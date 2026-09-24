import { createHash, randomUUID } from 'node:crypto'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { FieldPath } from 'firebase-admin/firestore'
import { db } from './runtime'
import { buildCurrentFunctionUser } from './roleAccess'
import { getGraphEmailSecrets } from './functionConfig'
import { isEmailEnabled, sendEmail } from './emailService'
import {
  validateFormValues,
  type WebsiteFormDefinition,
  type WebsiteFormDelivery,
} from './websiteForms'

const submissions = db.collection('websiteSubmissions')
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const validId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)
const LEASE_MS = 10 * 60 * 1000

export const submitWebsiteForm = onCall(
  { timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    const data = request.data || {}
    if (
      Buffer.byteLength(JSON.stringify(data)) > 70000 ||
      !validId(data.formId) ||
      typeof data.submissionId !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(data.submissionId)
    )
      throw new HttpsError('invalid-argument', 'Invalid form submission.')
    if (typeof data.website !== 'string')
      throw new HttpsError('invalid-argument', 'Refresh the form and try again.')
    if (data.website) return { received: true }
    const ip = request.rawRequest?.ip
    if (!ip) throw new HttpsError('unavailable', 'Please try again.')
    const now = Date.now(),
      bucket = Math.floor(now / 3600000)
    const ref = submissions.doc(hash(data.formId + ':' + data.submissionId))
    const ipRef = db.doc(`websiteFormLimits/ip-${hash(ip)}`),
      siteRef = db.doc('websiteFormLimits/site')
    await db.runTransaction(async (transaction) => {
      const [published, routing, existing, ipRate, siteRate] = await transaction.getAll(
        db.doc('websitePublished/current'),
        db.doc('websitePrivate/publicForms'),
        ref,
        ipRef,
        siteRef,
      )
      const form = (published.data()?.site?.forms as WebsiteFormDefinition[] | undefined)?.find(
        (entry) => entry.id === data.formId,
      )
      const delivery = (routing.data()?.forms as WebsiteFormDefinition[] | undefined)?.find(
        (entry) => entry.id === data.formId,
      )?.delivery
      if (
        !form ||
        !delivery?.to.length ||
        routing.data()?.publishedAt !== published.data()?.publishedAt
      )
        throw new HttpsError(
          'failed-precondition',
          'This form is no longer available. Refresh the page.',
        )
      let values
      try {
        values = validateFormValues(form, data.values)
      } catch (reason) {
        throw new HttpsError(
          'invalid-argument',
          reason instanceof Error ? reason.message : 'Check the form fields.',
        )
      }
      const fingerprint = hash(JSON.stringify(values))
      if (existing.exists) {
        if (existing.data()?.fingerprint !== fingerprint)
          throw new HttpsError(
            'already-exists',
            'This submission was already received. Refresh before sending a new message.',
          )
        return
      }
      const ipCount = ipRate.data()?.bucket === bucket ? Number(ipRate.data()?.count || 0) : 0
      const siteCount = siteRate.data()?.bucket === bucket ? Number(siteRate.data()?.count || 0) : 0
      if (ipCount >= 10 || siteCount >= 200)
        throw new HttpsError('resource-exhausted', 'Too many submissions. Please try again later.')
      const answers = form.fields.map((field) => ({
        label: field.label,
        value: values[field.id],
        fieldId: field.id,
      }))
      transaction.create(ref, {
        formId: form.id,
        formName: form.name,
        createdAt: now,
        answers,
        delivery,
        replyTo:
          form.replyToField && typeof values[form.replyToField] === 'string'
            ? values[form.replyToField]
            : '',
        fingerprint,
        emailStatus: 'pending',
        attempts: 0,
      })
      transaction.set(ipRef, { bucket, count: ipCount + 1, updatedAt: now })
      transaction.set(siteRef, { bucket, count: siteCount + 1, updatedAt: now })
    })
    return { received: true }
  },
)

