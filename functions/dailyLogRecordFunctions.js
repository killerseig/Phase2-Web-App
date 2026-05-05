"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDailyLogRecordCallable = exports.updateDailyLogRecordCallable = exports.createDailyLogRecordCallable = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
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
function normalizeRole(value) {
    const role = text(value).toLowerCase();
    if (role === 'admin' || role === 'controller' || role === 'foreman')
        return role;
    return 'none';
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
        .map((line) => (line.areas ? `${line.trade}: ${line.count} (${line.areas})` : `${line.trade}: ${line.count}`));
    return summary.join('; ');
}
function sanitizePayload(payload) {
    const manpowerLines = Array.isArray(payload?.manpowerLines)
        ? payload.manpowerLines.map((line) => ({
            trade: text(line?.trade),
            count: sanitizeLineCount(line?.count),
            areas: text(line?.areas),
            addedByUserId: textOrNull(line?.addedByUserId),
        }))
        : [];
    const indoorClimateReadings = Array.isArray(payload?.indoorClimateReadings)
        ? payload.indoorClimateReadings.map((reading) => ({
            area: text(reading?.area),
            high: text(reading?.high),
            low: text(reading?.low),
            humidity: text(reading?.humidity),
        }))
        : [];
    const attachments = Array.isArray(payload?.attachments)
        ? payload.attachments
            .map((attachment) => ({
            name: text(attachment?.name),
            url: text(attachment?.url),
            path: text(attachment?.path),
            type: sanitizeAttachmentType(attachment?.type),
            description: text(attachment?.description),
            createdAt: attachment?.createdAt ?? null,
        }))
            .filter((attachment) => attachment.name && attachment.url && attachment.path)
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
    const role = normalizeRole(data.role);
    const active = data.active === true;
    const assignedJobIds = Array.isArray(data.assignedJobIds)
        ? data.assignedJobIds
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    const displayName = [text(data.firstName), text(data.lastName)].filter(Boolean).join(' ') || textOrNull(data.email);
    if (!active) {
        throw new https_1.HttpsError('permission-denied', 'Your account is inactive.');
    }
    if (!['admin', 'controller', 'foreman'].includes(role)) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to daily logs.');
    }
    return {
        uid,
        role,
        active,
        assignedJobIds,
        displayName,
    };
}
function assertCanWriteJob(user, jobId) {
    if (user.role === 'admin' || user.role === 'controller')
        return;
    if (user.role === 'foreman' && user.assignedJobIds.includes(jobId))
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
    assertCanWriteJob(user, jobId);
    const sequenceNumber = await getNextSequenceNumber(jobId, logDate);
    const created = await runtime_1.db.collection('dailyLogs').add({
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
        payload: sanitizePayload(request.data?.payload),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
    assertCanWriteJob(user, jobId);
    if (toStatus(log.status) === 'submitted' && user.role === 'foreman') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted daily logs cannot be changed by foremen.');
    }
    const payload = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: request.auth.uid,
    };
    if ('payload' in request.data && request.data?.payload) {
        payload.payload = sanitizePayload(request.data.payload);
    }
    if ('additionalRecipients' in request.data) {
        payload.additionalRecipients = normalizeRecipientList(request.data?.additionalRecipients);
    }
    if ('status' in request.data && request.data?.status) {
        const status = toStatus(request.data.status);
        payload.status = status;
        if (status === 'submitted') {
            payload.submittedAt = admin.firestore.FieldValue.serverTimestamp();
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
    assertCanWriteJob(user, jobId);
    if (toStatus(log.status) === 'submitted' && user.role === 'foreman') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted daily logs cannot be deleted by foremen.');
    }
    await logRef.delete();
    return { success: true };
});
//# sourceMappingURL=dailyLogRecordFunctions.js.map