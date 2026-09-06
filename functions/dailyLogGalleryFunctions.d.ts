type GalleryAttachmentType = 'photo' | 'ptp' | 'qc' | 'other';
interface GalleryAttachment {
    name: string;
    url: string;
    type: GalleryAttachmentType;
    description: string;
}
interface EnsureDailyLogGalleryShareInput {
    dailyLogId: string;
    jobId: string;
    jobDetails?: any;
    log?: any;
}
export declare function buildPublicDailyLogGalleryPayload(jobDetails: any, log: any): {
    jobName: string;
    jobCode: string;
    logDate: string;
    sequenceNumber: number;
    foremanName: string;
    submittedAt: string | null;
    attachments: GalleryAttachment[];
};
export declare function ensureDailyLogGalleryShare({ dailyLogId, jobId, }: EnsureDailyLogGalleryShareInput): Promise<string>;
export declare function loadPublicDailyLogGallery(shareId: string): Promise<{
    jobName: string;
    jobCode: string;
    logDate: string;
    sequenceNumber: number;
    foremanName: string;
    submittedAt: string | null;
    attachments: GalleryAttachment[];
}>;
export declare function loadLegacyPublicDailyLogGallery(jobId: string, dailyLogId: string): Promise<{
    jobName: string;
    jobCode: string;
    logDate: string;
    sequenceNumber: number;
    foremanName: string;
    submittedAt: string | null;
    attachments: GalleryAttachment[];
}>;
export declare const getPublicDailyLogGallery: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    jobName: string;
    jobCode: string;
    logDate: string;
    sequenceNumber: number;
    foremanName: string;
    submittedAt: string | null;
    attachments: GalleryAttachment[];
}>, unknown>;
export {};
//# sourceMappingURL=dailyLogGalleryFunctions.d.ts.map