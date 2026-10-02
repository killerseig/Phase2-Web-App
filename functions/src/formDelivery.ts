import { randomUUID } from 'node:crypto'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { db } from './runtime'
import { formId, type FormRecord } from './formModel'
import { buildCurrentFunctionUser } from './roleAccess'
import { getGraphEmailSecrets } from './functionConfig'
import { classifyEmailDeliveryError } from './emailDeliveryErrors'
import { isEmailEnabled, sendEmail } from './emailService'
export interface FormEmailAdapter {
  enabled: () => boolean
  send: (record: FormRecord, recipients: string[]) => Promise<void>
}
export { buildFormEmailHtml, buildFormEmailText, prepareFormEmail } from './formEmailContent'
import { prepareFormEmail, FormEmailPreparationError } from './formEmailContent'
const provider: FormEmailAdapter = {
  enabled: () =>
    !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FUNCTIONS_EMULATOR && isEmailEnabled(),
  send: async (record, recipients) => {
    let email
    try {
      email = await prepareFormEmail(record, recipients)
    } catch (error) {
      if (error instanceof FormEmailPreparationError) throw error
      // Preparation has not contacted the provider, so an explicit retry is safe.
      throw new FormEmailPreparationError(
        'The completed form email could not be prepared. The submission is retained.',
      )
    }
    await sendEmail(email)
  },
}
// The submission is immutable. Delivery state and claims live in a separate record.
export async function deliverFormSubmission(
  id: string,
  retry = false,
  adapter: FormEmailAdapter = provider,
) {
  const ref = db.doc('formDeliveries/' + id),
    attemptId = randomUUID()
  const claim = await db.runTransaction(async (tx) => {
    const [delivery, submission] = await tx.getAll(ref, db.doc('formSubmissions/' + id))
    if (!delivery.exists || !submission.exists)
      throw new HttpsError('not-found', 'Submission not found.')
    const state = delivery.data()!
    if (
      state.status === 'sent' ||
      state.status === 'sending' ||
      state.status === 'not-configured' ||
      (!retry && state.status !== 'queued')
    )
      return undefined
    if (!['queued', 'failed', 'disabled'].includes(state.status)) return undefined
    tx.update(ref, {
      status: 'sending',
      attemptId,
      attempts: Number(state.attempts) + 1,
      attemptStartedAt: Date.now(),
    })
    return { record: submission.data() as FormRecord, recipients: state.recipients as string[] }
  })
  if (!claim) return
  let status = 'failed'
  try {
    if (!adapter.enabled()) status = 'disabled'
    else {
      await adapter.send(claim.record, claim.recipients)
      status = 'sent'
    }
  } catch (error) {
    const failure = classifyEmailDeliveryError(error)
    status =
      error instanceof FormEmailPreparationError ||
      !failure.retryable ||
      (failure.httpStatus !== undefined && failure.httpStatus < 500)
        ? 'failed'
        : 'uncertain'
  }
  await db.runTransaction(async (tx) => {
    const state = await tx.get(ref)
    if (state.data()?.attemptId === attemptId)
      tx.update(ref, { status, attemptFinishedAt: Date.now() })
  })
}
export const formEmail = onCall(
  { secrets: getGraphEmailSecrets(), timeoutSeconds: 120 },
  async (request) => {
    const id = request.data?.id
    if (!formId(id) || !request.auth?.uid)
      throw new HttpsError('unauthenticated', 'Sign in and choose a submission.')
    const [profile, snapshot] = await Promise.all([
      db.doc('users/' + request.auth.uid).get(),
      db.doc('formSubmissions/' + id).get(),
    ])
    const user = buildCurrentFunctionUser(request.auth.uid, profile.data() || {})
    if (
      !profile.exists ||
      !user.active ||
      !['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(user.role) ||
      !snapshot.exists ||
      (snapshot.data()?.ownerUid !== user.uid && user.role !== 'admin')
    )
      throw new HttpsError('permission-denied', 'This submission belongs to another user.')
    if (request.data?.action !== 'retry')
      throw new HttpsError('invalid-argument', 'Unknown delivery action.')
    await deliverFormSubmission(id, true)
    return { emailStatus: (await db.doc('formDeliveries/' + id).get()).data()?.status }
  },
)
export const deliverFormEmail = onDocumentCreated(
  {
    document: 'formDeliveries/{id}',
    secrets: getGraphEmailSecrets(),
    timeoutSeconds: 120,
    retry: false,
  },
  async (event) => {
    await deliverFormSubmission(event.params.id)
  },
)