function escapeHtml(value: unknown) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  )
}
export function submissionEmailHtml(record: {
  formName: string
  answers: { label: string; value: unknown }[]
}) {
  return `<h1>${escapeHtml(record.formName)}</h1><p>New public website submission</p>${record.answers.map((answer) => `<h3>${escapeHtml(answer.label)}</h3><p style="white-space:pre-wrap">${escapeHtml(typeof answer.value === 'boolean' ? (answer.value ? 'Yes' : 'No') : answer.value)}</p>`).join('')}`
}
// Claim once before contacting Graph. Delivery failures retain the complete inquiry for admin review.
export async function deliverWebsiteSubmission(id: string, retry = false) {
  const ref = submissions.doc(id),
    attemptId = randomUUID(),
    now = Date.now()
  const record = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Submission not found.')
    const data = snapshot.data()!
    if (data.emailStatus === 'sent') return undefined
    if (data.emailStatus === 'sending' && now - data.attemptStartedAt < LEASE_MS) return undefined
    if (!retry && data.emailStatus !== 'pending') return undefined
    transaction.update(ref, {
      emailStatus: 'sending',
      attemptId,
      attemptStartedAt: now,
      attempts: Number(data.attempts || 0) + 1,
    })
    return data
  })
  if (!record) return
  let status: 'sent' | 'failed' | 'disabled' = 'failed'
  try {
    if (!isEmailEnabled()) status = 'disabled'
    else {
      const delivery = record.delivery as WebsiteFormDelivery
      await sendEmail({
        to: delivery.to,
        cc: delivery.cc,
        subject: delivery.subject,
        html: submissionEmailHtml(
          record as { formName: string; answers: { label: string; value: unknown }[] },
        ),
        ...(record.replyTo ? { replyTo: record.replyTo } : {}),
      })
      status = 'sent'
    }
  } catch {
    // Do not put visitor data, email addresses, or provider error payloads in logs.
    status = 'failed'
  }
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref)
    if (current.data()?.attemptId === attemptId)
      transaction.update(ref, { emailStatus: status, attemptFinishedAt: Date.now() })
  })
}
export const deliverWebsiteFormEmail = onDocumentCreated(
  {
    document: 'websiteSubmissions/{submissionId}',
    secrets: getGraphEmailSecrets(),
    timeoutSeconds: 120,
    retry: false,
  },
  async (event) => {
    await deliverWebsiteSubmission(event.params.submissionId)
  },
)
export const websiteFormAdmin = onCall(
  { secrets: getGraphEmailSecrets(), timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to view submissions.')
    const snapshot = await db.doc(`users/${request.auth.uid}`).get()
    const user = buildCurrentFunctionUser(request.auth.uid, snapshot.data() || {})
    if (!snapshot.exists || !user.active || user.role !== 'admin')
      throw new HttpsError('permission-denied', 'Only active admins can view submissions.')
    const data = request.data || {}
    if (data.action === 'retry') {
      if (!validId(data.id)) throw new HttpsError('invalid-argument', 'Choose a submission.')
      await deliverWebsiteSubmission(data.id, true)
      return { emailStatus: (await submissions.doc(data.id).get()).data()?.emailStatus }
    }
    if (data.action !== 'list')
      throw new HttpsError('invalid-argument', 'Unknown submissions action.')
    let query = submissions
      .orderBy('createdAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc')
      .limit(26)
    if (data.cursor !== undefined) {
      if (!validId(data.cursor))
        throw new HttpsError('invalid-argument', 'Invalid submissions cursor.')
      const cursor = await submissions.doc(data.cursor).get()
      if (!cursor.exists) throw new HttpsError('invalid-argument', 'Refresh the submissions list.')
      query = query.startAfter(cursor)
    }
    const records = (await query.get()).docs
    return {
      submissions: records.slice(0, 25).map((record) => {
        const data = record.data()
        return {
          id: record.id,
          formName: data.formName,
          createdAt: data.createdAt,
          answers: data.answers,
          emailStatus: data.emailStatus,
          attempts: data.attempts,
          attemptStartedAt: data.attemptStartedAt || null,
        }
      }),
      nextCursor: records.length > 25 ? records[24]!.id : null,
    }
  },
)
