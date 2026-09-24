export interface WebsiteFormField {
    id: string;
    label: string;
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
    required: boolean;
    options: string[];
}
export interface WebsiteFormDelivery {
    to: string[];
    cc: string[];
    subject: string;
}
export interface WebsiteFormDefinition {
    id: string;
    name: string;
    description: string;
    buttonLabel: string;
    successMessage: string;
    replyToField: string;
    fields: WebsiteFormField[];
    delivery?: WebsiteFormDelivery;
}
export type WebsiteFormValues = Record<string, string | boolean>;
export declare const formEmail: (value: string) => boolean;
export declare function validateForm(value: unknown): WebsiteFormDefinition;
export declare function validateFormValues(form: WebsiteFormDefinition, raw: unknown): WebsiteFormValues;
export declare function newWebsiteForm(id: string): WebsiteFormDefinition;
export declare function publicForm(form: WebsiteFormDefinition): WebsiteFormDefinition;
//# sourceMappingURL=websiteForms.d.ts.map