import { type FormRecord } from './formModel';
import type { DailyLogInlinePhotoAttachment } from './dailyLogEmailPhotos';
import { type FormTranslation } from './formTranslation';
/** Printable complete form, independent of custom email omissions. No scripts or external fetches. */
export declare function buildFormSubmissionPdf(record: FormRecord, previews?: DailyLogInlinePhotoAttachment[], translation?: FormTranslation): Promise<Buffer>;
//# sourceMappingURL=formSubmissionPdf.d.ts.map