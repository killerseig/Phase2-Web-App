import { type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import type { EmailDeliveryFailureClassification } from './emailDeliveryErrors';
export type JobEventNotificationKey = 'newJobs' | 'fieldUserAssignments';
export declare const JOB_NOTIFICATION_CLAIM_LEASE_MS: number;
export type JobNotificationClaimDisposition = 'claim' | 'failed-permanent' | 'in-progress' | 'sent';
export interface JobNotificationRecord {
    id: string;
    name: string;
    code: string | null;
    type: string;
    gc: string | null;
    jobAddress: string | null;
    startDate: string | null;
    finishDate: string | null;
    assignedFieldUserIds: string[];
}
export interface JobNotificationEmailOptions {
    to: string[];
    subject: string;
    html: string;
}
export interface JobNotificationHandlerDependencies {
    isEmailEnabled: () => boolean;
    getGlobalRecipients: (notificationKey: JobEventNotificationKey) => Promise<string[]>;
    getFieldUserNames: (userIds: string[]) => Promise<string[]>;
    claimEvent: (eventKey: string, metadata: {
        notificationKey: JobEventNotificationKey;
        jobId: string;
    }) => Promise<boolean>;
    completeEvent: (eventKey: string) => Promise<void>;
    failEvent: (eventKey: string, failure: EmailDeliveryFailureClassification) => Promise<void>;
    releaseEvent: (eventKey: string) => Promise<void>;
    classifySendError: (error: unknown) => EmailDeliveryFailureClassification;
    sendEmail: (options: JobNotificationEmailOptions) => Promise<void>;
}
export type JobNotificationOutcome = 'sent' | 'failed-permanent' | 'skipped-duplicate' | 'skipped-email-disabled' | 'skipped-missing-job' | 'skipped-no-new-assignments' | 'skipped-no-recipients';
export declare function isValidJobNotificationRecipient(value: string): boolean;
export declare function getJobNotificationClaimDisposition(value: unknown, nowMs?: number, leaseMs?: number): JobNotificationClaimDisposition;
export declare function claimJobNotificationEventInTransaction(transaction: Pick<Transaction, 'get' | 'set'>, eventRef: DocumentReference, eventKey: string, metadata: {
    notificationKey: JobEventNotificationKey;
    jobId: string;
}, now?: Date): Promise<boolean>;
export declare function normalizeJobNotificationRecord(jobId: string, value: unknown): JobNotificationRecord | null;
export declare function getNewlyAssignedFieldUserIds(beforeValue: unknown, afterValue: unknown): string[];
export declare function buildNewJobNotificationSubject(job: JobNotificationRecord): string;
export declare function buildFieldUserAssignmentNotificationSubject(job: JobNotificationRecord): string;
export declare function buildNewJobNotificationEmail(job: JobNotificationRecord, fieldUserNames: string[]): string;
export declare function buildFieldUserAssignmentNotificationEmail(job: JobNotificationRecord, fieldUserNames: string[]): string;
export declare function handleNewJobNotification(input: {
    eventId: string;
    jobId: string;
    jobData: unknown;
}, deps: JobNotificationHandlerDependencies): Promise<JobNotificationOutcome>;
export declare function handleFieldUserAssignmentNotification(input: {
    eventId: string;
    jobId: string;
    beforeData: unknown;
    afterData: unknown;
}, deps: JobNotificationHandlerDependencies): Promise<JobNotificationOutcome>;
//# sourceMappingURL=jobNotificationEmail.d.ts.map