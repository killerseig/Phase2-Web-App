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
        number: data?.number || '',
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
    if (user.role !== 'admin') {
        throw new Error('Only admins can perform this action');
    }
}
/**
 * Get daily log by ID
 */
async function getDailyLog(jobId, dailyLogId) {
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
    };
}
/**
 * Get timecard by path
 */
async function getTimecard(jobId, weekStart, timecardId) {
    const tcSnap = await getDb()
        .collection(constants_1.COLLECTIONS.JOBS)
        .doc(jobId)
        .collection(constants_1.COLLECTIONS.WEEKS)
        .doc(weekStart)
        .collection(constants_1.COLLECTIONS.TIMECARDS)
        .doc(timecardId)
        .get();
    if (!tcSnap.exists)
        return null;
    return {
        id: tcSnap.id,
        ...tcSnap.data(),
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
//# sourceMappingURL=firestoreService.js.map