/** Form visibility never grants visibility of completed entries or photos. */
export interface FormAccessPolicy {
    respondents: 'signed-in' | 'public';
    identity: 'identified' | 'anonymous' | 'form-fields';
    respondentUserIds: string[];
    respondentRoles: string[];
    entryUserIds: string[];
    entryRoles: string[];
}
export declare function validateFormAccess(value: unknown): FormAccessPolicy;
export declare function canSubmitForm(policy: unknown, user?: {
    uid: string;
    role: string;
    active: boolean;
}): boolean;
export declare function canReadFormEntry(policy: unknown, ownerUid: string, user: {
    uid: string;
    role: string;
    active: boolean;
}): boolean;
//# sourceMappingURL=formAccess.d.ts.map