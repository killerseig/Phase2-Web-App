"use strict";
/**
 * Firestore Service
 * Reusable queries and data fetching functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobDetails = getJobDetails;
exports.getUserProfile = getUserProfile;
exports.getUserDisplayName = getUserDisplayName;
exports.verifyAdminRole = verifyAdminRole;
exports.getDailyLog = getDailyLog;
exports.getShopOrder = getShopOrder;
exports.getEmailSettings = getEmailSettings;
exports.getJobNotificationRecipients = getJobNotificationRecipients;
const firestore_1 = require("firebase-admin/firestore");
const constants_1 = require("./constants");
// Lazy initialize db on first use
let db = null;
function getDb() {
    if (!db) {
        db = (0, firestore_1.getFirestore)();
    }
    return db;
}
function normalizeRecipientList(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)));
}
function normalizeIdList(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)));
}
function normalizeNotificationRecipients(value, legacyFallbacks) {
    const data = typeof value === 'object' && value !== null ? value : {};
    return {
        dailyLogs: normalizeRecipientList(data.dailyLogs ?? legacyFallbacks?.dailyLogs),
        timecards: normalizeRecipientList(data.timecards ?? legacyFallbacks?.timecards),
        shopOrders: normalizeRecipientList(data.shopOrders ?? legacyFallbacks?.shopOrders),
    };
}
function normalizeGlobalNotificationRecipients(value, legacyFallbacks) {
    const data = typeof value === 'object' && value !== null ? value : {};
    return {
        ...normalizeNotificationRecipients(data, legacyFallbacks),
        newJobs: normalizeRecipientList(data.newJobs),
        fieldUserAssignments: normalizeRecipientList(data.fieldUserAssignments),
    };
}
/**
 * Get job details by ID
 */
async function getJobDetails(jobId) {
    const jobSnap = await getDb().collection(constants_1.COLLECTIONS.JOBS).doc(jobId).get();
    if (!jobSnap.exists)
        return null;
    const data = jobSnap.data();
    return {
        id: jobSnap.id,
        name: data?.name || constants_1.DEFAULTS.JOB_NAME,
        number: data?.number || data?.code || '',
        projectManager: typeof data?.projectManager === 'string' ? data.projectManager.trim() || null : null,
        foreman: typeof data?.foreman === 'string' ? data.foreman.trim() || null : null,
        gc: typeof data?.gc === 'string' ? data.gc.trim() || null : null,
        jobAddress: typeof data?.jobAddress === 'string' ? data.jobAddress.trim() || null : null,
        assignedForemanIds: normalizeIdList(data?.assignedForemanIds),
        productionBurden: typeof data?.productionBurden === 'number' ? data.productionBurden : null,
    };
}
/**
 * Get user profile from Firestore
 */
async function getUserProfile(uid) {
    const userSnap = await getDb().collection(constants_1.COLLECTIONS.USERS).doc(uid).get();
    if (!userSnap.exists)
        return null;
    const data = userSnap.data();
    return {
        uid: userSnap.id,
        email: data?.email || '',
        firstName: data?.firstName || '',
        lastName: data?.lastName || '',
        displayName: data?.displayName,
        role: data?.role || 'none',
        active: data?.active ?? true,
        assignedJobIds: Array.isArray(data?.assignedJobIds) ? data.assignedJobIds : [],
    };
}
/**
 * Get formatted user display name (firstName lastName or displayName)
 */
async function getUserDisplayName(uid, fallback) {
    const user = await getUserProfile(uid);
    if (!user)
        return fallback || constants_1.DEFAULTS.USER_NAME;
    if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
    }
    return user.displayName || user.email || fallback || constants_1.DEFAULTS.USER_NAME;
}
/**
 * Verify that a user is an admin
 * Throws error if not an admin
 */
async function verifyAdminRole(uid) {
    const user = await getUserProfile(uid);
    if (!user) {
        throw new Error('Your user profile not found');
    }
    if (user.active !== true) {
        throw new Error('Only active admins can perform this action');
    }
    if (user.role !== 'admin') {
        throw new Error('Only admins can perform this action');
    }
}
/**
 * Get daily log by ID
 */
async function getDailyLog(jobId, dailyLogId) {
    const directLogSnap = await getDb().collection('dailyLogs').doc(dailyLogId).get();
    if (directLogSnap.exists) {
        const data = directLogSnap.data() || {};
        if (String(data.jobId || '').trim() === String(jobId || '').trim()) {
            return {
                id: directLogSnap.id,
                ...data,
                additionalRecipients: normalizeRecipientList(data.additionalRecipients),
            };
        }
    }
    const logSnap = await getDb()
        .collection('jobs')
        .doc(jobId)
        .collection('dailyLogs')
        .doc(dailyLogId)
        .get();
    if (!logSnap.exists)
        return null;
    return {
        id: logSnap.id,
        ...logSnap.data(),
        additionalRecipients: normalizeRecipientList(logSnap.data()?.additionalRecipients),
    };
}
/**
 * Get shop order by ID
 */
async function getShopOrder(shopOrderId) {
    const orderSnap = await getDb().collection(constants_1.COLLECTIONS.SHOP_ORDERS).doc(shopOrderId).get();
    if (!orderSnap.exists)
        return null;
    return {
        id: orderSnap.id,
        ...orderSnap.data(),
    };
}
/**
 * Get global email settings
 */
async function getEmailSettings() {
    const settingsSnap = await getDb().collection('settings').doc('email').get();
    if (!settingsSnap.exists) {
        return {
            timecardSubmitRecipients: [],
            shopOrderSubmitRecipients: [],
            dailyLogSubmitRecipients: [],
            globalNotificationRecipients: {
                dailyLogs: [],
                timecards: [],
                shopOrders: [],
                newJobs: [],
                fieldUserAssignments: [],
            },
        };
    }
    const data = settingsSnap.data() || {};
    const timecardSubmitRecipients = normalizeRecipientList(data.timecardSubmitRecipients);
    const shopOrderSubmitRecipients = normalizeRecipientList(data.shopOrderSubmitRecipients);
    const dailyLogSubmitRecipients = normalizeRecipientList(data.dailyLogSubmitRecipients);
    return {
        timecardSubmitRecipients,
        shopOrderSubmitRecipients,
        dailyLogSubmitRecipients,
        globalNotificationRecipients: normalizeGlobalNotificationRecipients(data.globalNotificationRecipients, {
            dailyLogs: dailyLogSubmitRecipients,
            timecards: timecardSubmitRecipients,
            shopOrders: shopOrderSubmitRecipients,
        }),
    };
}
async function getJobNotificationRecipients(jobId, moduleKey) {
    const jobSnap = await getDb().collection(constants_1.COLLECTIONS.JOBS).doc(jobId).get();
    if (!jobSnap.exists)
        return [];
    const data = jobSnap.data() || {};
    const notificationRecipients = normalizeNotificationRecipients(data.notificationRecipients, {
        dailyLogs: data.dailyLogRecipients,
    });
    const legacyOfficeDailyLogRecipients = moduleKey === 'dailyLogs' ? normalizeRecipientList(data.adminDailyLogRecipients) : [];
    return Array.from(new Set([...notificationRecipients[moduleKey], ...legacyOfficeDailyLogRecipients]));
}
//# sourceMappingURL=firestoreService.js.map