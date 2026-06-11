export declare function prepareTimecardsForPdfCsvExport(timecards: any[]): Promise<any[]>;
export declare function normalizeTimecardForEmail(tc: any): any;
/**
 * Send Daily Log via email
 */
export declare const sendDailyLogEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export declare function buildTimecardCsv(timecards: any[], weekStart: string, defaultJobCode?: string): string;
export declare function buildTimecardCsvFilename(startWeek: string, endWeek?: string, jobCode?: string): string;
export declare function buildTimecardPdfFilename(startWeek: string, endWeek?: string, jobCode?: string): string;
export declare function buildTimecardPdfBuffer(payload: {
    jobName?: string;
    jobNumber?: string;
    submittedBy?: string;
    weekStart?: string;
    timecards: any[];
}): Promise<Buffer>;
/**
 * Send Shop Order via email
 */
export declare const sendShopOrderEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
//# sourceMappingURL=operationsFunctions.d.ts.map