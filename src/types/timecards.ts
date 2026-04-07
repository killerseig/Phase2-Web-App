import type { TimecardModel } from '@/utils/timecardUtils'

export type DiffField = 'difH' | 'difP' | 'difC'
export type WorkbookOffField = 'offHours' | 'offProduction' | 'offCost'
export type WorkbookFooterField = 'footerJobOrGl' | 'footerAccount' | 'footerOffice' | 'footerAmount'

export type TimecardWorkspaceEmployeeItem = {
  employeeId: string
  timecardId: string | null
  employeeName: string
  employeeNumber: string
  occupation: string
  subcontractedEmployee: boolean
  status: TimecardModel['status'] | 'missing'
  hoursTotal: number
  productionTotal: number
}

export type TimecardAccountSummaryItem = {
  key: string
  jobNumber: string
  subsectionArea: string
  account: string
  hoursTotal: number
  productionTotal: number
}
