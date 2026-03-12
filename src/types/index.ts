/**
 * Centralized Types
 * All shared interfaces and types used across the application
 */

import type { Role } from '@/constants/app'

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

export type UserRole = Role

export interface UserProfile {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  active: boolean
  createdAt?: unknown
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
  createdAt: unknown
  updatedAt: unknown
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
  createdAt: unknown
  updatedAt: unknown
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
  path?: string
  type?: string
  createdAt?: unknown
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
  createdAt: unknown
  updatedAt: unknown
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
  submittedAt?: unknown
  approvedAt?: unknown
  approvedBy?: string
  createdAt: unknown
  updatedAt: unknown
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
  createdAt: unknown
  updatedAt: unknown
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
  orderDate: unknown
  status: ShopOrderStatus
  items: ShopOrderItem[]
  submittedAt?: unknown
  createdBy: string
  createdAt: unknown
  updatedAt: unknown
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
  uploadedAt: unknown
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

