import { functions } from '../firebase'
import { httpsCallable } from 'firebase/functions'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from './serviceUtils'

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
