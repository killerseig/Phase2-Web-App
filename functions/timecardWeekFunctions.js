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
exports.submitTimecardWeekRecord = exports.deleteTimecardCardRecord = exports.updateTimecardCardRecord = exports.createTimecardCardRecord = exports.ensureTimecardWeekRecord = void 0;
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
function numberOrZero(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed))
        return 0;
    return Math.max(0, parsed);
}
function numberOrNull(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed))
        return null;
    return Math.max(0, parsed);
}
function normalizeRole(value) {
    const role = text(value).toLowerCase();
    if (role === 'admin' || role === 'controller' || role === 'foreman')
        return role;
    return 'none';
}
function formatIsoDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function getWeekStartFromSaturday(weekEndDate) {
    const current = new Date(`${weekEndDate}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() - 6);
    return formatIsoDate(current);
}
function getPreviousSaturday(weekEndDate) {
    const current = new Date(`${weekEndDate}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() - 7);
    return formatIsoDate(current);
}
function buildWeekDates(weekStartDate) {
    const start = new Date(`${weekStartDate}T00:00:00Z`);
    return Array.from({ length: 7 }, (_, index) => {
        const next = new Date(start);
        next.setUTCDate(start.getUTCDate() + index);
        return formatIsoDate(next);
    });
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
        throw new https_1.HttpsError('permission-denied', 'Your account does not have access to timecards.');
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
function sanitizeDay(day, index, weekDates) {
    return {
        date: text(day?.date) || weekDates[index] || '',
        dayOfWeek: index,
        hours: numberOrZero(day?.hours),
        production: numberOrZero(day?.production),
        unitCost: numberOrZero(day?.unitCost),
        unitCostOverride: numberOrNull(day?.unitCostOverride),
        lineTotal: numberOrZero(day?.lineTotal),
    };
}
function sanitizeLine(line, weekDates) {
    const sourceDays = Array.isArray(line?.days) ? line.days : [];
    return {
        jobNumber: text(line?.jobNumber),
        subsectionArea: text(line?.subsectionArea),
        account: text(line?.account),
        difH: text(line?.difH),
        difP: text(line?.difP),
        difC: text(line?.difC),
        offHours: numberOrZero(line?.offHours),
        offProduction: numberOrZero(line?.offProduction),
        offCost: numberOrZero(line?.offCost),
        days: weekDates.map((date, index) => sanitizeDay(sourceDays[index], index, weekDates)),
    };
}
function sanitizeCardPayload(card, weekStartDate, sortIndexFallback = 0) {
    const weekDates = buildWeekDates(weekStartDate);
    const lines = Array.isArray(card?.lines) ? card.lines : [];
    const totals = card?.totals || {};
    return {
        sourceType: text(card?.sourceType) === 'custom' ? 'custom' : 'employee',
        employeeId: textOrNull(card?.employeeId),
        firstName: text(card?.firstName),
        lastName: text(card?.lastName),
        fullName: text(card?.fullName) || [text(card?.firstName), text(card?.lastName)].filter(Boolean).join(' '),
        employeeNumber: text(card?.employeeNumber),
        occupation: text(card?.occupation),
        wageRate: numberOrNull(card?.wageRate),
        isContractor: card?.isContractor === true,
        sortIndex: Number.isFinite(Number(card?.sortIndex)) ? Number(card.sortIndex) : sortIndexFallback,
        lines: lines.map((line) => sanitizeLine(line, weekDates)),
        footerJobOrGl: text(card?.footerJobOrGl),
        footerAccount: text(card?.footerAccount),
        footerOffice: text(card?.footerOffice),
        footerAmount: text(card?.footerAmount),
        footerSecondJobOrGl: text(card?.footerSecondJobOrGl),
        footerSecondAccount: text(card?.footerSecondAccount),
        footerSecondOffice: text(card?.footerSecondOffice),
        footerSecondAmount: text(card?.footerSecondAmount),
        notes: text(card?.notes),
        regularHoursOverride: numberOrNull(card?.regularHoursOverride),
        overtimeHoursOverride: numberOrNull(card?.overtimeHoursOverride),
        totals: {
            hoursByDay: Array.isArray(totals.hoursByDay) ? totals.hoursByDay.map((value) => numberOrZero(value)) : Array(7).fill(0),
            productionByDay: Array.isArray(totals.productionByDay) ? totals.productionByDay.map((value) => numberOrZero(value)) : Array(7).fill(0),
            hoursTotal: numberOrZero(totals.hoursTotal),
            productionTotal: numberOrZero(totals.productionTotal),
            lineTotal: numberOrZero(totals.lineTotal),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
}
function cloneLineForNewWeek(line, weekDates) {
    return {
        jobNumber: text(line?.jobNumber),
        subsectionArea: text(line?.subsectionArea),
        account: text(line?.account),
        difH: text(line?.difH),
        difP: text(line?.difP),
        difC: text(line?.difC),
        offHours: 0,
        offProduction: 0,
        offCost: 0,
        days: weekDates.map((date, index) => ({
            date,
            dayOfWeek: index,
            hours: 0,
            production: 0,
            unitCost: 0,
            unitCostOverride: null,
            lineTotal: 0,
        })),
    };
}
function cloneCardForNewWeek(source, weekStartDate) {
    const weekDates = buildWeekDates(weekStartDate);
    const sourceLines = Array.isArray(source?.lines) ? source.lines : [];
    return {
        sourceType: text(source?.sourceType) === 'custom' ? 'custom' : 'employee',
        employeeId: textOrNull(source?.employeeId),
        firstName: text(source?.firstName),
        lastName: text(source?.lastName),
        fullName: text(source?.fullName) || [text(source?.firstName), text(source?.lastName)].filter(Boolean).join(' '),
        employeeNumber: text(source?.employeeNumber),
        occupation: text(source?.occupation),
        wageRate: numberOrNull(source?.wageRate),
        isContractor: source?.isContractor === true,
        sortIndex: numberOrZero(source?.sortIndex),
        lines: sourceLines.map((line) => cloneLineForNewWeek(line, weekDates)),
        footerJobOrGl: '',
        footerAccount: '',
        footerOffice: '',
        footerAmount: '',
        footerSecondJobOrGl: '',
        footerSecondAccount: '',
        footerSecondOffice: '',
        footerSecondAmount: '',
        notes: '',
        regularHoursOverride: null,
        overtimeHoursOverride: null,
        totals: {
            hoursByDay: Array(7).fill(0),
            productionByDay: Array(7).fill(0),
            hoursTotal: 0,
            productionTotal: 0,
            lineTotal: 0,
        },
    };
}
async function getWeekDoc(weekId) {
    const weekRef = runtime_1.db.collection('timecardWeeks').doc(weekId);
    const weekSnap = await weekRef.get();
    if (!weekSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Timecard week not found.');
    }
    const week = weekSnap.data() || {};
    const jobId = text(week.jobId);
    if (!jobId) {
        throw new https_1.HttpsError('failed-precondition', 'Timecard week is missing its job assignment.');
    }
    return { weekRef, weekSnap, week, jobId };
}
exports.ensureTimecardWeekRecord = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const input = request.data;
    const jobId = text(input?.jobId);
    const weekEndDate = text(input?.weekEndDate);
    if (!jobId)
        throw new https_1.HttpsError('invalid-argument', 'jobId is required');
    if (!weekEndDate)
        throw new https_1.HttpsError('invalid-argument', 'weekEndDate is required');
    const user = await getAuthorizedUser(request.auth.uid);
    assertCanWriteJob(user, jobId);
    const existingSnap = await runtime_1.db
        .collection('timecardWeeks')
        .where('jobId', '==', jobId)
        .where('weekEndDate', '==', weekEndDate)
        .limit(1)
        .get();
    const existingDoc = existingSnap.docs[0];
    if (existingDoc) {
        return { id: existingDoc.id };
    }
    const weekStartDate = getWeekStartFromSaturday(weekEndDate);
    const createdRef = await runtime_1.db.collection('timecardWeeks').add({
        jobId,
        jobCode: textOrNull(input?.jobCode),
        jobName: textOrNull(input?.jobName),
        ownerForemanUserId: textOrNull(input?.ownerForemanUserId ?? request.auth.uid),
        ownerForemanName: textOrNull(input?.ownerForemanName ?? user.displayName),
        weekStartDate,
        weekEndDate,
        status: 'draft',
        employeeCardCount: 0,
        createdByUserId: request.auth.uid,
        updatedByUserId: request.auth.uid,
        submittedByUserId: null,
        submittedAt: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const previousWeekSnap = await runtime_1.db
        .collection('timecardWeeks')
        .where('jobId', '==', jobId)
        .where('weekEndDate', '==', getPreviousSaturday(weekEndDate))
        .limit(1)
        .get();
    const previousWeekDoc = previousWeekSnap.docs[0];
    if (!previousWeekDoc) {
        return { id: createdRef.id };
    }
    const previousCardsSnap = await runtime_1.db
        .collection('timecardWeeks')
        .doc(previousWeekDoc.id)
        .collection('cards')
        .get();
    if (previousCardsSnap.empty) {
        return { id: createdRef.id };
    }
    const batch = runtime_1.db.batch();
    previousCardsSnap.docs
        .sort((left, right) => numberOrZero(left.data()?.sortIndex) - numberOrZero(right.data()?.sortIndex))
        .forEach((cardDoc, index) => {
        const nextCardRef = runtime_1.db.collection('timecardWeeks').doc(createdRef.id).collection('cards').doc();
        batch.set(nextCardRef, {
            ...sanitizeCardPayload(cloneCardForNewWeek(cardDoc.data(), weekStartDate), weekStartDate, index),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    batch.update(createdRef, {
        employeeCardCount: previousCardsSnap.size,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return { id: createdRef.id };
});
exports.createTimecardCardRecord = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const weekId = text(request.data?.weekId);
    const weekStartDate = text(request.data?.weekStartDate);
    const card = request.data?.card;
    if (!weekId)
        throw new https_1.HttpsError('invalid-argument', 'weekId is required');
    if (!weekStartDate)
        throw new https_1.HttpsError('invalid-argument', 'weekStartDate is required');
    if (!card || typeof card !== 'object')
        throw new https_1.HttpsError('invalid-argument', 'card is required');
    const { weekRef, week, jobId } = await getWeekDoc(weekId);
    const user = await getAuthorizedUser(request.auth.uid);
    assertCanWriteJob(user, jobId);
    if (text(week.status) === 'submitted' && user.role === 'foreman') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted weeks cannot be changed by foremen.');
    }
    const createdRef = runtime_1.db.collection('timecardWeeks').doc(weekId).collection('cards').doc();
    await createdRef.set({
        ...sanitizeCardPayload(card, weekStartDate),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await weekRef.update({
        employeeCardCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: request.auth.uid,
    });
    return { id: createdRef.id };
});
exports.updateTimecardCardRecord = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const weekId = text(request.data?.weekId);
    const cardId = text(request.data?.cardId);
    const weekStartDate = text(request.data?.weekStartDate);
    const card = request.data?.card;
    if (!weekId)
        throw new https_1.HttpsError('invalid-argument', 'weekId is required');
    if (!cardId)
        throw new https_1.HttpsError('invalid-argument', 'cardId is required');
    if (!weekStartDate)
        throw new https_1.HttpsError('invalid-argument', 'weekStartDate is required');
    if (!card || typeof card !== 'object')
        throw new https_1.HttpsError('invalid-argument', 'card is required');
    const { weekRef, week, jobId } = await getWeekDoc(weekId);
    const user = await getAuthorizedUser(request.auth.uid);
    assertCanWriteJob(user, jobId);
    if (text(week.status) === 'submitted' && user.role === 'foreman') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted weeks cannot be changed by foremen.');
    }
    const cardRef = runtime_1.db.collection('timecardWeeks').doc(weekId).collection('cards').doc(cardId);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Timecard card not found.');
    }
    await cardRef.update(sanitizeCardPayload(card, weekStartDate));
    await weekRef.update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: request.auth.uid,
    });
    return { success: true };
});
exports.deleteTimecardCardRecord = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const weekId = text(request.data?.weekId);
    const cardId = text(request.data?.cardId);
    if (!weekId)
        throw new https_1.HttpsError('invalid-argument', 'weekId is required');
    if (!cardId)
        throw new https_1.HttpsError('invalid-argument', 'cardId is required');
    const { weekRef, week, jobId } = await getWeekDoc(weekId);
    const user = await getAuthorizedUser(request.auth.uid);
    assertCanWriteJob(user, jobId);
    if (text(week.status) === 'submitted' && user.role === 'foreman') {
        throw new https_1.HttpsError('failed-precondition', 'Submitted weeks cannot be changed by foremen.');
    }
    const cardRef = runtime_1.db.collection('timecardWeeks').doc(weekId).collection('cards').doc(cardId);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Timecard card not found.');
    }
    await cardRef.delete();
    await weekRef.update({
        employeeCardCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: request.auth.uid,
    });
    return { success: true };
});
exports.submitTimecardWeekRecord = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in.');
    }
    const weekId = text(request.data?.weekId);
    if (!weekId)
        throw new https_1.HttpsError('invalid-argument', 'weekId is required');
    const { weekRef, jobId } = await getWeekDoc(weekId);
    const user = await getAuthorizedUser(request.auth.uid);
    assertCanWriteJob(user, jobId);
    await weekRef.update({
        status: 'submitted',
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        submittedByUserId: textOrNull(request.data?.actor?.userId ?? request.auth.uid),
        submittedByName: textOrNull(request.data?.actor?.displayName ?? user.displayName),
        updatedByUserId: request.auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=timecardWeekFunctions.js.map