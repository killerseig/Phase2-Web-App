import { COLLECTIONS } from './constants'
import { db } from './runtime'

export async function removeEmailFromRecipientLists(
  email: string,
): Promise<{ settingsUpdated: boolean; jobsUpdated: number }> {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return { settingsUpdated: false, jobsUpdated: 0 }
  }

  const filterRecipientList = (values: unknown): string[] => {
    const list = Array.isArray(values) ? values : []
    return list.filter((value: unknown) => String(value || '').trim().toLowerCase() !== normalizedEmail)
  }

  let settingsUpdated = false
  let jobsUpdated = 0

  const settingsRef = db.collection('settings').doc('email')
  const settingsSnap = await settingsRef.get()
  if (settingsSnap.exists) {
    const data = settingsSnap.data() || {}
    const nextTimecard = filterRecipientList(data.timecardSubmitRecipients)
    const nextShopOrder = filterRecipientList(data.shopOrderSubmitRecipients)
    const nextDailyLog = filterRecipientList(data.dailyLogSubmitRecipients)
    const globalRecipients = typeof data.globalNotificationRecipients === 'object' && data.globalNotificationRecipients !== null
      ? data.globalNotificationRecipients
      : {}
    const nextGlobalDailyLogs = filterRecipientList(globalRecipients.dailyLogs)
    const nextGlobalTimecards = filterRecipientList(globalRecipients.timecards)
    const nextGlobalShopOrders = filterRecipientList(globalRecipients.shopOrders)

    const changed =
      nextTimecard.length !== (Array.isArray(data.timecardSubmitRecipients) ? data.timecardSubmitRecipients.length : 0) ||
      nextShopOrder.length !== (Array.isArray(data.shopOrderSubmitRecipients) ? data.shopOrderSubmitRecipients.length : 0) ||
      nextDailyLog.length !== (Array.isArray(data.dailyLogSubmitRecipients) ? data.dailyLogSubmitRecipients.length : 0) ||
      nextGlobalDailyLogs.length !== (Array.isArray(globalRecipients.dailyLogs) ? globalRecipients.dailyLogs.length : 0) ||
      nextGlobalTimecards.length !== (Array.isArray(globalRecipients.timecards) ? globalRecipients.timecards.length : 0) ||
      nextGlobalShopOrders.length !== (Array.isArray(globalRecipients.shopOrders) ? globalRecipients.shopOrders.length : 0)

    if (changed) {
      await settingsRef.set(
        {
          timecardSubmitRecipients: nextTimecard,
          shopOrderSubmitRecipients: nextShopOrder,
          dailyLogSubmitRecipients: nextDailyLog,
          globalNotificationRecipients: {
            dailyLogs: nextGlobalDailyLogs,
            timecards: nextGlobalTimecards,
            shopOrders: nextGlobalShopOrders,
          },
        },
        { merge: true },
      )
      settingsUpdated = true
    }
  }

  const jobsSnap = await db.collection(COLLECTIONS.JOBS).get()
  const batch = db.batch()
  jobsSnap.docs.forEach((jobDoc) => {
    const data = jobDoc.data() || {}
    const currentDailyLogRecipients = Array.isArray(data.dailyLogRecipients) ? data.dailyLogRecipients : []
    const currentAdminDailyLogRecipients = Array.isArray(data.adminDailyLogRecipients) ? data.adminDailyLogRecipients : []
    const notificationRecipients = typeof data.notificationRecipients === 'object' && data.notificationRecipients !== null
      ? data.notificationRecipients
      : {}

    const nextDailyLogRecipients = currentDailyLogRecipients.filter(
      (value: unknown) => String(value || '').trim().toLowerCase() !== normalizedEmail,
    )
    const nextAdminDailyLogRecipients = currentAdminDailyLogRecipients.filter(
      (value: unknown) => String(value || '').trim().toLowerCase() !== normalizedEmail,
    )
    const nextNotificationDailyLogs = filterRecipientList(notificationRecipients.dailyLogs)
    const nextNotificationTimecards = filterRecipientList(notificationRecipients.timecards)
    const nextNotificationShopOrders = filterRecipientList(notificationRecipients.shopOrders)

    const changed =
      nextDailyLogRecipients.length !== currentDailyLogRecipients.length ||
      nextAdminDailyLogRecipients.length !== currentAdminDailyLogRecipients.length ||
      nextNotificationDailyLogs.length !== (Array.isArray(notificationRecipients.dailyLogs) ? notificationRecipients.dailyLogs.length : 0) ||
      nextNotificationTimecards.length !== (Array.isArray(notificationRecipients.timecards) ? notificationRecipients.timecards.length : 0) ||
      nextNotificationShopOrders.length !== (Array.isArray(notificationRecipients.shopOrders) ? notificationRecipients.shopOrders.length : 0)

    if (changed) {
      batch.update(jobDoc.ref, {
        dailyLogRecipients: nextDailyLogRecipients,
        adminDailyLogRecipients: nextAdminDailyLogRecipients,
        notificationRecipients: {
          dailyLogs: nextNotificationDailyLogs,
          timecards: nextNotificationTimecards,
          shopOrders: nextNotificationShopOrders,
        },
      })
      jobsUpdated += 1
    }
  })

  if (jobsUpdated > 0) {
    await batch.commit()
  }

  return { settingsUpdated, jobsUpdated }
}
