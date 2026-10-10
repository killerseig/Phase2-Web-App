import { type FormRecord } from './formModel';
import type { DailyLogInlinePhotoAttachment } from './dailyLogEmailPhotos';
/** Caller must authorize the entry before reading bytes; validate membership and storage ownership again. */
export declare function readEntryPhoto(record: FormRecord, assetId: string): Promise<Buffer>;
export declare function entryPdfPhotos(record: FormRecord): Promise<DailyLogInlinePhotoAttachment[]>;
//# sourceMappingURL=formEntryPhotos.d.ts.map