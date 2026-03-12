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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySecretExpiration = exports.setUserPassword = exports.verifySetupToken = exports.createUserByAdmin = exports.deleteUser = exports.handleUserAccessRevocationCleanup = exports.removeEmailFromAllRecipientLists = exports.sendShopOrderEmail = exports.downloadTimecardsForWeek = exports.sendTimecardEmail = exports.sendDailyLogEmail = exports.sendPasswordResetEmail = void 0;
const admin = __importStar(require("firebase-admin"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const https_3 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const firestoreService_1 = require("./firestoreService");
const emailService_1 = require("./emailService");
const graphClientId = (0, params_1.defineSecret)('GRAPH_CLIENT_ID');
const graphTenantId = (0, params_1.defineSecret)('GRAPH_TENANT_ID');
const graphClientSecret = (0, params_1.defineSecret)('GRAPH_CLIENT_SECRET');
const outlookSenderEmail = (0, params_1.defineSecret)('OUTLOOK_SENDER_EMAIL');
const constants_1 = require("./constants");
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const storageBucket = admin.storage().bucket();
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MAX_ATTACHMENT_TOTAL_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const TIMECARD_BURDEN_RATE = 0.32;
function normalizeRecipients(...groups) {
    const merged = groups.flatMap(group => (Array.isArray(group) ? group : []));
    const cleaned = merged
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean);
    return Array.from(new Set(cleaned));
}
function formatEmailDate(value) {
    try {
        if (!value)
            return 'N/A';
        const asDate = typeof value?.toDate === 'function'
            ? value.toDate()
            : value instanceof Date
                ? value
                : new Date(value);
        if (Number.isNaN(asDate.getTime()))
            return 'N/A';
        return asDate.toLocaleDateString();
    }
    catch {
        return 'N/A';
    }
}
function toNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || Number.isNaN(n))
        return 0;
    return n;
}
function calculateUnitCostForExport(employeeWage, hours, production, burdenRate = TIMECARD_BURDEN_RATE) {
    const wageValue = Math.max(0, toNumber(employeeWage));
    const hourValue = Math.max(0, toNumber(hours));
    const productionValue = Math.max(0, toNumber(production));
    const burdenValue = Math.max(0, toNumber(burdenRate));
    if (wageValue <= 0 || hourValue <= 0 || productionValue <= 0 || burdenValue <= 0) {
        return 0;
    }
    return (wageValue / hourValue / productionValue) * burdenValue;
}
function formatPlexxisDate(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || '').trim());
    if (!match)
        return String(dateString || '');
    const [, year, month, day] = match;
    return `${Number(month)}/${Number(day)}/${year}`;
}
function formatPlexxisNumber(value, blankWhenZero = false) {
    const numeric = toNumber(value);
    if (blankWhenZero && numeric === 0)
        return '';
    return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
function escapeCsvValue(value) {
    const str = String(value ?? '');
    if (!str.length)
        return '';
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
function getWeekEndingFromWeekStart(weekStart) {
    const parsed = new Date(`${String(weekStart || '').trim()}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()))
        return String(weekStart || '');
    parsed.setUTCDate(parsed.getUTCDate() + 6);
    const yyyy = parsed.getUTCFullYear();
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function formatPlexxisEmployeeName(timecard) {
    const firstNameRaw = String(timecard?.firstName || '').trim();
    const lastNameRaw = String(timecard?.lastName || '').trim();
    if (lastNameRaw && firstNameRaw)
        return `${lastNameRaw}, ${firstNameRaw}`;
    if (lastNameRaw)
        return lastNameRaw;
    if (firstNameRaw)
        return firstNameRaw;
    const employeeName = String(timecard?.employeeName || '').trim();
    if (!employeeName)
        return '';
    if (employeeName.includes(','))
        return employeeName;
    const parts = employeeName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const first = parts[0];
        const last = parts.slice(1).join(' ');
        return `${last}, ${first}`;
    }
    return employeeName;
}
function getLineDaySum(line, key, dayKey) {
    if (key === 'hours')
        return toNumber(line?.[dayKey]);
    return toNumber(line?.production?.[dayKey]);
}
function getLineTotalHours(line) {
    const fromTotals = toNumber(line?.totals?.hours);
    if (fromTotals > 0)
        return fromTotals;
    return DAY_KEYS.reduce((sum, key) => sum + getLineDaySum(line, 'hours', key), 0);
}
function getLineTotalProduction(line) {
    const fromTotals = toNumber(line?.totals?.production);
    if (fromTotals > 0)
        return fromTotals;
    return DAY_KEYS.reduce((sum, key) => sum + getLineDaySum(line, 'production', key), 0);
}
function pickFirstNonEmptyValue(source, keys) {
    for (const key of keys) {
        if (!key)
            continue;
        const value = source?.[key];
        if (value === null || value === undefined)
            continue;
        const text = String(value).trim();
        if (text)
            return text;
    }
    return '';
}
function getLineSubSection(line) {
    return pickFirstNonEmptyValue(line, [
        'subsectionArea',
        'subSection',
        'subsection',
        'sub_section',
        'area',
        'section',
        'subSectionCode',
    ]);
}
function getLineActivityCode(line) {
    return pickFirstNonEmptyValue(line, [
        'account',
        'acct',
        'activityCode',
        'activity',
        'detailCode',
        'detail',
        'accountCode',
    ]);
}
function getLineCostCode(line) {
    return pickFirstNonEmptyValue(line, [
        'costCode',
        'cost_code',
        'cost',
        'costcode',
    ]);
}
function sanitizeLeakedCodeValue(value, disallowedValues) {
    const raw = String(value || '').trim();
    if (!raw)
        return '';
    const disallowed = new Set((Array.isArray(disallowedValues) ? disallowedValues : [])
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean));
    if (disallowed.has(raw.toLowerCase()))
        return '';
    return raw;
}
function sanitizeActivityCode(value, line, disallowedValues) {
    const raw = sanitizeLeakedCodeValue(value, disallowedValues);
    if (!raw)
        return '';
    const difValues = [line?.difH, line?.difP, line?.difC]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
    if (difValues.includes(raw.toLowerCase()))
        return '';
    // Reject short numeric fragments that are commonly leaked from non-activity fields.
    if (/^\d{1,3}$/.test(raw))
        return '';
    return raw;
}
function getLineOffHours(line) {
    return toNumber(line?.offHours ?? line?.off?.hours ?? line?.off);
}
function getLineOffProduction(line) {
    return toNumber(line?.offProduction ?? line?.off?.production);
}
function getLineOffCost(line) {
    return toNumber(line?.offCost ?? line?.off?.cost ?? line?.off?.amount);
}
function parseOptionalHoursOverride(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'string' && !value.trim())
        return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0)
        return null;
    return parsed;
}
function getLineMonSatHours(line) {
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((sum, key) => sum + toNumber(line?.[key]), 0);
}
function getLineMonSatProduction(line) {
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((sum, key) => sum + toNumber(line?.production?.[key]), 0);
}
function getLineMonSatCost(line) {
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((sum, key) => sum + toNumber(line?.unitCost?.[key]), 0);
}
function getLineTotalHoursForForm(line) {
    // Form TOTAL for H row is based on MON-SAT hours.
    return getLineMonSatHours(line);
}
function getLineTotalProductionForForm(line) {
    // Form TOTAL for P row is based on MON-SAT production.
    return getLineMonSatProduction(line);
}
function getLineTotalCostForForm(line) {
    const fromTotals = toNumber(line?.totals?.lineTotal);
    if (fromTotals > 0)
        return fromTotals;
    return getLineMonSatCost(line);
}
function hasMeaningfulLineDataForPdf(line) {
    const totalHours = getLineTotalHoursForForm(line);
    const totalProduction = getLineTotalProductionForForm(line);
    const totalCost = getLineTotalCostForForm(line);
    const offHours = getLineOffHours(line);
    const offProduction = getLineOffProduction(line);
    const offCost = getLineOffCost(line);
    return totalHours > 0 || totalProduction > 0 || totalCost > 0 || offHours > 0 || offProduction > 0 || offCost > 0;
}
function hasMeaningfulLineDataForCsv(line) {
    const totalHours = getLineTotalHoursForForm(line);
    const totalProduction = getLineTotalProductionForForm(line);
    const subSection = getLineSubSection(line);
    const activityCode = sanitizeActivityCode(getLineActivityCode(line), line, []);
    const costCode = getLineCostCode(line);
    return totalHours > 0 || totalProduction > 0 || !!subSection || !!activityCode || !!costCode;
}
function hasMeaningfulTimecard(tc) {
    const lines = Array.isArray(tc?.lines) ? tc.lines : [];
    if (lines.some((line) => hasMeaningfulLineDataForCsv(line) || hasMeaningfulLineDataForPdf(line)))
        return true;
    const hoursTotal = toNumber(tc?.totals?.hoursTotal);
    const productionTotal = toNumber(tc?.totals?.productionTotal);
    return hoursTotal > 0 || productionTotal > 0;
}
function roundToHundredths(value) {
    return Math.round(toNumber(value) * 100) / 100;
}
function validatePdfCsvHourParity(timecards) {
    const mismatches = [];
    for (const tc of Array.isArray(timecards) ? timecards : []) {
        const lines = Array.isArray(tc?.lines) ? tc.lines : [];
        const pdfHours = lines
            .filter((line) => hasMeaningfulLineDataForPdf(line))
            .reduce((sum, line) => sum + getLineTotalHoursForForm(line), 0);
        const csvHours = lines
            .filter((line) => hasMeaningfulLineDataForCsv(line))
            .reduce((sum, line) => sum + getLineTotalHoursForForm(line), 0);
        if (Math.abs(roundToHundredths(pdfHours) - roundToHundredths(csvHours)) > 0.001) {
            const employeeName = String(tc?.employeeName || tc?.employeeCode || tc?.employeeNumber || 'Unknown employee').trim();
            mismatches.push(`${employeeName}: PDF ${roundToHundredths(pdfHours)} vs CSV ${roundToHundredths(csvHours)}`);
        }
    }
    if (mismatches.length) {
        throw new https_2.HttpsError('internal', `Hour parity validation failed: ${mismatches.slice(0, 8).join('; ')}`);
    }
}
async function loadDailyLogAttachments(log) {
    const attachments = [];
    const files = Array.isArray(log?.attachments) ? log.attachments : [];
    let totalBytes = 0;
    for (const att of files) {
        if (!att?.path)
            continue;
        if (attachments.length >= MAX_ATTACHMENT_COUNT) {
            console.warn('[sendDailyLogEmail] Skipping extra attachments beyond limit', { limit: MAX_ATTACHMENT_COUNT });
            break;
        }
        try {
            const file = storageBucket.file(att.path);
            const [exists] = await file.exists();
            if (!exists) {
                console.warn('[sendDailyLogEmail] Attachment missing in storage', { path: att.path });
                continue;
            }
            const [metadata] = await file.getMetadata();
            const size = Number(metadata?.size) || 0;
            if (totalBytes + size > MAX_ATTACHMENT_TOTAL_BYTES) {
                console.warn('[sendDailyLogEmail] Skipping attachment to respect size budget', {
                    path: att.path,
                    size,
                    totalBytes,
                    max: MAX_ATTACHMENT_TOTAL_BYTES,
                });
                continue;
            }
            const [buffer] = await file.download();
            totalBytes += buffer.length;
            attachments.push({
                name: att?.name || file.name.split('/').pop() || 'attachment',
                contentType: metadata?.contentType || 'application/octet-stream',
                contentBytes: buffer.toString('base64'),
            });
        }
        catch (err) {
            console.warn('[sendDailyLogEmail] Failed to load attachment', { path: att?.path, err });
        }
    }
    return attachments;
}
function normalizeTimecardForEmail(tc) {
    const employeeWage = toNumber(tc?.employeeWage ?? tc?.wage);
    const sourceLines = Array.isArray(tc?.lines) && tc.lines.length
        ? tc.lines
        : Array.isArray(tc?.jobs)
            ? tc.jobs
            : [];
    const lines = sourceLines.map((source) => {
        const hoursByDay = {
            sun: 0,
            mon: 0,
            tue: 0,
            wed: 0,
            thu: 0,
            fri: 0,
            sat: 0,
        };
        const productionByDay = {
            sun: 0,
            mon: 0,
            tue: 0,
            wed: 0,
            thu: 0,
            fri: 0,
            sat: 0,
        };
        const unitCostByDay = {
            sun: 0,
            mon: 0,
            tue: 0,
            wed: 0,
            thu: 0,
            fri: 0,
            sat: 0,
        };
        const days = Array.isArray(source?.days) ? source.days : [];
        for (const day of days) {
            const idx = typeof day?.dayOfWeek === 'number' && day.dayOfWeek >= 0 && day.dayOfWeek < DAY_KEYS.length
                ? day.dayOfWeek
                : days.indexOf(day);
            const key = DAY_KEYS[idx];
            if (key === undefined)
                continue;
            hoursByDay[key] = Number(day?.hours) || 0;
            productionByDay[key] = Number(day?.production) || 0;
            unitCostByDay[key] = Number(day?.unitCost) || 0;
        }
        DAY_KEYS.forEach((key) => {
            const lineHours = toNumber(source?.[key]);
            const lineProduction = toNumber(source?.production?.[key]);
            const lineUnitCost = toNumber(source?.unitCost?.[key]);
            if (lineHours > 0 || hoursByDay[key] === 0) {
                hoursByDay[key] = lineHours || hoursByDay[key];
            }
            if (lineProduction > 0 || productionByDay[key] === 0) {
                productionByDay[key] = lineProduction || productionByDay[key];
            }
            const computedUnitCost = calculateUnitCostForExport(employeeWage, hoursByDay[key], productionByDay[key]);
            unitCostByDay[key] = lineUnitCost || unitCostByDay[key] || computedUnitCost;
        });
        const lineSubSection = getLineSubSection(source);
        const lineCostCode = getLineCostCode(source);
        const lineJobCode = String(source?.jobNumber || tc?.jobCode || tc?.__jobCode || '').trim();
        const employeeCode = String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim();
        const rawActivityCode = getLineActivityCode(source);
        const sanitizedActivityCode = sanitizeActivityCode(rawActivityCode, source, [
            lineJobCode,
            tc?.jobCode,
            tc?.__jobCode,
            employeeCode,
            tc?.employeeNumber,
        ]);
        const line = {
            jobNumber: lineJobCode,
            subsectionArea: lineSubSection,
            area: lineSubSection,
            account: sanitizedActivityCode,
            acct: sanitizedActivityCode,
            activityCode: sanitizedActivityCode,
            costCode: lineCostCode,
            difH: source?.difH || '',
            difP: source?.difP || '',
            difC: source?.difC || '',
            offHours: toNumber(source?.offHours ?? source?.off?.hours ?? source?.off),
            offProduction: toNumber(source?.offProduction ?? source?.off?.production),
            offCost: toNumber(source?.offCost ?? source?.off?.cost ?? source?.off?.amount),
            production: productionByDay,
            unitCost: unitCostByDay,
        };
        DAY_KEYS.forEach(k => {
            line[k] = hoursByDay[k];
        });
        const totalHours = DAY_KEYS.reduce((sum, key) => sum + toNumber(hoursByDay[key]), 0);
        const totalProduction = DAY_KEYS.reduce((sum, key) => sum + toNumber(productionByDay[key]), 0);
        const hasRealActivity = !!sanitizedActivityCode;
        const hasRealCostCode = !!String(line?.costCode || '').trim();
        // Guard against legacy rows where hours were stored under production without a real activity/cost identity.
        if (totalHours === 0 && totalProduction > 0 && !hasRealActivity && !hasRealCostCode) {
            DAY_KEYS.forEach((k) => {
                line[k] = toNumber(productionByDay[k]);
                productionByDay[k] = 0;
                unitCostByDay[k] = 0;
            });
            line.production = productionByDay;
            line.unitCost = unitCostByDay;
        }
        const finalTotalHours = DAY_KEYS.reduce((sum, key) => sum + toNumber(line[key]), 0);
        const finalTotalProduction = DAY_KEYS.reduce((sum, key) => sum + toNumber(productionByDay[key]), 0);
        let totalLine = 0;
        DAY_KEYS.forEach(k => {
            totalLine += (productionByDay[k] || 0) * (unitCostByDay[k] || 0);
        });
        line.totals = {
            hours: finalTotalHours,
            production: finalTotalProduction,
            lineTotal: totalLine,
        };
        return line;
    });
    const totals = lines.reduce((agg, line) => {
        agg.hoursTotal += Number(line?.totals?.hours) || 0;
        agg.productionTotal += Number(line?.totals?.production) || 0;
        agg.lineTotal += Number(line?.totals?.lineTotal) || 0;
        return agg;
    }, { hoursTotal: 0, productionTotal: 0, lineTotal: 0 });
    return {
        ...tc,
        lines,
        jobCode: String(tc?.jobCode || tc?.__jobCode || '').trim(),
        employeeWage: tc?.employeeWage ?? tc?.wage ?? null,
        totals,
    };
}
/**
 * Send password reset email using Firebase Admin SDK
 * Works without authentication via HTTP callable
 */
exports.sendPasswordResetEmail = (0, https_3.onRequest)(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const { email } = req.body;
    if (!email || !email.trim()) {
        res.status(400).json({ error: 'Email is required' });
        return;
    }
    try {
        console.log(`[sendPasswordResetEmail] Sending reset email to: ${email}`);
        // Generate password reset link (this sends the email automatically)
        await auth.generatePasswordResetLink(email);
        console.log(`[sendPasswordResetEmail] Email sent successfully to: ${email}`);
        res.json({
            success: true,
            message: `Password reset email sent to ${email}`,
        });
    }
    catch (error) {
        console.error(`[sendPasswordResetEmail] Error:`, error.message);
        res.status(500).json({
            error: error?.message || 'Failed to send password reset email',
        });
    }
});
/**
 * Send Daily Log via email
 */
exports.sendDailyLogEmail = (0, https_1.onCall)({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
    if (!request.auth) {
        throw new Error(constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    const { jobId, dailyLogId, recipients: requestRecipients } = request.data;
    if (!jobId) {
        throw new Error(constants_1.ERROR_MESSAGES.JOB_ID_REQUIRED);
    }
    if (!dailyLogId) {
        throw new Error(constants_1.ERROR_MESSAGES.DAILY_LOG_ID_REQUIRED);
    }
    const settings = await (0, firestoreService_1.getEmailSettings)();
    const recipients = normalizeRecipients(settings.dailyLogSubmitRecipients, requestRecipients);
    if (!recipients || recipients.length === 0) {
        throw new Error(constants_1.ERROR_MESSAGES.RECIPIENTS_REQUIRED);
    }
    try {
        if (!(0, emailService_1.isEmailEnabled)()) {
            console.log('[sendDailyLogEmail] Email sending disabled. Skipping send.');
            return { success: true, message: 'Email sending disabled. Skipped.' };
        }
        const log = await (0, firestoreService_1.getDailyLog)(jobId, dailyLogId);
        if (!log) {
            throw new Error(constants_1.ERROR_MESSAGES.DAILY_LOG_NOT_FOUND);
        }
        const job = await (0, firestoreService_1.getJobDetails)(log?.jobId || '');
        const emailHtml = (0, emailService_1.buildDailyLogEmail)(job || { id: '', name: 'Unknown Job', number: '' }, log?.logDate || new Date().toISOString(), log);
        const attachments = await loadDailyLogAttachments(log);
        await (0, emailService_1.sendEmail)({
            to: recipients,
            subject: `${constants_1.EMAIL.SUBJECTS.DAILY_LOG} - ${job?.name || 'Job'} - ${log?.logDate || 'N/A'}`,
            html: emailHtml,
            ...(attachments.length ? { attachments } : {}),
        });
        console.log(`Daily log ${dailyLogId} emailed to ${recipients.join(', ')}`);
        return { success: true, message: 'Email sent successfully' };
    }
    catch (error) {
        console.error('Error sending daily log email:', error);
        throw new Error(error.message);
    }
});
/**
 * Send Timecard via email
 */
exports.sendTimecardEmail = (0, https_1.onCall)({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
    if (!request.auth) {
        throw new Error(constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    const { jobId, timecardIds, weekStart, recipients: requestRecipients } = request.data;
    if (!jobId) {
        throw new Error(constants_1.ERROR_MESSAGES.JOB_ID_REQUIRED);
    }
    if (!timecardIds || !Array.isArray(timecardIds) || timecardIds.length === 0) {
        throw new Error('timecardIds array is required');
    }
    if (!weekStart) {
        throw new Error(constants_1.ERROR_MESSAGES.WEEK_START_REQUIRED);
    }
    const settings = await (0, firestoreService_1.getEmailSettings)();
    const recipients = normalizeRecipients(settings.timecardSubmitRecipients, requestRecipients);
    if (!recipients || recipients.length === 0) {
        throw new Error(constants_1.ERROR_MESSAGES.RECIPIENTS_REQUIRED);
    }
    try {
        if (!(0, emailService_1.isEmailEnabled)()) {
            console.log('[sendTimecardEmail] Email sending disabled. Skipping send.');
            return { success: true, message: 'Email sending disabled. Skipped.' };
        }
        // Fetch all timecards
        const timecards = [];
        const missingIds = [];
        for (const tcId of timecardIds) {
            console.log('[sendTimecardEmail] Fetching timecard', { jobId, weekStart, tcId });
            const tc = await (0, firestoreService_1.getTimecard)(jobId, weekStart, tcId);
            if (tc) {
                timecards.push(tc);
            }
            else {
                missingIds.push(tcId);
                console.warn('[sendTimecardEmail] Timecard not found', { jobId, weekStart, tcId });
            }
        }
        if (timecards.length === 0) {
            const availableSnap = await db.collection(constants_1.COLLECTIONS.JOBS).doc(jobId).collection('timecards').get();
            const availableIds = availableSnap.docs.map(d => d.id);
            console.error('[sendTimecardEmail] No timecards found for requested IDs', {
                jobId,
                weekStart,
                requested: timecardIds,
                missing: missingIds,
                availableCount: availableIds.length,
                availableSample: availableIds.slice(0, 25),
            });
            throw new Error(`${constants_1.ERROR_MESSAGES.TIMECARD_NOT_FOUND}: ${missingIds.join(', ') || 'none found'}`);
        }
        const normalizedTimecards = timecards.map(normalizeTimecardForEmail);
        const job = await (0, firestoreService_1.getJobDetails)(jobId);
        const userName = await (0, firestoreService_1.getUserDisplayName)(request.auth.uid, request.auth.token.email);
        const emailHtml = (0, emailService_1.buildTimecardsEmail)({
            jobName: job?.name,
            jobNumber: job?.number,
            submittedBy: userName,
            weekStart,
            timecards: normalizedTimecards,
        });
        const csvAttachment = buildTimecardCsv(normalizedTimecards, weekStart, job?.number);
        const csvFileName = buildTimecardCsvFilename(weekStart, job?.number);
        const pdfFileName = buildTimecardPdfFilename(weekStart, job?.number);
        const pdfBuffer = await buildTimecardPdfBuffer({
            jobName: job?.name,
            jobNumber: job?.number,
            submittedBy: userName,
            weekStart,
            timecards: normalizedTimecards,
        });
        const attachments = [];
        if (csvAttachment) {
            attachments.push({
                name: csvFileName,
                contentType: 'text/csv',
                contentBytes: Buffer.from(csvAttachment, 'utf-8').toString('base64'),
            });
        }
        attachments.push({
            name: pdfFileName,
            contentType: 'application/pdf',
            contentBytes: pdfBuffer.toString('base64'),
        });
        await (0, emailService_1.sendEmail)({
            to: recipients,
            subject: `${constants_1.EMAIL.SUBJECTS.TIMECARD} - ${timecards.length} timecard(s) - Week of ${weekStart}`,
            html: emailHtml,
            attachments,
        });
        console.log(`Timecards ${timecardIds.join(', ')} emailed to ${recipients.join(', ')}`);
        return { success: true, message: 'Email sent successfully' };
    }
    catch (error) {
        console.error('Error sending timecard email:', error);
        throw new Error(error.message);
    }
});
async function listSubmittedTimecardsForJobWeek(jobId, weekStart) {
    const weekEnding = getWeekEndingFromWeekStart(weekStart);
    const directSnap = await db
        .collection(constants_1.COLLECTIONS.JOBS)
        .doc(jobId)
        .collection(constants_1.COLLECTIONS.TIMECARDS)
        .where('status', '==', 'submitted')
        .get();
    const direct = directSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((tc) => {
        if (tc?.archived === true)
            return false;
        const matchesWeekStart = String(tc?.weekStartDate || '').trim() === weekStart;
        const matchesWeekEnding = String(tc?.weekEndingDate || '').trim() === weekEnding;
        return matchesWeekStart || matchesWeekEnding;
    });
    const legacySnap = await db
        .collection(constants_1.COLLECTIONS.JOBS)
        .doc(jobId)
        .collection(constants_1.COLLECTIONS.WEEKS)
        .doc(weekStart)
        .collection(constants_1.COLLECTIONS.TIMECARDS)
        .get();
    const legacy = legacySnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data(), weekStartDate: doc.data()?.weekStartDate || weekStart }))
        .filter((tc) => tc?.status === 'submitted' && tc?.archived !== true);
    const mergedById = new Map();
    for (const tc of direct)
        mergedById.set(tc.id, tc);
    for (const tc of legacy) {
        if (!mergedById.has(tc.id))
            mergedById.set(tc.id, tc);
    }
    return Array.from(mergedById.values());
}
/**
 * Download submitted timecards for a selected week as CSV or PDF
 * Access: admin and controller roles
 */
exports.downloadTimecardsForWeek = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    const user = await (0, firestoreService_1.getUserProfile)(request.auth.uid);
    if (!user) {
        throw new https_2.HttpsError('failed-precondition', constants_1.ERROR_MESSAGES.USER_PROFILE_NOT_FOUND);
    }
    if (user.role !== 'admin' && user.role !== 'controller') {
        throw new https_2.HttpsError('permission-denied', 'Only admins or controllers can perform this action');
    }
    const weekStart = String(request.data?.weekStart || '').trim();
    const format = String(request.data?.format || '').trim().toLowerCase();
    const jobId = typeof request.data?.jobId === 'string' ? String(request.data.jobId).trim() : '';
    if (!weekStart) {
        throw new https_2.HttpsError('invalid-argument', constants_1.ERROR_MESSAGES.WEEK_START_REQUIRED);
    }
    if (format !== 'csv' && format !== 'pdf') {
        throw new https_2.HttpsError('invalid-argument', 'format must be either "csv" or "pdf"');
    }
    const parsedWeekStart = new Date(`${weekStart}T00:00:00Z`);
    if (Number.isNaN(parsedWeekStart.getTime())) {
        throw new https_2.HttpsError('invalid-argument', 'weekStart must use YYYY-MM-DD format');
    }
    try {
        let targetJobs = [];
        let jobName = 'All Jobs';
        let jobCode = '';
        if (jobId) {
            const jobSnap = await db.collection(constants_1.COLLECTIONS.JOBS).doc(jobId).get();
            if (!jobSnap.exists)
                throw new https_2.HttpsError('not-found', 'Job not found');
            const data = jobSnap.data() || {};
            const resolvedCode = String(data.number || data.code || '').trim();
            targetJobs = [{ id: jobId, name: String(data.name || 'Unknown Job'), code: resolvedCode }];
            jobName = String(data.name || 'Unknown Job');
            jobCode = resolvedCode;
        }
        else {
            const jobsSnap = await db.collection(constants_1.COLLECTIONS.JOBS).get();
            targetJobs = jobsSnap.docs.map((doc) => {
                const data = doc.data() || {};
                return {
                    id: doc.id,
                    name: String(data.name || 'Unknown Job'),
                    code: String(data.number || data.code || '').trim(),
                };
            });
        }
        if (!targetJobs.length) {
            throw new https_2.HttpsError('not-found', 'No jobs found');
        }
        const timecardsByJob = await Promise.all(targetJobs.map(async (job) => {
            const jobCards = await listSubmittedTimecardsForJobWeek(job.id, weekStart);
            return jobCards.map((tc) => ({
                ...tc,
                __jobCode: job.code,
                __jobName: job.name,
            }));
        }));
        const submittedTimecards = timecardsByJob.flat();
        if (!submittedTimecards.length) {
            throw new https_2.HttpsError('not-found', `No submitted timecards found for week ${weekStart}`);
        }
        const normalizedTimecards = submittedTimecards
            .map(normalizeTimecardForEmail)
            .filter((tc) => hasMeaningfulTimecard(tc))
            .sort((a, b) => {
            const nameA = String(a?.employeeName || '').toLowerCase();
            const nameB = String(b?.employeeName || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        if (!normalizedTimecards.length) {
            throw new https_2.HttpsError('not-found', `No submitted timecards with export data found for week ${weekStart}`);
        }
        validatePdfCsvHourParity(normalizedTimecards);
        const weekEndDate = new Date(parsedWeekStart);
        weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
        const weekEnding = [
            weekEndDate.getUTCFullYear(),
            String(weekEndDate.getUTCMonth() + 1).padStart(2, '0'),
            String(weekEndDate.getUTCDate()).padStart(2, '0'),
        ].join('-');
        if (format === 'csv') {
            const csv = buildTimecardCsv(normalizedTimecards, weekStart, jobCode || undefined);
            return {
                success: true,
                format: 'csv',
                fileName: buildTimecardCsvFilename(weekStart, jobCode || undefined),
                contentType: 'text/csv',
                contentBase64: Buffer.from(csv, 'utf-8').toString('base64'),
                weekStart,
                weekEnding,
                timecardCount: normalizedTimecards.length,
            };
        }
        const submittedBy = await (0, firestoreService_1.getUserDisplayName)(request.auth.uid, request.auth.token.email);
        const pdfBuffer = await buildTimecardPdfBuffer({
            jobName,
            jobNumber: jobCode,
            submittedBy,
            weekStart,
            timecards: normalizedTimecards,
        });
        return {
            success: true,
            format: 'pdf',
            fileName: buildTimecardPdfFilename(weekStart, jobCode || undefined),
            contentType: 'application/pdf',
            contentBase64: pdfBuffer.toString('base64'),
            weekStart,
            weekEnding,
            timecardCount: normalizedTimecards.length,
        };
    }
    catch (error) {
        console.error('[downloadTimecardsForWeek] Error', { weekStart, format, jobId, error });
        if (error instanceof https_2.HttpsError)
            throw error;
        throw new https_2.HttpsError('internal', error?.message || 'Failed to download timecards');
    }
});
function buildTimecardCsv(timecards, weekStart, defaultJobCode) {
    const headers = ['Employee Name', 'Employee Code', 'Job Code', 'DETAIL_DATE', 'Sub-Section', 'Activity Code', 'Cost Code', 'H_Hours', 'P_HOURS', '', ''];
    const fixedDataRowCount = 108;
    const blankRow = Array(headers.length).fill('');
    const rows = [headers, [...blankRow]];
    const fallbackWeekEnding = getWeekEndingFromWeekStart(weekStart);
    for (const tc of Array.isArray(timecards) ? timecards : []) {
        const lines = Array.isArray(tc?.lines) && tc.lines.length ? tc.lines : [];
        const detailDate = formatPlexxisDate(String(tc?.weekEndingDate || fallbackWeekEnding || weekStart || ''));
        const employeeName = formatPlexxisEmployeeName(tc);
        const employeeCode = String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim();
        for (const line of lines) {
            const lineHours = getLineTotalHoursForForm(line);
            const lineProduction = getLineTotalProductionForForm(line);
            const subSection = getLineSubSection(line);
            const activityCode = sanitizeActivityCode(getLineActivityCode(line), line, [
                String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || defaultJobCode || '').trim(),
                String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim(),
            ]);
            const costCode = getLineCostCode(line);
            const rowJobCode = String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || defaultJobCode || '').trim();
            const hasData = lineHours > 0 || lineProduction > 0 || !!subSection || !!activityCode || !!costCode;
            if (!hasData)
                continue;
            rows.push([
                employeeName,
                employeeCode,
                rowJobCode,
                detailDate,
                subSection,
                activityCode,
                costCode,
                formatPlexxisNumber(lineHours, true),
                formatPlexxisNumber(lineProduction, true),
                '',
                '',
            ]);
        }
    }
    while (rows.length < fixedDataRowCount + 1) {
        rows.push([...blankRow]);
    }
    return rows
        .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
        .join('\r\n');
}
function buildTimecardCsvFilename(weekStart, jobCode) {
    const weekDate = new Date(weekStart);
    if (!Number.isNaN(weekDate.getTime())) {
        weekDate.setDate(weekDate.getDate() + 6);
        const yyyy = weekDate.getFullYear();
        const mm = String(weekDate.getMonth() + 1).padStart(2, '0');
        const dd = String(weekDate.getDate()).padStart(2, '0');
        const normalizedJobCode = String(jobCode || '').trim();
        return normalizedJobCode ? `${yyyy}-${mm}-${dd} ${normalizedJobCode}.csv` : `${yyyy}-${mm}-${dd}.csv`;
    }
    const normalizedWeekStart = String(weekStart || '').trim() || 'timecards';
    const normalizedJobCode = String(jobCode || '').trim();
    return normalizedJobCode ? `${normalizedWeekStart} ${normalizedJobCode}.csv` : `${normalizedWeekStart}.csv`;
}
function buildTimecardPdfFilename(weekStart, jobCode) {
    const weekDate = new Date(weekStart);
    if (!Number.isNaN(weekDate.getTime())) {
        weekDate.setDate(weekDate.getDate() + 6);
        const yyyy = weekDate.getFullYear();
        const mm = String(weekDate.getMonth() + 1).padStart(2, '0');
        const dd = String(weekDate.getDate()).padStart(2, '0');
        const normalizedJobCode = String(jobCode || '').trim();
        return normalizedJobCode ? `${yyyy}-${mm}-${dd} ${normalizedJobCode}.pdf` : `${yyyy}-${mm}-${dd}.pdf`;
    }
    const normalizedWeekStart = String(weekStart || '').trim() || 'timecards';
    const normalizedJobCode = String(jobCode || '').trim();
    return normalizedJobCode ? `${normalizedWeekStart} ${normalizedJobCode}.pdf` : `${normalizedWeekStart}.pdf`;
}
async function buildTimecardPdfBuffer(payload) {
    const doc = new pdfkit_1.default({ margin: 24, size: 'LETTER' });
    const chunks = [];
    const monSatKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const safeText = (value) => String(value ?? '').trim() || '-';
    const fmt = (value, blankWhenZero = false) => {
        const numeric = toNumber(value);
        if (blankWhenZero && numeric === 0)
            return '';
        return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    };
    const fmtMoney = (value, blankWhenZero = false) => {
        const numeric = toNumber(value);
        if (blankWhenZero && numeric === 0)
            return '';
        return `$${numeric.toFixed(2)}`;
    };
    const percentWidths = (total, weights) => {
        const sum = weights.reduce((s, w) => s + w, 0) || 1;
        const widths = weights.map((w) => (total * w) / sum);
        const used = widths.slice(0, -1).reduce((s, v) => s + v, 0);
        widths[widths.length - 1] = Math.max(total - used, 0);
        return widths;
    };
    const weekStartDate = payload.weekStart ? new Date(`${payload.weekStart}T00:00:00Z`) : null;
    const weekEndDate = weekStartDate && !Number.isNaN(weekStartDate.getTime()) ? new Date(weekStartDate) : null;
    if (weekEndDate)
        weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
    const weekEndingLabel = weekEndDate
        ? `${weekEndDate.getUTCMonth() + 1}/${weekEndDate.getUTCDate()}/${weekEndDate.getUTCFullYear()}`
        : safeText(payload.weekStart);
    await new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        doc.on('end', () => resolve());
        doc.on('error', (err) => reject(err));
        const drawGridRow = (x, y, colWidths, rowHeight, cells, options) => {
            let cx = x;
            const aligns = options?.align || [];
            doc.lineWidth(0.5).strokeColor('#111111');
            for (let i = 0; i < colWidths.length; i++) {
                const cellWidth = colWidths[i] || 0;
                const text = cells[i] ?? '';
                const align = aligns[i] || 'center';
                doc.rect(cx, y, cellWidth, rowHeight).stroke();
                doc
                    .font(options?.bold ? 'Helvetica-Bold' : 'Helvetica')
                    .fontSize(options?.fontSize ?? 6.0)
                    .fillColor('#111111')
                    .text(text, cx + 1.2, y + 1.2, {
                    width: Math.max(cellWidth - 3, 0),
                    height: Math.max(rowHeight - 3, 0),
                    align,
                    ellipsis: true,
                });
                cx += cellWidth;
            }
        };
        const drawHeaderFieldRow = (x, y, width, rowHeight, leftText, rightText) => {
            const leftWidth = Math.round(width * 0.62 * 1000) / 1000;
            doc.rect(x, y, width, rowHeight).stroke();
            doc.moveTo(x + leftWidth, y).lineTo(x + leftWidth, y + rowHeight).stroke();
            doc.font('Helvetica').fontSize(6.8).text(leftText, x + 2, y + 2, {
                width: leftWidth - 4,
                height: rowHeight - 4,
                align: 'left',
                ellipsis: true,
            });
            doc.font('Helvetica').fontSize(6.8).text(rightText, x + leftWidth + 2, y + 2, {
                width: width - leftWidth - 4,
                height: rowHeight - 4,
                align: 'left',
                ellipsis: true,
            });
        };
        const drawTimecardCard = (tc, x, y, width, height, renderBlankTemplate = false) => {
            const pad = 6;
            const innerX = x + pad;
            const innerY = y + pad;
            const innerWidth = width - pad * 2;
            const innerHeight = height - pad * 2;
            const bottom = y + height - pad;
            doc.lineWidth(1).strokeColor('#111111').rect(x, y, width, height).stroke();
            let cursorY = innerY;
            doc
                .font('Helvetica-Bold')
                .fontSize(10)
                .fillColor('#111111')
                .text('PHASE 2 COMPANY', innerX, cursorY, { width: innerWidth, align: 'center' });
            cursorY += 14.5;
            const employeeName = renderBlankTemplate ? '' : String(tc?.employeeName || '').trim();
            const employeeCode = renderBlankTemplate ? '' : String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim();
            const occupation = renderBlankTemplate ? '' : String(tc?.occupation || '').trim();
            const wageNumeric = toNumber(tc?.employeeWage ?? tc?.wage);
            const wageSource = tc?.employeeWage ?? tc?.wage ?? '';
            const wageLabel = renderBlankTemplate ? '' : (wageNumeric > 0 ? `$${wageNumeric.toFixed(2)}` : String(wageSource).trim());
            const weekEnding = renderBlankTemplate ? '' : weekEndingLabel;
            const fieldRowHeight = 11.5;
            drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, `EMP. NAME: ${employeeName}`, `EMPLOYEE# ${employeeCode}`);
            cursorY += fieldRowHeight;
            drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, `OCCUPATION: ${occupation}`, `Wage ${wageLabel}`);
            cursorY += fieldRowHeight;
            drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, '', `WEEK ENDING ${weekEnding}`);
            cursorY += fieldRowHeight + 2;
            const footerHeight = 98;
            const gridTop = cursorY;
            const gridBottom = Math.max(gridTop + 30, innerY + innerHeight - footerHeight);
            const gridHeight = Math.max(gridBottom - gridTop, 30);
            const tableHeaderHeight = 11;
            const maxLineGroups = 13;
            const rowHeight = Math.max(5.5, (gridHeight - tableHeaderHeight) / (maxLineGroups * 3));
            const lineGroupHeight = rowHeight * 3;
            const columnWidths = percentWidths(innerWidth, [16, 4, 4, 10, 6, 7, 7, 7, 7, 7, 7, 8, 8, 6]);
            const detailFontSize = rowHeight >= 6.25 ? 5.8 : 4.9;
            const costFontSize = rowHeight >= 6.25 ? 5.5 : 4.6;
            drawGridRow(innerX, gridTop, columnWidths, tableHeaderHeight, ['JOB #', '1', '', 'ACCT', 'DIF', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'TOTAL', 'PROD', 'OFF'], {
                bold: true,
                fontSize: rowHeight >= 6.25 ? 5.9 : 5.1,
                align: ['left', 'center', 'center', 'left', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center'],
            });
            let cursorDataY = gridTop + tableHeaderHeight;
            const lines = renderBlankTemplate ? [] : (Array.isArray(tc?.lines) ? tc.lines.filter((line) => hasMeaningfulLineDataForPdf(line)) : []);
            for (let lineIndex = 0; lineIndex < maxLineGroups; lineIndex++) {
                const line = lines[lineIndex];
                const hasLine = !!line;
                const jobCode = hasLine ? String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || '').trim() : '';
                const account = hasLine
                    ? sanitizeActivityCode(getLineActivityCode(line), line, [
                        jobCode,
                        String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim(),
                    ])
                    : '';
                const lineHoursTotal = hasLine ? getLineTotalHoursForForm(line) : 0;
                const lineProdTotal = hasLine ? getLineTotalProductionForForm(line) : 0;
                const lineCostTotal = hasLine ? getLineTotalCostForForm(line) : 0;
                const offHours = hasLine ? getLineOffHours(line) : 0;
                const offProduction = hasLine ? getLineOffProduction(line) : 0;
                const offCost = hasLine ? getLineOffCost(line) : 0;
                const hRow = [
                    jobCode,
                    hasLine ? '1' : '',
                    hasLine ? 'H' : '',
                    account,
                    hasLine ? String(line?.difH || '').trim() : '',
                    ...monSatKeys.map((k) => fmt(line?.[k], true)),
                    hasLine ? fmt(lineHoursTotal, true) : '',
                    '',
                    hasLine ? fmt(offHours, true) : '',
                ];
                const pRow = [
                    '',
                    hasLine ? '1' : '',
                    hasLine ? 'P' : '',
                    '',
                    hasLine ? String(line?.difP || '').trim() : '',
                    ...monSatKeys.map((k) => fmt(line?.production?.[k], true)),
                    hasLine ? fmt(lineProdTotal, true) : '',
                    '',
                    hasLine ? fmt(offProduction, true) : '',
                ];
                const cRow = [
                    '',
                    hasLine ? '1' : '',
                    hasLine ? 'C' : '',
                    '',
                    hasLine ? String(line?.difC || '').trim() : '',
                    ...monSatKeys.map((k) => fmtMoney(line?.unitCost?.[k], true)),
                    hasLine ? fmtMoney(lineCostTotal, true) : '',
                    '',
                    hasLine ? fmtMoney(offCost, true) : '',
                ];
                drawGridRow(innerX, cursorDataY, columnWidths, rowHeight, hRow, {
                    fontSize: detailFontSize,
                    align: ['left', 'center', 'center', 'left', 'center', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
                });
                cursorDataY += rowHeight;
                drawGridRow(innerX, cursorDataY, columnWidths, rowHeight, pRow, {
                    fontSize: detailFontSize,
                    align: ['left', 'center', 'center', 'left', 'center', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
                });
                cursorDataY += rowHeight;
                drawGridRow(innerX, cursorDataY, columnWidths, rowHeight, cRow, {
                    fontSize: costFontSize,
                    align: ['left', 'center', 'center', 'left', 'center', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
                });
                cursorDataY += rowHeight;
            }
            const footerTop = gridTop + tableHeaderHeight + (maxLineGroups * lineGroupHeight);
            const mondayHours = lines.reduce((sum, line) => sum + toNumber(line?.mon), 0);
            const tuesdayHours = lines.reduce((sum, line) => sum + toNumber(line?.tue), 0);
            const wednesdayHours = lines.reduce((sum, line) => sum + toNumber(line?.wed), 0);
            const thursdayHours = lines.reduce((sum, line) => sum + toNumber(line?.thu), 0);
            const fridayHours = lines.reduce((sum, line) => sum + toNumber(line?.fri), 0);
            const saturdayHours = lines.reduce((sum, line) => sum + toNumber(line?.sat), 0);
            const offHoursTotal = lines.reduce((sum, line) => sum + getLineOffHours(line), 0);
            const weekTotalHours = mondayHours + tuesdayHours + wednesdayHours + thursdayHours + fridayHours + saturdayHours;
            drawGridRow(innerX, footerTop, columnWidths, 11, ['TOTAL HOURS', '', '', '', '', fmt(mondayHours, true), fmt(tuesdayHours, true), fmt(wednesdayHours, true), fmt(thursdayHours, true), fmt(fridayHours, true), fmt(saturdayHours, true), fmt(weekTotalHours, true), '', fmt(offHoursTotal, true)], {
                bold: true,
                fontSize: 5.8,
                align: ['left', 'center', 'center', 'left', 'center', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
            });
            const smallBoxY = footerTop + 11;
            const boxWidth = innerWidth / 4;
            const boxLabels = ['JOB or GL', 'ACCT', 'OFFICE', 'AMT'];
            for (let idx = 0; idx < 4; idx++) {
                const bx = innerX + (idx * boxWidth);
                doc.rect(bx, smallBoxY, boxWidth, 14).stroke();
                doc.font('Helvetica').fontSize(6.2).text(boxLabels[idx] || '', bx + 2, smallBoxY + 2, {
                    width: boxWidth - 4,
                    align: 'center',
                    ellipsis: true,
                });
            }
            const totalHoursForFooter = Math.max(0, toNumber(weekTotalHours));
            let otHours = '';
            let regHours = '';
            if (!renderBlankTemplate) {
                if (totalHoursForFooter <= 40) {
                    regHours = totalHoursForFooter > 0 ? fmt(totalHoursForFooter) : '';
                }
                else {
                    regHours = fmt(40);
                    otHours = fmt(totalHoursForFooter - 40, true);
                }
            }
            const otY = smallBoxY + 14 + 2;
            doc.rect(innerX, otY, 24, 11).stroke();
            doc.rect(innerX + 24, otY, innerWidth - 24, 11).stroke();
            doc.font('Helvetica-Bold').fontSize(6.6).text('OT', innerX + 2, otY + 2, { width: 20, align: 'left' });
            doc.font('Helvetica').fontSize(6.6).text(otHours, innerX + 26, otY + 2, {
                width: innerWidth - 28,
                align: 'left',
            });
            const regY = otY + 11;
            doc.rect(innerX, regY, 24, 11).stroke();
            doc.rect(innerX + 24, regY, innerWidth - 24, 11).stroke();
            doc.font('Helvetica-Bold').fontSize(6.6).text('REG', innerX + 2, regY + 2, { width: 20, align: 'left' });
            doc.font('Helvetica').fontSize(6.6).text(regHours, innerX + 26, regY + 2, {
                width: innerWidth - 28,
                align: 'left',
            });
            const notesY = regY + 11;
            const notesHeight = Math.max(bottom - notesY, 12);
            doc.rect(innerX, notesY, 34, notesHeight).stroke();
            doc.rect(innerX + 34, notesY, innerWidth - 34, notesHeight).stroke();
            doc.font('Helvetica-Bold').fontSize(6.6).text('NOTES:', innerX + 2, notesY + 2, { width: 30, align: 'left' });
            doc.font('Helvetica').fontSize(6.2).text(renderBlankTemplate ? '' : String(tc?.notes || '').trim(), innerX + 36, notesY + 2, {
                width: innerWidth - 38,
                height: notesHeight - 4,
                align: 'left',
                ellipsis: true,
            });
        };
        const timecards = (Array.isArray(payload.timecards) ? payload.timecards : []).filter((tc) => hasMeaningfulTimecard(tc));
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const marginLeft = doc.page.margins.left || 24;
        const marginTop = doc.page.margins.top || 24;
        const marginRight = doc.page.margins.right || 24;
        const marginBottom = doc.page.margins.bottom || 24;
        const landscapeWidth = pageHeight;
        const landscapeHeight = pageWidth;
        const contentLeft = marginLeft;
        const contentTop = marginTop;
        const contentWidth = landscapeWidth - marginLeft - marginRight;
        const contentHeight = landscapeHeight - marginTop - marginBottom;
        const columnGap = 10;
        const cardWidth = (contentWidth - columnGap) / 2;
        if (!timecards.length) {
            doc.save();
            doc.translate(pageWidth, 0);
            doc.rotate(90);
            doc
                .font('Helvetica')
                .fontSize(10)
                .fillColor('#111111')
                .text('No submitted timecards found.', contentLeft, contentTop);
            doc.restore();
            doc.end();
            return;
        }
        const cardTop = contentTop;
        const cardHeight = contentHeight;
        for (let idx = 0; idx < timecards.length; idx += 2) {
            if (idx > 0)
                doc.addPage();
            const leftX = contentLeft;
            const rightX = contentLeft + cardWidth + columnGap;
            doc.save();
            doc.translate(pageWidth, 0);
            doc.rotate(90);
            drawTimecardCard(timecards[idx], leftX, cardTop, cardWidth, cardHeight, false);
            if (idx + 1 < timecards.length) {
                drawTimecardCard(timecards[idx + 1], rightX, cardTop, cardWidth, cardHeight, false);
            }
            doc.restore();
        }
        doc.end();
    });
    return Buffer.concat(chunks);
}
/**
 * Send Shop Order via email
 */
exports.sendShopOrderEmail = (0, https_1.onCall)({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
    if (!request.auth) {
        throw new Error(constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    const { jobId, shopOrderId, recipients: requestRecipients } = request.data;
    if (!jobId) {
        throw new Error(constants_1.ERROR_MESSAGES.JOB_ID_REQUIRED);
    }
    if (!shopOrderId) {
        throw new Error(constants_1.ERROR_MESSAGES.SHOP_ORDER_ID_REQUIRED);
    }
    const settings = await (0, firestoreService_1.getEmailSettings)();
    const recipients = normalizeRecipients(settings.shopOrderSubmitRecipients, requestRecipients);
    if (!recipients || recipients.length === 0) {
        throw new Error(constants_1.ERROR_MESSAGES.RECIPIENTS_REQUIRED);
    }
    try {
        if (!(0, emailService_1.isEmailEnabled)()) {
            console.log('[sendShopOrderEmail] Email sending disabled. Skipping send.');
            return { success: true, message: 'Email sending disabled. Skipped.' };
        }
        let order = null;
        // Primary: job-scoped collection (jobs/{jobId}/shop_orders/{shopOrderId})
        const jobOrderSnap = await db.collection(constants_1.COLLECTIONS.JOBS).doc(jobId).collection('shop_orders').doc(shopOrderId).get();
        if (jobOrderSnap.exists) {
            order = { id: jobOrderSnap.id, ...jobOrderSnap.data(), jobId };
        }
        else {
            // Fallback to legacy root collection (shopOrders)
            order = await (0, firestoreService_1.getShopOrder)(shopOrderId);
        }
        if (!order) {
            throw new Error(constants_1.ERROR_MESSAGES.SHOP_ORDER_NOT_FOUND);
        }
        const job = await (0, firestoreService_1.getJobDetails)(order?.jobId || jobId);
        const emailHtml = (0, emailService_1.buildShopOrderEmail)(order);
        const orderDateLabel = formatEmailDate(order?.orderDate || order?.createdAt || order?.updatedAt);
        await (0, emailService_1.sendEmail)({
            to: recipients,
            subject: `${constants_1.EMAIL.SUBJECTS.SHOP_ORDER} - ${job?.name || 'Job'} - ${orderDateLabel}`,
            html: emailHtml,
        });
        console.log(`Shop order ${shopOrderId} emailed to ${recipients.join(', ')}`);
        return { success: true, message: 'Email sent successfully' };
    }
    catch (error) {
        console.error('Error sending shop order email:', error);
        throw new Error(error.message);
    }
});
/**
 * Internal helper to send daily log email (used by scheduled function)
 */
async function sendDailyLogEmailInternal(jobId, dailyLogId, recipients) {
    if (!(0, emailService_1.isEmailEnabled)()) {
        console.log('[sendDailyLogEmailInternal] Email sending disabled. Skipping send.');
        return;
    }
    const log = await (0, firestoreService_1.getDailyLog)(jobId, dailyLogId);
    if (!log) {
        throw new Error(constants_1.ERROR_MESSAGES.DAILY_LOG_NOT_FOUND);
    }
    const job = await (0, firestoreService_1.getJobDetails)(log?.jobId || '');
    const emailHtml = (0, emailService_1.buildDailyLogAutoSubmitEmail)(job || { id: '', name: 'Unknown Job', number: '' }, log?.logDate || new Date().toISOString());
    const attachments = await loadDailyLogAttachments(log);
    await (0, emailService_1.sendEmail)({
        to: recipients,
        subject: `${constants_1.EMAIL.SUBJECTS.DAILY_LOG_AUTO} - ${job?.name || 'Job'} - ${log?.logDate || 'N/A'}`,
        html: emailHtml,
        ...(attachments.length ? { attachments } : {}),
    });
}
async function removeEmailFromRecipientLists(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
        return { settingsUpdated: false, jobsUpdated: 0 };
    }
    let settingsUpdated = false;
    let jobsUpdated = 0;
    const settingsRef = db.collection('settings').doc('email');
    const settingsSnap = await settingsRef.get();
    if (settingsSnap.exists) {
        const data = settingsSnap.data() || {};
        const filterRecipientList = (values) => {
            const list = Array.isArray(values) ? values : [];
            return list.filter((value) => String(value || '').trim().toLowerCase() !== normalizedEmail);
        };
        const nextTimecard = filterRecipientList(data.timecardSubmitRecipients);
        const nextShopOrder = filterRecipientList(data.shopOrderSubmitRecipients);
        const nextDailyLog = filterRecipientList(data.dailyLogSubmitRecipients);
        const changed = nextTimecard.length !== (Array.isArray(data.timecardSubmitRecipients) ? data.timecardSubmitRecipients.length : 0) ||
            nextShopOrder.length !== (Array.isArray(data.shopOrderSubmitRecipients) ? data.shopOrderSubmitRecipients.length : 0) ||
            nextDailyLog.length !== (Array.isArray(data.dailyLogSubmitRecipients) ? data.dailyLogSubmitRecipients.length : 0);
        if (changed) {
            await settingsRef.set({
                timecardSubmitRecipients: nextTimecard,
                shopOrderSubmitRecipients: nextShopOrder,
                dailyLogSubmitRecipients: nextDailyLog,
            }, { merge: true });
            settingsUpdated = true;
        }
    }
    const jobsSnap = await db.collection(constants_1.COLLECTIONS.JOBS).get();
    const batch = db.batch();
    jobsSnap.docs.forEach((jobDoc) => {
        const currentRecipients = Array.isArray(jobDoc.data()?.dailyLogRecipients)
            ? jobDoc.data().dailyLogRecipients
            : [];
        if (!currentRecipients.length)
            return;
        const nextRecipients = currentRecipients.filter((value) => String(value || '').trim().toLowerCase() !== normalizedEmail);
        if (nextRecipients.length !== currentRecipients.length) {
            batch.update(jobDoc.ref, { dailyLogRecipients: nextRecipients });
            jobsUpdated += 1;
        }
    });
    if (jobsUpdated > 0) {
        await batch.commit();
    }
    return { settingsUpdated, jobsUpdated };
}
exports.removeEmailFromAllRecipientLists = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new Error(constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    await (0, firestoreService_1.verifyAdminRole)(request.auth.uid);
    const rawEmail = String(request.data?.email || '').trim();
    if (!rawEmail) {
        throw new Error(constants_1.ERROR_MESSAGES.EMAIL_REQUIRED);
    }
    const cleanup = await removeEmailFromRecipientLists(rawEmail);
    return {
        success: true,
        message: 'Recipient cleanup completed',
        removedFromRecipientLists: cleanup.settingsUpdated || cleanup.jobsUpdated > 0,
        updatedJobCount: cleanup.jobsUpdated,
    };
});
exports.handleUserAccessRevocationCleanup = (0, firestore_1.onDocumentUpdated)('users/{uid}', async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    if (!afterData)
        return;
    const beforeRole = String(beforeData?.role || '').trim().toLowerCase();
    const afterRole = String(afterData?.role || '').trim().toLowerCase();
    const beforeActive = typeof beforeData?.active === 'boolean' ? beforeData.active : true;
    const afterActive = typeof afterData?.active === 'boolean' ? afterData.active : true;
    const changedToNoneRole = beforeRole !== afterRole && afterRole === 'none';
    const changedToInactive = beforeActive !== afterActive && afterActive === false;
    const roleChangedWhileInactive = beforeRole !== afterRole && afterActive === false;
    if (!changedToNoneRole && !changedToInactive && !roleChangedWhileInactive) {
        return;
    }
    const email = String(afterData?.email || beforeData?.email || '').trim();
    if (!email)
        return;
    try {
        const cleanup = await removeEmailFromRecipientLists(email);
        console.log('[handleUserAccessRevocationCleanup] Recipient cleanup complete', {
            uid: event.params.uid,
            email,
            reason: {
                changedToNoneRole,
                changedToInactive,
                roleChangedWhileInactive,
            },
            settingsUpdated: cleanup.settingsUpdated,
            jobsUpdated: cleanup.jobsUpdated,
        });
    }
    catch (error) {
        console.error('[handleUserAccessRevocationCleanup] Recipient cleanup failed', {
            uid: event.params.uid,
            email,
            error,
        });
    }
});
/**
 * Delete a user from both Firestore and Firebase Authentication
 * Only callable by authenticated admin users
 */
exports.deleteUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new Error(constants_1.ERROR_MESSAGES.NOT_SIGNED_IN_DELETE);
    }
    const { uid } = request.data;
    if (!uid) {
        throw new Error(constants_1.ERROR_MESSAGES.UID_REQUIRED);
    }
    try {
        await (0, firestoreService_1.verifyAdminRole)(request.auth.uid);
        const userDocRef = db.collection(constants_1.COLLECTIONS.USERS).doc(uid);
        const userDocSnap = await userDocRef.get();
        let authEmail = '';
        try {
            const authUser = await auth.getUser(uid);
            authEmail = String(authUser.email || '').trim();
        }
        catch (lookupError) {
            console.warn('[deleteUser] Unable to load auth user before delete', { uid, lookupError });
        }
        const firestoreEmail = String(userDocSnap.data()?.email || '').trim();
        const candidateEmails = Array.from(new Set([authEmail, firestoreEmail].filter(Boolean)));
        let settingsUpdated = false;
        let jobsUpdated = 0;
        for (const candidateEmail of candidateEmails) {
            const cleanup = await removeEmailFromRecipientLists(candidateEmail);
            settingsUpdated = settingsUpdated || cleanup.settingsUpdated;
            jobsUpdated += cleanup.jobsUpdated;
        }
        // Delete from Firebase Auth
        await auth.deleteUser(uid);
        // Delete from Firestore
        await userDocRef.delete();
        console.log('[deleteUser] Offboarding cleanup complete', {
            uid,
            candidateEmails,
            settingsUpdated,
            jobsUpdated,
        });
        return {
            success: true,
            message: 'User deleted successfully',
            removedFromRecipientLists: settingsUpdated || jobsUpdated > 0,
            updatedJobCount: jobsUpdated,
        };
    }
    catch (error) {
        throw new Error(error.message || constants_1.ERROR_MESSAGES.FAILED_TO_DELETE_USER);
    }
});
/**
 * Create a new user account (admin-only)
 * Generates password reset link and sends welcome email
 */
