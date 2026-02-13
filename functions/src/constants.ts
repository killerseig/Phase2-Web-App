/**
 * Application Constants
 * Centralized configuration for roles, collections, messages, etc.
 */

// User Roles
// NOTE: frontend supports a 'foreman' role; include it here to keep backend validation aligned.
export const VALID_ROLES = ['admin', 'employee', 'shop', 'foreman', 'none'] as const
export type UserRole = typeof VALID_ROLES[number]

// Firestore Collections
export const COLLECTIONS = {
  USERS: 'users',
  JOBS: 'jobs',
  DAILY_LOGS: 'dailyLogs',
  SHOP_ORDERS: 'shopOrders',
  WEEKS: 'weeks',
  TIMECARDS: 'timecards',
} as const

// Email Configuration
export const EMAIL = {
  SUBJECTS: {
    WELCOME: 'Create Your Phase 2 Account Password',
    DAILY_LOG: 'Daily Log Report',
    DAILY_LOG_AUTO: 'Daily Log (Auto-Submitted)',
    TIMECARD: 'Timecard Report',
    SHOP_ORDER: 'Shop Order',
    SECRET_EXPIRATION: '⚠️ Graph API Secret Expiring Soon - Action Required',
  },
  URLS: {
    LOGIN: 'https://phase2-website.web.app/login',
    BRAND_NAME: 'Phase 2',
  },
  // Microsoft Graph API Configuration
  GRAPH: {
    SCOPE: 'https://graph.microsoft.com/.default',
    TOKEN_ENDPOINT_TEMPLATE: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
    SEND_MAIL_ENDPOINT: 'https://graph.microsoft.com/v1.0/me/sendMail',
    TOKEN_EXPIRATION_BUFFER_MS: 300000, // 5 minutes before actual expiration
  },
  SENDER_EMAIL: 'no-reply@phase2co.com',
  // Secret expiration monitoring
  SECRET_EXPIRATION_DATE: '2027-02-09', // YYYY-MM-DD format
  SECRET_NOTIFICATION_DAYS: 30,
} as const

// Error Messages
export const ERROR_MESSAGES = {
  NOT_SIGNED_IN: 'Must be signed in',
  NOT_SIGNED_IN_CREATE: 'Must be signed in to create users',
  NOT_SIGNED_IN_DELETE: 'Must be signed in to delete users',
  EMAIL_REQUIRED: 'Email is required',
  FIRST_NAME_REQUIRED: 'First name is required',
  LAST_NAME_REQUIRED: 'Last name is required',
  INVALID_ROLE: (roles: string[]) => `Invalid role. Must be one of: ${roles.join(', ')}`,
  USER_PROFILE_NOT_FOUND: 'Your user profile not found',
  ONLY_ADMINS_CAN_CREATE: 'Only admins can create users',
  ONLY_ADMINS_CAN_DELETE: 'Only admins can delete users',
  USER_ALREADY_EXISTS: 'User with this email already exists',
  DAILY_LOG_ID_REQUIRED: 'dailyLogId is required',
  RECIPIENTS_REQUIRED: 'recipients array is required',
  DAILY_LOG_NOT_FOUND: 'Daily log not found',
  JOB_ID_REQUIRED: 'jobId is required',
  TIMECARD_ID_REQUIRED: 'timecardId is required',
  WEEK_START_REQUIRED: 'weekStart is required',
  TIMECARD_NOT_FOUND: 'Timecard not found',
  SHOP_ORDER_ID_REQUIRED: 'shopOrderId is required',
  SHOP_ORDER_NOT_FOUND: 'Shop order not found',
  UID_REQUIRED: 'User ID (uid) is required',
  FAILED_TO_CREATE_USER: 'Failed to create user',
  FAILED_TO_DELETE_USER: 'Failed to delete user',
} as const

// Default Values
export const DEFAULTS = {
  JOB_NAME: 'Unknown Job',
  USER_NAME: 'Unknown User',
  TIMECARD_ENTRY: 'No timecard entries',
  SHOP_ORDER_ITEMS: 'No items in order',
  STATUS_DRAFT: 'draft',
  STATUS_AUTO: 'Submitted (Auto)',
} as const

// HTML/Email Styling
export const EMAIL_STYLES = `
  <style>
    .email-container {
      font-family: Arial, sans-serif;
      background-color: #f5f5f5;
      padding: 20px;
    }
    .header {
      background-color: #007bff;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 4px 4px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      background-color: white;
      padding: 20px;
      line-height: 1.6;
    }
    .footer {
      background-color: #f0f0f0;
      padding: 15px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-radius: 0 0 4px 4px;
    }
    .footer p {
      margin: 0;
    }
    table {
      border: 1px solid #ddd;
      border-collapse: collapse;
      width: 100%;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
  </style>
` as const

export const EMAIL_STYLES_OBJECT = {
  TABLE: 'border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-top: 10px;"',
  TABLE_HEADER_ROW: 'style="background-color: #f0f0f0;"',
  BUTTON: 'style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;"',
  LINK: 'style="color: #007bff;"',
} as const
