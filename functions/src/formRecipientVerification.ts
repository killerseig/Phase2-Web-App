import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from './runtime'
import { getGraphEmailSecrets } from './functionConfig'
import { isEmailEnabled, sendEmail } from './emailService'
import { formId, type FormRecord } from './formModel'
import { validateFormAccess } from './formAccess'
import { normalizeFormRecipientEmails, respondentRecipients } from './formRecipients'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export interface RecipientChallengeMailer {
  enabled: () => boolean
  send: (email: string, code: string) => Promise<void>
}
const provider: RecipientChallengeMailer = {
  enabled: () =>
    process.env.FORM_PUBLIC_RECIPIENT_VERIFICATION_ENABLED === 'true' &&
    !process.env.FIRESTORE_EMULATOR_HOST &&
    !process.env.FUNCTIONS_EMULATOR &&
    isEmailEnabled(),
  send: async (email, code) =>
    sendEmail({
      to: email,
      subject: 'Approve one form results email',
      html: `<p>Someone requested that this address receive the results of one Phase 2 form response.</p><p>If you agree, give this code to the person completing the form: <strong>${code}</strong></p><p>The code expires in 15 minutes and approves only that response. Do not share it if you did not request or approve this email. This does not grant access to private records or photos.</p>`,
    }),
}
export async function verifyPublicFormRecipient(
  input: Record<string, unknown>,
  origin: string,
  mailer: RecipientChallengeMailer = provider,
) {
  if (
    !formId(input.id) ||
    typeof input.publicCapability !== 'string' ||
    !/^[a-f0-9]{64}$/.test(input.publicCapability)
  )
    throw new HttpsError('permission-denied', 'Invalid form session.')
  const email = normalizeFormRecipientEmails([input.email], 1)[0]
  const recordRef = db.doc(`formRecords/${input.id}`)
  const proofRef = db.doc(`formRecipientVerifications/${hash(`${input.id}:${email}`)}`)
  const now = Date.now(),
    capabilityHash = hash(input.publicCapability)
  const checkRecord = async (
    record: FormRecord & { publicCapabilityHash?: string; publicExpiresAt?: number },
    tx?: FirebaseFirestore.Transaction,
  ) => {
    if (
      !record ||
      record.status !== 'draft' ||
      record.publicCapabilityHash !== capabilityHash ||
      !record.publicExpiresAt ||
      record.publicExpiresAt <= now
    )
      throw new HttpsError('permission-denied', 'This form session expired or was submitted.')
    if (!respondentRecipients(record.definition.fields, record.answers).includes(email))
      throw new HttpsError('failed-precondition', 'Save this address in the recipient field first.')
    const templateRef = db.doc(`formTemplates/${record.templateId}`)
    const template = tx ? await tx.get(templateRef) : await templateRef.get()
    if (!template.exists || template.data()?.archived || !template.data()?.latestVersion)
      throw new HttpsError('permission-denied', 'This form is unavailable.')
    const versionRef = templateRef.collection('versions').doc('v' + template.data()!.latestVersion)
    const latest = tx ? await tx.get(versionRef) : await versionRef.get()
    if (!latest.exists || validateFormAccess(latest.data()?.access).respondents !== 'public')
      throw new HttpsError('permission-denied', 'This form now requires sign in.')
  }
  if (input.action === 'request') {
    if (!mailer.enabled())
      return {
        status: 'not-configured',
        message:
          'Recipient verification email is not enabled. Your answers can still be submitted.',
      }
    if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId))
      throw new HttpsError('invalid-argument', 'Invalid verification request.')
    const code = String(randomInt(0, 100000000)).padStart(8, '0')
    const codeHash = hash(`${input.id}:${email}:${code}`)
    const requestRef = db.doc(
      `formRecipientVerificationRequests/${hash(`${input.id}:${input.requestId}`)}`,
    )
    const requested = await db.runTransaction(async (tx) => {
      const [recordSnap, proof, prior] = await Promise.all([
        tx.get(recordRef),
        tx.get(proofRef),
        tx.get(requestRef),
      ])
      const record = recordSnap.data() as FormRecord & {
        publicCapabilityHash?: string
        publicExpiresAt?: number
      }
      await checkRecord(record, tx)
      if (prior.exists) {
        if (prior.data()?.email !== email)
          throw new HttpsError('invalid-argument', 'Request ID belongs to a different address.')
        return false
      }
      if (proof.data()?.verified === true && proof.data()?.approvalExpiresAt > now) return false
      if (proof.data()?.codeExpiresAt > now && ['sending', 'sent'].includes(proof.data()?.status))
        return false
      const rateRefs = [
        db.doc(
          `formRecipientVerificationRates/origin-${hash(origin)}-${Math.floor(now / 3600000)}`,
        ),
        db.doc(`formRecipientVerificationRates/draft-${input.id}`),
        db.doc(
          `formRecipientVerificationRates/address-${hash(email!)}-${Math.floor(now / 86400000)}`,
        ),
      ]
      const rates = await tx.getAll(...rateRefs),
        limits = [10, 10, 3]
      if (rates.some((snap, i) => Number(snap.data()?.count ?? 0) >= limits[i]!))
        throw new HttpsError(
          'resource-exhausted',
          'Verification limit reached. Submit now or try later.',
        )
      rates.forEach((snap, i) =>
        tx.set(rateRefs[i]!, {
          count: Number(snap.data()?.count ?? 0) + 1,
          expiresAt: now + 86400000,
        }),
      )
      tx.set(proofRef, {
        recordId: input.id,
        email,
        capabilityHash,
        templateId: record.templateId,
        templateVersion: record.templateVersion,
        codeHash,
        codeExpiresAt: now + 15 * 60000,
        attempts: 0,
        verified: false,
        status: 'sending',
        requestId: input.requestId,
      })
      tx.create(requestRef, { email, createdAt: now })
      return true
    })
    if (requested) {
      try {
        await mailer.send(email!, code)
        await proofRef.update({ status: 'sent' })
      } catch {
        await proofRef.update({ status: 'failed' })
        throw new HttpsError('unavailable', 'Verification email failed. Your answers are retained.')
      }
    }
    const saved = await proofRef.get()
    return { status: saved.data()?.verified ? 'verified' : (saved.data()?.status ?? 'pending') }
  }
  if (input.action === 'verify') {
    if (typeof input.code !== 'string' || !/^\d{8}$/.test(input.code))
      throw new HttpsError('invalid-argument', 'Enter the eight-digit code.')
    const matched = await db.runTransaction(async (tx) => {
      const [recordSnap, proof] = await Promise.all([tx.get(recordRef), tx.get(proofRef)])
      const record = recordSnap.data() as FormRecord & {
        publicCapabilityHash?: string
        publicExpiresAt?: number
      }
      await checkRecord(record, tx)
      const data = proof.data()
      if (
        !data ||
        data.capabilityHash !== capabilityHash ||
        data.templateId !== record.templateId ||
        data.templateVersion !== record.templateVersion ||
        data.status !== 'sent' ||
        data.codeExpiresAt <= now ||
        data.attempts >= 5
      )
        throw new HttpsError('permission-denied', 'Verification expired or unavailable.')
      if (data.verified && data.approvalExpiresAt > now) return true
      const actual = Buffer.from(hash(`${input.id}:${email}:${input.code}`), 'hex'),
        expected = Buffer.from(data.codeHash, 'hex')
      const valid = expected.length === actual.length && timingSafeEqual(actual, expected)
      tx.update(proofRef, {
        attempts: Number(data.attempts) + 1,
        ...(valid
          ? { verified: true, verifiedAt: now, approvalExpiresAt: record.publicExpiresAt }
          : {}),
      })
      return valid
    })
    if (!matched) throw new HttpsError('permission-denied', 'Incorrect verification code.')
    return { status: 'verified' }
  }
  throw new HttpsError('invalid-argument', 'Unknown verification action.')
}
export const publicFormRecipientVerification = onCall(
  { secrets: getGraphEmailSecrets(), timeoutSeconds: 60 },
  (request) => verifyPublicFormRecipient(request.data ?? {}, request.rawRequest?.ip ?? 'unknown'),
)