exports.createUserByAdmin = (0, https_1.onCall)({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
    if (!request.auth) {
        throw new Error(constants_1.ERROR_MESSAGES.NOT_SIGNED_IN_CREATE);
    }
    const { email, firstName, lastName, role } = request.data;
    // Validate inputs
    if (!email || !email.trim()) {
        throw new Error(constants_1.ERROR_MESSAGES.EMAIL_REQUIRED);
    }
    if (!firstName || !firstName.trim()) {
        throw new Error(constants_1.ERROR_MESSAGES.FIRST_NAME_REQUIRED);
    }
    if (!lastName || !lastName.trim()) {
        throw new Error(constants_1.ERROR_MESSAGES.LAST_NAME_REQUIRED);
    }
    const userRole = role || 'none';
    if (!constants_1.VALID_ROLES.includes(userRole)) {
        throw new Error(constants_1.ERROR_MESSAGES.INVALID_ROLE(constants_1.VALID_ROLES));
    }
    try {
        // Verify caller is admin
        await (0, firestoreService_1.verifyAdminRole)(request.auth.uid);
        // Check if user already exists
        try {
            await auth.getUserByEmail(email);
            throw new Error(constants_1.ERROR_MESSAGES.USER_ALREADY_EXISTS);
        }
        catch (err) {
            if (err.code !== 'auth/user-not-found') {
                throw err;
            }
            // User doesn't exist, continue
        }
        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
            email: email.trim(),
            emailVerified: false,
        });
        console.log(`[createUserByAdmin] Created auth user: ${userRecord.uid}`);
        // Create a custom setup token for password creation
        const crypto = require('crypto');
        const setupToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        console.log(`[createUserByAdmin] Generated setup token: ${setupToken.substring(0, 10)}...`);
        // Create Firestore profile with setup token
        await db.collection(constants_1.COLLECTIONS.USERS).doc(userRecord.uid).set({
            email: userRecord.email,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role: userRole,
            active: true,
            createdAt: new Date(),
            setupToken: setupToken,
            setupTokenExpiry: tokenExpiry,
        });
        console.log(`[createUserByAdmin] Created Firestore profile with setup token: ${userRecord.uid}`);
        // Verify the token was stored
        const verifyDoc = await db.collection(constants_1.COLLECTIONS.USERS).doc(userRecord.uid).get();
        const verifyData = verifyDoc.data();
        console.log(`[createUserByAdmin] Verified token stored: ${verifyData?.setupToken?.substring(0, 10)}...`);
        // Build custom setup link with token
        const setupLink = `https://phase2-website.web.app/set-password?setupToken=${setupToken}&uid=${userRecord.uid}`;
        // Send welcome email with custom setup link
        if ((0, emailService_1.isEmailEnabled)()) {
            const emailHtml = (0, emailService_1.buildWelcomeEmail)(firstName, setupLink);
            await (0, emailService_1.sendEmail)({
                to: userRecord.email,
                subject: constants_1.EMAIL.SUBJECTS.WELCOME,
                html: emailHtml,
            });
            console.log(`[createUserByAdmin] Sent welcome email to ${userRecord.email}`);
        }
        return {
            success: true,
            message: `User created successfully. Welcome email sent to ${userRecord.email}`,
            uid: userRecord.uid,
        };
    }
    catch (error) {
        console.error('[createUserByAdmin] Error:', error.message);
        throw new Error(error.message || constants_1.ERROR_MESSAGES.FAILED_TO_CREATE_USER);
    }
});
/**
 * Verify setup token for new user account
 * Called from the SetPassword page to validate the token before password creation
 * No authentication required - uses token for validation
 */
