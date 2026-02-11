/**
 * Email Service
 * Handles email sending via Microsoft Graph API
 */
import { JobDetails } from './firestoreService';
/**
 * Check if email sending is enabled
 */
export declare function isEmailEnabled(): boolean;
/**
 * Get sender email address
 */
export declare function getSenderEmail(): string;
/**
 * Build HTML template for welcome email
 */
export declare function buildWelcomeEmail(firstName: string, resetLink: string): string;
/**
 * Build HTML template for daily log auto-submit email
 */
export declare function buildDailyLogAutoSubmitEmail(jobDetails: JobDetails, logDate: string): string;
/**
 * Build HTML template for daily log email
 */
export declare function buildDailyLogEmail(jobDetails: JobDetails, logDate: string, dailyLog: any): string;
/**
 * Build HTML template for timecard email
 */
export declare function buildTimecardEmail(employeeName: string, weekEnding: string): string;
/**
 * Build HTML template for shop order email
 */
export declare function buildShopOrderEmail(order: any): string;
/**
 * Build HTML template for client secret expiration notification
 */
export declare function buildSecretExpirationEmail(): string;
/**
 * Send email via Microsoft Graph API
 */
export declare function sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
}): Promise<void>;
/**
 * Send daily log email notification
 */
export declare function sendDailyLogEmailNotification(recipients: string[], jobDetails: JobDetails, logDate: string, dailyLog?: any): Promise<void>;
/**
 * Send timecard email notification
 */
export declare function sendTimecardEmailNotification(recipients: string[], employeeName: string, weekEnding: string): Promise<void>;
/**
 * Send shop order email notification
 */
export declare function sendShopOrderEmailNotification(recipients: string[], order: any): Promise<void>;
/**
 * Send secret expiration warning email
 */
export declare function sendSecretExpirationWarning(adminEmails: string[]): Promise<void>;
//# sourceMappingURL=emailService.d.ts.map