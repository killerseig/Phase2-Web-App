/**
 * Application Constants & Configuration
 * Centralized configuration for the entire app
 */

// ============================================================================
// USER ROLES
// ============================================================================
export const USER_ROLES = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
  SHOP: 'shop',
  FOREMAN: 'foreman',
  NONE: 'none',
} as const

export const ROLE_LABELS = {
  admin: 'Administrator',
  employee: 'Employee',
  shop: 'Shop',
  foreman: 'Foreman',
  none: 'None',
} as const

export const VALID_ROLES = ['admin', 'employee', 'shop', 'foreman', 'none'] as const

// ============================================================================
// STATUS & WORKFLOW
// ============================================================================
export const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
} as const

export const STATUS_COLORS = {
  draft: 'secondary',
  submitted: 'warning',
  approved: 'success',
  active: 'success',
  inactive: 'danger',
  completed: 'success',
  archived: 'secondary',
} as const

export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  active: 'Active',
  inactive: 'Inactive',
  completed: 'Completed',
  archived: 'Archived',
} as const

// ============================================================================
// COLLECTIONS
// ============================================================================
export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  JOBS: 'jobs',
  EMPLOYEES: 'employees',
  DAILY_LOGS: 'dailyLogs',
  TIMECARDS: 'timecards',
  SHOP_CATALOG: 'shopCatalog',
  SHOP_CATEGORIES: 'shopCategories',
  SHOP_ORDERS: 'shopOrders',
} as const

// ============================================================================
// VALIDATION RULES
// ============================================================================
export const VALIDATION = {
  // Names
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  
  // Email
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // Descriptions
  MIN_DESCRIPTION_LENGTH: 1,
  MAX_DESCRIPTION_LENGTH: 500,
  
  // Numbers
  MIN_PRICE: 0,
  MAX_PRICE: 999999,
  
  MIN_QUANTITY: 0,
  MAX_QUANTITY: 10000,
} as const

export const ERROR_MESSAGES = {
  // Auth
  NOT_SIGNED_IN: 'You are not signed in',
  AUTH_FAILED: 'Authentication failed',
  
  // Validation
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email address',
  NAME_TOO_SHORT: `Name must be at least ${VALIDATION.MIN_NAME_LENGTH} characters`,
  NAME_TOO_LONG: `Name must be at most ${VALIDATION.MAX_NAME_LENGTH} characters`,
  
  // Resources
  NOT_FOUND: 'The requested resource was not found',
  PERMISSION_DENIED: 'You do not have permission to perform this action',
  
  // Operations
  FAILED_TO_SAVE: 'Failed to save changes',
  FAILED_TO_DELETE: 'Failed to delete item',
  FAILED_TO_CREATE: 'Failed to create item',
  FAILED_TO_LOAD: 'Failed to load data',
} as const

// ============================================================================
// EMAIL CONFIGURATION
// ============================================================================
export const EMAIL_CONFIG = {
  SUBJECTS: {
    WELCOME: 'Welcome to the Application',
    DAILY_LOG: 'Daily Log',
    DAILY_LOG_AUTO: 'Daily Log (Auto-Submit)',
    TIMECARD: 'Timecard Submission',
    SHOP_ORDER: 'Shop Order',
    PASSWORD_RESET: 'Reset Your Password',
  },
} as const

// ============================================================================
// UI CONFIGURATION
// ============================================================================
export const UI = {
  // Pagination
  ITEMS_PER_PAGE: 25,
  
  // Debounce delays (ms)
  SEARCH_DEBOUNCE: 300,
  SAVE_DEBOUNCE: 500,
  
  // Toast notifications
  TOAST_DURATION: 5000,
  
  // Modals
  MODAL_ANIMATION_DURATION: 300,
} as const

// ============================================================================
// DATE/TIME
// ============================================================================
export const DATE_FORMATS = {
  DISPLAY_DATE: 'MMM DD, YYYY',
  DISPLAY_TIME: 'HH:mm',
  ISO_DATE: 'YYYY-MM-DD',
  FIRESTORE_DATE: 'YYYY-MM-DD',
} as const

// ============================================================================
// API & CLOUD FUNCTIONS
// ============================================================================
export const CLOUD_FUNCTIONS = {
  SEND_PASSWORD_RESET_EMAIL: 'sendPasswordResetEmail',
  SEND_DAILY_LOG_EMAIL: 'sendDailyLogEmail',
  SEND_TIMECARD_EMAIL: 'sendTimecardEmail',
  SEND_SHOP_ORDER_EMAIL: 'sendShopOrderEmail',
  CREATE_USER_BY_ADMIN: 'createUserByAdmin',
  DELETE_USER: 'deleteUser',
} as const

export const API_TIMEOUT_MS = 30000 // 30 seconds

// ============================================================================
// FEATURE FLAGS
// ============================================================================
export const FEATURES = {
  EMAIL_ENABLED: true,
  DAILY_LOGS_ENABLED: true,
  TIMECARDS_ENABLED: true,
  SHOP_ORDERS_ENABLED: true,
  ADMIN_PANEL_ENABLED: true,
} as const

// ============================================================================
// LABOR CONTRACTORS & SUBCATEGORIES
// ============================================================================
export const LABOR_CONTRACTORS = {
  CONTRACTOR_1: {
    id: 'contractor-1',
    name: 'ABC Labor Contractors',
    categories: ['Ironworkers', 'Laborers', 'Equipment Operators', 'Welders'],
  },
  CONTRACTOR_2: {
    id: 'contractor-2',
    name: 'XYZ Subcontractors',
    categories: ['Concrete Specialists', 'Carpenters', 'Formwork Specialists'],
  },
  CONTRACTOR_3: {
    id: 'contractor-3',
    name: 'Third Contractor',
    categories: ['Electricians', 'HVAC Technicians', 'Plumbers', 'Safety Inspectors'],
  },
} as const

// Flattened list of all contractors for dropdowns
export const CONTRACTOR_LIST = Object.values(LABOR_CONTRACTORS)

// ============================================================================
// TIMECARD & ACCOUNT VALIDATION
// ============================================================================
export const ACCOUNT_VALIDATION = {
  ACCOUNT_NUMBER_PATTERN: /^\d{4}$/,    // Exactly 4 digits
  ACCOUNT_NUMBER_LENGTH: 4,
  GL_CODE_LENGTH: 3,                     // 3-digit GL code makes account # optional
  EMPLOYEE_NUMBER_PATTERN: /^\d{4,5}$/,  // 4-5 digits
  EMPLOYEE_NUMBER_MIN: 4,
  EMPLOYEE_NUMBER_MAX: 5,
} as const

// ============================================================================
// TIMECARD WEEK CONFIGURATION
// ============================================================================
export const TIMECARD_CONFIG = {
  WEEK_START_DAY: 0,                  // 0 = Sunday
  WEEK_END_DAY: 6,                    // 6 = Saturday
  DAYS_PER_WEEK: 7,
  SUBMISSION_DEADLINE_DAY: 1,         // Monday
  SUBMISSION_DEADLINE_HOUR: 12,       // Noon
} as const

// Day names for display (index 0=Sunday)
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