exports.verifySetupToken = (0, https_1.onCall)(async (request) => {
    const { uid, setupToken } = request.data;
    // Validate inputs
    if (!uid || !setupToken) {
        throw new Error('Missing required parameters: uid and setupToken');
    }
    try {
        // Get the user document with admin privileges
        const userDoc = await db.collection(constants_1.COLLECTIONS.USERS).doc(uid).get();
        if (!userDoc.exists) {
            console.log(`[verifySetupToken] User not found: ${uid}`);
            throw new Error('User not found');
        }
        const userData = userDoc.data();
        console.log(`[verifySetupToken] Verifying token for user ${uid}`);
        // Verify token matches
        if (!userData?.setupToken || userData.setupToken !== setupToken) {
            console.log(`[verifySetupToken] Token mismatch for user ${uid}`);
            throw new Error('Invalid token');
        }
        // Check if token has expired
        let expiryTime;
        if (userData.setupTokenExpiry?.toDate) {
            // It's a Firestore Timestamp
            expiryTime = userData.setupTokenExpiry.toDate();
        }
        else if (userData.setupTokenExpiry instanceof Date) {
            expiryTime = userData.setupTokenExpiry;
        }
        else {
            expiryTime = new Date(userData.setupTokenExpiry);
        }
        if (new Date() > expiryTime) {
            console.log(`[verifySetupToken] Token expired for user ${uid}`);
            throw new Error('Token expired');
        }
        console.log(`[verifySetupToken] Token verified successfully for user ${uid}`);
        return {
            success: true,
            email: userData.email,
            message: 'Token verified',
        };
    }
    catch (error) {
        console.error(`[verifySetupToken] Error:`, error.message);
        throw new Error(error.message || 'Failed to verify token');
    }
});
/**
 * Set password for new user account using custom setup token
 * Called from the SetPassword page
 */
