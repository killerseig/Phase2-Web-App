/**
 * Email Service
 * Handles email sending via Microsoft Graph API
 */
import type { JobDetails } from './firestoreService';
import type { DailyLogInlinePhotoPreview } from './dailyLogEmailPhotos';
/**
 * Check if email sending is enabled
 */
export declare function isEmailEnabled(): boolean;
/**
 * Get sender email address
 */
export declare function getSenderEmail(): string;
export declare function buildGraphSenderRecipient(senderEmail: string): {
    emailAddress: {
        address: string;
        name: "Phase 2";
    };
};
export declare function buildDailyLogEmailSubject(jobDetails: JobDetails, logDate: string, dailyLog?: any): string;
export declare function buildShopOrderEmailSubject(order: any, jobDetails?: Partial<JobDetails> | null): string;
export declare function buildTimecardEmailSubject(payload: {
    jobName?: string;
    jobNumber?: string;
    submittedBy?: string;
    weekStart?: string;
}): string;
export declare function normalizeDailyLogEmailPayload(dailyLog: any): Record<string, any>;
/**
 * Build HTML template for welcome email
 */
export declare function buildWelcomeEmail(firstName: string, resetLink: string): string;
/**
 * Build HTML template for password reset email
 */
export declare function buildPasswordResetEmail(displayName: string, resetLink: string): string;
/**
 * Build HTML template for daily log auto-submit email
 */
export declare function buildDailyLogAutoSubmitEmail(jobDetails: JobDetails, logDate: string): string;
/**
 * Build HTML template for daily log email
 */
export declare function buildDailyLogEmail(jobDetails: JobDetails, logDate: string, dailyLog: any, options?: {
    dailyLogUrl?: string;
    inlinePhotoPreviews?: DailyLogInlinePhotoPreview[];
}): string;
export declare function buildTimecardsEmail(payload: {
    jobName?: string;
    jobNumber?: string;
    submittedBy?: string;
    weekStart?: string;
    timecards: any[];
}): string;
/**
 * Build HTML template for shop order email
 */
export declare function buildShopOrderEmail(order: any, costCodesByCatalogItemId?: Record<string, string>): string;
export declare function buildShopOrderPdfFilename(order: any): string;
export interface ShopOrderPdfRenderEvent {
    pageNumber: number;
    y: number;
}
export interface ShopOrderPdfBuildOptions {
    onTableHeader?: (event: ShopOrderPdfRenderEvent) => void;
}
export declare function buildShopOrderPdfBuffer(order: any, costCodesByCatalogItemId?: Record<string, string>, options?: ShopOrderPdfBuildOptions): Promise<Buffer>;
/**
 * Build HTML template for client secret expiration notification
 */
export declare function buildSecretExpirationEmail(): string;
/**
 * Send email via Microsoft Graph API
 */
export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: Array<{
        name: string;
        contentType?: string;
        contentBytes: string;
        contentId?: string;
        isInline?: boolean;
    }>;
}
export declare function buildEmailSendLogSummary(options: SendEmailOptions): {
    recipientCount: number;
    attachmentCount: number;
    hasHtmlBody: boolean;
};
export declare function sendEmail(options: SendEmailOptions): Promise<void>;
/**
 * Send daily log email notification
 */
export declare function sendDailyLogEmailNotification(recipients: string[], jobDetails: JobDetails, logDate: string, dailyLog?: any): Promise<void>;
/**
 * Send shop order email notification
 */
export declare function sendShopOrderEmailNotification(recipients: string[], order: any): Promise<void>;
/**
 * Send secret expiration warning email
 */
export declare function sendSecretExpirationWarning(adminEmails: string[]): Promise<void>;
//# sourceMappingURL=emailService.d.ts.map