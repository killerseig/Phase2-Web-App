import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import type { PersonalTimecardInput } from '../../functions/src/personalTimecardModel'
export type { PersonalTimecardInput }
export interface PersonalTimecardResult {
  state: 'ready' | 'week-not-open' | 'context' | 'link-status'
  status?: string
  employeeNumber?: string
  employeeName: string
  card: (PersonalTimecardInput & { display?: {
    lines: Array<{ difH: string; difP: string; offHours: number; offProduction: number; production: number[] }>
    regularHoursOverride: number | null; overtimeHoursOverride: number | null
  } }) | null
  version: string | null
  readOnly: boolean
  jobs?: Array<{ id: string; code: string; name: string }>
  defaultJobId?: string
  currentWeekEndDate?: string
  identity?: { firstName: string; lastName: string; employeeNumber: string; occupation: string }
  replayed?: boolean
}
export async function personalTimecardRequest(data: {
  personalAction: 'context' | 'load' | 'save' | 'link-status' | 'auto-link'
  accountUid?: string
  expectedFirstName?: string
  expectedLastName?: string
  jobId?: string
  weekEndDate?: string
  card?: PersonalTimecardInput
  requestId?: string
  expectedVersion?: string | null
}) {
  const { functions } = requireFirebaseServices()
  return (
    await httpsCallable<typeof data, PersonalTimecardResult>(
      functions,
      'ensureTimecardWeekRecord',
    )(data)
  ).data
}
