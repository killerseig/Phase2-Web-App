import { functions } from '../firebase'
import { httpsCallable } from 'firebase/functions'

export async function sendDailyLogEmail(jobId: string, dailyLogId: string, recipients: string[]): Promise<void> {
  const callable = httpsCallable(functions, 'sendDailyLogEmail')
  await callable({ jobId, dailyLogId, recipients })
}

export async function sendTimecardEmail(jobId: string, timecardIds: string[], weekStart: string, recipients: string[]): Promise<void> {
  const callable = httpsCallable(functions, 'sendTimecardEmail')
  await callable({ jobId, timecardIds, weekStart, recipients })
}

export async function sendShopOrderEmail(jobId: string, shopOrderId: string, recipients: string[]): Promise<void> {
  const callable = httpsCallable(functions, 'sendShopOrderEmail')
  await callable({ jobId, shopOrderId, recipients })
}
