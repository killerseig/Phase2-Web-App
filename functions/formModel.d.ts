import { type FormAccessPolicy } from './formAccess';
export type FormFieldKind = 'text' | 'textarea' | 'email' | 'phone' | 'time' | 'date' | 'number' | 'choice' | 'checkbox' | 'radio' | 'multiselect' | 'photo' | 'repeat' | 'recipients' | 'matrix';
export interface FormField {
    id: string;
    kind: FormFieldKind;
    label: string;
    required: boolean;
    options: string[];
    section?: string;
    hint?: string;
    minimum?: number;
    integer?: boolean;
    rows?: {
        id: string;
        label: string;
    }[];
    fields?: FormField[];
    minInstances?: number;
    maxInstances?: number;
    requiredWhen?: {
        fieldId: string;
        values: string[];
    };
}
export interface FormOutputSettings {
    requireLogin: boolean;
    pdf: boolean;
    template: string;
}
export interface FormDefinition {
    recipientGroups?: ('job-foremen' | 'job-project-managers' | 'job-everyone')[];
    access?: FormAccessPolicy;
    output?: FormOutputSettings;
    title: string;
    description: string;
    fields: FormField[];
    recipients: string[];
}
export interface FormVersion extends FormDefinition {
    version: number;
    createdAt: string;
}
export interface FormGroupInstance {
    instanceId: string;
    answers: FormAnswers;
}
export type FormAnswers = Record<string, string | number | boolean | string[] | FormGroupInstance[]>;
export interface FormRecord {
    /** Receipt count only; never exposes Admin notification addresses. */
    recipientExclusionCount?: number;
    /** Self-reported public contact; not verified account identity. */
    respondentIdentity?: {
        name: string;
        email: string;
    };
    /** Optional immutable job context for the new shared job dashboard. */
    jobId?: string;
    id: string;
    ownerUid: string;
    templateId: string;
    templateVersion: number;
    definition: FormVersion;
    answers: FormAnswers;
    revision: number;
    status: 'draft' | 'submitted';
    createdAt: number;
    updatedAt: number;
    submittedAt?: number;
    emailStatus?: string;
}
export declare const formFieldKinds: FormFieldKind[];
export declare const optionFieldKinds: FormFieldKind[];
export declare const formId: (value: unknown) => value is string;
export declare function validateFormDefinition(value: unknown): FormDefinition;
export declare function isFieldRequired(field: FormField, answers: FormAnswers): boolean;
export declare function validateFormAnswers(definition: FormDefinition, value: unknown, final: boolean): FormAnswers;
export declare function attachedPhotoCount(definition: FormDefinition, answers: FormAnswers): number;
export declare function formAnswerSummary(field: FormField, value: FormAnswers[string] | undefined): string;
export declare function respondentDefinition(definition: FormVersion): FormVersion;
export declare function photoAnswerIds(definition: FormDefinition, answers: FormAnswers): string[];
//# sourceMappingURL=formModel.d.ts.map