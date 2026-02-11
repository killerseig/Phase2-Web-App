/**
 * Application Constants
 * Centralized configuration for roles, collections, messages, etc.
 */
export declare const VALID_ROLES: readonly ["admin", "employee", "shop", "none"];
export type UserRole = typeof VALID_ROLES[number];
export declare const COLLECTIONS: {
    readonly USERS: "users";
    readonly JOBS: "jobs";
    readonly DAILY_LOGS: "dailyLogs";
    readonly SHOP_ORDERS: "shopOrders";
    readonly WEEKS: "weeks";
    readonly TIMECARDS: "timecards";
};
export declare const EMAIL: {
    readonly SUBJECTS: {
        readonly WELCOME: "Create Your Phase 2 Account Password";
        readonly DAILY_LOG: "Daily Log Report";
        readonly DAILY_LOG_AUTO: "Daily Log (Auto-Submitted)";
        readonly TIMECARD: "Timecard Report";
        readonly SHOP_ORDER: "Shop Order";
        readonly SECRET_EXPIRATION: "⚠️ Graph API Secret Expiring Soon - Action Required";
    };
    readonly URLS: {
        readonly LOGIN: "https://phase2-website.web.app/login";
        readonly BRAND_NAME: "Phase 2";
    };
    readonly GRAPH: {
        readonly SCOPE: "https://graph.microsoft.com/.default";
        readonly TOKEN_ENDPOINT_TEMPLATE: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
        readonly SEND_MAIL_ENDPOINT: "https://graph.microsoft.com/v1.0/me/sendMail";
        readonly TOKEN_EXPIRATION_BUFFER_MS: 300000;
    };
    readonly SENDER_EMAIL: "no-reply@phase2co.com";
    readonly SECRET_EXPIRATION_DATE: "2027-02-09";
    readonly SECRET_NOTIFICATION_DAYS: 30;
};
export declare const ERROR_MESSAGES: {
    readonly NOT_SIGNED_IN: "Must be signed in";
    readonly NOT_SIGNED_IN_CREATE: "Must be signed in to create users";
    readonly NOT_SIGNED_IN_DELETE: "Must be signed in to delete users";
    readonly EMAIL_REQUIRED: "Email is required";
    readonly FIRST_NAME_REQUIRED: "First name is required";
    readonly LAST_NAME_REQUIRED: "Last name is required";
    readonly INVALID_ROLE: (roles: string[]) => string;
    readonly USER_PROFILE_NOT_FOUND: "Your user profile not found";
    readonly ONLY_ADMINS_CAN_CREATE: "Only admins can create users";
    readonly ONLY_ADMINS_CAN_DELETE: "Only admins can delete users";
    readonly USER_ALREADY_EXISTS: "User with this email already exists";
    readonly DAILY_LOG_ID_REQUIRED: "dailyLogId is required";
    readonly RECIPIENTS_REQUIRED: "recipients array is required";
    readonly DAILY_LOG_NOT_FOUND: "Daily log not found";
    readonly JOB_ID_REQUIRED: "jobId is required";
    readonly TIMECARD_ID_REQUIRED: "timecardId is required";
    readonly WEEK_START_REQUIRED: "weekStart is required";
    readonly TIMECARD_NOT_FOUND: "Timecard not found";
    readonly SHOP_ORDER_ID_REQUIRED: "shopOrderId is required";
    readonly SHOP_ORDER_NOT_FOUND: "Shop order not found";
    readonly UID_REQUIRED: "User ID (uid) is required";
    readonly FAILED_TO_CREATE_USER: "Failed to create user";
    readonly FAILED_TO_DELETE_USER: "Failed to delete user";
};
export declare const DEFAULTS: {
    readonly JOB_NAME: "Unknown Job";
    readonly USER_NAME: "Unknown User";
    readonly TIMECARD_ENTRY: "No timecard entries";
    readonly SHOP_ORDER_ITEMS: "No items in order";
    readonly STATUS_DRAFT: "draft";
    readonly STATUS_AUTO: "Submitted (Auto)";
};
export declare const EMAIL_STYLES: "\n  <style>\n    .email-container {\n      font-family: Arial, sans-serif;\n      background-color: #f5f5f5;\n      padding: 20px;\n    }\n    .header {\n      background-color: #007bff;\n      color: white;\n      padding: 20px;\n      text-align: center;\n      border-radius: 4px 4px 0 0;\n    }\n    .header h1 {\n      margin: 0;\n      font-size: 24px;\n    }\n    .content {\n      background-color: white;\n      padding: 20px;\n      line-height: 1.6;\n    }\n    .footer {\n      background-color: #f0f0f0;\n      padding: 15px;\n      text-align: center;\n      font-size: 12px;\n      color: #666;\n      border-radius: 0 0 4px 4px;\n    }\n    .footer p {\n      margin: 0;\n    }\n    table {\n      border: 1px solid #ddd;\n      border-collapse: collapse;\n      width: 100%;\n      margin-top: 10px;\n    }\n    th, td {\n      border: 1px solid #ddd;\n      padding: 8px;\n      text-align: left;\n    }\n    th {\n      background-color: #f0f0f0;\n      font-weight: bold;\n    }\n  </style>\n";
export declare const EMAIL_STYLES_OBJECT: {
    readonly TABLE: "border=\"1\" cellpadding=\"5\" cellspacing=\"0\" style=\"border-collapse: collapse; width: 100%; margin-top: 10px;\"";
    readonly TABLE_HEADER_ROW: "style=\"background-color: #f0f0f0;\"";
    readonly BUTTON: "style=\"background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;\"";
    readonly LINK: "style=\"color: #007bff;\"";
};
//# sourceMappingURL=constants.d.ts.map