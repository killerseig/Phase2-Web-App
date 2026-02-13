import { functions } from '../firebase'
import { httpsCallable } from 'firebase/functions'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from './serviceUtils'
import { db } from '@/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

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

const EMAIL_SETTINGS_DOC = doc(db, 'settings', 'email')

export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const snap = await getDoc(EMAIL_SETTINGS_DOC)
    if (!snap.exists()) return { timecardSubmitRecipients: [], shopOrderSubmitRecipients: [], dailyLogSubmitRecipients: [] }
    const data = snap.data() || {}
    return {
      timecardSubmitRecipients: Array.isArray(data.timecardSubmitRecipients) ? data.timecardSubmitRecipients : [],
      shopOrderSubmitRecipients: Array.isArray(data.shopOrderSubmitRecipients) ? data.shopOrderSubmitRecipients : [],
      dailyLogSubmitRecipients: Array.isArray(data.dailyLogSubmitRecipients) ? data.dailyLogSubmitRecipients : [],
    }
  } catch (e) {
    console.warn('[getEmailSettings] Falling back to defaults due to error:', e)
    return { timecardSubmitRecipients: [], shopOrderSubmitRecipients: [], dailyLogSubmitRecipients: [] }
  }
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
