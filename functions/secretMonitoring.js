"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifySecretExpiration = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const constants_1 = require("./constants");
const emailService_1 = require("./emailService");
const functionConfig_1 = require("./functionConfig");
const runtime_1 = require("./runtime");
exports.notifySecretExpiration = (0, scheduler_1.onSchedule)({ schedule: 'every day 09:00', secrets: (0, functionConfig_1.getGraphEmailSecrets)() }, async () => {
    try {
        const today = new Date();
        const currentDateStr = today.toISOString().split('T')[0];
        const secretExpirationDate = (0, functionConfig_1.getGraphSecretExpirationDate)();
        const expirationDate = new Date(secretExpirationDate);
        const notificationTriggerDate = new Date(expirationDate);
        notificationTriggerDate.setDate(notificationTriggerDate.getDate() - constants_1.EMAIL.SECRET_NOTIFICATION_DAYS);
        const notificationTriggerDateStr = notificationTriggerDate.toISOString().split('T')[0];
        console.log('[notifySecretExpiration] Today:', currentDateStr);
        console.log('[notifySecretExpiration] Notification trigger date:', notificationTriggerDateStr);
        console.log('[notifySecretExpiration] Secret expiration date:', secretExpirationDate);
        if (currentDateStr < notificationTriggerDateStr) {
            console.log('[notifySecretExpiration] Not yet time to notify. Exiting.');
            return;
        }
        if (currentDateStr > secretExpirationDate) {
            console.error('[notifySecretExpiration] Secret has already expired!');
        }
        const adminSnapshot = await runtime_1.db
            .collection(constants_1.COLLECTIONS.USERS)
            .where('role', '==', 'admin')
            .where('active', '==', true)
            .get();
        if (adminSnapshot.empty) {
            console.log('[notifySecretExpiration] No active admin users found');
            return;
        }
        const adminEmails = adminSnapshot.docs
            .map((doc) => doc.data().email)
            .filter((email) => email && email.trim().length > 0);
        if (adminEmails.length === 0) {
            console.log('[notifySecretExpiration] No admin emails found');
            return;
        }
        await (0, emailService_1.sendEmail)({
            to: adminEmails,
            subject: constants_1.EMAIL.SUBJECTS.SECRET_EXPIRATION,
            html: (0, emailService_1.buildSecretExpirationEmail)(),
        });
        console.log(`[notifySecretExpiration] Notification sent to ${adminEmails.length} admin(s)`);
    }
    catch (error) {
        console.error('[notifySecretExpiration] Error:', error?.message || error);
    }
});
//# sourceMappingURL=secretMonitoring.js.map