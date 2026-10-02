export { buildFormEmailHtml, buildFormEmailText } from './formEmailRender';
import { type FormRecord } from './formModel';
import { type SendEmailOptions } from './emailService';
interface FormPhotoAsset {
    recordId: string;
    fieldId: string;
    ownerUid: string;
    path: string;
}
export interface FormEmailDependencies {
    loadAsset: (id: string) => Promise<FormPhotoAsset | undefined>;
    download: (path: string, maxBytes: number) => Promise<Buffer>;
    ownerEmail: (uid: string) => Promise<unknown>;
    appBaseUrl: () => string;
    viewerUrl?: (record: FormRecord) => Promise<string>;
}
export declare class FormEmailPreparationError extends Error {
    constructor(message: string);
}
/** Graph uses HTML, as Daily Logs does. Text is the equivalent capture/export representation. */
export interface PreparedFormEmail extends SendEmailOptions {
    text: string;
}
export declare function prepareFormEmail(record: FormRecord, recipients: string[], deps?: FormEmailDependencies): Promise<PreparedFormEmail>;
export declare function fitFormEmailPayload(options: PreparedFormEmail): PreparedFormEmail;
//# sourceMappingURL=formEmailContent.d.ts.map