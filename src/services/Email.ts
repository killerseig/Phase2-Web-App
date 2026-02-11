import { functions } from '../firebase'
import { httpsCallable } from 'firebase/functions'

export async function sendDailyLogEmail(dailyLogId: string, recipients: string[]): Promise<void> {
  const callable = httpsCallable(functions, 'sendDailyLogEmail')
  await callable({ dailyLogId, recipients })
}

export async function sendTimecardEmail(jobId: string, timecardId: string, weekStart: string, recipients: string[]): Promise<void> {
  const callable = httpsCallable(functions, 'sendTimecardEmail')
  await callable({ jobId, timecardId, weekStart, recipients })
}

export async function sendShopOrderEmail(shopOrderId: string, recipients: string[]): Promise<void> {
  const callable = httpsCallable(functions, 'sendShopOrderEmail')
  await callable({ shopOrderId, recipients })
}
