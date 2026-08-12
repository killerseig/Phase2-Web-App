"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBMITTED_EMAIL_IN_PROGRESS_TIMEOUT_MS = void 0;
exports.buildSubmittedEmailOperationId = buildSubmittedEmailOperationId;
exports.isSubmittedEmailOperationAlreadySent = isSubmittedEmailOperationAlreadySent;
exports.isSubmittedEmailOperationInProgress = isSubmittedEmailOperationInProgress;
exports.buildSubmittedEmailClaimUpdate = buildSubmittedEmailClaimUpdate;
exports.buildSubmittedEmailStatusUpdate = buildSubmittedEmailStatusUpdate;
exports.SUBMITTED_EMAIL_IN_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000;
function buildSubmittedEmailOperationId(operation, recordId) {
    const safeRecordId = recordId.trim().replace(/\s+/g, '-');
    return `${operation}:${safeRecordId}`;
}
function isSubmittedEmailOperationAlreadySent(record, operationId) {
    return record?.submittedEmailOperationId === operationId && Boolean(record.submittedEmailSentAt);
}
function timestampToMillis(value) {
    if (!value)
        return null;
    if (value instanceof Date)
        return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value === 'object') {
        const candidate = value;
        if (typeof candidate.toDate === 'function') {
            const date = candidate.toDate();
            return Number.isNaN(date.getTime()) ? null : date.getTime();
        }
        if (typeof candidate.seconds === 'number' && Number.isFinite(candidate.seconds)) {
            return (candidate.seconds * 1000) + Math.floor((candidate.nanoseconds || 0) / 1000000);
        }
    }
    return null;
}
function isSubmittedEmailOperationInProgress(record, operationId, now = new Date(), timeoutMs = exports.SUBMITTED_EMAIL_IN_PROGRESS_TIMEOUT_MS) {
    if (record?.submittedEmailOperationId !== operationId)
        return false;
    if (!record.submittedEmailInProgressAt || record.submittedEmailSentAt || record.submittedEmailError)
        return false;
    const inProgressAt = timestampToMillis(record.submittedEmailInProgressAt);
    if (inProgressAt === null)
        return true;
    return now.getTime() - inProgressAt < timeoutMs;
}
function buildSubmittedEmailClaimUpdate(operationId, sentinels) {
    return {
        submittedEmailOperationId: operationId,
        submittedEmailAttemptedAt: sentinels.serverTimestamp(),
        submittedEmailInProgressAt: sentinels.serverTimestamp(),
        submittedEmailSentAt: null,
        submittedEmailError: sentinels.delete(),
    };
}
function buildSubmittedEmailStatusUpdate(result, sentinels) {
    return {
        ...(result.operationId ? { submittedEmailOperationId: result.operationId } : {}),
        submittedEmailAttemptedAt: sentinels.serverTimestamp(),
        submittedEmailInProgressAt: sentinels.delete(),
        submittedEmailSentAt: result.emailSent ? sentinels.serverTimestamp() : null,
        submittedEmailError: result.emailSent ? sentinels.delete() : result.emailMessage,
    };
}
//# sourceMappingURL=emailStatus.js.map