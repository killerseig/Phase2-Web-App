"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendShopOrderEmail = exports.sendDailyLogEmail = void 0;
exports.prepareTimecardsForPdfCsvExport = prepareTimecardsForPdfCsvExport;
exports.normalizeTimecardForEmail = normalizeTimecardForEmail;
exports.buildTimecardCsv = buildTimecardCsv;
exports.buildTimecardCsvFilename = buildTimecardCsvFilename;
exports.buildTimecardPdfFilename = buildTimecardPdfFilename;
exports.buildTimecardPdfBuffer = buildTimecardPdfBuffer;
const pdfkit_1 = __importDefault(require("pdfkit"));
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const firestoreService_1 = require("./firestoreService");
const emailService_1 = require("./emailService");
const constants_1 = require("./constants");
const functionConfig_1 = require("./functionConfig");
const runtime_1 = require("./runtime");
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MAX_ATTACHMENT_TOTAL_BYTES = 15 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const DEFAULT_PRODUCTION_BURDEN = 0.33;
function normalizeRecipients(...groups) {
    const merged = groups.flatMap(group => (Array.isArray(group) ? group : []));
    const cleaned = merged
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean);
    return Array.from(new Set(cleaned));
}
async function getShopOrderCostCodesByCatalogItemId(items) {
    const catalogItemIds = Array.from(new Set((Array.isArray(items) ? items : [])
        .map((item) => String(item?.catalogItemId || '').trim())
        .filter(Boolean)));
    if (!catalogItemIds.length)
        return {};
    const refs = catalogItemIds.map((catalogItemId) => runtime_1.db.collection('shopCatalog').doc(catalogItemId));
    const snapshots = await runtime_1.db.getAll(...refs);
    return snapshots.reduce((costCodesByCatalogItemId, snapshot) => {
        const costCode = String(snapshot.data()?.sku || '').trim();
        if (snapshot.exists && costCode) {
            costCodesByCatalogItemId[snapshot.id] = costCode;
        }
        return costCodesByCatalogItemId;
    }, {});
}
function getAssignedJobIds(user) {
    if (!Array.isArray(user?.assignedJobIds))
        return [];
    return user.assignedJobIds
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);
}
function assertActiveRoleUser(user, allowedRoles, errorMessage) {
    if (!user) {
        throw new https_2.HttpsError('failed-precondition', constants_1.ERROR_MESSAGES.USER_PROFILE_NOT_FOUND);
    }
    const rawRole = String(user?.role || 'none').trim().toLowerCase();
    const role = rawRole === 'project-manager' ? 'foreman' : rawRole;
    if (user?.active !== true) {
        throw new https_2.HttpsError('permission-denied', 'Your account is inactive');
    }
    if (!allowedRoles.includes(role)) {
        throw new https_2.HttpsError('permission-denied', errorMessage);
    }
    return {
        ...user,
        role,
        assignedJobIds: getAssignedJobIds(user),
    };
}
function assertAdminOrAssignedForeman(user, jobId, errorMessage) {
    const authorizedUser = assertActiveRoleUser(user, ['admin', 'foreman'], errorMessage);
    if (authorizedUser.role === 'admin')
        return authorizedUser;
    if (!authorizedUser.assignedJobIds.includes(String(jobId || '').trim())) {
        throw new https_2.HttpsError('permission-denied', errorMessage);
    }
    return authorizedUser;
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
function normalizeProductionBurden(value) {
    const burden = Number(value);
    if (!Number.isFinite(burden) || Number.isNaN(burden) || burden < 0) {
        return DEFAULT_PRODUCTION_BURDEN;
    }
    return burden;
}
function getProductionMultiplier(productionBurden) {
    return 1 + normalizeProductionBurden(productionBurden);
}
function calculateUnitCostForExport(employeeWage, hours, production, productionBurden = DEFAULT_PRODUCTION_BURDEN) {
    const wageValue = Math.max(0, toNumber(employeeWage));
    const hourValue = Math.max(0, toNumber(hours));
    const productionValue = Math.max(0, toNumber(production));
    const multiplierValue = Math.max(0, toNumber(getProductionMultiplier(productionBurden)));
    if (wageValue <= 0 || hourValue <= 0 || productionValue <= 0 || multiplierValue <= 0) {
        return 0;
    }
    return (hourValue * wageValue * multiplierValue) / productionValue;
}
function formatPlexxisDate(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || '').trim());
    if (!match)
        return String(dateString || '');
    const [, year, month, day] = match;
    return `${Number(month)}/${Number(day)}/${year}`;
}
function buildEmptyDayDateRecord() {
    return {
        sun: '',
        mon: '',
        tue: '',
        wed: '',
        thu: '',
        fri: '',
        sat: '',
    };
}
function buildWeekDateRecord(weekStartDate) {
    const dates = buildEmptyDayDateRecord();
    const trimmed = String(weekStartDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
        return dates;
    const base = new Date(`${trimmed}T00:00:00Z`);
    DAY_KEYS.forEach((key, index) => {
        const date = new Date(base);
        date.setUTCDate(base.getUTCDate() + index);
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        dates[key] = `${yyyy}-${mm}-${dd}`;
    });
    return dates;
}
function mergeDayDates(target, sourceDays) {
    for (const day of Array.isArray(sourceDays) ? sourceDays : []) {
        const idx = typeof day?.dayOfWeek === 'number' && day.dayOfWeek >= 0 && day.dayOfWeek < DAY_KEYS.length
            ? day.dayOfWeek
            : sourceDays.indexOf(day);
        const key = DAY_KEYS[idx];
        if (key === undefined)
            continue;
        const date = String(day?.date || '').trim();
        if (date)
            target[key] = date;
    }
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
function formatDateOnly(value) {
    const yyyy = value.getUTCFullYear();
    const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(value.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function parseDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim()))
        return null;
    const parsed = new Date(`${String(value || '').trim()}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return formatDateOnly(parsed) === String(value || '').trim() ? parsed : null;
}
function formatWeekEndingLabel(value) {
    const normalized = String(value || '').trim();
    if (!normalized)
        return '';
    return formatPlexxisDate(normalized);
}
function deriveEmployeeNameParts(timecard) {
    const firstName = String(timecard?.firstName || '').trim();
    const lastName = String(timecard?.lastName || '').trim();
    if (firstName || lastName) {
        return {
            firstName,
            lastName,
            employeeName: `${firstName} ${lastName}`.trim() || String(timecard?.employeeName || '').trim() || 'Unnamed Employee',
        };
    }
    const employeeName = String(timecard?.employeeName || '').trim();
    if (!employeeName) {
        return { firstName: '', lastName: '', employeeName: 'Unnamed Employee' };
    }
    if (employeeName.includes(',')) {
        const [rawLastName, rawFirstName] = employeeName.split(',', 2);
        return {
            firstName: String(rawFirstName || '').trim(),
            lastName: String(rawLastName || '').trim(),
            employeeName,
        };
    }
    const parts = employeeName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return {
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' '),
            employeeName,
        };
    }
    return {
        firstName: employeeName,
        lastName: '',
        employeeName,
    };
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
    const employeeName = String(timecard?.fullName || timecard?.employeeName || '').trim();
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
function getTimecardDisplayEmployeeCode(timecard) {
    return String(timecard?.employeeNumber || timecard?.employeeCode || '').trim();
}
function toNullableNumber(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || Number.isNaN(numeric))
        return null;
    return numeric;
}
async function hydrateTimecardIdentityFields(timecards) {
    const entries = Array.isArray(timecards) ? timecards : [];
    if (!entries.length)
        return [];
    const employeeIds = Array.from(new Set(entries
        .map((timecard) => String(timecard?.employeeId || '').trim())
        .filter(Boolean)));
    const rosterKeys = Array.from(new Set(entries
        .map((timecard) => {
        const jobId = String(timecard?.jobId || timecard?.__jobId || '').trim();
        const rosterId = String(timecard?.employeeRosterId || '').trim();
        return jobId && rosterId ? `${jobId}:${rosterId}` : '';
    })
        .filter(Boolean)));
    const employeeDirectory = new Map();
    const rosterDirectory = new Map();
    if (employeeIds.length) {
        const employeeSnapshots = await Promise.all(employeeIds.map(async (employeeId) => ({
            employeeId,
            snap: await runtime_1.db.collection('employees').doc(employeeId).get(),
        })));
        employeeSnapshots.forEach(({ employeeId, snap }) => {
            if (snap.exists) {
                employeeDirectory.set(employeeId, snap.data() || {});
            }
        });
    }
    if (rosterKeys.length) {
        const rosterSnapshots = await Promise.all(rosterKeys.map(async (key) => {
            const separatorIndex = key.indexOf(':');
            const jobId = key.slice(0, separatorIndex);
            const rosterId = key.slice(separatorIndex + 1);
            return {
                key,
                snap: await runtime_1.db.collection(constants_1.COLLECTIONS.JOBS).doc(jobId).collection('roster').doc(rosterId).get(),
            };
        }));
        rosterSnapshots.forEach(({ key, snap }) => {
            if (snap.exists) {
                rosterDirectory.set(key, snap.data() || {});
            }
        });
    }
    return entries.map((timecard) => {
        const employeeId = String(timecard?.employeeId || '').trim();
        const jobId = String(timecard?.jobId || timecard?.__jobId || '').trim();
        const rosterId = String(timecard?.employeeRosterId || '').trim();
        const rosterKey = jobId && rosterId ? `${jobId}:${rosterId}` : '';
        const employeeRecord = employeeDirectory.get(employeeId) || {};
        const rosterRecord = rosterKey ? (rosterDirectory.get(rosterKey) || {}) : {};
        const firstName = String(timecard?.firstName
            || employeeRecord?.firstName
            || rosterRecord?.firstName
            || '').trim();
        const lastName = String(timecard?.lastName
            || employeeRecord?.lastName
            || rosterRecord?.lastName
            || '').trim();
        const fallbackFullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const fullName = String(timecard?.fullName
            || timecard?.employeeName
            || fallbackFullName
            || [employeeRecord?.firstName, employeeRecord?.lastName].filter(Boolean).join(' ')
            || [rosterRecord?.firstName, rosterRecord?.lastName].filter(Boolean).join(' ')
            || '').trim();
        const employeeName = String(timecard?.employeeName || fullName).trim();
        const employeeNumber = String(timecard?.employeeNumber
            || timecard?.employeeCode
            || employeeRecord?.employeeNumber
            || rosterRecord?.employeeNumber
            || '').trim();
        const occupation = String(timecard?.occupation
            || employeeRecord?.occupation
            || rosterRecord?.occupation
            || '').trim();
        const wageRate = toNullableNumber(timecard?.wageRate
            ?? timecard?.employeeWage
            ?? timecard?.wage
            ?? employeeRecord?.wageRate
            ?? rosterRecord?.wageRate);
        return {
            ...timecard,
            firstName,
            lastName,
            fullName,
            employeeName,
            employeeNumber,
            occupation,
            wageRate,
            employeeWage: timecard?.employeeWage ?? wageRate,
            wage: timecard?.wage ?? wageRate,
        };
    });
}
async function prepareTimecardsForPdfCsvExport(timecards) {
    const hydratedTimecards = await hydrateTimecardIdentityFields(timecards);
    return hydratedTimecards.map(normalizeTimecardForEmail);
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
function getLineSummaryCostForForm(line, employeeWage, productionBurden) {
    const totalHours = getLineTotalHoursForForm(line);
    const totalProduction = getLineTotalProductionForForm(line);
    if (totalHours <= 0 || totalProduction <= 0)
        return 0;
    return calculateUnitCostForExport(employeeWage, totalHours, totalProduction, productionBurden);
}
function getLineTotalCostForForm(line, employeeWage, productionBurden) {
    if (employeeWage !== undefined) {
        const summaryCost = getLineSummaryCostForForm(line, employeeWage, productionBurden);
        if (summaryCost > 0)
            return summaryCost;
    }
    const fromTotals = toNumber(line?.totals?.lineTotal);
    if (fromTotals > 0)
        return fromTotals;
    return getLineMonSatCost(line);
}
function hasMeaningfulLineDataForPdf(line) {
    const totalHours = getLineTotalHoursForForm(line);
    const totalProduction = getLineTotalProductionForForm(line);
    const totalCost = getLineMonSatCost(line);
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
            const employeeName = formatPlexxisEmployeeName(tc) || getTimecardDisplayEmployeeCode(tc) || 'Unknown employee';
            mismatches.push(`${employeeName}: PDF ${roundToHundredths(pdfHours)} vs CSV ${roundToHundredths(csvHours)}`);
        }
    }
    if (mismatches.length) {
        throw new https_2.HttpsError('internal', `Hour parity validation failed: ${mismatches.slice(0, 8).join('; ')}`);
    }
}
async function loadDailyLogAttachments(log) {
    const attachments = [];
    const dailyLogPayload = (0, emailService_1.normalizeDailyLogEmailPayload)(log);
    const files = Array.isArray(dailyLogPayload.attachments) ? dailyLogPayload.attachments : [];
    let totalBytes = 0;
    for (const att of files) {
        if (!att?.path)
            continue;
        if (attachments.length >= MAX_ATTACHMENT_COUNT) {
            console.warn('[sendDailyLogEmail] Skipping extra attachments beyond limit', { limit: MAX_ATTACHMENT_COUNT });
            break;
        }
        try {
            const file = runtime_1.storageBucket.file(att.path);
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
        const datesByDay = buildWeekDateRecord(String(tc?.weekStartDate || ''));
        const days = Array.isArray(source?.days) ? source.days : [];
        const timecardDays = Array.isArray(tc?.days) ? tc.days : [];
        mergeDayDates(datesByDay, timecardDays);
        mergeDayDates(datesByDay, days);
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
            const computedUnitCost = calculateUnitCostForExport(employeeWage, hoursByDay[key], productionByDay[key], tc?.productionBurden);
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
            dates: { ...datesByDay },
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
 * Send Daily Log via email
 */
exports.sendDailyLogEmail = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)() }, async (request) => {
    if (!request.auth) {
        throw new Error(constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    const callerUid = request.auth.uid;
    const { jobId, dailyLogId } = request.data;
    if (!jobId) {
        throw new Error(constants_1.ERROR_MESSAGES.JOB_ID_REQUIRED);
    }
    if (!dailyLogId) {
        throw new Error(constants_1.ERROR_MESSAGES.DAILY_LOG_ID_REQUIRED);
    }
    try {
        const user = await (0, firestoreService_1.getUserProfile)(callerUid);
        const authorizedUser = assertAdminOrAssignedForeman(user, jobId, 'Only admins or assigned foremen can send daily log emails');
        if (!(0, emailService_1.isEmailEnabled)()) {
            console.log('[sendDailyLogEmail] Email sending disabled. Skipping send.');
            return { success: true, message: 'Email sending disabled. Skipped.' };
        }
        const log = await (0, firestoreService_1.getDailyLog)(jobId, dailyLogId);
        if (!log) {
            throw new Error(constants_1.ERROR_MESSAGES.DAILY_LOG_NOT_FOUND);
        }
        if (String(log?.status || '').trim().toLowerCase() !== 'submitted') {
            throw new https_2.HttpsError('failed-precondition', 'Only submitted daily logs can be emailed');
        }
        const logOwnerUserId = String(log?.foremanUserId || log?.uid || log?.createdByUserId || '').trim();
        if (authorizedUser.role === 'foreman' && logOwnerUserId !== callerUid) {
            throw new https_2.HttpsError('permission-denied', 'Foremen can only email their own daily logs');
        }
        const settings = await (0, firestoreService_1.getEmailSettings)();
        const recipients = normalizeRecipients(settings.globalNotificationRecipients.dailyLogs, await (0, firestoreService_1.getJobNotificationRecipients)(jobId, 'dailyLogs'), log?.additionalRecipients);
        if (!recipients.length) {
            throw new https_2.HttpsError('failed-precondition', constants_1.ERROR_MESSAGES.RECIPIENTS_REQUIRED);
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
        if (error instanceof https_2.HttpsError)
            throw error;
        throw new https_2.HttpsError('internal', error?.message || 'Failed to send daily log email');
    }
});
function buildTimecardCsv(timecards, weekStart, defaultJobCode) {
    const headers = ['Employee Name', 'Employee Code', 'Job Code', 'DETAIL_DATE', 'Sub-Section', 'Activity Code', 'Cost Code', 'H_Hours', 'P_HOURS', '', ''];
    const fixedDataRowCount = 108;
    const blankRow = Array(headers.length).fill('');
    const rows = [headers, [...blankRow]];
    const fallbackDates = buildWeekDateRecord(weekStart);
    for (const tc of Array.isArray(timecards) ? timecards : []) {
        const lines = Array.isArray(tc?.lines) && tc.lines.length ? tc.lines : [];
        const employeeName = formatPlexxisEmployeeName(tc);
        const employeeCode = getTimecardDisplayEmployeeCode(tc);
        for (const line of lines) {
            const subSection = getLineSubSection(line);
            const activityCode = sanitizeActivityCode(getLineActivityCode(line), line, [
                String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || defaultJobCode || '').trim(),
                getTimecardDisplayEmployeeCode(tc),
            ]);
            const costCode = getLineCostCode(line);
            const rowJobCode = String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || defaultJobCode || '').trim();
            for (const key of DAY_KEYS) {
                const dayHours = toNumber(line?.[key]);
                const dayProduction = toNumber(line?.production?.[key]);
                const hasData = dayHours > 0 || dayProduction > 0;
                if (!hasData)
                    continue;
                rows.push([
                    employeeName,
                    employeeCode,
                    rowJobCode,
                    formatPlexxisDate(String(line?.dates?.[key] || fallbackDates[key] || tc?.weekEndingDate || '')),
                    subSection,
                    activityCode,
                    costCode,
                    formatPlexxisNumber(dayHours, true),
                    formatPlexxisNumber(dayProduction, true),
                    '',
                    '',
                ]);
            }
        }
    }
    while (rows.length < fixedDataRowCount + 1) {
        rows.push([...blankRow]);
    }
    return rows
        .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
        .join('\r\n');
}
function buildTimecardExportPeriodLabel(startWeek, endWeek) {
    const normalizedStartWeek = String(startWeek || '').trim();
    const normalizedEndWeek = String(endWeek || startWeek || '').trim() || normalizedStartWeek;
    const startLabel = getWeekEndingFromWeekStart(normalizedStartWeek);
    const endLabel = getWeekEndingFromWeekStart(normalizedEndWeek);
    if (normalizedStartWeek && normalizedStartWeek === normalizedEndWeek) {
        return startLabel || normalizedStartWeek;
    }
    if (startLabel && endLabel) {
        return `${startLabel}_to_${endLabel}`;
    }
    return normalizedStartWeek === normalizedEndWeek
        ? normalizedStartWeek || 'timecards'
        : `${normalizedStartWeek || 'start'}_to_${normalizedEndWeek || 'end'}`;
}
function buildTimecardCsvFilename(startWeek, endWeek, jobCode) {
    const periodLabel = buildTimecardExportPeriodLabel(startWeek, endWeek);
    const normalizedJobCode = String(jobCode || '').trim();
    return normalizedJobCode ? `${periodLabel} ${normalizedJobCode}.csv` : `${periodLabel}.csv`;
}
function buildTimecardPdfFilename(startWeek, endWeek, jobCode) {
    const periodLabel = buildTimecardExportPeriodLabel(startWeek, endWeek);
    const normalizedJobCode = String(jobCode || '').trim();
    return normalizedJobCode ? `${periodLabel} ${normalizedJobCode}.pdf` : `${periodLabel}.pdf`;
}
async function buildTimecardPdfBuffer(payload) {
    // Use a true landscape page so the emailed PDF prints in the same orientation
    // as the legacy workbook instead of relying on rotated portrait content.
    const doc = new pdfkit_1.default({ margin: 24, size: 'LETTER', layout: 'landscape' });
    const chunks = [];
    const monSatKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const safeText = (value) => String(value ?? '').trim() || '-';
    const fmt = (value, blankWhenZero = false) => {
        const numeric = toNumber(value);
        if (blankWhenZero && numeric === 0)
            return '';
        return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    };
    const fmtWorkbookEntry = (value, decimals = 2, blankWhenZero = false) => {
        const numeric = toNumber(value);
        if (blankWhenZero && numeric === 0)
            return '';
        return numeric.toFixed(decimals);
    };
    const fmtWorkbookHoursTotal = (value, blankWhenZero = false) => {
        const numeric = toNumber(value);
        if (blankWhenZero && numeric === 0)
            return '';
        return numeric.toFixed(1);
    };
    const fmtWorkbookCost = (value, blankWhenZero = false) => {
        const numeric = toNumber(value);
        if (blankWhenZero && numeric === 0)
            return '';
        return numeric.toFixed(2);
    };
    const fmtWorkbookSummaryCost = (value, blankWhenZero = false) => {
        const numeric = toNumber(value);
        if (blankWhenZero && numeric === 0)
            return '';
        return numeric.toFixed(3);
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
        ? formatWeekEndingLabel(formatDateOnly(weekEndDate))
        : safeText(payload.weekStart);
    await new Promise((resolve, reject) => {
        doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        doc.on('end', () => resolve());
        doc.on('error', (err) => reject(err));
        const sumWidths = (widths, startIndex, endIndexExclusive) => (widths.slice(startIndex, endIndexExclusive).reduce((sum, current) => sum + current, 0));
        const getColumnX = (x, colWidths, index) => (x + sumWidths(colWidths, 0, index));
        const drawCell = (x, y, width, height, text, options) => {
            doc.lineWidth(0.5).strokeColor('#111111').rect(x, y, width, height).stroke();
            const paddingX = options?.paddingX ?? 1.2;
            const paddingY = options?.paddingY ?? 1.2;
            const fontSize = options?.fontSize ?? 6.0;
            const lineHeight = fontSize * 1.15;
            const textOffsetY = options?.textOffsetY ?? 0;
            const textY = (options?.verticalAlign === 'middle'
                ? y + Math.max((height - lineHeight) / 2, paddingY)
                : y + paddingY) + textOffsetY;
            doc
                .font(options?.fontName || (options?.bold ? 'Helvetica-Bold' : 'Helvetica'))
                .fontSize(fontSize)
                .fillColor('#111111')
                .text(text, x + paddingX, textY, {
                width: Math.max(width - (paddingX * 2), 0),
                height: Math.max(height - (paddingY * 2), 0),
                align: options?.align ?? 'center',
                ellipsis: true,
            });
        };
        const drawGridRow = (x, y, colWidths, rowHeight, cells, options) => {
            let cx = x;
            const aligns = options?.align || [];
            doc.lineWidth(0.5).strokeColor('#111111');
            for (let i = 0; i < colWidths.length; i++) {
                const cellWidth = colWidths[i] || 0;
                const text = cells[i] ?? '';
                const align = aligns[i] || 'center';
                drawCell(cx, y, cellWidth, rowHeight, text, {
                    bold: options?.bold,
                    fontSize: options?.fontSize,
                    fontName: options?.fontName,
                    align,
                    verticalAlign: 'middle',
                });
                cx += cellWidth;
            }
        };
        const drawWorkbookDaySeparators = (x, yTop, yBottom, colWidths) => {
            const separatorIndexes = [6, 7, 8, 9, 10];
            separatorIndexes.forEach((index) => {
                const separatorX = getColumnX(x, colWidths, index);
                doc.save();
                doc
                    .lineWidth(1.1)
                    .strokeColor('#ffffff')
                    .moveTo(separatorX, yTop)
                    .lineTo(separatorX, yBottom)
                    .stroke();
                doc
                    .dash(1.2, { space: 1.1 })
                    .lineWidth(0.5)
                    .strokeColor('#111111')
                    .moveTo(separatorX, yTop)
                    .lineTo(separatorX, yBottom)
                    .stroke()
                    .undash();
                doc.restore();
            });
        };
        const drawUnderlinedField = (x, y, width, rowHeight, label, value, align = 'left') => {
            const normalizedLabel = String(label || '').trim();
            const normalizedValue = String(value || '').trim();
            const labelInset = 2;
            const labelFontSize = 6.8;
            const valueFontSize = 7.0;
            if (!normalizedLabel && !normalizedValue)
                return;
            doc.font('Helvetica-Oblique').fontSize(labelFontSize);
            const labelWidth = normalizedLabel
                ? Math.min(doc.widthOfString(normalizedLabel) + 8, width * 0.42)
                : 12;
            const lineStart = x + Math.max(labelWidth + labelInset, 18);
            const lineEnd = x + width - 2;
            const lineY = y + rowHeight - 3;
            if (normalizedLabel) {
                doc
                    .font('Helvetica-Oblique')
                    .fontSize(labelFontSize)
                    .fillColor('#111111')
                    .text(normalizedLabel, x + labelInset, y + 2, {
                    width: Math.max(labelWidth - labelInset, 0),
                    align: 'left',
                    ellipsis: true,
                });
            }
            if (lineStart < lineEnd) {
                doc.moveTo(lineStart, lineY).lineTo(lineEnd, lineY).stroke();
            }
            if (normalizedValue) {
                doc
                    .font('Helvetica-Bold')
                    .fontSize(valueFontSize)
                    .fillColor('#111111')
                    .text(normalizedValue, lineStart + 2, y + 2, {
                    width: Math.max(lineEnd - lineStart - 2, 0),
                    align,
                    ellipsis: true,
                });
            }
        };
        const drawWorkbookGroupCell = (x, y, width, rowHeight, values, options) => {
            const groupHeight = rowHeight * 3;
            drawCell(x, y, width, groupHeight, '', {
                fontSize: options?.fontSize,
                align: options?.align ?? 'center',
                verticalAlign: 'middle',
            });
            const fontSize = options?.fontSize ?? 5.8;
            const align = options?.align ?? 'right';
            const paddingX = options?.paddingX ?? 1.6;
            const lineInsetY = Math.max((rowHeight - fontSize) / 2, 0.9);
            values.forEach((value, index) => {
                if (!value)
                    return;
                doc
                    .font('Helvetica')
                    .fontSize(fontSize)
                    .fillColor('#111111')
                    .text(value, x + paddingX, y + (rowHeight * index) + lineInsetY, {
                    width: Math.max(width - (paddingX * 2), 0),
                    align,
                    ellipsis: true,
                });
            });
        };
        const drawFooterUnderlinedValue = (x, y, width, rowHeight, label, value, options) => {
            const labelInset = 2;
            const labelFontSize = 5.8;
            const valueFontSize = 6.2;
            doc.font('Helvetica').fontSize(labelFontSize);
            const labelWidth = Math.max(doc.widthOfString(label) + 5, 16);
            const lineStart = x + labelWidth + labelInset;
            const lineEnd = x + width - 2;
            const lineY = y + rowHeight - 2.2;
            doc
                .font('Helvetica')
                .fontSize(labelFontSize)
                .fillColor('#111111')
                .text(label, x + labelInset, y + 1.4, {
                width: Math.max(labelWidth, 0),
                align: 'left',
                ellipsis: true,
            });
            if (lineStart < lineEnd) {
                doc.moveTo(lineStart, lineY).lineTo(lineEnd, lineY).stroke();
            }
            if (value) {
                const valueOffsetY = options?.valueOffsetY ?? 0;
                doc
                    .font('Helvetica')
                    .fontSize(valueFontSize)
                    .fillColor('#111111')
                    .text(value, lineStart + 2, y + 1.1 + valueOffsetY, {
                    width: Math.max(lineEnd - lineStart - 2, 0),
                    align: 'center',
                    ellipsis: true,
                });
            }
        };
        const drawHeaderFieldRow = (x, y, width, rowHeight, leftField, rightField) => {
            const leftWidth = Math.round(width * 0.62 * 1000) / 1000;
            drawUnderlinedField(x, y, leftWidth, rowHeight, leftField.label, leftField.value, 'left');
            drawUnderlinedField(x + leftWidth, y, width - leftWidth, rowHeight, rightField.label, rightField.value, 'right');
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
                .font('Helvetica')
                .fontSize(9.8)
                .fillColor('#111111')
                .text('PHASE 2 COMPANY', innerX, cursorY, { width: innerWidth, align: 'center' });
            cursorY += 14;
            const employeeName = renderBlankTemplate ? '' : formatPlexxisEmployeeName(tc);
            const employeeCode = renderBlankTemplate ? '' : getTimecardDisplayEmployeeCode(tc);
            const occupation = renderBlankTemplate ? '' : String(tc?.occupation || '').trim();
            const wageNumeric = toNumber(tc?.employeeWage ?? tc?.wage);
            const wageSource = tc?.employeeWage ?? tc?.wage ?? '';
            const wageLabel = renderBlankTemplate ? '' : (wageNumeric > 0 ? `$${wageNumeric.toFixed(2)}` : (String(wageSource).trim() || '-'));
            const cardWeekEnding = String(tc?.weekEndingDate || '').trim()
                || getWeekEndingFromWeekStart(String(tc?.weekStartDate || '').trim());
            const weekEnding = renderBlankTemplate ? '' : formatWeekEndingLabel(cardWeekEnding) || weekEndingLabel;
            const fieldRowHeight = 11.5;
            drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, {
                label: 'EMP. NAME:',
                value: employeeName,
            }, {
                label: 'EMPLOYEE#',
                value: employeeCode,
            });
            cursorY += fieldRowHeight;
            drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, {
                label: 'OCCUPATION:',
                value: occupation,
            }, {
                label: 'Wage',
                value: wageLabel,
            });
            cursorY += fieldRowHeight;
            drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, {
                label: '',
                value: '',
            }, {
                label: 'WEEK ENDING',
                value: weekEnding,
            });
            cursorY += fieldRowHeight + 2;
            const footerHeight = 98;
            const gridTop = cursorY;
            const gridBottom = Math.max(gridTop + 30, innerY + innerHeight - footerHeight);
            const gridHeight = Math.max(gridBottom - gridTop, 30);
            const tableHeaderHeight = 11;
            const maxLineGroups = 13;
            const rowHeight = Math.max(5.5, (gridHeight - tableHeaderHeight) / (maxLineGroups * 3));
            const lineGroupHeight = rowHeight * 3;
            const columnWidths = percentWidths(innerWidth, [11.5, 5.5, 4, 9.5, 5.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 8.5, 8.5, 8.5]);
            const detailFontSize = rowHeight >= 6.25 ? 5.8 : 4.9;
            const costFontSize = rowHeight >= 6.25 ? 5.5 : 4.6;
            drawGridRow(innerX, gridTop, columnWidths, tableHeaderHeight, ['JOB #', '1', '', 'ACCT', 'DIF', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'TOTAL', 'PROD', 'OFF'], {
                fontSize: rowHeight >= 6.25 ? 5.9 : 5.1,
                fontName: 'Helvetica-Oblique',
                align: ['left', 'center', 'center', 'left', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center'],
            });
            let cursorDataY = gridTop + tableHeaderHeight;
            const lines = renderBlankTemplate ? [] : (Array.isArray(tc?.lines) ? tc.lines.filter((line) => hasMeaningfulLineDataForPdf(line)) : []);
            const employeeWage = toNumber(tc?.employeeWage ?? tc?.wage);
            for (let lineIndex = 0; lineIndex < maxLineGroups; lineIndex++) {
                const line = lines[lineIndex];
                const hasLine = !!line;
                const jobCode = hasLine ? String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || '').trim() : '';
                const account = hasLine
                    ? sanitizeActivityCode(getLineActivityCode(line), line, [
                        jobCode,
                        getTimecardDisplayEmployeeCode(tc),
                    ])
                    : '';
                const lineHoursTotal = hasLine ? getLineTotalHoursForForm(line) : 0;
                const lineProdTotal = hasLine ? getLineTotalProductionForForm(line) : 0;
                const lineCostTotal = hasLine ? getLineTotalCostForForm(line, employeeWage, tc?.productionBurden) : 0;
                const offHours = hasLine ? getLineOffHours(line) : 0;
                const offProduction = hasLine ? getLineOffProduction(line) : 0;
                const offCost = hasLine ? getLineOffCost(line) : 0;
                const subsectionArea = hasLine ? String(line?.subsectionArea || line?.area || '').trim() : '';
                const groupHeight = rowHeight * 3;
                const mergedColumns = [
                    { index: 0, text: jobCode, align: 'center' },
                    { index: 1, text: subsectionArea, align: 'center' },
                    { index: 3, text: account, align: 'center' },
                ];
                for (const column of mergedColumns) {
                    drawCell(getColumnX(innerX, columnWidths, column.index), cursorDataY, columnWidths[column.index] || 0, groupHeight, column.text, {
                        fontSize: detailFontSize,
                        align: column.align,
                        verticalAlign: 'middle',
                    });
                }
                const rowDefinitions = [
                    {
                        label: 'H',
                        diff: hasLine ? String(line?.difH || '').trim() : '',
                        dayValues: monSatKeys.map((key) => fmtWorkbookEntry(line?.[key], 2, true)),
                        fontSize: detailFontSize,
                    },
                    {
                        label: 'P',
                        diff: hasLine ? String(line?.difP || '').trim() : '',
                        dayValues: monSatKeys.map((key) => fmtWorkbookEntry(line?.production?.[key], 2, true)),
                        fontSize: detailFontSize,
                    },
                    {
                        label: 'C',
                        diff: hasLine ? String(line?.difC || '').trim() : '',
                        dayValues: monSatKeys.map((key) => fmtWorkbookCost(line?.unitCost?.[key], true)),
                        fontSize: costFontSize,
                    },
                ];
                rowDefinitions.forEach((rowDef, rowIndex) => {
                    const rowY = cursorDataY + (rowIndex * rowHeight);
                    drawCell(getColumnX(innerX, columnWidths, 2), rowY, columnWidths[2] || 0, rowHeight, rowDef.label, {
                        bold: true,
                        fontSize: detailFontSize,
                        align: 'center',
                        verticalAlign: 'middle',
                    });
                    drawCell(getColumnX(innerX, columnWidths, 4), rowY, columnWidths[4] || 0, rowHeight, rowDef.diff, {
                        fontSize: rowDef.fontSize,
                        align: 'center',
                        verticalAlign: 'middle',
                    });
                });
                monSatKeys.forEach((key, dayOffset) => {
                    const columnIndex = 5 + dayOffset;
                    drawWorkbookGroupCell(getColumnX(innerX, columnWidths, columnIndex), cursorDataY, columnWidths[columnIndex] || 0, rowHeight, [
                        fmtWorkbookEntry(line?.[key], 2, true),
                        fmtWorkbookEntry(line?.production?.[key], 2, true),
                        fmtWorkbookCost(line?.unitCost?.[key], true),
                    ], {
                        fontSize: detailFontSize,
                        align: 'center',
                        paddingX: 1.6,
                    });
                });
                drawWorkbookGroupCell(getColumnX(innerX, columnWidths, 11), cursorDataY, columnWidths[11] || 0, rowHeight, [
                    hasLine ? fmtWorkbookHoursTotal(lineHoursTotal, true) : '',
                    '',
                    '',
                ], {
                    fontSize: detailFontSize,
                    align: 'center',
                    paddingX: 1.6,
                });
                drawWorkbookGroupCell(getColumnX(innerX, columnWidths, 12), cursorDataY, columnWidths[12] || 0, rowHeight, [
                    '',
                    hasLine ? fmt(lineProdTotal, true) : '',
                    hasLine ? fmtWorkbookSummaryCost(lineCostTotal, true) : '',
                ], {
                    fontSize: detailFontSize,
                    align: 'center',
                    paddingX: 1.6,
                });
                drawWorkbookGroupCell(getColumnX(innerX, columnWidths, 13), cursorDataY, columnWidths[13] || 0, rowHeight, [
                    hasLine ? fmtWorkbookHoursTotal(offHours, true) : '',
                    hasLine ? fmt(offProduction, true) : '',
                    hasLine ? fmtWorkbookCost(offCost, true) : '',
                ], {
                    fontSize: detailFontSize,
                    align: 'center',
                    paddingX: 1.6,
                });
                cursorDataY += groupHeight;
            }
            const footerTop = gridTop + tableHeaderHeight + (maxLineGroups * lineGroupHeight);
            const mondayHours = lines.reduce((sum, line) => sum + toNumber(line?.mon), 0);
            const tuesdayHours = lines.reduce((sum, line) => sum + toNumber(line?.tue), 0);
            const wednesdayHours = lines.reduce((sum, line) => sum + toNumber(line?.wed), 0);
            const thursdayHours = lines.reduce((sum, line) => sum + toNumber(line?.thu), 0);
            const fridayHours = lines.reduce((sum, line) => sum + toNumber(line?.fri), 0);
            const saturdayHours = lines.reduce((sum, line) => sum + toNumber(line?.sat), 0);
            const weekTotalHours = mondayHours + tuesdayHours + wednesdayHours + thursdayHours + fridayHours + saturdayHours;
            const totalsRowHeight = 11;
            drawWorkbookDaySeparators(innerX, gridTop + tableHeaderHeight, footerTop + totalsRowHeight, columnWidths);
            drawCell(innerX, footerTop, sumWidths(columnWidths, 0, 5), totalsRowHeight, 'TOTAL HOURS', {
                bold: true,
                fontSize: 5.8,
                align: 'right',
                verticalAlign: 'middle',
                paddingX: 4,
                textOffsetY: 0.45,
            });
            [
                mondayHours,
                tuesdayHours,
                wednesdayHours,
                thursdayHours,
                fridayHours,
                saturdayHours,
            ].forEach((dayTotal, dayOffset) => {
                const columnIndex = 5 + dayOffset;
                drawCell(getColumnX(innerX, columnWidths, columnIndex), footerTop, columnWidths[columnIndex] || 0, totalsRowHeight, fmtWorkbookHoursTotal(dayTotal, true), {
                    bold: true,
                    fontSize: 5.8,
                    align: 'center',
                    verticalAlign: 'middle',
                    paddingX: 1.2,
                    textOffsetY: 0.45,
                });
            });
            drawCell(getColumnX(innerX, columnWidths, 11), footerTop, columnWidths[11] || 0, totalsRowHeight, fmtWorkbookHoursTotal(weekTotalHours, true), {
                bold: true,
                fontSize: 5.8,
                align: 'center',
                verticalAlign: 'middle',
                paddingX: 1.2,
                textOffsetY: 0.45,
            });
            drawCell(getColumnX(innerX, columnWidths, 12), footerTop, columnWidths[12] || 0, totalsRowHeight, '', { bold: true });
            drawCell(getColumnX(innerX, columnWidths, 13), footerTop, columnWidths[13] || 0, totalsRowHeight, '', { bold: true });
            const totalHoursForFooter = Math.max(0, toNumber(weekTotalHours));
            const regularOverride = toNumber(tc?.regularHoursOverride);
            const overtimeOverride = toNumber(tc?.overtimeHoursOverride);
            const hasRegularOverride = tc?.regularHoursOverride != null && tc?.regularHoursOverride !== '';
            const hasOvertimeOverride = tc?.overtimeHoursOverride != null && tc?.overtimeHoursOverride !== '';
            let otHours = '';
            let regHours = '';
            if (!renderBlankTemplate) {
                if (hasRegularOverride || hasOvertimeOverride) {
                    regHours = hasRegularOverride ? fmt(regularOverride, true) : '';
                    otHours = hasOvertimeOverride ? fmt(overtimeOverride, true) : '';
                }
                else if (totalHoursForFooter <= 40) {
                    regHours = totalHoursForFooter > 0 ? fmt(totalHoursForFooter) : '';
                }
                else {
                    regHours = fmt(40);
                    otHours = fmt(totalHoursForFooter - 40, true);
                }
            }
            const footerSectionGap = 8;
            const footerLabelRowY = footerTop + totalsRowHeight + footerSectionGap;
            const footerLabelRowHeight = 6;
            const footerInputRowY = footerLabelRowY + footerLabelRowHeight;
            const footerInputRowHeight = 9;
            const footerSecondRowY = footerInputRowY + footerInputRowHeight;
            const footerFields = [
                {
                    label: 'JOB or GL',
                    value: safeText(renderBlankTemplate ? '' : tc?.footerJobOrGl).replace(/^-\s*$/, ''),
                    start: 0,
                    end: 2,
                },
                {
                    label: 'ACCT',
                    value: safeText(renderBlankTemplate ? '' : tc?.footerAccount).replace(/^-\s*$/, ''),
                    start: 2,
                    end: 4,
                },
                {
                    label: 'OFFICE',
                    value: safeText(renderBlankTemplate ? '' : tc?.footerOffice).replace(/^-\s*$/, ''),
                    start: 4,
                    end: 6,
                },
                {
                    label: 'AMT',
                    value: safeText(renderBlankTemplate ? '' : tc?.footerAmount).replace(/^-\s*$/, ''),
                    start: 6,
                    end: 8,
                },
            ];
            footerFields.forEach((field) => {
                const fieldX = getColumnX(innerX, columnWidths, field.start);
                const fieldWidth = sumWidths(columnWidths, field.start, field.end);
                doc
                    .font('Helvetica')
                    .fontSize(5.4)
                    .fillColor('#111111')
                    .text(field.label, fieldX, footerLabelRowY + 0.5, {
                    width: fieldWidth,
                    align: 'center',
                    ellipsis: true,
                });
                drawCell(fieldX, footerInputRowY, fieldWidth, footerInputRowHeight, field.value, {
                    fontSize: 6.0,
                    align: 'center',
                    verticalAlign: 'middle',
                });
                drawCell(fieldX, footerSecondRowY, fieldWidth, footerInputRowHeight, '', {
                    fontSize: 6.0,
                    align: 'center',
                    verticalAlign: 'middle',
                });
            });
            const otRegX = getColumnX(innerX, columnWidths, 10);
            const otRegWidth = sumWidths(columnWidths, 10, 12);
            const otRegRowHeight = 8.5;
            drawFooterUnderlinedValue(otRegX, footerLabelRowY + 0.8, otRegWidth, otRegRowHeight, 'OT', otHours, {
                valueOffsetY: -0.45,
            });
            drawFooterUnderlinedValue(otRegX, footerSecondRowY + 1.2, otRegWidth, otRegRowHeight, 'REG', regHours, {
                valueOffsetY: -0.45,
            });
            const notesY = Math.max(footerSecondRowY + footerInputRowHeight + 12, bottom - 18);
            const notesLabel = 'NOTES:';
            doc.font('Helvetica-Bold').fontSize(6.6);
            const notesLabelWidth = Math.max(doc.widthOfString(notesLabel) + 6, 34);
            doc
                .font('Helvetica-Bold')
                .fontSize(6.6)
                .fillColor('#111111')
                .text(notesLabel, innerX + 2, notesY, {
                width: notesLabelWidth,
                align: 'left',
                ellipsis: true,
            });
            const notesLineStart = innerX + notesLabelWidth + 2;
            const notesLineEnd = innerX + innerWidth - 2;
            const notesLineY = notesY + 7;
            if (notesLineStart < notesLineEnd) {
                doc.moveTo(notesLineStart, notesLineY).lineTo(notesLineEnd, notesLineY).stroke();
            }
            const notesText = renderBlankTemplate ? '' : String(tc?.notes || '').trim();
            if (notesText) {
                doc
                    .font('Helvetica')
                    .fontSize(6.2)
                    .fillColor('#111111')
                    .text(notesText, notesLineStart + 2, notesY - 1, {
                    width: Math.max(notesLineEnd - notesLineStart - 2, 0),
                    height: Math.max(bottom - notesY - 2, 10),
                    align: 'left',
                    ellipsis: true,
                });
            }
        };
        const timecards = (Array.isArray(payload.timecards) ? payload.timecards : []).filter((tc) => hasMeaningfulTimecard(tc));
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const marginLeft = doc.page.margins.left || 24;
        const marginTop = doc.page.margins.top || 24;
        const marginRight = doc.page.margins.right || 24;
        const marginBottom = doc.page.margins.bottom || 24;
        const contentLeft = marginLeft;
        const contentTop = marginTop;
        const contentWidth = pageWidth - marginLeft - marginRight;
        const contentHeight = pageHeight - marginTop - marginBottom;
        const columnGap = 10;
        const cardWidth = (contentWidth - columnGap) / 2;
        if (!timecards.length) {
            doc
                .font('Helvetica')
                .fontSize(10)
                .fillColor('#111111')
                .text('No submitted timecards found.', contentLeft, contentTop);
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
            drawTimecardCard(timecards[idx], leftX, cardTop, cardWidth, cardHeight, false);
            if (idx + 1 < timecards.length) {
                drawTimecardCard(timecards[idx + 1], rightX, cardTop, cardWidth, cardHeight, false);
            }
        }
        doc.end();
    });
    return Buffer.concat(chunks);
}
/**
 * Send Shop Order via email
 */
exports.sendShopOrderEmail = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)() }, async (request) => {
    if (!request.auth) {
        throw new Error(constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    const { jobId, shopOrderId } = request.data;
    if (!jobId) {
        throw new Error(constants_1.ERROR_MESSAGES.JOB_ID_REQUIRED);
    }
    if (!shopOrderId) {
        throw new Error(constants_1.ERROR_MESSAGES.SHOP_ORDER_ID_REQUIRED);
    }
    try {
        const user = await (0, firestoreService_1.getUserProfile)(request.auth.uid);
        assertAdminOrAssignedForeman(user, jobId, 'Only admins or assigned foremen can send shop order emails');
        if (!(0, emailService_1.isEmailEnabled)()) {
            console.log('[sendShopOrderEmail] Email sending disabled. Skipping send.');
            return { success: true, message: 'Email sending disabled. Skipped.' };
        }
        const requestedRecipients = Array.isArray(request.data?.recipients)
            ? request.data.recipients
            : [];
        const settings = await (0, firestoreService_1.getEmailSettings)();
        const recipients = normalizeRecipients(requestedRecipients, settings.globalNotificationRecipients.shopOrders, await (0, firestoreService_1.getJobNotificationRecipients)(jobId, 'shopOrders'));
        if (!recipients.length) {
            throw new https_2.HttpsError('failed-precondition', constants_1.ERROR_MESSAGES.RECIPIENTS_REQUIRED);
        }
        let order = null;
        const rootOrder = await (0, firestoreService_1.getShopOrder)(shopOrderId);
        // Prefer the job-scoped record when it exists, but fill missing fields from
        // the current root record so legacy partial docs do not hide newer metadata.
        const jobOrderSnap = await runtime_1.db.collection(constants_1.COLLECTIONS.JOBS).doc(jobId).collection('shop_orders').doc(shopOrderId).get();
        if (jobOrderSnap.exists) {
            const jobOrderData = jobOrderSnap.data() || {};
            const rootDeliveryDate = String(rootOrder?.deliveryDate || '').trim();
            const jobDeliveryDate = String(jobOrderData.deliveryDate || '').trim();
            order = {
                ...(rootOrder || {}),
                id: jobOrderSnap.id,
                ...jobOrderData,
                jobId,
            };
            if (!jobDeliveryDate && rootDeliveryDate) {
                order.deliveryDate = rootDeliveryDate;
            }
        }
        else {
            order = rootOrder;
        }
        if (!order) {
            throw new Error(constants_1.ERROR_MESSAGES.SHOP_ORDER_NOT_FOUND);
        }
        const resolvedJobId = String(order?.jobId || jobId).trim();
        if (resolvedJobId && resolvedJobId !== String(jobId).trim()) {
            throw new https_2.HttpsError('permission-denied', 'Shop order does not belong to the requested job');
        }
        const job = await (0, firestoreService_1.getJobDetails)(resolvedJobId || jobId);
        const costCodesByCatalogItemId = await getShopOrderCostCodesByCatalogItemId(order?.items);
        const emailHtml = (0, emailService_1.buildShopOrderEmail)(order, costCodesByCatalogItemId);
        const pdfBuffer = await (0, emailService_1.buildShopOrderPdfBuffer)(order, costCodesByCatalogItemId);
        const orderDateLabel = formatEmailDate(order?.orderDate || order?.createdAt || order?.updatedAt);
        await (0, emailService_1.sendEmail)({
            to: recipients,
            subject: `${constants_1.EMAIL.SUBJECTS.SHOP_ORDER} - ${job?.name || 'Job'} - ${orderDateLabel}`,
            html: emailHtml,
            attachments: [
                {
                    name: (0, emailService_1.buildShopOrderPdfFilename)(order),
                    contentType: 'application/pdf',
                    contentBytes: pdfBuffer.toString('base64'),
                },
            ],
        });
        console.log(`Shop order ${shopOrderId} emailed to ${recipients.join(', ')}`);
        return { success: true, message: 'Email sent successfully' };
    }
    catch (error) {
        console.error('Error sending shop order email:', error);
        if (error instanceof https_2.HttpsError)
            throw error;
        throw new https_2.HttpsError('internal', error?.message || 'Failed to send shop order email');
    }
});
//# sourceMappingURL=operationsFunctions.js.map