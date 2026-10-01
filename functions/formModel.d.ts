export type FormFieldKind = 'text' | 'textarea' | 'date' | 'number' | 'choice' | 'photo';
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
    requiredWhen?: {
        fieldId: string;
        values: string[];
    };
}
export interface FormDefinition {
    title: string;
    description: string;
    fields: FormField[];
    recipients: string[];
}
export interface FormVersion extends FormDefinition {
    version: number;
    createdAt: string;
}
export type FormAnswers = Record<string, string | number | string[]>;
export interface FormRecord {
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
export declare const formId: (value: unknown) => value is string;
export declare function validateFormDefinition(value: unknown): FormDefinition;
export declare function isFieldRequired(field: FormField, answers: FormAnswers): boolean;
export declare function validateFormAnswers(definition: FormDefinition, value: unknown, final: boolean): FormAnswers;
export declare function respondentDefinition(definition: FormVersion): FormVersion;
//# sourceMappingURL=formModel.d.ts.map