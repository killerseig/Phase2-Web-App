export { buildFormEmailHtml, buildFormEmailText } from './formEmailRender';
import { type FormRecord } from './formModel';
import { type SendEmailOptions } from './emailService';
import type { FormTranslation } from './formTranslation';
import { type DailyLogInlinePhotoAttachment } from './dailyLogEmailPhotos';
interface FormPhotoAsset {
    recordId: string;
    fieldId: string;
    ownerUid: string;
    path: string;
    groupId?: string;
    instanceId?: string;
}
export interface FormEmailDependencies {
    translate?: (record: FormRecord) => Promise<FormTranslation>;
    loadAsset: (id: string) => Promise<FormPhotoAsset | undefined>;
    download: (path: string, maxBytes: number) => Promise<Buffer>;
    ownerEmail: (uid: string) => Promise<unknown>;
    appBaseUrl: () => string;
}
export declare class FormEmailPreparationError extends Error {
    constructor(message: string);
}
/** PDF attachments include every submitted photo, independent of capped HTML thumbnails. */
export declare function prepareFormPdfPhotos(record: FormRecord, deps: FormEmailDependencies): Promise<DailyLogInlinePhotoAttachment[]>;
/** Graph uses HTML, as Daily Logs does. Text is the equivalent capture/export representation. */
export interface PreparedFormEmail extends SendEmailOptions {
    text: string;
}
export declare function prepareFormEmail(record: FormRecord, recipients: string[], deps?: FormEmailDependencies): Promise<PreparedFormEmail>;
export declare function fitFormEmailPayload(options: PreparedFormEmail): PreparedFormEmail;
//# sourceMappingURL=formEmailContent.d.ts.map