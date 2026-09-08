import { type DocumentReference } from 'firebase-admin/firestore';
import { getJobDetails, getUserProfile, getDailyLog, getShopOrder, getEmailSettings, getJobNotificationRecipients } from './firestoreService';
import { sendEmail, buildDailyLogEmail, buildShopOrderEmail, buildShopOrderPdfBuffer, buildShopOrderPdfFilename, isEmailEnabled } from './emailService';
import { type SubmittedEmailStatusResult } from './emailStatus';
import { claimSubmittedEmailOperation } from './submittedEmailOperations';
import { getAppBaseUrl } from './functionConfig';
import { ensureDailyLogGalleryShare } from './dailyLogGalleryFunctions';
import { prepareDailyLogInlinePhotos } from './dailyLogEmailPhotos';
declare function getShopOrderCostCodesByCatalogItemId(items: any[]): Promise<Record<string, string>>;
declare function recordSubmittedEmailStatus(refs: DocumentReference[], result: SubmittedEmailStatusResult, context: Record<string, unknown>): Promise<void>;
declare function dailyLogEmailStatusRefs(jobId: string, dailyLogId: string): DocumentReference[];
declare function shopOrderEmailStatusRefs(jobId: string, shopOrderId: string): DocumentReference[];
declare function getJobScopedShopOrderSnapshot(jobId: string, shopOrderId: string): Promise<FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData, FirebaseFirestore.DocumentData>>;
export declare function prepareTimecardsForPdfCsvExport(timecards: any[]): Promise<any[]>;
interface CallableRequestLike {
    auth?: {
        uid: string;
    } | null;
    data?: any;
}
interface SendDailyLogEmailDependencies {
    getUserProfile: typeof getUserProfile;
    getJobDetails: typeof getJobDetails;
    dailyLogEmailStatusRefs: typeof dailyLogEmailStatusRefs;
    claimSubmittedEmailOperation: typeof claimSubmittedEmailOperation;
    isEmailEnabled: typeof isEmailEnabled;
    getDailyLog: typeof getDailyLog;
    getEmailSettings: typeof getEmailSettings;
    getJobNotificationRecipients: typeof getJobNotificationRecipients;
    getAppBaseUrl: typeof getAppBaseUrl;
    ensureDailyLogGalleryShare: typeof ensureDailyLogGalleryShare;
    prepareDailyLogInlinePhotos: typeof prepareDailyLogInlinePhotos;
    buildDailyLogEmail: typeof buildDailyLogEmail;
    sendEmail: typeof sendEmail;
    recordSubmittedEmailStatus: typeof recordSubmittedEmailStatus;
}
export declare function normalizeTimecardForEmail(tc: any): any;
export declare function handleSendDailyLogEmail(request: CallableRequestLike, deps?: SendDailyLogEmailDependencies): Promise<{
    success: boolean;
    message: string;
}>;
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
export interface TimecardPdfCardHeaderEvent {
    cardId?: string;
    employeeName: string;
    employeeCode: string;
    occupation: string;
    renderBlankTemplate: boolean;
    wageLabel: string;
    weekEnding: string;
}
export interface TimecardPdfBuildOptions {
    onCardHeader?: (event: TimecardPdfCardHeaderEvent) => void;
}
export declare function buildTimecardPdfBuffer(payload: {
    jobName?: string;
    jobNumber?: string;
    submittedBy?: string;
    weekStart?: string;
    timecards: any[];
}, options?: TimecardPdfBuildOptions): Promise<Buffer>;
/**
 * Send Shop Order via email
 */
interface SendShopOrderEmailDependencies {
    getUserProfile: typeof getUserProfile;
    getJobDetails: typeof getJobDetails;
    shopOrderEmailStatusRefs: typeof shopOrderEmailStatusRefs;
    claimSubmittedEmailOperation: typeof claimSubmittedEmailOperation;
    isEmailEnabled: typeof isEmailEnabled;
    getEmailSettings: typeof getEmailSettings;
    getJobNotificationRecipients: typeof getJobNotificationRecipients;
    recordSubmittedEmailStatus: typeof recordSubmittedEmailStatus;
    getShopOrder: typeof getShopOrder;
    getJobScopedShopOrderSnapshot: typeof getJobScopedShopOrderSnapshot;
    getShopOrderCostCodesByCatalogItemId: typeof getShopOrderCostCodesByCatalogItemId;
    buildShopOrderEmail: typeof buildShopOrderEmail;
    buildShopOrderPdfBuffer: typeof buildShopOrderPdfBuffer;
    buildShopOrderPdfFilename: typeof buildShopOrderPdfFilename;
    sendEmail: typeof sendEmail;
}
export declare function handleSendShopOrderEmail(request: CallableRequestLike, deps?: SendShopOrderEmailDependencies): Promise<{
    success: boolean;
    message: string;
}>;
export declare const sendShopOrderEmail: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    success: boolean;
    message: string;
}>, unknown>;
export {};
//# sourceMappingURL=operationsFunctions.d.ts.map