"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDailyLogRecordCallable = exports.updateDailyLogRecordCallable = exports.createDailyLogRecordCallable = exports.listDailyLogsForCurrentUser = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const roleAccess_1 = require("./roleAccess");
const fieldWorkflowAccess_1 = require("./fieldWorkflowAccess");
const firestoreService_1 = require("./firestoreService");
const jobIdentity_1 = require("./jobIdentity");
const runtime_1 = require("./runtime");
const dailyLogTextFieldKeys = new Set([
    'weeklySchedule',
    'manpowerAssessment',
    'safetyConcerns',
    'ahaReviewed',
    'scheduleConcerns',
    'budgetConcerns',
    'deliveriesReceived',
    'deliveriesNeeded',
    'newWorkAuthorizations',
    'qcAssignedTo',
    'qcAreasInspected',
    'qcIssuesIdentified',
    'qcIssuesResolved',
    'notesCorrespondence',
    'actionItems',
]);
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function textOrNull(value) {
    const normalized = text(value);
    return normalized || null;
}
function normalizeRecipientList(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)));
}
function toStatus(value) {
    return value === 'submitted' ? 'submitted' : 'draft';
}
function sanitizeLineCount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return 0;
    return Math.max(0, Math.round(parsed));
}
function sanitizeAttachmentType(value) {
    return value === 'ptp' || value === 'qc' || value === 'other' ? value : 'photo';
}
function summarizeManpowerLines(lines) {
    const summary = lines
        .filter((line) => line.trade.length > 0 && line.count > 0)
        .map((line) => line.areas ? `${line.trade}: ${line.count} (${line.areas})` : `${line.trade}: ${line.count}`);
    return summary.join('; ');
}
function isBlankManpowerLine(line) {
    return !line.trade && !line.count && !line.areas;
}
function isBlankIndoorClimateReading(reading) {
    return !reading.area && !reading.high && !reading.low && !reading.humidity;
}
function expectedDailyLogThumbnailPath(path, dailyLogId) {
    const prefix = `daily-logs/${dailyLogId}/`;
    if (!path.startsWith(prefix))
        return '';
    const fileName = path.slice(prefix.length);
    if (!fileName || fileName.includes('/'))
        return '';
    return `${prefix}thumbnails/${fileName}`;
}
function sanitizePayload(payload, dailyLogId) {
    const manpowerLines = Array.isArray(payload?.manpowerLines)
        ? payload.manpowerLines
            .map((line) => ({
            trade: text(line?.trade),
            count: sanitizeLineCount(line?.count),
            areas: text(line?.areas),
            addedByUserId: textOrNull(line?.addedByUserId),
        }))
            .filter((line) => !isBlankManpowerLine(line))
        : [];
    const indoorClimateReadings = Array.isArray(payload?.indoorClimateReadings)
        ? payload.indoorClimateReadings
            .map((reading) => ({
            area: text(reading?.area),
            high: text(reading?.high),
            low: text(reading?.low),
            humidity: text(reading?.humidity),
        }))
            .filter((reading) => !isBlankIndoorClimateReading(reading))
        : [];
    const attachments = Array.isArray(payload?.attachments)
        ? payload.attachments
            .map((attachment) => {
            const thumbnailUrl = text(attachment?.thumbnailUrl);
            const path = text(attachment?.path);
            const expectedThumbnailPath = expectedDailyLogThumbnailPath(path, dailyLogId);
            const suppliedThumbnailPath = text(attachment?.thumbnailPath);
            const thumbnailPath = suppliedThumbnailPath && suppliedThumbnailPath === expectedThumbnailPath
                ? suppliedThumbnailPath
                : '';
            return {
                name: text(attachment?.name),
                url: text(attachment?.url),
                ...(thumbnailUrl && thumbnailPath ? { thumbnailUrl } : {}),
                path,
                ...(thumbnailPath ? { thumbnailPath } : {}),
                type: sanitizeAttachmentType(attachment?.type),
                description: text(attachment?.description),
                createdAt: attachment?.createdAt ?? null,
            };
        })
            .filter((attachment) => attachment.name &&
            attachment.url &&
            Boolean(expectedDailyLogThumbnailPath(attachment.path, dailyLogId)))
        : [];
    return {
        jobSiteNumbers: text(payload?.jobSiteNumbers),
        foremanOnSite: text(payload?.foremanOnSite),
        siteForemanAssistant: text(payload?.siteForemanAssistant),
        projectName: text(payload?.projectName),
        manpower: summarizeManpowerLines(manpowerLines),
        weeklySchedule: text(payload?.weeklySchedule),
        manpowerAssessment: text(payload?.manpowerAssessment),
        indoorClimateReadings,
        manpowerLines,
        safetyConcerns: text(payload?.safetyConcerns),
        ahaReviewed: text(payload?.ahaReviewed),
        scheduleConcerns: text(payload?.scheduleConcerns),
        budgetConcerns: text(payload?.budgetConcerns),
        deliveriesReceived: text(payload?.deliveriesReceived),
        deliveriesNeeded: text(payload?.deliveriesNeeded),
        newWorkAuthorizations: text(payload?.newWorkAuthorizations),
        qcInspection: text(payload?.qcAreasInspected),
        qcAssignedTo: text(payload?.qcAssignedTo),
        qcAreasInspected: text(payload?.qcAreasInspected),
        qcIssuesIdentified: text(payload?.qcIssuesIdentified),
        qcIssuesResolved: text(payload?.qcIssuesResolved),
        notesCorrespondence: text(payload?.notesCorrespondence),
        actionItems: text(payload?.actionItems),
        attachments,
    };
}
async function getAuthorizedUser(uid) {
    const userSnap = await runtime_1.db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'Your user profile was not found.');
    }
    const data = userSnap.data() || {};
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, data);
    if (!user.active) {
        throw new https_1.HttpsError('permission-denied', 'Your account is inactive.');
    }
    if (!(0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['admin', 'foreman', 'shop-foreman', 'project-manager'])) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to daily logs.');
    }
    return user;
}
async function getAuthorizedReader(uid) {
    const userSnap = await runtime_1.db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'Your user profile was not found.');
    }
    const data = userSnap.data() || {};
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, data);
    if (!user.active) {
        throw new https_1.HttpsError('permission-denied', 'Your account is inactive.');
    }
    if (!(0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['admin', 'foreman', 'shop-foreman', 'project-manager'])) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to daily logs.');
    }
    return user;
}
function canReadJobDailyLogs(user, jobId, jobDetails) {
    if (user.role === 'admin')
        return true;
    const assignedJobIds = new Set(user.assignedJobIds);
    if ((jobDetails?.assignedForemanIds ?? []).includes(user.uid)) {
        assignedJobIds.add(jobId);
    }
    if (assignedJobIds.has(jobId))
        return true;
    return user.role === 'shop-foreman' && (0, jobIdentity_1.isFunctionShopJob)(jobDetails);
}
function assertCanWriteJob(user, jobId, jobDetails, action) {
    if ((0, fieldWorkflowAccess_1.canWriteFieldWorkflowForJob)(user, jobId, jobDetails, action))
        return;
    throw new https_1.HttpsError('permission-denied', 'You are not assigned to this job.');
}
function userOwnsDraftDailyLog(user, log) {
    if (toStatus(log.status) !== 'draft')
        return false;
    return [log.foremanUserId, log.createdByUserId].some((value) => text(value) === user.uid);
}
function canWriteExistingDailyLog(user, jobId, jobDetails, action, log) {
    if ((0, fieldWorkflowAccess_1.canWriteFieldWorkflowForJob)(user, jobId, jobDetails, action))
        return true;
    // If the user was allowed to create the draft, do not strand them if job
    // assignment metadata is stale or shaped differently than expected.
    return ((action === 'edit-draft' || action === 'submit') &&
        (0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['foreman', 'shop-foreman', 'project-manager']) &&
        userOwnsDraftDailyLog(user, log));
}
function assertCanWriteExistingDailyLog(user, jobId, jobDetails, action, log) {
    if (canWriteExistingDailyLog(user, jobId, jobDetails, action, log))
        return;
    throw new https_1.HttpsError('permission-denied', 'You are not assigned to this job.');
}
async function getNextSequenceNumber(jobId, logDate) {
    const snapshot = await runtime_1.db
        .collection('dailyLogs')
        .where('jobId', '==', jobId)
        .where('logDate', '==', logDate)
        .get();
    const maxExisting = snapshot.docs.reduce((maxValue, entry) => {
        const parsed = Number(entry.data()?.sequenceNumber);
        const sequenceNumber = Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : 1;
        return Math.max(maxValue, sequenceNumber);
    }, 0);
    return maxExisting + 1;
}
async function getDailyLogDoc(dailyLogId) {
    const logRef = runtime_1.db.collection('dailyLogs').doc(dailyLogId);
    const logSnap = await logRef.get();
    if (!logSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Daily log not found.');
    }
    const log = logSnap.data() || {};
    const jobId = text(log.jobId);
    if (!jobId) {
        throw new https_1.HttpsError('failed-precondition', 'Daily log is missing its job assignment.');
    }
    return { logRef, logSnap, log, jobId };
}
function serializeFirestoreValue(value) {
    if (value === null || value === undefined)
        return value;
    if (typeof value?.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((entry) => serializeFirestoreValue(entry));
    }
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeFirestoreValue(entry)]));
    }
    return value;
}
function normalizeLogForResponse(doc) {
    return {
        id: doc.id,
        ...serializeFirestoreValue(doc.data() || {}),
    };
}
function getLogSortTimestamp(log) {
    const submitted = Date.parse(text(log?.submittedAt));
    if (Number.isFinite(submitted))
        return submitted;
    const updated = Date.parse(text(log?.updatedAt));
    if (Number.isFinite(updated))
        return updated;
    const created = Date.parse(text(log?.createdAt));
    return Number.isFinite(created) ? created : 0;
}
function sortLogResponses(logs) {
    const rank = (status) => (text(status) === 'submitted' ? 0 : 1);
    return logs
        .slice()
        .sort((left, right) => rank(left.status) - rank(right.status) ||
        getLogSortTimestamp(right) - getLogSortTimestamp(left) ||
        Number(right.sequenceNumber || 0) - Number(left.sequenceNumber || 0) ||
        text(right.id).localeCompare(text(left.id)));
}
exports.listDailyLogsForCurrentUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const jobId = text(request.data?.jobId);
    const logDate = text(request.data?.logDate);
    if (!jobId || jobId.includes('/')) {
        throw new https_1.HttpsError('invalid-argument', 'jobId is required.');
    }
    if (!logDate) {
        throw new https_1.HttpsError('invalid-argument', 'logDate is required.');
    }
    const user = await getAuthorizedReader(request.auth.uid);
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    if (!canReadJobDailyLogs(user, jobId, jobDetails)) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to this job daily log workspace.');
    }
    const snapshot = await runtime_1.db
        .collection('dailyLogs')
        .where('jobId', '==', jobId)
        .where('logDate', '==', logDate)
        .get();
    return {
        logs: sortLogResponses(snapshot.docs.map(normalizeLogForResponse)),
    };
});
exports.createDailyLogRecordCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const jobId = text(request.data?.jobId);
    const logDate = text(request.data?.logDate);
    if (!jobId)
        throw new https_1.HttpsError('invalid-argument', 'jobId is required');
    if (!logDate)
        throw new https_1.HttpsError('invalid-argument', 'logDate is required');
    const user = await getAuthorizedUser(request.auth.uid);
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    assertCanWriteJob(user, jobId, jobDetails, 'create');
    const sequenceNumber = await getNextSequenceNumber(jobId, logDate);
    const created = runtime_1.db.collection('dailyLogs').doc();
    await created.set({
        jobId,
        jobCode: textOrNull(request.data?.jobCode),
        jobName: textOrNull(request.data?.jobName),
        logDate,
        sequenceNumber,
        status: 'draft',
        foremanUserId: textOrNull(request.data?.foremanUserId ?? request.auth.uid),
        foremanName: textOrNull(request.data?.foremanName ?? user.displayName),
        createdByUserId: request.auth.uid,
        updatedByUserId: request.auth.uid,
        submittedByUserId: null,
        additionalRecipients: normalizeRecipientList(request.data?.additionalRecipients),
        payload: sanitizePayload(request.data?.payload, created.id),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        submittedAt: null,
    });
    return { id: created.id };
});
exports.updateDailyLogRecordCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const dailyLogId = text(request.data?.dailyLogId);
    if (!dailyLogId)
        throw new https_1.HttpsError('invalid-argument', 'dailyLogId is required');
    const { logRef, log, jobId } = await getDailyLogDoc(dailyLogId);
    const user = await getAuthorizedUser(request.auth.uid);
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    const writeAction = 'status' in request.data && toStatus(request.data?.status) === 'submitted'
        ? 'submit'
        : 'edit-draft';
    assertCanWriteExistingDailyLog(user, jobId, jobDetails, writeAction, log);
    if (toStatus(log.status) === 'submitted' && user.role !== 'admin') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted daily logs cannot be changed by field users.');
    }
    const payload = {
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedByUserId: request.auth.uid,
    };
    if ('payload' in request.data && request.data?.payload) {
        payload.payload = sanitizePayload(request.data.payload, dailyLogId);
    }
    if ('payloadFields' in request.data && request.data?.payloadFields) {
        if (typeof request.data.payloadFields !== 'object' ||
            Array.isArray(request.data.payloadFields)) {
            throw new https_1.HttpsError('invalid-argument', 'payloadFields must be an object.');
        }
        for (const [fieldKey, fieldValue] of Object.entries(request.data.payloadFields)) {
            if (!dailyLogTextFieldKeys.has(fieldKey)) {
                throw new https_1.HttpsError('invalid-argument', `Unsupported daily log field: ${fieldKey}`);
            }
            payload[`payload.${fieldKey}`] = text(fieldValue);
            if (fieldKey === 'qcAreasInspected') {
                payload['payload.qcInspection'] = text(fieldValue);
            }
        }
    }
    if ('additionalRecipients' in request.data) {
        payload.additionalRecipients = normalizeRecipientList(request.data?.additionalRecipients);
    }
    if ('status' in request.data && request.data?.status) {
        const status = toStatus(request.data.status);
        payload.status = status;
        if (status === 'submitted') {
            payload.submittedAt = firestore_1.FieldValue.serverTimestamp();
            payload.submittedByUserId = textOrNull(request.data?.actor?.userId ?? request.auth.uid);
            payload.submittedByName = textOrNull(request.data?.actor?.displayName ?? user.displayName);
        }
    }
    await logRef.update(payload);
    return { success: true };
});
exports.deleteDailyLogRecordCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const dailyLogId = text(request.data?.dailyLogId);
    if (!dailyLogId)
        throw new https_1.HttpsError('invalid-argument', 'dailyLogId is required');
    const { logRef, log, jobId } = await getDailyLogDoc(dailyLogId);
    const user = await getAuthorizedUser(request.auth.uid);
    const jobDetails = await (0, firestoreService_1.getJobDetails)(jobId);
    assertCanWriteExistingDailyLog(user, jobId, jobDetails, 'edit-draft', log);
    if (toStatus(log.status) === 'submitted' && user.role !== 'admin') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted daily logs cannot be deleted by field users.');
    }
    await logRef.delete();
    return { success: true };
});
//# sourceMappingURL=dailyLogRecordFunctions.js.map