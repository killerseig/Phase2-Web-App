"use strict";
/**
 * Firestore Service
 * Reusable queries and data fetching functions
 */
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
exports.getJobDetails = getJobDetails;
exports.getUserProfile = getUserProfile;
exports.getUserDisplayName = getUserDisplayName;
exports.verifyAdminRole = verifyAdminRole;
exports.getDailyLog = getDailyLog;
exports.getTimecard = getTimecard;
exports.getShopOrder = getShopOrder;
exports.getEmailSettings = getEmailSettings;
exports.getJobNotificationRecipients = getJobNotificationRecipients;
const admin = __importStar(require("firebase-admin"));
const constants_1 = require("./constants");
// Lazy initialize db on first use
let db = null;
function getDb() {
    if (!db) {
        db = admin.firestore();
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
function normalizeNotificationRecipients(value, legacyFallbacks) {
    const data = typeof value === 'object' && value !== null ? value : {};
    return {
        dailyLogs: normalizeRecipientList(data.dailyLogs ?? legacyFallbacks?.dailyLogs),
        timecards: normalizeRecipientList(data.timecards ?? legacyFallbacks?.timecards),
        shopOrders: normalizeRecipientList(data.shopOrders ?? legacyFallbacks?.shopOrders),
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
    const logSnap = await getDb().collection('jobs').doc(jobId).collection('dailyLogs').doc(dailyLogId).get();
    if (!logSnap.exists)
        return null;
    return {
        id: logSnap.id,
        ...logSnap.data(),
        additionalRecipients: normalizeRecipientList(logSnap.data()?.additionalRecipients),
    };
}
/**
 * Get timecard by path
 */
async function getTimecard(jobId, weekStart, timecardId) {
    const db = getDb();
    // Phase 3 timecards live directly under jobs/{jobId}/timecards
    const directRef = db
        .collection(constants_1.COLLECTIONS.JOBS)
        .doc(jobId)
        .collection('timecards')
        .doc(timecardId);
    const directSnap = await directRef.get();
    if (directSnap.exists) {
        return {
            id: directSnap.id,
            ...directSnap.data(),
        };
    }
    // Fallback for legacy Phase 2 structure jobs/{jobId}/weeks/{weekStart}/timecards
    const legacyRef = db
        .collection(constants_1.COLLECTIONS.JOBS)
        .doc(jobId)
        .collection(constants_1.COLLECTIONS.WEEKS)
        .doc(weekStart)
        .collection(constants_1.COLLECTIONS.TIMECARDS)
        .doc(timecardId);
    const legacySnap = await legacyRef.get();
    if (!legacySnap.exists)
        return null;
    return {
        id: legacySnap.id,
        ...legacySnap.data(),
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
        globalNotificationRecipients: normalizeNotificationRecipients(data.globalNotificationRecipients, {
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
    const legacyOfficeDailyLogRecipients = moduleKey === 'dailyLogs'
        ? normalizeRecipientList(data.adminDailyLogRecipients)
        : [];
    return Array.from(new Set([
        ...notificationRecipients[moduleKey],
        ...legacyOfficeDailyLogRecipients,
    ]));
}
//# sourceMappingURL=firestoreService.js.map