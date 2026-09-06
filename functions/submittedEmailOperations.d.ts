import { type DocumentReference, type Firestore } from 'firebase-admin/firestore';
export type SubmittedEmailOperationClaimStatus = 'claimed' | 'already-sent' | 'in-progress' | 'missing-record';
export declare const SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE = "Email already sent successfully";
export declare const SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE = "Email send already in progress. Please wait for the current send to finish.";
export declare function getSubmittedEmailClaimShortCircuitMessage(claimStatus: SubmittedEmailOperationClaimStatus): string | null;
export declare function claimSubmittedEmailOperation(db: Firestore, refs: DocumentReference[], operationId: string, context: Record<string, unknown>): Promise<SubmittedEmailOperationClaimStatus>;
//# sourceMappingURL=submittedEmailOperations.d.ts.map