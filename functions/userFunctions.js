"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserPassword = exports.requestPasswordResetEmail = exports.verifySetupToken = exports.sendPendingUserInvites = exports.createUserByAdmin = exports.deleteUser = exports.handleUserAccessRevocationCleanup = exports.listAssignableFieldUsers = exports.removeEmailFromAllRecipientLists = exports.sendUserPasswordResetByAdmin = exports.resendUserInviteByAdmin = void 0;
exports.sendUserInvite = sendUserInvite;
exports.handleResendUserInviteByAdmin = handleResendUserInviteByAdmin;
exports.handleSendUserPasswordResetByAdmin = handleSendUserPasswordResetByAdmin;
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
const constants_1 = require("./constants");
const emailService_1 = require("./emailService");
const functionConfig_1 = require("./functionConfig");
const recipientCleanup_1 = require("./recipientCleanup");
const roleAccess_1 = require("./roleAccess");
const runtime_1 = require("./runtime");
const firestoreService_1 = require("./firestoreService");
const targetRoleCapabilities_1 = require("./targetRoleCapabilities");
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
const USER_INVITE_STATE_FIELDS = [
    'setupToken',
    'setupTokenExpiry',
    'inviteStatus',
    'inviteSentAt',
    'inviteSentByUid',
    'inviteAcceptedAt',
];
const INVITE_DELIVERY_LEASE_DURATION_MS = 2 * 60 * 1000;
const INVITE_DELIVERY_IN_PROGRESS_MESSAGE = 'An invite email is already being sent for this user. Wait a moment and try again.';
const INVITE_DELIVERY_OWNERSHIP_LOST_MESSAGE = 'This invite email was superseded before it could be finalized. Send a new invite.';
function inviteDeliveryLeaseIsActive(data, now) {
    const deliveryId = String(data.inviteDeliveryId || '').trim();
    if (!deliveryId)
        return false;
    const expiresAt = parseTokenExpiry(data.inviteDeliveryLeaseExpiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}
function buildInviteDeliveryLeaseClearUpdate(deleteField) {
    return {
        inviteDeliveryId: deleteField(),
        inviteDeliveryLeaseExpiresAt: deleteField(),
    };
}
function captureUserInviteState(data) {
    return Object.fromEntries(USER_INVITE_STATE_FIELDS.map((field) => [
        field,
        {
            exists: Object.prototype.hasOwnProperty.call(data, field),
            value: data[field],
        },
    ]));
}
function buildUserInviteRestoreUpdate(previousState, deleteField) {
    return Object.fromEntries(USER_INVITE_STATE_FIELDS.map((field) => [
        field,
        previousState[field].exists ? previousState[field].value : deleteField(),
    ]));
}
const firestoreUserInviteStateStore = {
    async transact(uid, transition) {
        const userRef = runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(uid);
        return runtime_1.db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(userRef);
            if (!snapshot.exists) {
                throw new https_1.HttpsError('not-found', 'User not found.');
            }
            const next = transition(snapshot.data() || {});
            if (next.update) {
                transaction.update(userRef, next.update);
            }
            return next.result;
        });
    },
};
const sendUserInviteDependencies = {
    createDeliveryId: () => (0, crypto_1.randomBytes)(16).toString('hex'),
    createTokenRecord: createSetupTokenRecord,
    deleteField: () => firestore_1.FieldValue.delete(),
    deliverEmail: emailService_1.sendEmail,
    now: () => new Date(),
    serverTimestamp: () => firestore_1.FieldValue.serverTimestamp(),
    stateStore: firestoreUserInviteStateStore,
};
function normalizeAssignedJobIds(value) {
    if (!Array.isArray(value))
        return [];
    return Array.from(new Set(value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)));
}
function normalizeAssignableUser(id, data) {
    const role = (0, roleAccess_1.normalizeStoredRole)(data.role);
    if (!(0, targetRoleCapabilities_1.targetFunctionRoleCanBeAssignedJobs)(role))
        return null;
    return {
        id,
        email: typeof data.email === 'string' ? data.email : null,
        firstName: typeof data.firstName === 'string' ? data.firstName : null,
        lastName: typeof data.lastName === 'string' ? data.lastName : null,
        role,
        active: data.active !== false,
        assignedJobIds: normalizeAssignedJobIds(data.assignedJobIds),
        inviteStatus: typeof data.inviteStatus === 'string' ? data.inviteStatus : null,
        inviteSentAt: data.inviteSentAt ?? null,
    };
}
async function getAuthorizedAssignableUserReader(uid) {
    const userSnap = await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(uid).get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'Your user profile was not found.');
    }
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, userSnap.data() || {});
    if (!user.active) {
        throw new https_1.HttpsError('permission-denied', 'Your account is inactive.');
    }
    if (!(0, roleAccess_1.currentFunctionUserHasAnyRole)(user, ['admin', 'payroll', 'project-manager'])) {
        throw new https_1.HttpsError('permission-denied', 'Your account cannot load assignable users.');
    }
    return user;
}
async function sendUserInvite(options, dependencies = sendUserInviteDependencies) {
    const deliveryId = dependencies.createDeliveryId();
    const deliveryStartedAt = dependencies.now();
    const deliveryLeaseExpiresAt = new Date(deliveryStartedAt.getTime() + INVITE_DELIVERY_LEASE_DURATION_MS);
    const tokenRecord = dependencies.createTokenRecord();
    const previousState = await dependencies.stateStore.transact(options.uid, (current) => {
        if (inviteDeliveryLeaseIsActive(current, deliveryStartedAt)) {
            throw new https_1.HttpsError('failed-precondition', INVITE_DELIVERY_IN_PROGRESS_MESSAGE);
        }
        return {
            update: {
                ...tokenRecord,
                inviteDeliveryId: deliveryId,
                inviteDeliveryLeaseExpiresAt: deliveryLeaseExpiresAt,
            },
            result: captureUserInviteState(current),
        };
    });
    try {
        await dependencies.deliverEmail({
            to: options.email,
            subject: constants_1.EMAIL.SUBJECTS.WELCOME,
            html: (0, emailService_1.buildWelcomeEmail)(options.firstName || 'there', buildSetupLink(options.uid, tokenRecord.setupToken)),
        });
    }
    catch (deliveryError) {
        try {
            await dependencies.stateStore.transact(options.uid, (current) => {
                if (current.inviteDeliveryId !== deliveryId ||
                    current.setupToken !== tokenRecord.setupToken) {
                    return { result: false };
                }
                return {
                    update: {
                        ...buildUserInviteRestoreUpdate(previousState, dependencies.deleteField),
                        ...buildInviteDeliveryLeaseClearUpdate(dependencies.deleteField),
                    },
                    result: true,
                };
            });
        }
        catch (rollbackError) {
            console.error('[sendUserInvite] Failed to restore invite state after delivery failure:', rollbackError instanceof Error ? rollbackError.message : rollbackError);
        }
        throw deliveryError;
    }
    const finalized = await dependencies.stateStore.transact(options.uid, (current) => {
        if (current.inviteDeliveryId !== deliveryId || current.setupToken !== tokenRecord.setupToken) {
            return { result: false };
        }
        const preserveAcceptedStatus = previousState.inviteStatus.value === 'accepted' || current.inviteStatus === 'accepted';
        return {
            update: {
                inviteStatus: preserveAcceptedStatus ? 'accepted' : 'sent',
                inviteSentAt: dependencies.serverTimestamp(),
                inviteSentByUid: options.sentByUid ?? null,
                ...buildInviteDeliveryLeaseClearUpdate(dependencies.deleteField),
            },
            result: true,
        };
    });
    if (!finalized) {
        throw new https_1.HttpsError('aborted', INVITE_DELIVERY_OWNERSHIP_LOST_MESSAGE);
    }
}
const adminUserEmailActionDependencies = {
    verifyAdminRole: firestoreService_1.verifyAdminRole,
    isEmailEnabled: emailService_1.isEmailEnabled,
    getUserProfile: async (uid) => {
        const snapshot = await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).doc(uid).get();
        return snapshot.exists ? snapshot.data() || null : null;
    },
    getAuthUser: (uid) => runtime_1.auth.getUser(uid),
    sendInvite: sendUserInvite,
    sendPasswordReset: async ({ email, displayName }) => {
        const resetLink = await runtime_1.auth.generatePasswordResetLink(email);
        await (0, emailService_1.sendEmail)({
            to: email,
            subject: constants_1.EMAIL.SUBJECTS.PASSWORD_RESET,
            html: (0, emailService_1.buildPasswordResetEmail)(displayName, resetLink),
        });
    },
};
function requireAdminUserEmailActionPayload(request) {
    const actorUid = String(request.auth?.uid || '').trim();
    if (!actorUid) {
        throw new https_1.HttpsError('unauthenticated', constants_1.ERROR_MESSAGES.NOT_SIGNED_IN_CREATE);
    }
    const targetUid = String(request.data?.uid || '').trim();
    if (!targetUid) {
        throw new https_1.HttpsError('invalid-argument', constants_1.ERROR_MESSAGES.UID_REQUIRED);
    }
    return { actorUid, targetUid };
}
async function getAdminUserEmailTarget(targetUid, dependencies) {
    const [profile, authUser] = await Promise.all([
        dependencies.getUserProfile(targetUid),
        dependencies.getAuthUser(targetUid),
    ]);
    if (!profile) {
        throw new https_1.HttpsError('not-found', 'User not found.');
    }
    const authEmail = String(authUser.email || '').trim();
    if (!authEmail) {
        throw new https_1.HttpsError('failed-precondition', "This user's Authentication account does not have an email address.");
    }
    const profileEmail = String(profile.email || '').trim();
    if (!profileEmail || profileEmail.toLowerCase() !== authEmail.toLowerCase()) {
        throw new https_1.HttpsError('failed-precondition', "This user's profile email does not match their Authentication email. Update the account before sending email.");
    }
    const firstName = String(profile.firstName || '').trim();
    const profileDisplayName = [firstName, String(profile.lastName || '').trim()]
        .filter(Boolean)
        .join(' ');
    return {
        email: authEmail,
        firstName,
        displayName: String(authUser.displayName || '').trim() || profileDisplayName,
    };
}
async function handleResendUserInviteByAdmin(request, dependencies = adminUserEmailActionDependencies) {
    const { actorUid, targetUid } = requireAdminUserEmailActionPayload(request);
    await dependencies.verifyAdminRole(actorUid);
    if (!dependencies.isEmailEnabled()) {
        throw new https_1.HttpsError('failed-precondition', 'Email sending is disabled.');
    }
    try {
        const target = await getAdminUserEmailTarget(targetUid, dependencies);
        await dependencies.sendInvite({
            uid: targetUid,
            email: target.email,
            firstName: target.firstName,
            sentByUid: actorUid,
        });
        return {
            success: true,
            email: target.email,
            message: `Invite email sent to ${target.email}.`,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('[resendUserInviteByAdmin] Error:', error instanceof Error ? error.message : error);
        throw new https_1.HttpsError('internal', 'Failed to resend invite email.');
    }
}
async function handleSendUserPasswordResetByAdmin(request, dependencies = adminUserEmailActionDependencies) {
    const { actorUid, targetUid } = requireAdminUserEmailActionPayload(request);
    await dependencies.verifyAdminRole(actorUid);
    if (!dependencies.isEmailEnabled()) {
        throw new https_1.HttpsError('failed-precondition', 'Email sending is disabled.');
    }
    try {
        const target = await getAdminUserEmailTarget(targetUid, dependencies);
        await dependencies.sendPasswordReset({
            email: target.email,
            displayName: target.displayName,
        });
        return {
            success: true,
            email: target.email,
            message: `Password reset email sent to ${target.email}.`,
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('[sendUserPasswordResetByAdmin] Error:', error instanceof Error ? error.message : error);
        throw new https_1.HttpsError('internal', 'Failed to send password reset email.');
    }
}
exports.resendUserInviteByAdmin = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)() }, async (request) => {
    return handleResendUserInviteByAdmin(request);
});
exports.sendUserPasswordResetByAdmin = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)() }, async (request) => {
    return handleSendUserPasswordResetByAdmin(request);
});
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
exports.listAssignableFieldUsers = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', constants_1.ERROR_MESSAGES.NOT_SIGNED_IN);
    }
    await getAuthorizedAssignableUserReader(request.auth.uid);
    const snapshot = await runtime_1.db.collection(constants_1.COLLECTIONS.USERS).get();
    const users = snapshot.docs
        .map((entry) => normalizeAssignableUser(entry.id, entry.data()))
        .filter((entry) => entry !== null)
        .sort((left, right) => {
        const leftActive = left.active ? 0 : 1;
        const rightActive = right.active ? 0 : 1;
        if (leftActive !== rightActive)
            return leftActive - rightActive;
        const leftName = `${left.firstName ?? ''} ${left.lastName ?? ''}`.trim();
        const rightName = `${right.firstName ?? ''} ${right.lastName ?? ''}`.trim();
        if (leftName && rightName && leftName !== rightName)
            return leftName.localeCompare(rightName);
        return (left.email ?? '').localeCompare(right.email ?? '');
    });
    return { users };
});
exports.handleUserAccessRevocationCleanup = (0, firestore_2.onDocumentUpdated)('users/{uid}', async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    if (!afterData)
        return;
    const beforeRole = String(beforeData?.role || '')
        .trim()
        .toLowerCase();
    const afterRole = String(afterData?.role || '')
        .trim()
        .toLowerCase();
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
    const userRole = String(request.data?.role || 'none')
        .trim()
        .toLowerCase();
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
    if (!(0, roleAccess_1.isValidStoredRole)(userRole)) {
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
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
            const role = String(userData.role || '')
                .trim()
                .toLowerCase();
            const active = userData.active !== false;
            if (!email || !active || !(0, roleAccess_1.canSendInviteForStoredRole)(role)) {
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
    const email = String(request.data?.email || '')
        .trim()
        .toLowerCase();
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
            inviteAcceptedAt: firestore_1.FieldValue.serverTimestamp(),
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