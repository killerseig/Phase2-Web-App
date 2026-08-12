"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetFunctionRoleReceivesFieldEmail = targetFunctionRoleReceivesFieldEmail;
exports.getTargetFunctionFieldEmailRecipientEmails = getTargetFunctionFieldEmailRecipientEmails;
const targetJobAssignments_1 = require("./targetJobAssignments");
const targetRoleCapabilities_1 = require("./targetRoleCapabilities");
function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
function targetFunctionRoleReceivesFieldEmail(input) {
    if (!input.jobId)
        return false;
    const capabilities = (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(input.role);
    if (capabilities.receiveShopJobFieldEmails && input.isShopJob)
        return true;
    return capabilities.receiveAssignedJobFieldEmails
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds);
}
function getTargetFunctionFieldEmailRecipientEmails(input) {
    const recipients = new Set();
    for (const user of input.users) {
        if (user.active === false)
            continue;
        if (!targetFunctionRoleReceivesFieldEmail({
            assignedJobIds: user.assignedJobIds,
            isShopJob: input.isShopJob,
            jobId: input.jobId,
            role: user.role,
        })) {
            continue;
        }
        const email = normalizeEmail(user.email);
        if (email)
            recipients.add(email);
    }
    return Array.from(recipients).sort();
}
//# sourceMappingURL=targetFieldEmailRecipients.js.map