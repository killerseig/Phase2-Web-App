"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE = exports.SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE = void 0;
exports.getSubmittedEmailClaimShortCircuitMessage = getSubmittedEmailClaimShortCircuitMessage;
exports.claimSubmittedEmailOperation = claimSubmittedEmailOperation;
const firestore_1 = require("firebase-admin/firestore");
const emailStatus_1 = require("./emailStatus");
exports.SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE = 'Email already sent successfully';
exports.SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE = 'Email send already in progress. Please wait for the current send to finish.';
function getSubmittedEmailClaimShortCircuitMessage(claimStatus) {
    if (claimStatus === 'already-sent')
        return exports.SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE;
    if (claimStatus === 'in-progress')
        return exports.SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE;
    return null;
}
async function claimSubmittedEmailOperation(db, refs, operationId, context) {
    try {
        return await db.runTransaction(async (transaction) => {
            const snapshots = [];
            for (const ref of refs) {
                snapshots.push(await transaction.get(ref));
            }
            const existingSnapshots = snapshots.filter((snapshot) => snapshot.exists);
            if (existingSnapshots.some((snapshot) => (0, emailStatus_1.isSubmittedEmailOperationAlreadySent)(snapshot.data(), operationId))) {
                return 'already-sent';
            }
            if (existingSnapshots.some((snapshot) => (0, emailStatus_1.isSubmittedEmailOperationInProgress)(snapshot.data(), operationId))) {
                return 'in-progress';
            }
            if (!existingSnapshots.length) {
                console.warn('[claimSubmittedEmailOperation] No matching documents found', context);
                return 'missing-record';
            }
            const payload = (0, emailStatus_1.buildSubmittedEmailClaimUpdate)(operationId, firestore_1.FieldValue);
            for (const snapshot of existingSnapshots) {
                transaction.update(snapshot.ref, payload);
            }
            return 'claimed';
        });
    }
    catch (error) {
        console.warn('[claimSubmittedEmailOperation] Failed to claim submitted email operation', {
            ...context,
            operationId,
            error,
        });
        throw error;
    }
}
//# sourceMappingURL=submittedEmailOperations.js.map