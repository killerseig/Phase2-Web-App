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
exports.SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE = exports.SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE = void 0;
exports.getSubmittedEmailClaimShortCircuitMessage = getSubmittedEmailClaimShortCircuitMessage;
exports.claimSubmittedEmailOperation = claimSubmittedEmailOperation;
const admin = __importStar(require("firebase-admin"));
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
            const payload = (0, emailStatus_1.buildSubmittedEmailClaimUpdate)(operationId, admin.firestore.FieldValue);
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