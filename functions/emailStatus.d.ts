export interface SubmittedEmailStatusResult {
    emailSent: boolean;
    emailMessage: string;
    operationId?: string | null;
}
export interface FirestoreStatusSentinels {
    serverTimestamp(): unknown;
    delete(): unknown;
}
type SubmittedEmailOperation = 'dailyLogSubmittedEmail' | 'shopOrderSubmittedEmail' | 'timecardWeekSubmittedEmail';
export declare const SUBMITTED_EMAIL_IN_PROGRESS_TIMEOUT_MS: number;
export interface SubmittedEmailOperationRecord {
    submittedEmailOperationId?: unknown;
    submittedEmailInProgressAt?: unknown;
    submittedEmailSentAt?: unknown;
    submittedEmailError?: unknown;
}
export declare function buildSubmittedEmailOperationId(operation: SubmittedEmailOperation, recordId: string): string;
export declare function isSubmittedEmailOperationAlreadySent(record: SubmittedEmailOperationRecord | null | undefined, operationId: string): boolean;
export declare function isSubmittedEmailOperationInProgress(record: SubmittedEmailOperationRecord | null | undefined, operationId: string, now?: Date, timeoutMs?: number): boolean;
export declare function buildSubmittedEmailClaimUpdate(operationId: string, sentinels: FirestoreStatusSentinels): Record<string, unknown>;
export declare function buildSubmittedEmailStatusUpdate(result: SubmittedEmailStatusResult, sentinels: FirestoreStatusSentinels): Record<string, unknown>;
export {};
//# sourceMappingURL=emailStatus.d.ts.map