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
exports.updateJobRecordCallable = exports.createJobRecordCallable = exports.getVisibleJobForCurrentUser = exports.listVisibleJobsForCurrentUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const constants_1 = require("./constants");
const jobIdentity_1 = require("./jobIdentity");
const roleAccess_1 = require("./roleAccess");
const targetJobAccess_1 = require("./targetJobAccess");
const targetRoleCapabilities_1 = require("./targetRoleCapabilities");
const runtime_1 = require("./runtime");
function text(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    return '';
}
function textOrNull(value) {
    const normalized = text(value);
    return normalized || null;
}
function numberOrNull(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function normalizeIdList(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !entry.includes('/'))));
}
function normalizeRecipientList(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)));
}
function normalizeNotificationRecipients(value, legacyDailyLogs) {
    const data = typeof value === 'object' && value !== null ? value : {};
    return {
        dailyLogs: normalizeRecipientList(data.dailyLogs ?? legacyDailyLogs),
        timecards: normalizeRecipientList(data.timecards),
        shopOrders: normalizeRecipientList(data.shopOrders),
    };
}
function normalizeJobInput(value) {
    const data = typeof value === 'object' && value !== null ? value : {};
    return {
        name: text(data.name),
        code: textOrNull(data.code),
        type: text(data.type) || 'general',
        gc: textOrNull(data.gc),
        jobAddress: textOrNull(data.jobAddress),
        startDate: textOrNull(data.startDate),
        finishDate: textOrNull(data.finishDate),
        productionBurden: numberOrNull(data.productionBurden),
        assignedForemanIds: normalizeIdList(data.assignedForemanIds),
        notificationRecipients: normalizeNotificationRecipients(data.notificationRecipients, data.dailyLogRecipients),
        active: data.active !== false,
    };
}
function normalizeJob(id, data) {
    const code = textOrNull(data.code) ?? textOrNull(data.number);
    return {
        id,
        name: text(data.name) || 'Untitled Job',
        code,
        gc: textOrNull(data.gc),
        type: text(data.type) || 'general',
        projectManager: textOrNull(data.projectManager),
        foreman: textOrNull(data.foreman),
        jobAddress: textOrNull(data.jobAddress),
        startDate: textOrNull(data.startDate),
        finishDate: textOrNull(data.finishDate),
        productionBurden: numberOrNull(data.productionBurden),
        active: data.active !== false,
        assignedForemanIds: normalizeIdList(data.assignedForemanIds),
        timecardStatus: textOrNull(data.timecardStatus),
        timecardPeriodEndDate: textOrNull(data.timecardPeriodEndDate),
        notificationRecipients: normalizeNotificationRecipients(data.notificationRecipients, data.dailyLogRecipients),
        adminDailyLogRecipients: normalizeRecipientList(data.adminDailyLogRecipients),
        dailyLogRecipients: normalizeRecipientList(data.dailyLogRecipients),
    };
}
function sortJobs(jobs) {
    return jobs.slice().sort((left, right) => {
        const leftActive = left.active !== false ? 0 : 1;
        const rightActive = right.active !== false ? 0 : 1;
        if (leftActive !== rightActive)
            return leftActive - rightActive;
        const codeComparison = (left.code ?? '').localeCompare(right.code ?? '', undefined, { numeric: true });
        if (codeComparison !== 0)
            return codeComparison;
        return left.name.localeCompare(right.name);
    });
}
async function getAuthorizedUser(uid) {
    const userSnap = await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(uid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'Your user profile was not found.');
    }
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, userSnap.data() || {});
    if (!user.active) {
        throw new https_1.HttpsError('permission-denied', 'Your account is inactive.');
    }
    if (!(0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['admin', 'payroll', 'shop-foreman', 'project-manager', 'foreman'])) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to jobs.');
    }
    return user;
}
function buildAccessAssignedJobIds(user, job) {
    const assignedJobIds = new Set(user.assignedJobIds);
    if (job.assignedForemanIds.includes(user.uid)) {
        assignedJobIds.add(job.id);
    }
    return Array.from(assignedJobIds);
}
function canSeeJob(user, job) {
    return (0, targetJobAccess_1.targetFunctionRoleCanSeeJobListEntry)({
        assignedJobIds: buildAccessAssignedJobIds(user, job),
        isShopJob: (0, jobIdentity_1.isFunctionShopJob)({ name: job.name, number: job.code }),
        jobId: job.id,
        role: user.role,
    });
}
function canOpenJob(user, job) {
    return (0, targetJobAccess_1.targetFunctionRoleCanOpenJobDashboard)({
        assignedJobIds: buildAccessAssignedJobIds(user, job),
        isShopJob: (0, jobIdentity_1.isFunctionShopJob)({ name: job.name, number: job.code }),
        jobId: job.id,
        role: user.role,
    }) || canSeeJob(user, job);
}
function canEditJob(user, job) {
    return (0, targetJobAccess_1.targetFunctionRoleCanEditJobSetup)({
        assignedJobIds: buildAccessAssignedJobIds(user, job),
        isShopJob: (0, jobIdentity_1.isFunctionShopJob)({ name: job.name, number: job.code }),
        jobId: job.id,
        role: user.role,
    });
}
async function syncJobForemanAssignments(jobId, previousAssignedForemanIds, nextAssignedForemanIds) {
    const effectiveAssignedForemanIds = normalizeIdList(nextAssignedForemanIds);
    const changedForemanIds = Array.from(new Set([...previousAssignedForemanIds, ...effectiveAssignedForemanIds]));
    const batch = runtime_1.db.batch();
    for (const foremanId of changedForemanIds) {
        const userRef = runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(foremanId);
        const userSnapshot = await userRef.get();
        if (!userSnapshot.exists)
            continue;
        const currentAssignedJobIds = normalizeIdList(userSnapshot.data()?.assignedJobIds);
        const nextAssignedJobIds = new Set(currentAssignedJobIds);
        if (effectiveAssignedForemanIds.includes(foremanId)) {
            nextAssignedJobIds.add(jobId);
        }
        else {
            nextAssignedJobIds.delete(jobId);
        }
        batch.update(userRef, { assignedJobIds: Array.from(nextAssignedJobIds) });
    }
    return batch;
}
async function filterAssignableUserIds(userIds) {
    const assignableUserIds = [];
    await Promise.all(normalizeIdList(userIds).map(async (userId) => {
        const snapshot = await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(userId).get();
        if (!snapshot.exists)
            return;
        const user = (0, roleAccess_1.buildCurrentFunctionUser)(snapshot.id, snapshot.data() || {});
        if (!user.active || !(0, targetRoleCapabilities_1.targetFunctionRoleCanBeAssignedJobs)(user.role))
            return;
        assignableUserIds.push(userId);
    }));
    return normalizeIdList(assignableUserIds);
}
async function readAssignedJobsById(assignedJobIds) {
    const jobsById = new Map();
    await Promise.all(assignedJobIds.map(async (jobId) => {
        const snapshot = await runtime_1.db.collection(constants_1.COLLECTIONS.JOBS).doc(jobId).get();
        if (!snapshot.exists)
            return;
        jobsById.set(snapshot.id, normalizeJob(snapshot.id, snapshot.data() || {}));
    }));
    return jobsById;
}
async function readJobsAssignedOnJobRecord(uid) {
    const snapshot = await runtime_1.db
        .collection(constants_1.COLLECTIONS.JOBS)
        .where('assignedForemanIds', 'array-contains', uid)
        .get();
    return snapshot.docs.map((entry) => normalizeJob(entry.id, entry.data() || {}));
}
exports.listVisibleJobsForCurrentUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const user = await getAuthorizedUser(request.auth.uid);
    const jobsById = new Map();
    if ((0, targetJobAccess_1.targetFunctionRoleCanSeeJobListEntry)({
        assignedJobIds: user.assignedJobIds,
        isShopJob: false,
        jobId: '__all__',
        role: user.role,
    })) {
        const snapshot = await runtime_1.db.collection(constants_1.COLLECTIONS.JOBS).get();
        snapshot.docs.forEach((entry) => {
            jobsById.set(entry.id, normalizeJob(entry.id, entry.data() || {}));
        });
    }
    else {
        const assignedByUserProfile = await readAssignedJobsById(normalizeIdList(user.assignedJobIds));
        assignedByUserProfile.forEach((job, jobId) => jobsById.set(jobId, job));
        const assignedOnJobRecords = await readJobsAssignedOnJobRecord(user.uid);
        assignedOnJobRecords.forEach((job) => jobsById.set(job.id, job));
    }
    return {
        jobs: sortJobs(Array.from(jobsById.values()).filter((job) => canSeeJob(user, job))),
    };
});
exports.getVisibleJobForCurrentUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const jobId = text(request.data?.jobId);
    if (!jobId || jobId.includes('/')) {
        throw new https_1.HttpsError('invalid-argument', 'jobId is required.');
    }
    const user = await getAuthorizedUser(request.auth.uid);
    const snapshot = await runtime_1.db.collection(constants_1.COLLECTIONS.JOBS).doc(jobId).get();
    if (!snapshot.exists) {
        return { job: null };
    }
    const job = normalizeJob(snapshot.id, snapshot.data() || {});
    if (!canOpenJob(user, job)) {
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to this job.');
    }
    return { job };
});
exports.createJobRecordCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const user = await getAuthorizedUser(request.auth.uid);
    if (!(0, targetJobAccess_1.targetFunctionRoleCanCreateJobs)(user.role)) {
        throw new https_1.HttpsError('permission-denied', 'Your account cannot create jobs.');
    }
    const input = normalizeJobInput(request.data?.job);
    if (!input.name) {
        throw new https_1.HttpsError('invalid-argument', 'Job name is required.');
    }
    const isAdmin = (0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['admin']);
    const nextActive = isAdmin ? input.active : true;
    const jobRef = runtime_1.db.collection(constants_1.COLLECTIONS.JOBS).doc();
    const assignedForemanIds = await filterAssignableUserIds(input.assignedForemanIds);
    const assignmentBatch = await syncJobForemanAssignments(jobRef.id, [], assignedForemanIds);
    assignmentBatch.set(jobRef, {
        name: input.name,
        code: input.code,
        type: input.type,
        gc: input.gc,
        jobAddress: input.jobAddress,
        startDate: input.startDate,
        finishDate: input.finishDate,
        productionBurden: input.productionBurden,
        active: nextActive,
        archivedAt: nextActive ? null : admin.firestore.FieldValue.serverTimestamp(),
        assignedForemanIds,
        timecardStatus: 'pending',
        timecardSubmittedAt: null,
        timecardPeriodEndDate: null,
        timecardLastSentWeekEnding: null,
        notificationRecipients: input.notificationRecipients,
        adminDailyLogRecipients: [],
        dailyLogRecipients: input.notificationRecipients.dailyLogs,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await assignmentBatch.commit();
    return { id: jobRef.id };
});
exports.updateJobRecordCallable = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const jobId = text(request.data?.jobId);
    if (!jobId || jobId.includes('/')) {
        throw new https_1.HttpsError('invalid-argument', 'jobId is required.');
    }
    const user = await getAuthorizedUser(request.auth.uid);
    const jobRef = runtime_1.db.collection(constants_1.COLLECTIONS.JOBS).doc(jobId);
    const snapshot = await jobRef.get();
    if (!snapshot.exists) {
        throw new https_1.HttpsError('not-found', 'Job not found.');
    }
    const existingJob = normalizeJob(snapshot.id, snapshot.data() || {});
    if (!canEditJob(user, existingJob)) {
        throw new https_1.HttpsError('permission-denied', 'Your account cannot edit this job.');
    }
    const input = normalizeJobInput(request.data?.job);
    if (!input.name) {
        throw new https_1.HttpsError('invalid-argument', 'Job name is required.');
    }
    const isAdmin = (0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['admin']);
    const nextActive = isAdmin ? input.active : existingJob.active;
    const assignedForemanIds = await filterAssignableUserIds(input.assignedForemanIds);
    const assignmentBatch = await syncJobForemanAssignments(jobId, existingJob.assignedForemanIds, assignedForemanIds);
    assignmentBatch.update(jobRef, {
        name: input.name,
        code: input.code,
        type: input.type,
        gc: input.gc,
        jobAddress: input.jobAddress,
        startDate: input.startDate,
        finishDate: input.finishDate,
        productionBurden: input.productionBurden,
        active: nextActive,
        archivedAt: nextActive ? null : snapshot.data()?.archivedAt ?? null,
        assignedForemanIds,
        notificationRecipients: input.notificationRecipients,
        dailyLogRecipients: input.notificationRecipients.dailyLogs,
    });
    await assignmentBatch.commit();
    return { success: true };
});
//# sourceMappingURL=jobFunctions.js.map