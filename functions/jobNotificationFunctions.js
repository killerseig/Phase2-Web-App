"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFieldUserAssignmentNotification = exports.sendNewJobNotification = void 0;
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const emailService_1 = require("./emailService");
const emailDeliveryErrors_1 = require("./emailDeliveryErrors");
const firestoreService_1 = require("./firestoreService");
const functionConfig_1 = require("./functionConfig");
const jobNotificationEmail_1 = require("./jobNotificationEmail");
const runtime_1 = require("./runtime");
const NOTIFICATION_EVENT_COLLECTION = 'emailNotificationEvents';
function notificationEventRef(eventKey) {
    const eventHash = (0, crypto_1.createHash)('sha256').update(eventKey).digest('hex');
    return runtime_1.db.collection(NOTIFICATION_EVENT_COLLECTION).doc(eventHash);
}
async function getGlobalRecipients(notificationKey) {
    const settings = await (0, firestoreService_1.getEmailSettings)();
    return settings.globalNotificationRecipients[notificationKey];
}
async function getFieldUserNames(userIds) {
    return Promise.all(userIds.map(async (userId, index) => {
        const user = await (0, firestoreService_1.getUserProfile)(userId);
        if (!user)
            return `Field User ${index + 1}`;
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        return fullName || user.displayName || user.email || `Field User ${index + 1}`;
    }));
}
async function claimEvent(eventKey, metadata) {
    const eventRef = notificationEventRef(eventKey);
    return runtime_1.db.runTransaction((transaction) => (0, jobNotificationEmail_1.claimJobNotificationEventInTransaction)(transaction, eventRef, eventKey, metadata));
}
async function completeEvent(eventKey) {
    await notificationEventRef(eventKey).update({
        status: 'sent',
        sentAt: firestore_1.FieldValue.serverTimestamp(),
        leaseExpiresAt: firestore_1.FieldValue.delete(),
    });
}
async function failEvent(eventKey, failure) {
    await notificationEventRef(eventKey).update({
        status: 'failed-permanent',
        failedAt: firestore_1.FieldValue.serverTimestamp(),
        failureHttpStatus: failure.httpStatus ?? null,
        leaseExpiresAt: firestore_1.FieldValue.delete(),
    });
}
async function releaseEvent(eventKey) {
    await notificationEventRef(eventKey).delete();
}
const dependencies = {
    isEmailEnabled: emailService_1.isEmailEnabled,
    getGlobalRecipients,
    getFieldUserNames,
    claimEvent,
    completeEvent,
    failEvent,
    releaseEvent,
    classifySendError: emailDeliveryErrors_1.classifyEmailDeliveryError,
    sendEmail: emailService_1.sendEmail,
};
exports.sendNewJobNotification = (0, firestore_2.onDocumentCreated)({
    document: 'jobs/{jobId}',
    retry: true,
    secrets: (0, functionConfig_1.getGraphEmailSecrets)(),
}, async (event) => {
    const outcome = await (0, jobNotificationEmail_1.handleNewJobNotification)({
        eventId: event.id,
        jobId: event.params.jobId,
        jobData: event.data?.data(),
    }, dependencies);
    console.log('[sendNewJobNotification] Job notification handled', {
        eventId: event.id,
        jobId: event.params.jobId,
        outcome,
    });
});
exports.sendFieldUserAssignmentNotification = (0, firestore_2.onDocumentUpdated)({
    document: 'jobs/{jobId}',
    retry: true,
    secrets: (0, functionConfig_1.getGraphEmailSecrets)(),
}, async (event) => {
    const outcome = await (0, jobNotificationEmail_1.handleFieldUserAssignmentNotification)({
        eventId: event.id,
        jobId: event.params.jobId,
        beforeData: event.data?.before.data(),
        afterData: event.data?.after.data(),
    }, dependencies);
    console.log('[sendFieldUserAssignmentNotification] Assignment notification handled', {
        eventId: event.id,
        jobId: event.params.jobId,
        outcome,
    });
});
//# sourceMappingURL=jobNotificationFunctions.js.map