import type { FormDefinition } from './formModel';
export interface FormOutputIssue {
    severity: 'error' | 'warning';
    message: string;
}
export declare function formOutputIssues(definition: FormDefinition): FormOutputIssue[];
/** Plain text plus stable field-ID placeholders only; never evaluate expressions or HTML. */
export declare function renderFormOutputTemplate(definition: FormDefinition, literal: (value: string) => string, answer: (id: string) => string): string;
//# sourceMappingURL=formOutputTemplate.d.ts.map