"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES = exports.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES = exports.DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES = exports.DAILY_LOG_EMAIL_PHOTO_PREVIEW_LIMIT = void 0;
exports.normalizeDailyLogPhotoSection = normalizeDailyLogPhotoSection;
exports.getExpectedDailyLogThumbnailPath = getExpectedDailyLogThumbnailPath;
exports.selectDailyLogEmailPhotoCandidates = selectDailyLogEmailPhotoCandidates;
exports.prepareDailyLogInlinePhotos = prepareDailyLogInlinePhotos;
const sharp_1 = __importDefault(require("sharp"));
const runtime_1 = require("./runtime");
exports.DAILY_LOG_EMAIL_PHOTO_PREVIEW_LIMIT = 6;
exports.DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES = 96 * 1024;
exports.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES = 128 * 1024;
exports.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const DAILY_LOG_GALLERY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const DAILY_LOG_STORED_THUMBNAIL_MAX_BYTES = 300 * 1024;
const MIN_REMAINING_INLINE_IMAGE_BYTES = 16 * 1024;
const JPEG_ATTEMPTS = [
    { maxDimension: 480, quality: 68 },
    { maxDimension: 400, quality: 60 },
    { maxDimension: 320, quality: 52 },
    { maxDimension: 240, quality: 44 },
    { maxDimension: 200, quality: 38 },
    { maxDimension: 160, quality: 32 },
];
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function objectRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function normalizeDailyLogPhotoSection(value) {
    if (value === 'ptp' || value === 'qc')
        return value;
    return 'photo';
}
function getExpectedDailyLogThumbnailPath(originalPath, dailyLogId) {
    const normalizedDailyLogId = text(dailyLogId);
    if (!normalizedDailyLogId || normalizedDailyLogId.includes('/'))
        return '';
    const prefix = `daily-logs/${normalizedDailyLogId}/`;
    if (!originalPath.startsWith(prefix))
        return '';
    const fileName = originalPath.slice(prefix.length);
    if (!fileName || fileName.includes('/') || fileName.length > 512)
        return '';
    return `${prefix}thumbnails/${fileName}`;
}
function selectDailyLogEmailPhotoCandidates(dailyLogId, dailyLog) {
    const root = objectRecord(dailyLog);
    const payload = objectRecord(root.payload);
    const rawAttachments = Array.isArray(payload.attachments)
        ? payload.attachments
        : Array.isArray(root.attachments)
            ? root.attachments
            : [];
    const records = rawAttachments.map(objectRecord);
    const sections = ['photo', 'ptp', 'qc'];
    return sections.flatMap((section) => records
        .filter((record) => normalizeDailyLogPhotoSection(record.type) === section)
        .slice(0, exports.DAILY_LOG_EMAIL_PHOTO_PREVIEW_LIMIT)
        .flatMap((record, index) => {
        const originalPath = text(record.path);
        const expectedThumbnailPath = getExpectedDailyLogThumbnailPath(originalPath, dailyLogId);
        if (!expectedThumbnailPath)
            return [];
        const suppliedThumbnailPath = text(record.thumbnailPath);
        return [
            {
                section,
                position: index + 1,
                originalPath,
                thumbnailPath: suppliedThumbnailPath === expectedThumbnailPath
                    ? suppliedThumbnailPath
                    : expectedThumbnailPath,
            },
        ];
    }));
}
function isMissingStorageObject(error) {
    if (!error || typeof error !== 'object')
        return false;
    const record = error;
    const code = String(record.code ?? '');
    return code === '404' || code === 'storage/object-not-found' || code === 'object-not-found';
}
async function downloadObject(path, maxBytes) {
    const file = runtime_1.storageBucket.file(path);
    const [metadata] = await file.getMetadata();
    const declaredSize = Number(metadata.size);
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
        throw new Error('Stored Daily Log photo exceeds the email processing limit.');
    }
    const [contents] = await file.download();
    if (contents.length > maxBytes) {
        throw new Error('Stored Daily Log photo exceeds the email processing limit.');
    }
    return contents;
}
async function createBoundedJpeg(source, maxBytes) {
    const hardLimit = Math.min(exports.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES, maxBytes);
    if (hardLimit < MIN_REMAINING_INLINE_IMAGE_BYTES)
        return null;
    const targetBytes = Math.min(exports.DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES, hardLimit);
    let smallest = null;
    for (const attempt of JPEG_ATTEMPTS) {
        const output = await (0, sharp_1.default)(source, {
            failOn: 'warning',
            limitInputPixels: 80000000,
            sequentialRead: true,
        })
            .rotate()
            .flatten({ background: '#ffffff' })
            .resize({
            width: attempt.maxDimension,
            height: attempt.maxDimension,
            fit: 'inside',
            withoutEnlargement: true,
        })
            .jpeg({ quality: attempt.quality, mozjpeg: true })
            .toBuffer();
        if (!smallest || output.length < smallest.length)
            smallest = output;
        if (output.length <= targetBytes)
            return output;
    }
    return smallest && smallest.length <= hardLimit ? smallest : null;
}
const defaultDependencies = {
    downloadObject,
    createBoundedJpeg,
};
async function prepareDailyLogInlinePhotos(dailyLogId, dailyLog, dependencies = defaultDependencies) {
    const candidates = selectDailyLogEmailPhotoCandidates(dailyLogId, dailyLog);
    const previews = [];
    const attachments = [];
    let totalBytes = 0;
    for (const candidate of candidates) {
        const remainingBytes = exports.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES - totalBytes;
        if (remainingBytes < MIN_REMAINING_INLINE_IMAGE_BYTES)
            break;
        let source = null;
        try {
            source = await dependencies.downloadObject(candidate.thumbnailPath, DAILY_LOG_STORED_THUMBNAIL_MAX_BYTES);
        }
        catch (error) {
            // A missing legacy derivative is expected. Other thumbnail failures also fall back to the
            // trusted original so a transient derivative issue does not remove the photo from email.
            if (!isMissingStorageObject(error))
                source = null;
        }
        if (!source) {
            try {
                source = await dependencies.downloadObject(candidate.originalPath, DAILY_LOG_GALLERY_IMAGE_MAX_BYTES);
            }
            catch {
                continue;
            }
        }
        let jpeg = null;
        try {
            jpeg = await dependencies.createBoundedJpeg(source, Math.min(exports.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES, remainingBytes));
        }
        catch {
            continue;
        }
        if (!jpeg || jpeg.length > remainingBytes)
            continue;
        const contentId = `daily-log-${candidate.section}-${candidate.position}@phase2.local`;
        totalBytes += jpeg.length;
        previews.push({
            section: candidate.section,
            position: candidate.position,
            contentId,
        });
        attachments.push({
            name: `daily-log-${candidate.section}-${candidate.position}.jpg`,
            contentType: 'image/jpeg',
            contentBytes: jpeg.toString('base64'),
            contentId,
            isInline: true,
        });
    }
    return { previews, attachments };
}
//# sourceMappingURL=dailyLogEmailPhotos.js.map