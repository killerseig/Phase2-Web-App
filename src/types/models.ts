/**
 * Core Domain Models for Phase 3
 * Updated data structures for job-scoped employees, weekly timecards, and foreman management
 */

import type { Timestamp } from 'firebase/firestore'
import { ROLES } from '@/constants/app'

// ============================================================================
// USER PROFILE
// ============================================================================

export type Role = typeof ROLES[keyof typeof ROLES]

export interface UserProfile {
  id: string              // Firebase Auth UID
  email: string | null
  firstName: string | null
  lastName: string | null
  role: Role
  active: boolean
  
  // Foreman-specific: which jobs they can manage
  assignedJobIds?: string[]  // Empty for non-foremen
  
  createdAt?: Timestamp
  lastLoginAt?: Timestamp
}

// ============================================================================
// JOB
// ============================================================================

export type JobType = 'general' | 'subcontractor'
export type TimecardStatus = 'pending' | 'submitted' | 'archived'

export interface Job {
  id: string
  header?: string | null
  name: string
  code?: string | null              // 3-digit GL code
  projectManager?: string | null
  foreman?: string | null
  gc?: string | null
  jobAddress?: string | null
  startDate?: string | null
  finishDate?: string | null
  taxExempt?: string | null
  certified?: string | null
  cip?: string | null
  kjic?: string | null
  accountNumber?: string | null     // 4-digit account number
  type: JobType                     // general or subcontractor
  active: boolean
  
  // Foreman assignment
  assignedForemanIds?: string[]     // UIDs of foremen responsible for this job
  
  // Timecard tracking
  timecardStatus?: TimecardStatus   // Current submission status
  timecardSubmittedAt?: Timestamp   // When last submitted
  timecardPeriodEndDate?: string    // YYYY-MM-DD (Saturday) - current period
  timecardLastSentWeekEnding?: string // YYYY-MM-DD (Saturday) last week sent to office
  
  // Communications
  dailyLogRecipients?: string[]
  
  createdAt?: Timestamp
  archivedAt?: Timestamp
}

// ============================================================================
// JOB ROSTER EMPLOYEE (Job-Scoped)
// ============================================================================

export interface LaborContractor {
  name: string                      // e.g., "ABC Labor Contractors"
  category: string                  // e.g., "Ironworkers"
}

export interface JobRosterEmployee {
  id: string                        // Auto-generated doc ID (NOT employee#)
  jobId: string                     // Parent job
  
  // Identity
  employeeNumber: string            // 4-5 digits (e.g., "1234")
  firstName: string
  lastName: string
  
  // Work info
  occupation: string                // Job title/trade
  contractor?: LaborContractor      // Optional contractor assignment
  
  // Compensation (job-specific and private)
  wageRate?: number                 // Hourly rate
  unitCost?: number                 // Cost per unit for production tracking
  
  // Status
  active: boolean
  isPrimaryForeman?: boolean        // Primary foreman for this job
  
  // Metadata
  createdAt?: Timestamp
  updatedAt?: Timestamp
  addedByUid?: string               // Foreman who added to roster
}

// Input types
export type JobRosterEmployeeInput = Omit<JobRosterEmployee, 'id' | 'jobId' | 'createdAt' | 'updatedAt'>

// ============================================================================
// TIMECARD (Weekly, Job-Scoped)
// ============================================================================

export interface TimecardDay {
  date: string                      // YYYY-MM-DD
  dayOfWeek: number                 // 0=Sun, 1=Mon, ..., 6=Sat
  hours: number                     // Hours worked
  production: number                // Units produced
  unitCost: number                  // Cost per unit
  lineTotal: number                 // production * unitCost
  notes?: string
}

export interface TimecardTotals {
  hours: number[]                   // Array of 7 daily hours
  production: number[]              // Array of 7 daily production
  hoursTotal: number                // Sum of all hours
  productionTotal: number           // Sum of all production
  lineTotal: number                 // Sum of all line totals
}

// Job entry within a timecard (supports multiple jobs per timecard)
export interface TimecardJobEntry {
  jobNumber?: string                // Job # or reference
  subsectionArea?: string           // Subsection/Area
  area?: string                     // Subsection/Area (legacy alias)
  account?: string                  // Account number (alias)
  acct?: string                     // Account number
  div?: string                      // Division
  // Daily tracking per job (0=Sun, 6=Sat)
  days?: TimecardDay[]              // Hours, production, cost per day for this job
}

