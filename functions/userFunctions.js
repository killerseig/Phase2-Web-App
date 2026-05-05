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
exports.setUserPassword = exports.requestPasswordResetEmail = exports.verifySetupToken = exports.sendPendingUserInvites = exports.createUserByAdmin = exports.deleteUser = exports.handleUserAccessRevocationCleanup = exports.removeEmailFromAllRecipientLists = void 0;
const crypto_1 = require("crypto");
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const constants_1 = require("./constants");
const emailService_1 = require("./emailService");
const functionConfig_1 = require("./functionConfig");
const recipientCleanup_1 = require("./recipientCleanup");
const runtime_1 = require("./runtime");
const firestoreService_1 = require("./firestoreService");
function parseTokenExpiry(value) {
    if (value?.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    if (value instanceof Date) {
        return value;
    }
    return new Date(value);
}
function assertSetupTokenPayload(uid, setupToken) {
    if (!uid || !setupToken) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required parameters: uid and setupToken');
    }
}
function buildSetupLink(uid, setupToken) {
    const baseUrl = (0, functionConfig_1.getAppBaseUrl)();
    return `${baseUrl}/set-password?setupToken=${setupToken}&uid=${uid}`;
}
function createSetupTokenRecord() {
    return {
        setupToken: (0, crypto_1.randomBytes)(32).toString('hex'),
        setupTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };
}
async function sendUserInvite(options) {
    const userRef = runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(options.uid);
    const tokenRecord = createSetupTokenRecord();
    await userRef.update(tokenRecord);
    await (0, emailService_1.sendEmail)({
        to: options.email,
        subject: constants_1.EMAIL.SUBJECTS.WELCOME,
        html: (0, emailService_1.buildWelcomeEmail)(options.firstName || 'there', buildSetupLink(options.uid, tokenRecord.setupToken)),
    });
    await userRef.update({
        inviteStatus: 'sent',
        inviteSentAt: admin.firestore.FieldValue.serverTimestamp(),
        inviteSentByUid: options.sentByUid ?? null,
    });
}
exports.removeEmailFromAllRecipientLists = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    await (0, firestoreService_1.verifyAdminRole)(request.auth.uid);
    const rawEmail = String(request.data?.email || '').trim();
    if (!rawEmail) {
        throw new https_1.HttpsError('invalid-argument', constants_1.ERROR_MESSAGES.EMAIL_REQUIRED);
    }
    const cleanup = await (0, recipientCleanup_1.removeEmailFromRecipientLists)(rawEmail);
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
        const cleanup = await (0, recipientCleanup_1.removeEmailFromRecipientLists)(email);
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
exports.deleteUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', constants_1.ERROR_MESSAGES.NOT_SIGNED_IN_DELETE);
    }
    const uid = String(request.data?.uid || '').trim();
    if (!uid) {
        throw new https_1.HttpsError('invalid-argument', constants_1.ERROR_MESSAGES.UID_REQUIRED);
    }
    try {
        await (0, firestoreService_1.verifyAdminRole)(request.auth.uid);
        const userDocRef = runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(uid);
        const userDocSnap = await userDocRef.get();
        let authEmail = '';
        try {
            const authUser = await runtime_1.auth.getUser(uid);
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
            const cleanup = await (0, recipientCleanup_1.removeEmailFromRecipientLists)(candidateEmail);
            settingsUpdated = settingsUpdated || cleanup.settingsUpdated;
            jobsUpdated += cleanup.jobsUpdated;
        }
        await runtime_1.auth.deleteUser(uid);
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
        throw new https_1.HttpsError('internal', error?.message || constants_1.ERROR_MESSAGES.FAILED_TO_DELETE_USER);
    }
});
exports.createUserByAdmin = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)() }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', constants_1.ERROR_MESSAGES.NOT_SIGNED_IN_CREATE);
    }
    const email = String(request.data?.email || '').trim();
    const firstName = String(request.data?.firstName || '').trim();
    const lastName = String(request.data?.lastName || '').trim();
    const userRole = String(request.data?.role || 'none').trim().toLowerCase();
    const sendInvite = request.data?.sendInvite === true;
    if (!email) {
        throw new https_1.HttpsError('invalid-argument', constants_1.ERROR_MESSAGES.EMAIL_REQUIRED);
    }
    if (!firstName) {
        throw new https_1.HttpsError('invalid-argument', constants_1.ERROR_MESSAGES.FIRST_NAME_REQUIRED);
    }
    if (!lastName) {
        throw new https_1.HttpsError('invalid-argument', constants_1.ERROR_MESSAGES.LAST_NAME_REQUIRED);
    }
    if (!constants_1.VALID_ROLES.includes(userRole)) {
        throw new https_1.HttpsError('invalid-argument', constants_1.ERROR_MESSAGES.INVALID_ROLE(constants_1.VALID_ROLES));
    }
    try {
        await (0, firestoreService_1.verifyAdminRole)(request.auth.uid);
        try {
            await runtime_1.auth.getUserByEmail(email);
            throw new https_1.HttpsError('already-exists', constants_1.ERROR_MESSAGES.USER_ALREADY_EXISTS);
        }
        catch (error) {
            if (error instanceof https_1.HttpsError) {
                throw error;
            }
            if (error?.code !== 'auth/user-not-found') {
                throw error;
            }
        }
        const userRecord = await runtime_1.auth.createUser({
            email,
            emailVerified: false,
        });
        await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(userRecord.uid).set({
            email: userRecord.email,
            firstName,
            lastName,
            role: userRole,
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            setupToken: null,
            setupTokenExpiry: null,
            inviteStatus: 'pending',
            inviteSentAt: null,
            inviteAcceptedAt: null,
        });
        if (!sendInvite) {
            return {
                success: true,
                message: `User created successfully. Invite queued for ${userRecord.email}.`,
                uid: userRecord.uid,
            };
        }
        if (!(0, emailService_1.isEmailEnabled)()) {
            return {
                success: true,
                message: `User created successfully. Email sending is disabled, so the invite was left queued for ${userRecord.email}.`,
                uid: userRecord.uid,
            };
        }
        try {
            await sendUserInvite({
                uid: userRecord.uid,
                email: userRecord.email || email,
                firstName,
                sentByUid: request.auth.uid,
            });
            return {
                success: true,
                message: `User created successfully. Invite sent to ${userRecord.email}.`,
                uid: userRecord.uid,
            };
        }
        catch (inviteError) {
            console.error('[createUserByAdmin] Invite send failed after create:', inviteError?.message || inviteError);
            return {
                success: true,
                message: `User created successfully, but the invite could not be sent. The user was left in the pending invite queue.`,
                uid: userRecord.uid,
            };
        }
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('[createUserByAdmin] Error:', error?.message || error);
        throw new https_1.HttpsError('internal', error?.message || constants_1.ERROR_MESSAGES.FAILED_TO_CREATE_USER);
    }
});
exports.sendPendingUserInvites = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)() }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', constants_1.ERROR_MESSAGES.NOT_SIGNED_IN_CREATE);
    }
    await (0, firestoreService_1.verifyAdminRole)(request.auth.uid);
    if (!(0, emailService_1.isEmailEnabled)()) {
        return {
            success: true,
            sentCount: 0,
            skippedCount: 0,
            message: 'Email sending is disabled. Pending invites were not sent.',
        };
    }
    try {
        const pendingSnapshot = await runtime_1.db
            .collection(constants_1.COLLECTIONS.USERS)
            .where('inviteStatus', '==', 'pending')
            .get();
        if (pendingSnapshot.empty) {
            return {
                success: true,
                sentCount: 0,
                skippedCount: 0,
                message: 'There are no pending invites to send.',
            };
        }
        let sentCount = 0;
        let skippedCount = 0;
        for (const userDoc of pendingSnapshot.docs) {
            const userData = userDoc.data();
            const email = String(userData.email || '').trim();
            const firstName = String(userData.firstName || '').trim();
            const role = String(userData.role || '').trim().toLowerCase();
            const active = userData.active !== false;
            if (!email || !active || role === 'none' || !constants_1.VALID_ROLES.includes(role)) {
                skippedCount += 1;
                continue;
            }
            await sendUserInvite({
                uid: userDoc.id,
                email,
                firstName,
                sentByUid: request.auth.uid,
            });
            sentCount += 1;
        }
        return {
            success: true,
            sentCount,
            skippedCount,
            message: sentCount > 0
                ? `Sent ${sentCount} invite${sentCount === 1 ? '' : 's'}${skippedCount ? ` and skipped ${skippedCount}.` : '.'}`
                : skippedCount > 0
                    ? `No invites were sent. Skipped ${skippedCount} pending user${skippedCount === 1 ? '' : 's'}.`
                    : 'There are no pending invites to send.',
        };
    }
    catch (error) {
        console.error('[sendPendingUserInvites] Error:', error?.message || error);
        throw new https_1.HttpsError('internal', error?.message || 'Failed to send pending invites.');
    }
});
exports.verifySetupToken = (0, https_1.onCall)(async (request) => {
    const uid = String(request.data?.uid || '').trim();
    const setupToken = String(request.data?.setupToken || '').trim();
    assertSetupTokenPayload(uid, setupToken);
    try {
        const userDoc = await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(uid).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        if (!userData?.setupToken || userData.setupToken !== setupToken) {
            throw new https_1.HttpsError('permission-denied', 'Invalid token');
        }
        if (new Date() > parseTokenExpiry(userData.setupTokenExpiry)) {
            throw new https_1.HttpsError('deadline-exceeded', 'Token expired');
        }
        return {
            success: true,
            email: userData.email,
            message: 'Token verified',
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('[verifySetupToken] Error:', error?.message || error);
        throw new https_1.HttpsError('internal', error?.message || 'Failed to verify token');
    }
});
exports.requestPasswordResetEmail = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)() }, async (request) => {
    const email = String(request.data?.email || '').trim().toLowerCase();
    if (!email) {
        throw new https_1.HttpsError('invalid-argument', 'Enter your email address first.');
    }
    const successMessage = 'If an account exists for that email, a password reset email has been sent.';
    try {
        const userRecord = await runtime_1.auth.getUserByEmail(email).catch((error) => {
            if (error?.code === 'auth/user-not-found') {
                return null;
            }
            throw error;
        });
        if (!userRecord?.email) {
            return {
                success: true,
                message: successMessage,
            };
        }
        const resetLink = await runtime_1.auth.generatePasswordResetLink(userRecord.email);
        if ((0, emailService_1.isEmailEnabled)()) {
            const displayName = [userRecord.displayName].filter(Boolean).join(' ').trim();
            await (0, emailService_1.sendEmail)({
                to: userRecord.email,
                subject: constants_1.EMAIL.SUBJECTS.PASSWORD_RESET,
                html: (0, emailService_1.buildPasswordResetEmail)(displayName, resetLink),
            });
        }
        return {
            success: true,
            message: successMessage,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('[requestPasswordResetEmail] Error:', error?.message || error);
        throw new https_1.HttpsError('internal', 'Failed to send reset email.');
    }
});
exports.setUserPassword = (0, https_1.onCall)(async (request) => {
    const uid = String(request.data?.uid || '').trim();
    const password = String(request.data?.password || '');
    const setupToken = String(request.data?.setupToken || '').trim();
    if (!uid || !password || !setupToken) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required parameters: uid, password, and setupToken');
    }
    if (password.length < 6) {
        throw new https_1.HttpsError('invalid-argument', 'Password must be at least 6 characters');
    }
    try {
        const userDoc = await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(uid).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        if (userData?.setupToken !== setupToken) {
            throw new https_1.HttpsError('permission-denied', 'Invalid setup token');
        }
        if (new Date() > parseTokenExpiry(userData?.setupTokenExpiry)) {
            throw new https_1.HttpsError('deadline-exceeded', 'Setup token has expired');
        }
        await runtime_1.auth.updateUser(uid, { password });
        await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(uid).update({
            setupToken: null,
            setupTokenExpiry: null,
            inviteStatus: 'accepted',
            inviteAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            message: 'Password set successfully',
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('[setUserPassword] Error:', error?.message || error);
        throw new https_1.HttpsError('internal', error?.message || 'Failed to set password');
    }
});
//# sourceMappingURL=userFunctions.js.map