import type { Firestore } from 'firebase-admin/firestore';
import type { FormAnswers, FormDefinition, FormField } from './formModel';
export declare const FORM_RESPONDENT_RECIPIENT_LIMIT = 10;
export declare const FORM_TOTAL_RECIPIENT_LIMIT = 100;
export declare const formRecipientGroups: readonly ["job-foremen", "job-project-managers", "job-everyone"];
export type FormRecipientGroup = (typeof formRecipientGroups)[number];
interface RecipientUser {
    uid: string;
    email?: unknown;
    active?: unknown;
    role?: unknown;
    assignedJobIds?: unknown;
}
interface RecipientJob {
    id: string;
    assignedForemanIds?: unknown;
}
export declare function normalizeFormRecipientEmails(value: unknown, limit: number): string[];
export declare function respondentRecipients(fields: FormField[], answers: FormAnswers): string[];
/** Notification routing only: this function never grants access to entries or photos. */
export declare function resolveRecipientEmails(definition: FormDefinition, answers: FormAnswers, job: RecipientJob | null, users: RecipientUser[], options?: {
    publicRespondent?: boolean;
    verifiedEmails?: string[];
    publicRecordId?: string;
}): string[];
/** Queries only explicit assignment membership; never scans the company directory. */
export declare function resolveFormSubmissionRecipients(db: Firestore, definition: FormDefinition, answers: FormAnswers, jobId?: string, options?: {
    publicRespondent?: boolean;
    verifiedEmails?: string[];
    publicRecordId?: string;
}): Promise<string[]>;
/** Copy only these provenance fields into the immutable submission/delivery, never code hashes. */
export declare function publicRecipientConsentSnapshot(db: Firestore, recordId: string): Promise<{
    proofId: string;
    email: string;
    recordId: string;
    templateId: string;
    templateVersion: number;
    verifiedAt: number;
    approvalExpiresAt: number;
}[]>;
export {};
//# sourceMappingURL=formRecipients.d.ts.map