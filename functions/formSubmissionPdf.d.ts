import { type FormRecord } from './formModel';
import type { DailyLogInlinePhotoAttachment } from './dailyLogEmailPhotos';
/** Printable complete form, independent of custom email omissions. No scripts or external fetches. */
export declare function buildFormSubmissionPdf(record: FormRecord, previews?: DailyLogInlinePhotoAttachment[]): Promise<Buffer>;
//# sourceMappingURL=formSubmissionPdf.d.ts.map