export interface Timecard {
  id: string
  jobId: string
  
  // Weekly tracking (Sunday-Saturday)
  weekStartDate: string             // YYYY-MM-DD (Sunday - calculated)
  weekEndingDate: string            // YYYY-MM-DD (Saturday - user-selected)
  
  // Submission tracking
  status: 'draft' | 'submitted'
  createdByUid: string              // Foreman who created this
  submittedAt?: Timestamp
  
  // Employee reference (from job roster)
  employeeRosterId: string          // Reference to jobs/{jobId}/roster/{employeeId}
  employeeNumber: string            // Denormalized (quick display)
  employeeName: string              // Denormalized (firstName + lastName)
  firstName?: string                // Denormalized first name
  lastName?: string                 // Denormalized last name
  occupation: string                // Denormalized
  employeeWage?: number | null      // Hourly wage
  subcontractedEmployee?: boolean   // Is subcontracted employee
  
  // Job entries (multiple jobs per timecard)
  jobs?: TimecardJobEntry[]         // Can have multiple jobs with H/P/C tracking
  
  // Daily entries (0=Sun, 6=Sat)
  days: TimecardDay[]               // Must have exactly 7 days
  totals: TimecardTotals            // Calculated summary
  
  // Notes
  notes: string
  
  // Archival
  archived: boolean                 // Default: false
  archivedAt?: Timestamp
  
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

// Input type
export type TimecardInput = Omit<
  Timecard,
  | 'id'
  | 'jobId'
  | 'status'
  | 'createdByUid'
  | 'submittedAt'
  | 'createdAt'
  | 'updatedAt'
  | 'weekStartDate'
  | 'totals'
  | 'archived'
  | 'archivedAt'
>

// ============================================================================
// DAILY LOG (Job-Scoped with Archival)
// ============================================================================

export interface ManpowerLine {
  trade: string
  count: number
  areas: string
  addedByUserId?: string
}

export interface Attachment {
  name: string
  url: string
  path: string
  type?: 'photo' | 'ptp' | 'other'
  createdAt?: Timestamp
}

export interface DailyLog {
  id: string
  jobId: string
  uid: string                       // Foreman who created
  
  // Date tracking
  logDate: string                   // YYYY-MM-DD
  status: 'draft' | 'submitted'
  
  // Site information
  jobSiteNumbers: string
  foremanOnSite: string
  siteForemanAssistant: string
  projectName: string
  
  // Manpower
  manpower: string
  weeklySchedule: string
  manpowerAssessment: string
  manpowerLines?: ManpowerLine[]
  
  // Safety & schedules
  safetyConcerns: string
  ahaReviewed: boolean
  scheduleConcerns: string
  budgetConcerns: string
  
  // Logistics
  deliveriesReceived: string
  deliveriesNeeded: string
  newWorkAuthorizations: string
  qcInspection: string
  
  // Notes
  notesCorrespondence: string
  actionItems: string
  commentsAboutShip?: string
  
  // Attachments
  attachments?: Attachment[]
  
  // Archival support
  archived: boolean                 // Default: false
  archivedAt?: Timestamp
  
  createdAt?: Timestamp
  updatedAt?: Timestamp
  submittedAt?: Timestamp
}

// Input type
export type DailyLogInput = Omit<
  DailyLog,
  'id' | 'jobId' | 'uid' | 'status' | 'createdAt' | 'updatedAt' | 'submittedAt'
>

// ============================================================================
// LABOR CONTRACTOR CONFIGURATION
// ============================================================================

export interface LaborContractorConfig {
  id: string
  name: string
  categories: string[]
}

// ============================================================================
// VIEW MODELS / COMPOSITE TYPES
// ============================================================================

/**
 * Complete timecard with all denormalized employee details
 * Used for display in UI
 */
export interface TimecardDetail extends Timecard {
  rosterEmployee?: JobRosterEmployee
  jobInfo?: Job
}

/**
 * Job with timecard submission status indicator
 * Used for dashboard/job list
 */
export interface JobWithTimecardStatus extends Job {
  timecardSubmissionStatus: 'not-submitted' | 'submitted' | 'archived'
  daysUntilDeadline?: number       // Days until noon Monday deadline
}
