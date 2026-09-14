"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicDailyLogGallery = void 0;
exports.isTrustedStorageObjectUrl = isTrustedStorageObjectUrl;
exports.buildPublicDailyLogGalleryPayload = buildPublicDailyLogGalleryPayload;
exports.ensureDailyLogGalleryShare = ensureDailyLogGalleryShare;
exports.loadPublicDailyLogGallery = loadPublicDailyLogGallery;
exports.loadLegacyPublicDailyLogGallery = loadLegacyPublicDailyLogGallery;
const firestore_1 = require("firebase-admin/firestore");
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const firestoreService_1 = require("./firestoreService");
const runtime_1 = require("./runtime");
const dailyLogEmailPhotos_1 = require("./dailyLogEmailPhotos");
const GALLERY_SHARES_COLLECTION = 'dailyLogGalleryShares';
const GALLERY_SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const FIRESTORE_DOCUMENT_ID_PATTERN = /^[^/]{1,128}$/;
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeSequenceNumber(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1)
        return 1;
    return Math.round(parsed);
}
function normalizeAttachmentType(value) {
    return value === 'ptp' || value === 'qc' || value === 'other' ? value : 'photo';
}
function isTrustedStorageObjectUrl(value, objectPath, bucketName) {
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'https:')
            return false;
        if (parsed.hostname === 'firebasestorage.googleapis.com') {
            const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(parsed.pathname);
            if (!match)
                return false;
            return (decodeURIComponent(match[1] || '') === bucketName &&
                decodeURIComponent(match[2] || '') === objectPath);
        }
        if (parsed.hostname === 'storage.googleapis.com') {
            const expectedPath = `/${encodeURIComponent(bucketName)}/${objectPath
                .split('/')
                .map((part) => encodeURIComponent(part))
                .join('/')}`;
            return parsed.pathname === expectedPath;
        }
        return false;
    }
    catch {
        return false;
    }
}
function normalizeAttachment(value, dailyLogId, bucketName) {
    if (!value || typeof value !== 'object')
        return null;
    const record = value;
    const name = text(record.name) || 'Daily log photo';
    const url = text(record.url);
    const thumbnailUrl = text(record.thumbnailUrl);
    const path = text(record.path);
    const expectedThumbnailPath = (0, dailyLogEmailPhotos_1.getExpectedDailyLogThumbnailPath)(path, dailyLogId);
    const thumbnailPath = text(record.thumbnailPath);
    // Gallery images are served from Firebase download URLs. Reject non-web
    // schemes so a stored value can never become an executable public link.
    if (!expectedThumbnailPath || !isTrustedStorageObjectUrl(url, path, bucketName)) {
        return null;
    }
    const hasTrustedThumbnail = (!thumbnailPath || thumbnailPath === expectedThumbnailPath) &&
        isTrustedStorageObjectUrl(thumbnailUrl, expectedThumbnailPath, bucketName);
    return {
        name,
        url,
        ...(hasTrustedThumbnail ? { thumbnailUrl } : {}),
        type: normalizeAttachmentType(record.type),
        description: text(record.description),
    };
}
function serializeDate(value) {
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
}
function getDailyLogAttachments(log, dailyLogId, bucketName) {
    const payload = log?.payload && typeof log.payload === 'object' ? log.payload : log;
    const attachments = Array.isArray(payload?.attachments)
        ? payload.attachments
        : Array.isArray(log?.attachments)
            ? log.attachments
            : [];
    return attachments
        .map((attachment) => normalizeAttachment(attachment, dailyLogId, bucketName))
        .filter((attachment) => attachment !== null);
}
function buildPublicDailyLogGalleryPayload(jobDetails, log, dailyLogId = text(log?.id), bucketName = runtime_1.storageBucket.name) {
    const payload = log?.payload && typeof log.payload === 'object' ? log.payload : log;
    return {
        jobName: text(jobDetails?.name) || text(log?.jobName) || text(payload?.projectName) || 'Phase 2 Job',
        jobCode: text(jobDetails?.number) || text(jobDetails?.code) || text(log?.jobCode),
        logDate: text(log?.logDate),
        sequenceNumber: normalizeSequenceNumber(log?.sequenceNumber),
        foremanName: text(payload?.foremanOnSite) ||
            text(log?.foremanName) ||
            text(log?.submittedByName) ||
            'Phase 2 Foreman',
        submittedAt: serializeDate(log?.submittedAt),
        attachments: getDailyLogAttachments(log, dailyLogId, bucketName),
    };
}
async function getDailyLogReference(jobId, dailyLogId) {
    const directReference = runtime_1.db.collection('dailyLogs').doc(dailyLogId);
    const directSnapshot = await directReference.get();
    if (directSnapshot.exists && text(directSnapshot.data()?.jobId) === jobId) {
        return directReference;
    }
    const nestedReference = runtime_1.db.collection('jobs').doc(jobId).collection('dailyLogs').doc(dailyLogId);
    const nestedSnapshot = await nestedReference.get();
    if (nestedSnapshot.exists)
        return nestedReference;
    throw new https_1.HttpsError('not-found', 'Daily log not found.');
}
async function ensureDailyLogGalleryShare({ dailyLogId, jobId, }) {
    const normalizedDailyLogId = text(dailyLogId);
    const normalizedJobId = text(jobId);
    if (!normalizedDailyLogId || !normalizedJobId) {
        throw new https_1.HttpsError('invalid-argument', 'Daily log and job are required for the gallery.');
    }
    const logReference = await getDailyLogReference(normalizedJobId, normalizedDailyLogId);
    let shareId = '';
    await runtime_1.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(logReference);
        if (!snapshot.exists || text(snapshot.data()?.status) !== 'submitted') {
            throw new https_1.HttpsError('failed-precondition', 'Only submitted daily logs can be shared.');
        }
        const existingShareId = text(snapshot.data()?.galleryShareId);
        shareId = GALLERY_SHARE_ID_PATTERN.test(existingShareId)
            ? existingShareId
            : (0, node_crypto_1.randomBytes)(32).toString('base64url');
        const shareReference = runtime_1.db.collection(GALLERY_SHARES_COLLECTION).doc(shareId);
        transaction.set(logReference, {
            galleryShareId: shareId,
            galleryPublishedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(shareReference, {
            dailyLogPath: logReference.path,
            jobId: normalizedJobId,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    return shareId;
}
function isAllowedDailyLogPath(value) {
    return /^dailyLogs\/[^/]+$/.test(value) || /^jobs\/[^/]+\/dailyLogs\/[^/]+$/.test(value);
}
function dailyLogBelongsToSharedJob(dailyLogPath, log, jobId) {
    const storedJobId = text(log?.jobId);
    if (storedJobId)
        return storedJobId === jobId;
    // Legacy nested daily logs did not always duplicate the job ID in the document.
    // In that layout the parent document path remains the authoritative assignment.
    const nestedPathMatch = /^jobs\/([^/]+)\/dailyLogs\/[^/]+$/.exec(dailyLogPath);
    return nestedPathMatch?.[1] === jobId;
}
async function loadPublicDailyLogGallery(shareId) {
    const normalizedShareId = text(shareId);
    if (!GALLERY_SHARE_ID_PATTERN.test(normalizedShareId)) {
        throw new https_1.HttpsError('not-found', 'Photo gallery not found.');
    }
    const shareSnapshot = await runtime_1.db.collection(GALLERY_SHARES_COLLECTION).doc(normalizedShareId).get();
    const share = shareSnapshot.data() || {};
    const dailyLogPath = text(share.dailyLogPath);
    const jobId = text(share.jobId);
    if (!shareSnapshot.exists || !jobId || !isAllowedDailyLogPath(dailyLogPath)) {
        throw new https_1.HttpsError('not-found', 'Photo gallery not found.');
    }
    const logSnapshot = await runtime_1.db.doc(dailyLogPath).get();
    const log = logSnapshot.data() || {};
    if (!logSnapshot.exists ||
        text(log.status) !== 'submitted' ||
        !dailyLogBelongsToSharedJob(dailyLogPath, log, jobId)) {
        throw new https_1.HttpsError('not-found', 'Photo gallery not found.');
    }
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    return buildPublicDailyLogGalleryPayload(jobDetails, log, logSnapshot.id);
}
async function loadLegacyPublicDailyLogGallery(jobId, dailyLogId) {
    const normalizedJobId = text(jobId);
    const normalizedDailyLogId = text(dailyLogId);
    if (!FIRESTORE_DOCUMENT_ID_PATTERN.test(normalizedJobId) ||
        !FIRESTORE_DOCUMENT_ID_PATTERN.test(normalizedDailyLogId)) {
        throw new https_1.HttpsError('not-found', 'Photo gallery not found.');
    }
    const logReference = await getDailyLogReference(normalizedJobId, normalizedDailyLogId);
    const logSnapshot = await logReference.get();
    const log = logSnapshot.data() || {};
    if (!logSnapshot.exists ||
        text(log.status) !== 'submitted' ||
        !dailyLogBelongsToSharedJob(logReference.path, log, normalizedJobId)) {
        throw new https_1.HttpsError('not-found', 'Photo gallery not found.');
    }
    const jobDetails = await (0, firestoreService_1.getJobDetails)(normalizedJobId);
    return buildPublicDailyLogGalleryPayload(jobDetails, log, logSnapshot.id);
}
exports.getPublicDailyLogGallery = (0, https_1.onCall)(async (request) => {
    const shareId = text(request.data?.shareId);
    if (shareId)
        return loadPublicDailyLogGallery(shareId);
    throw new https_1.HttpsError('failed-precondition', 'This older photo link is no longer available. Ask the sender for a new gallery link.');
});
//# sourceMappingURL=dailyLogGalleryFunctions.js.map