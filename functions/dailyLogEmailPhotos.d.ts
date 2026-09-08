export type DailyLogPhotoSectionKey = 'photo' | 'ptp' | 'qc';
export interface DailyLogInlinePhotoPreview {
    section: DailyLogPhotoSectionKey;
    position: number;
    contentId: string;
}
export interface DailyLogInlinePhotoAttachment {
    name: string;
    contentType: 'image/jpeg';
    contentBytes: string;
    contentId: string;
    isInline: true;
}
export interface PreparedDailyLogInlinePhotos {
    previews: DailyLogInlinePhotoPreview[];
    attachments: DailyLogInlinePhotoAttachment[];
}
interface DailyLogPhotoCandidate {
    section: DailyLogPhotoSectionKey;
    position: number;
    originalPath: string;
    thumbnailPath: string;
}
interface DailyLogEmailPhotoDependencies {
    downloadObject: (path: string, maxBytes: number) => Promise<Buffer>;
    createBoundedJpeg: (source: Buffer, maxBytes: number) => Promise<Buffer | null>;
}
export declare const DAILY_LOG_EMAIL_PHOTO_PREVIEW_LIMIT = 6;
export declare const DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES: number;
export declare const DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES: number;
export declare const DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES: number;
export declare function normalizeDailyLogPhotoSection(value: unknown): DailyLogPhotoSectionKey;
export declare function getExpectedDailyLogThumbnailPath(originalPath: string, dailyLogId: string): string;
export declare function selectDailyLogEmailPhotoCandidates(dailyLogId: string, dailyLog: unknown): DailyLogPhotoCandidate[];
export declare function prepareDailyLogInlinePhotos(dailyLogId: string, dailyLog: unknown, dependencies?: DailyLogEmailPhotoDependencies): Promise<PreparedDailyLogInlinePhotos>;
export {};
//# sourceMappingURL=dailyLogEmailPhotos.d.ts.map