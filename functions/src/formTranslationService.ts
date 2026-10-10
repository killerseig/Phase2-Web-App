import axios from 'axios'
import { defineBoolean, defineSecret } from 'firebase-functions/params'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { db } from './runtime'
import { authorizeFormEntry } from './formEntryAccess'
import { buildCurrentFunctionUser } from './roleAccess'
import {
  translateFormRecord,
  translationSource,
  currentFormTranslation,
  type FormTranslation,
  type TranslationAdapter,
} from './formTranslation'
import type { FormRecord } from './formModel'

export const formTranslationEnabled = defineBoolean('FORM_TRANSLATION_ENABLED', { default: false })
export const formTranslationProcessingApproved = defineBoolean(
  'FORM_TRANSLATION_PROCESSING_APPROVED',
  { default: false },
)
export const formTranslationApiKey = defineSecret('FORM_TRANSLATION_API_KEY')
/** Cloud Translation Basic, explicit provisioning; no Firebase built-in translation. */
export function configuredFormTranslationAdapter(): TranslationAdapter | undefined {
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR) return undefined
  if (!formTranslationEnabled.value() || !formTranslationProcessingApproved.value())
    return undefined
  const key = formTranslationApiKey.value()
  if (!key) return undefined
  return {
    translate: async (texts) => {
      const response = await axios.post(
        'https://translation.googleapis.com/language/translate/v2',
        { q: texts, target: 'en', format: 'text' },
        {
          params: { key },
          timeout: 20000,
          maxContentLength: 512 * 1024,
          maxBodyLength: 128 * 1024,
        },
      )
      const translations = response.data?.data?.translations
      if (!Array.isArray(translations)) throw new Error('Translation unavailable.')
      return translations.map((item) => item.translatedText)
    },
  }
}
export async function prepareFormTranslation(
  record: FormRecord,
  injectedAdapter?: TranslationAdapter,
  reauthorize?: () => Promise<unknown>,
): Promise<FormTranslation> {
  const { sourceHash } = translationSource(record)
  const ref = db.doc('formTranslations/' + record.id + '/versions/' + sourceHash)
  const cached = currentFormTranslation(record, (await ref.get()).data())
  if (cached?.status === 'ready' && cached.sourceHash === sourceHash) return cached
  const adapter = injectedAdapter || configuredFormTranslationAdapter()
  if (!adapter) return translateFormRecord(record)
  const acquired = await db.runTransaction(async (transaction) => {
    const latest = (await transaction.get(ref)).data()
    if (latest?.status === 'ready' || (latest?.leaseUntil || 0) > Date.now()) return false
    transaction.set(ref, { sourceHash, leaseUntil: Date.now() + 120000 }, { merge: true })
    return true
  })
  if (!acquired)
    throw new HttpsError('resource-exhausted', 'Translation is being prepared. Try again shortly.')
  const result = await translateFormRecord(record, adapter)
  await reauthorize?.()
  await ref.set({ ...result, leaseUntil: result.status === 'failed' ? Date.now() + 60000 : 0 })
  return result
}
export async function formTranslationHandler(
  request: CallableRequest<{
    id: string
    action: string
    revision?: number
    corrections?: Record<string, string>
  }>,
  prepare: (record: FormRecord, reauthorize: () => Promise<unknown>) => Promise<FormTranslation> = (
    record,
    verify,
  ) => prepareFormTranslation(record, undefined, verify),
) {
  const record = await authorizeFormEntry(request.data?.id, request.auth?.uid)
  const { sourceHash } = translationSource(record)
  const ref = db.doc('formTranslations/' + record.id + '/versions/' + sourceHash)
  const action = request.data?.action
  if (action === 'get') {
    const cached = currentFormTranslation(record, (await ref.get()).data())
    await authorizeFormEntry(record.id, request.auth?.uid)
    const initial = await translateFormRecord(record)
    return {
      translation: cached?.status
        ? cached
        : configuredFormTranslationAdapter()
          ? { ...initial, status: 'pending' as const }
          : initial,
    }
  }
  if (action === 'translate') {
    const translation = await prepare(record, () =>
      authorizeFormEntry(record.id, request.auth?.uid),
    )
    await authorizeFormEntry(record.id, request.auth?.uid)
    return { translation }
  }
  if (action === 'correct') {
    const profile = (await db.doc('users/' + request.auth!.uid).get()).data()
    const user = buildCurrentFunctionUser(request.auth!.uid, profile || {})
    if (!user.active || user.role !== 'admin')
      throw new HttpsError('permission-denied', 'Only Admin can correct a translation.')
    const corrections = request.data?.corrections
    if (
      !corrections ||
      typeof corrections !== 'object' ||
      Array.isArray(corrections) ||
      JSON.stringify(corrections).length > 100000
    )
      throw new HttpsError('invalid-argument', 'Invalid corrections.')
    const translation = await db.runTransaction(async (transaction) => {
      const current = currentFormTranslation(record, (await transaction.get(ref)).data())
      if (
        current?.status !== 'ready' ||
        current.sourceHash !== sourceHash ||
        current.revision !== request.data.revision
      )
        throw new HttpsError('failed-precondition', 'Reload this translation before correcting it.')
      if (
        Object.keys(corrections).some(
          (key) => !current.segments.some((segment) => segment.key === key),
        ) ||
        Object.values(corrections).some(
          (value) => typeof value !== 'string' || !value.trim() || value.length > 20000,
        )
      )
        throw new HttpsError('invalid-argument', 'Invalid translation segments.')
      const next = {
        ...current,
        revision: current.revision + 1,
        correction: { by: request.auth!.uid, at: Date.now() },
        segments: current.segments.map((segment) => ({
          ...segment,
          translated: corrections[segment.key] ?? segment.translated,
        })),
      }
      await authorizeFormEntry(record.id, request.auth?.uid)
      const latestUser = buildCurrentFunctionUser(
        request.auth!.uid,
        (await db.doc('users/' + request.auth!.uid).get()).data() || {},
      )
      if (!latestUser.active || latestUser.role !== 'admin')
        throw new HttpsError('permission-denied', 'Only Admin can correct a translation.')
      transaction.set(ref, next)
      transaction.set(ref.collection('corrections').doc('r' + next.revision), {
        before: current.segments,
        after: next.segments,
        ...next.correction,
        sourceHash,
      })
      return next
    })
    await authorizeFormEntry(record.id, request.auth?.uid)
    return { translation }
  }
  throw new HttpsError('invalid-argument', 'Invalid translation action.')
}
export const formTranslation = onCall(
  { timeoutSeconds: 120, secrets: [formTranslationApiKey] },
  (request) => formTranslationHandler(request),
)