exports.setUserPassword = (0, https_1.onCall)(async (request) => {
    const { uid, password, setupToken } = request.data;
    // Validate inputs
    if (!uid || !password || !setupToken) {
        throw new Error('Missing required parameters: uid, password, and setupToken');
    }
    if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
    }
    try {
        // Verify the user exists and token is valid
        const userDoc = await db.collection(constants_1.COLLECTIONS.USERS).doc(uid).get();
        if (!userDoc || !userDoc.exists) {
            throw new Error('User not found');
        }
        const userData = userDoc.data();
        // Verify token matches
        if (userData?.setupToken !== setupToken) {
            throw new Error('Invalid setup token');
        }
        // Check if token has expired
        let expiryTime;
        if (userData?.setupTokenExpiry?.toDate) {
            // It's a Firestore Timestamp
            expiryTime = userData.setupTokenExpiry.toDate();
        }
        else if (userData?.setupTokenExpiry instanceof Date) {
            expiryTime = userData.setupTokenExpiry;
        }
        else {
            expiryTime = new Date(userData?.setupTokenExpiry);
        }
        if (new Date() > expiryTime) {
            throw new Error('Setup token has expired');
        }
        // Update user password in Firebase Auth
        await auth.updateUser(uid, { password });
        console.log(`[setUserPassword] Password set for user: ${uid}`);
        // Clear the setup token from Firestore
        await db.collection(constants_1.COLLECTIONS.USERS).doc(uid).update({
            setupToken: null,
            setupTokenExpiry: null,
        });
        return {
            success: true,
            message: 'Password set successfully',
        };
    }
    catch (error) {
        console.error('[setUserPassword] Error:', error.message);
        throw new Error(error.message || 'Failed to set password');
    }
});
/**
 * Scheduled function to notify admins of upcoming secret expiration
 * Runs daily at 9:00 AM UTC
 * Sends notification 30 days before secret expiration (Jan 10, 2027)
 */
