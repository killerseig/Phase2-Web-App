export type RawRoleKey = 'admin' | 'controller' | 'foreman' | 'none'
export type RoleKey = 'admin' | 'foreman' | 'none'

export interface UserProfile {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  role: RawRoleKey
  active: boolean
  assignedJobIds: string[]
  inviteStatus?: 'pending' | 'sent' | 'accepted' | string | null
  inviteSentAt?: unknown
}

export type JobType =
  | 'paint'
  | 'acoustics'
  | 'drywall'
  | 'small-jobs'
  | 'general'
  | 'subcontractor'

export type NotificationModuleKey = 'dailyLogs' | 'timecards' | 'shopOrders'

export interface NotificationRecipients {
  dailyLogs: string[]
  timecards: string[]
  shopOrders: string[]
}

export interface JobRecord {
  id: string
  name: string
  code: string | null
  gc: string | null
  type: JobType | string
  projectManager?: string | null
  foreman?: string | null
  jobAddress?: string | null
  startDate?: string | null
  finishDate?: string | null
  productionBurden?: number | null
  active: boolean
  assignedForemanIds: string[]
  timecardStatus?: 'pending' | 'submitted' | 'archived' | string | null
  timecardPeriodEndDate?: string | null
  notificationRecipients?: NotificationRecipients
  adminDailyLogRecipients?: string[]
  dailyLogRecipients?: string[]
}

export interface EmployeeRecord {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  wageRate: number | null
  active: boolean
  isContractor: boolean
  jobId: string | null
}

export interface ShopCategoryRecord {
  id: string
  name: string
  parentId: string | null
  active: boolean
}

export interface ShopCatalogItemRecord {
  id: string
  description: string
  categoryId: string | null
  sku: string | null
  price: number | null
  active: boolean
}

export type ShopOrderStatus = 'draft' | 'submitted'

export interface ShopOrderItemRecord {
  id: string
  sourceType: 'catalog' | 'custom'
  catalogItemId: string | null
  description: string
  quantity: number | null
  note: string
  categoryId: string | null
  sku: string | null
}

export interface ShopOrderRecord {
  id: string
  jobId: string
  jobCode: string | null
  jobName: string | null
  deliveryDate: string | null
  status: ShopOrderStatus | string
  comments: string
  foremanUserId: string | null
  foremanName: string | null
  items: ShopOrderItemRecord[]
  createdAt?: unknown
  updatedAt?: unknown
  submittedAt?: unknown
}

export type TimecardWeekStatus = 'draft' | 'submitted'
export type TimecardCardSourceType = 'employee' | 'custom'

export interface TimecardCardDayRecord {
  date: string
  dayOfWeek: number
  hours: number
  production: number
  unitCost: number
  unitCostOverride?: number | null
  lineTotal: number
}

export interface TimecardWorkbookLineRecord {
  jobNumber: string
  subsectionArea: string
  account: string
  difH: string
  difP: string
  difC: string
  offHours: number
  offProduction: number
  offCost: number
  days: TimecardCardDayRecord[]
}

export interface TimecardCardTotalsRecord {
  hoursByDay: number[]
  productionByDay: number[]
  hoursTotal: number
  productionTotal: number
  lineTotal: number
}

export interface TimecardCardRecord {
  id: string
  sourceType: TimecardCardSourceType | string
  employeeId: string | null
  firstName: string
  lastName: string
  fullName: string
  employeeNumber: string
  occupation: string
  wageRate: number | null
  isContractor: boolean
  sortIndex: number
  lines: TimecardWorkbookLineRecord[]
  footerJobOrGl: string
  footerAccount: string
  footerOffice: string
  footerAmount: string
  footerSecondJobOrGl: string
  footerSecondAccount: string
  footerSecondOffice: string
  footerSecondAmount: string
  notes: string
  regularHoursOverride: number | null
  overtimeHoursOverride: number | null
  totals: TimecardCardTotalsRecord
  createdAt?: unknown
  updatedAt?: unknown
}

export interface TimecardWeekRecord {
  id: string
  jobId: string
  jobCode: string | null
  jobName: string | null
  ownerForemanUserId: string | null
  ownerForemanName: string | null
  weekStartDate: string
  weekEndDate: string
  status: TimecardWeekStatus | string
  employeeCardCount: number
  submittedAt?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export type DailyLogStatus = 'draft' | 'submitted'
export type DailyLogAttachmentType = 'photo' | 'ptp' | 'qc' | 'other'

export interface DailyLogAttachmentRecord {
  name: string
  url: string
  path: string
  type: DailyLogAttachmentType
  description: string
  createdAt?: unknown
}

export interface DailyLogManpowerLineRecord {
  trade: string
  count: number
  areas: string
  addedByUserId?: string | null
}

export interface DailyLogIndoorClimateReadingRecord {
  area: string
  high: string
  low: string
  humidity: string
}

export interface DailyLogPayload {
  jobSiteNumbers: string
  foremanOnSite: string
  siteForemanAssistant: string
  projectName: string
  manpower: string
  weeklySchedule: string
  manpowerAssessment: string
  indoorClimateReadings: DailyLogIndoorClimateReadingRecord[]
  manpowerLines: DailyLogManpowerLineRecord[]
  safetyConcerns: string
  ahaReviewed: string
  scheduleConcerns: string
  budgetConcerns: string
  deliveriesReceived: string
  deliveriesNeeded: string
  newWorkAuthorizations: string
  qcInspection: string
  qcAssignedTo: string
  qcAreasInspected: string
  qcIssuesIdentified: string
  qcIssuesResolved: string
  notesCorrespondence: string
  actionItems: string
  attachments: DailyLogAttachmentRecord[]
}

export interface DailyLogRecord {
  id: string
  jobId: string
  jobCode: string | null
  jobName: string | null
  logDate: string
  sequenceNumber: number
  status: DailyLogStatus | string
  foremanUserId: string | null
  foremanName: string | null
  additionalRecipients: string[]
  payload: DailyLogPayload
  createdAt?: unknown
  updatedAt?: unknown
  submittedAt?: unknown
}

export function normalizeRoleKey(value: unknown): RawRoleKey {
  if (typeof value !== 'string') return 'none'

  const normalized = value.trim().toLowerCase()
  if (normalized === 'admin' || normalized === 'controller' || normalized === 'foreman') {
    return normalized
  }

  return 'none'
}

export function toEffectiveRole(value: RawRoleKey): RoleKey {
  if (value === 'admin' || value === 'controller') return 'admin'
  if (value === 'foreman') return 'foreman'
  return 'none'
}

export function formatJobTypeLabel(value: string | null | undefined): string {
  switch (value) {
    case 'paint':
      return 'Paint'
    case 'acoustics':
      return 'Acoustics'
    case 'drywall':
      return 'Drywall'
    case 'small-jobs':
      return 'Small Jobs'
    case 'general':
      return 'General'
    case 'subcontractor':
      return 'Subcontractor'
    default:
      return value && value.trim().length ? value : 'General'
  }
}
