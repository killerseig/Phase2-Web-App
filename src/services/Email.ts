import { functions } from '@/firebase'
import { httpsCallable } from 'firebase/functions'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from './serviceUtils'
import { db } from '@/firebase'
import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { logWarn } from '@/utils'

const assertActiveUser = () => {
  const auth = useAuthStore()
  if (!auth.user) throw new Error('Not signed in')
  if (!auth.active) throw new Error('User is inactive')
  return auth
}

export async function sendDailyLogEmail(jobId: string, dailyLogId: string, recipients: string[]): Promise<void> {
  assertActiveUser()
  const callable = httpsCallable(functions, 'sendDailyLogEmail')
  try {
    await callable({ jobId, dailyLogId, recipients })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to send daily log email'))
  }
}

export async function sendTimecardEmail(jobId: string, timecardIds: string[], weekStart: string, recipients: string[]): Promise<void> {
  assertActiveUser()
  const callable = httpsCallable(functions, 'sendTimecardEmail')
  try {
    await callable({ jobId, timecardIds, weekStart, recipients })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to send timecard email'))
  }
}

export type DownloadTimecardsForWeekFormat = 'csv' | 'pdf'
export type ControllerTimecardStatusFilter = 'all' | 'submitted' | 'draft'
export type ControllerSubcontractedFilter = 'all' | 'subcontracted' | 'direct'

export type ControllerTimecardFilters = {
  startWeek: string
  endWeek?: string
  jobId?: string
  trade?: string
  firstName?: string
  lastName?: string
  subcontracted?: ControllerSubcontractedFilter
  status?: ControllerTimecardStatusFilter
}

export type DownloadTimecardsResult = {
  success: boolean
  format: DownloadTimecardsForWeekFormat
  fileName: string
  contentType: string
  contentBase64: string
  weekStart: string
  weekEnding: string
  startWeek: string
  endWeek: string
  startWeekEnding: string
  endWeekEnding: string
  timecardCount: number
}

export type ControllerTimecardWeekItem = {
  id: string
  timecardId: string
  jobId: string
  jobName: string
  jobCode: string
  createdByUid: string
  createdByName: string
  employeeNumber: string
  employeeName: string
  firstName: string
  lastName: string
  occupation: string
  status: 'draft' | 'submitted'
  weekStart: string
  weekEnding: string
  totalHours: number
  totalProduction: number
  totalLine: number
  subcontractedEmployee: boolean
  submittedAt: string | null
  submittedAtMs: number | null
}

export type ListTimecardsResult = {
  success: boolean
  startWeek: string
  endWeek: string
  startWeekEnding: string
  endWeekEnding: string
  filters: {
    jobId: string
    trade: string
    firstName: string
    lastName: string
    subcontracted: ControllerSubcontractedFilter
    status: ControllerTimecardStatusFilter
  }
  totalCount: number
  submittedCount: number
  draftCount: number
  totalHours: number
  totalProduction: number
  totalLine: number
  timecards: ControllerTimecardWeekItem[]
}

export async function downloadTimecardsForWeek(
  filters: ControllerTimecardFilters,
  format: DownloadTimecardsForWeekFormat,
): Promise<DownloadTimecardsResult> {
  assertActiveUser()
  const callable = httpsCallable(functions, 'downloadTimecardsForWeek')
  try {
    const result = await callable({ ...filters, format })
    return result.data as DownloadTimecardsResult
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to download timecards'))
  }
}

export async function listTimecardsForWeek(filters: ControllerTimecardFilters): Promise<ListTimecardsResult> {
  assertActiveUser()
  const callable = httpsCallable(functions, 'listTimecardsForWeek')
  try {
    const result = await callable(filters)
    return result.data as ListTimecardsResult
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load timecards'))
  }
}

export async function sendShopOrderEmail(jobId: string, shopOrderId: string, recipients: string[]): Promise<void> {
  assertActiveUser()
  const callable = httpsCallable(functions, 'sendShopOrderEmail')
  try {
    await callable({ jobId, shopOrderId, recipients })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to send shop order email'))
  }
}

// Global email settings (app-wide)
type EmailSettings = {
  timecardSubmitRecipients?: string[]
  shopOrderSubmitRecipients?: string[]
  dailyLogSubmitRecipients?: string[]
}

export type RemoveEmailFromRecipientsResult = {
  success: boolean
  message: string
  removedFromRecipientLists?: boolean
  updatedJobCount?: number
}

const EMAIL_SETTINGS_DOC = doc(db, 'settings', 'email')

const normalizeEmailSettings = (data: Record<string, unknown> | undefined): EmailSettings => ({
  timecardSubmitRecipients: Array.isArray(data?.timecardSubmitRecipients) ? data?.timecardSubmitRecipients as string[] : [],
  shopOrderSubmitRecipients: Array.isArray(data?.shopOrderSubmitRecipients) ? data?.shopOrderSubmitRecipients as string[] : [],
  dailyLogSubmitRecipients: Array.isArray(data?.dailyLogSubmitRecipients) ? data?.dailyLogSubmitRecipients as string[] : [],
})

export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const snap = await getDoc(EMAIL_SETTINGS_DOC)
    if (!snap.exists()) return { timecardSubmitRecipients: [], shopOrderSubmitRecipients: [], dailyLogSubmitRecipients: [] }
    return normalizeEmailSettings(snap.data())
  } catch (e) {
    logWarn('Email Service', 'Falling back to default email settings due to read error', e)
    return { timecardSubmitRecipients: [], shopOrderSubmitRecipients: [], dailyLogSubmitRecipients: [] }
  }
}

export function subscribeEmailSettings(
  onUpdate: (settings: EmailSettings) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    EMAIL_SETTINGS_DOC,
    (snap) => {
      if (!snap.exists()) {
        onUpdate({ timecardSubmitRecipients: [], shopOrderSubmitRecipients: [], dailyLogSubmitRecipients: [] })
        return
      }
      onUpdate(normalizeEmailSettings(snap.data()))
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function updateTimecardSubmitRecipientsGlobal(recipients: string[]): Promise<void> {
  await setDoc(EMAIL_SETTINGS_DOC, { timecardSubmitRecipients: recipients }, { merge: true })
}

export async function updateShopOrderSubmitRecipientsGlobal(recipients: string[]): Promise<void> {
  await setDoc(EMAIL_SETTINGS_DOC, { shopOrderSubmitRecipients: recipients }, { merge: true })
}

export async function updateDailyLogSubmitRecipientsGlobal(recipients: string[]): Promise<void> {
  await setDoc(EMAIL_SETTINGS_DOC, { dailyLogSubmitRecipients: recipients }, { merge: true })
}

export async function removeEmailFromAllRecipientLists(email: string): Promise<RemoveEmailFromRecipientsResult> {
  assertActiveUser()
  const callable = httpsCallable(functions, 'removeEmailFromAllRecipientLists')
  try {
    const result = await callable({ email })
    return result.data as RemoveEmailFromRecipientsResult
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to remove email from recipient lists'))
  }
}
