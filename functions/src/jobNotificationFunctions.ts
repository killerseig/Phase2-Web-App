import { createHash } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore'

import { isEmailEnabled, sendEmail } from './emailService'
import {
  classifyEmailDeliveryError,
  type EmailDeliveryFailureClassification,
} from './emailDeliveryErrors'
import { getEmailSettings, getUserProfile } from './firestoreService'
import { getGraphEmailSecrets } from './functionConfig'
import {
  handleFieldUserAssignmentNotification,
  handleNewJobNotification,
  claimJobNotificationEventInTransaction,
  type JobEventNotificationKey,
  type JobNotificationHandlerDependencies,
} from './jobNotificationEmail'
import { db } from './runtime'

const NOTIFICATION_EVENT_COLLECTION = 'emailNotificationEvents'

function notificationEventRef(eventKey: string) {
  const eventHash = createHash('sha256').update(eventKey).digest('hex')
  return db.collection(NOTIFICATION_EVENT_COLLECTION).doc(eventHash)
}

async function getGlobalRecipients(notificationKey: JobEventNotificationKey) {
  const settings = await getEmailSettings()
  return settings.globalNotificationRecipients[notificationKey]
}

async function getFieldUserNames(userIds: string[]) {
  return Promise.all(
    userIds.map(async (userId, index) => {
      const user = await getUserProfile(userId)
      if (!user) return `Field User ${index + 1}`

      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim()
      return fullName || user.displayName || user.email || `Field User ${index + 1}`
    }),
  )
}

async function claimEvent(
  eventKey: string,
  metadata: { notificationKey: JobEventNotificationKey; jobId: string },
) {
  const eventRef = notificationEventRef(eventKey)
  return db.runTransaction((transaction) =>
    claimJobNotificationEventInTransaction(transaction, eventRef, eventKey, metadata),
  )
}

async function completeEvent(eventKey: string) {
  await notificationEventRef(eventKey).update({
    status: 'sent',
    sentAt: FieldValue.serverTimestamp(),
    leaseExpiresAt: FieldValue.delete(),
  })
}

async function failEvent(eventKey: string, failure: EmailDeliveryFailureClassification) {
  await notificationEventRef(eventKey).update({
    status: 'failed-permanent',
    failedAt: FieldValue.serverTimestamp(),
    failureHttpStatus: failure.httpStatus ?? null,
    leaseExpiresAt: FieldValue.delete(),
  })
}

async function releaseEvent(eventKey: string) {
  await notificationEventRef(eventKey).delete()
}

const dependencies: JobNotificationHandlerDependencies = {
  isEmailEnabled,
  getGlobalRecipients,
  getFieldUserNames,
  claimEvent,
  completeEvent,
  failEvent,
  releaseEvent,
  classifySendError: classifyEmailDeliveryError,
  sendEmail,
}

export const sendNewJobNotification = onDocumentCreated(
  {
    document: 'jobs/{jobId}',
    retry: true,
    secrets: getGraphEmailSecrets(),
  },
  async (event) => {
    const outcome = await handleNewJobNotification(
      {
        eventId: event.id,
        jobId: event.params.jobId,
        jobData: event.data?.data(),
      },
      dependencies,
    )

    console.log('[sendNewJobNotification] Job notification handled', {
      eventId: event.id,
      jobId: event.params.jobId,
      outcome,
    })
  },
)

export const sendFieldUserAssignmentNotification = onDocumentUpdated(
  {
    document: 'jobs/{jobId}',
    retry: true,
    secrets: getGraphEmailSecrets(),
  },
  async (event) => {
    const outcome = await handleFieldUserAssignmentNotification(
      {
        eventId: event.id,
        jobId: event.params.jobId,
        beforeData: event.data?.before.data(),
        afterData: event.data?.after.data(),
      },
      dependencies,
    )

    console.log('[sendFieldUserAssignmentNotification] Assignment notification handled', {
      eventId: event.id,
      jobId: event.params.jobId,
      outcome,
    })
  },
)
