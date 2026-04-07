import type { ControllerTimecardWeekItem } from '@/services/Email'
import type { TimecardModel } from '@/utils/timecardUtils'

export type ControllerSortKey =
  | 'weekEnding'
  | 'jobName'
  | 'jobCode'
  | 'employeeNumber'
  | 'employeeName'
  | 'occupation'
  | 'status'
  | 'totalHours'
  | 'totalProduction'
  | 'totalLine'
  | 'submittedAt'

export type ControllerSortOption = {
  key: ControllerSortKey
  label: string
}

export type ControllerGroupedTimecard = {
  key: string
  row: ControllerTimecardWeekItem
  timecard: TimecardModel
}

export type ControllerCreatorGroup = {
  creatorKey: string
  creatorName: string
  totalCount: number
  draftCount: number
  submittedCount: number
  totalHours: number
  totalProduction: number
  totalLine: number
  timecards: ControllerGroupedTimecard[]
}

export type ControllerJobGroup = {
  jobId: string
  jobName: string
  jobCode: string
  totalCount: number
  draftCount: number
  submittedCount: number
  totalHours: number
  totalProduction: number
  totalLine: number
  creatorGroups: ControllerCreatorGroup[]
}
