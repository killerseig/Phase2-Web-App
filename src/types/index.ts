/**
 * Centralized Types
 * All shared interfaces and types used across the application
 */

// Re-export centralized document types
export type {
  AuditMetadata,
  UserTrackedDocument,
  SubmittableDocument,
  ApprovableDocument,
  DocumentStatus,
  SubmittableStatus,
} from './documents'

// Re-export API response types
export type { ApiResponse } from './api'
export { successResponse, errorResponse, ErrorCodes } from './api'

// ============================================================================
// AUTH & USERS
// ============================================================================

export type UserRole = 'admin' | 'employee' | 'shop' | 'none'

export interface UserProfile {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  active: boolean
  createdAt?: any
}

// ============================================================================
// JOBS
// ============================================================================

export interface Job {
  id: string
  number: string
  name: string
  address: string
  status: 'active' | 'inactive' | 'completed'
  createdAt: any
  updatedAt: any
}

// ============================================================================
// EMPLOYEES
// ============================================================================

export interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeNumber?: string
  occupation: string
  createdAt: any
  updatedAt: any
}

export type EmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>

// ============================================================================
// DAILY LOGS
// ============================================================================

export type DailyLogStatus = 'draft' | 'submitted'

export interface ManpowerLine {
  trade: string
  count: number
  areas: string
}

export interface DailyLogAttachment {
  name: string
  url: string
  type?: string
}

export interface DailyLog {
  id: string
  jobId: string
  logDate: string
  status: DailyLogStatus
  projectName: string
  jobSiteNumbers: string
  foremanOnSite: string
  siteForemanAssistant: string
  manpower: string
  manpowerLines: ManpowerLine[]
  weeklySchedule: string
  manpowerAssessment: string
  safetyConcerns: string
  ahaReviewed: boolean
  scheduleConcerns: string
  budgetConcerns: string
  deliveriesReceived: string
  deliveriesNeeded: string
  newWorkAuthorizations: string
  qcInspection: string
  notesCorrespondence: string
  actionItems: string
  attachments: DailyLogAttachment[]
  createdBy: string
  createdAt: any
  updatedAt: any
}

export type DailyLogDraftInput = Omit<
  DailyLog,
  'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'status'
>

// ============================================================================
// TIMECARDS
// ============================================================================

export type TimecardStatus = 'draft' | 'submitted' | 'approved'

export interface TimecardLine {
  jobNumber: string
  area: string
  account: string
  mon: number
  tue: number
  wed: number
  thu: number
  fri: number
  sat: number
  sun: number
}

export interface Timecard {
  id: string
  jobId: string
  weekStart: string
  weekEnding: string
  employeeId: string
  employeeName: string
  status: TimecardStatus
  lines: TimecardLine[]
  submittedAt?: any
  approvedAt?: any
  approvedBy?: string
  createdAt: any
  updatedAt: any
}

export type TimecardDraftInput = Omit<
  Timecard,
  'id' | 'status' | 'submittedAt' | 'approvedAt' | 'approvedBy' | 'createdAt' | 'updatedAt'
>

// ============================================================================
// SHOP CATALOG
// ============================================================================

export interface ShopCatalogItem {
  id: string
  name: string
  description: string
  price: number
  unit: string
  category: string
  inStock: boolean
  createdAt: any
  updatedAt: any
}

// ============================================================================
// SHOP ORDERS
// ============================================================================

export type ShopOrderStatus = 'draft' | 'order' | 'receive'

export interface ShopOrderItem {
  catalogItemId?: string
  description: string
  quantity: number
  note?: string
}

export interface ShopOrder {
  id: string
  jobId: string
  orderDate: any
  status: ShopOrderStatus
  items: ShopOrderItem[]
  submittedAt?: any
  createdBy: string
  createdAt: any
  updatedAt: any
}

// ============================================================================
// ATTACHMENTS & STORAGE
// ============================================================================

export type AttachmentType = 'photo' | 'ptp' | 'other'

export interface Attachment {
  name: string
  url: string
  type: AttachmentType
  size: number
  uploadedAt: any
}

// ============================================================================
// SERVICE REQUESTS/RESPONSES
// ============================================================================

export interface ServiceResponse<T> {
  success: boolean
  message: string
  data?: T
}

export interface EmailResponse {
  success: boolean
  message: string
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}