exports.notifySecretExpiration = (0, scheduler_1.onSchedule)({ schedule: 'every day 09:00', secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (context) => {
    try {
        const today = new Date();
        const currentDateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        // Parse expiration date and notification trigger date
        const expirationDate = new Date(constants_1.EMAIL.SECRET_EXPIRATION_DATE);
        const notificationTriggerDate = new Date(expirationDate);
        notificationTriggerDate.setDate(notificationTriggerDate.getDate() - constants_1.EMAIL.SECRET_NOTIFICATION_DAYS);
        const notificationTriggerDateStr = notificationTriggerDate.toISOString().split('T')[0];
        console.log(`[notifySecretExpiration] Today: ${currentDateStr}`);
        console.log(`[notifySecretExpiration] Notification trigger date: ${notificationTriggerDateStr}`);
        console.log(`[notifySecretExpiration] Secret expiration date: ${constants_1.EMAIL.SECRET_EXPIRATION_DATE}`);
        // Check if today is on or after the notification trigger date
        if (currentDateStr < notificationTriggerDateStr) {
            console.log('[notifySecretExpiration] Not yet time to notify. Exiting.');
            return;
        }
        // Check if secret has already expired
        if (currentDateStr > constants_1.EMAIL.SECRET_EXPIRATION_DATE) {
            console.error('[notifySecretExpiration] Secret has already expired!');
            // Still send warning but with different urgency
        }
        // Get all admin users
        const adminSnapshot = await db
            .collection(constants_1.COLLECTIONS.USERS)
            .where('role', '==', 'admin')
            .where('active', '==', true)
            .get();
        if (adminSnapshot.empty) {
            console.log('[notifySecretExpiration] No active admin users found');
            return;
        }
        const adminEmails = adminSnapshot.docs
            .map(doc => doc.data().email)
            .filter((email) => email && email.trim().length > 0);
        console.log(`[notifySecretExpiration] Found ${adminEmails.length} admin(s): ${adminEmails.join(', ')}`);
        if (adminEmails.length === 0) {
            console.log('[notifySecretExpiration] No admin emails found');
            return;
        }
        // Send notification email to each admin
        const emailHtml = (0, emailService_1.buildSecretExpirationEmail)();
        await (0, emailService_1.sendEmail)({
            to: adminEmails,
            subject: constants_1.EMAIL.SUBJECTS.SECRET_EXPIRATION,
            html: emailHtml,
        });
        console.log(`[notifySecretExpiration] Notification sent to ${adminEmails.length} admin(s)`);
    }
    catch (error) {
        console.error('[notifySecretExpiration] Error:', error.message);
        // Don't throw - we want the function to complete even if there's an issue
        // so the scheduler doesn't mark it as failed
    }
});
//# sourceMappingURL=index.js.map