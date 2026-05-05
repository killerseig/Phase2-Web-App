import { onSchedule } from 'firebase-functions/v2/scheduler'
import { EMAIL, COLLECTIONS } from './constants'
import { sendEmail, buildSecretExpirationEmail } from './emailService'
import { getGraphSecretExpirationDate, getGraphEmailSecrets } from './functionConfig'
import { db } from './runtime'

export const notifySecretExpiration = onSchedule(
  { schedule: 'every day 09:00', secrets: getGraphEmailSecrets() },
  async () => {
    try {
      const today = new Date()
      const currentDateStr = today.toISOString().split('T')[0]
      const secretExpirationDate = getGraphSecretExpirationDate()

      const expirationDate = new Date(secretExpirationDate)
      const notificationTriggerDate = new Date(expirationDate)
      notificationTriggerDate.setDate(notificationTriggerDate.getDate() - EMAIL.SECRET_NOTIFICATION_DAYS)
      const notificationTriggerDateStr = notificationTriggerDate.toISOString().split('T')[0]

      console.log('[notifySecretExpiration] Today:', currentDateStr)
      console.log('[notifySecretExpiration] Notification trigger date:', notificationTriggerDateStr)
      console.log('[notifySecretExpiration] Secret expiration date:', secretExpirationDate)

      if (currentDateStr < notificationTriggerDateStr) {
        console.log('[notifySecretExpiration] Not yet time to notify. Exiting.')
        return
      }

      if (currentDateStr > secretExpirationDate) {
        console.error('[notifySecretExpiration] Secret has already expired!')
      }

      const adminSnapshot = await db
        .collection(COLLECTIONS.USERS)
        .where('role', '==', 'admin')
        .where('active', '==', true)
        .get()

      if (adminSnapshot.empty) {
        console.log('[notifySecretExpiration] No active admin users found')
        return
      }

      const adminEmails = adminSnapshot.docs
        .map((doc) => doc.data().email)
        .filter((email: any) => email && email.trim().length > 0)

      if (adminEmails.length === 0) {
        console.log('[notifySecretExpiration] No admin emails found')
        return
      }

      await sendEmail({
        to: adminEmails,
        subject: EMAIL.SUBJECTS.SECRET_EXPIRATION,
        html: buildSecretExpirationEmail(),
      })

      console.log(`[notifySecretExpiration] Notification sent to ${adminEmails.length} admin(s)`)
    } catch (error: any) {
      console.error('[notifySecretExpiration] Error:', error?.message || error)
    }
  },
)
