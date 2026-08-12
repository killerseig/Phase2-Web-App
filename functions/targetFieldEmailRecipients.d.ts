import { type TargetFunctionRoleKey } from './targetRoleCapabilities';
export interface TargetFunctionFieldEmailRecipientInput {
    assignedJobIds?: readonly string[] | null;
    isShopJob?: boolean;
    jobId: string;
    role: TargetFunctionRoleKey;
}
export interface TargetFunctionFieldEmailRecipientUser {
    active?: boolean | null;
    assignedJobIds?: readonly string[] | null;
    email?: string | null;
    role: TargetFunctionRoleKey;
}
export interface TargetFunctionFieldEmailRecipientListInput {
    isShopJob?: boolean;
    jobId: string;
    users: readonly TargetFunctionFieldEmailRecipientUser[];
}
export declare function targetFunctionRoleReceivesFieldEmail(input: TargetFunctionFieldEmailRecipientInput): boolean;
export declare function getTargetFunctionFieldEmailRecipientEmails(input: TargetFunctionFieldEmailRecipientListInput): string[];
//# sourceMappingURL=targetFieldEmailRecipients.d.ts.map