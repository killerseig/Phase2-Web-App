import { createHash } from 'node:crypto'
import type { FormRecord, FormField, FormAnswers, FormGroupInstance } from './formModel'

export interface TranslationSegment {
  key: string
  original: string
  translated: string
}
export interface FormTranslation {
  sourceHash: string
  target: 'en'
  status: 'ready' | 'disabled' | 'failed' | 'pending'
  provider: 'google-cloud-translation' | 'none'
  createdAt: number
  revision: number
  segments: TranslationSegment[]
  correction?: { by: string; at: number }
}
export interface TranslationAdapter {
  translate: (texts: string[]) => Promise<string[]>
}
export function currentFormTranslation(
  record: FormRecord,
  value: unknown,
): FormTranslation | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as FormTranslation
  const source = translationSource(record)
  if (
    candidate.sourceHash !== source.sourceHash ||
    candidate.target !== 'en' ||
    !['ready', 'disabled', 'failed', 'pending'].includes(candidate.status) ||
    !['none', 'google-cloud-translation'].includes(candidate.provider) ||
    !Number.isSafeInteger(candidate.revision) ||
    candidate.revision < 1 ||
    !Array.isArray(candidate.segments) ||
    candidate.segments.length !== source.segments.length
  )
    return undefined
  if (
    candidate.segments.some(
      (segment, index) =>
        segment?.key !== source.segments[index]!.key ||
        segment.original !== source.segments[index]!.original ||
        typeof segment.translated !== 'string' ||
        segment.translated.length > 20000 ||
        (candidate.status === 'ready' && !segment.translated.trim()),
    ) ||
    candidate.segments.reduce((sum, segment) => sum + segment.translated.length, 0) > 100000
  )
    return undefined
  return candidate
}
export function translationSource(record: FormRecord) {
  const segments: TranslationSegment[] = []
  function visit(fields: FormField[], answers: FormAnswers, prefix = '') {
    for (const field of fields) {
      const key = prefix + field.id
      const value = answers[field.id]
      if (field.kind === 'repeat') {
        for (const instance of (value || []) as FormGroupInstance[])
          visit(field.fields || [], instance.answers, key + '/' + instance.instanceId + '/')
      } else if (
        ['text', 'textarea', 'choice', 'radio'].includes(field.kind) &&
        typeof value === 'string' &&
        value.trim()
      ) {
        segments.push({ key, original: value, translated: '' })
      } else if (['matrix', 'multiselect'].includes(field.kind) && Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'string' && item.trim())
            segments.push({ key: key + '/' + index, original: item, translated: '' })
        })
      }
    }
  }
  visit(record.definition.fields, record.answers)
  const sourceHash = createHash('sha256')
    .update(
      JSON.stringify({
        version: 1,
        definition: record.definition,
        answers: record.answers,
        target: 'en',
      }),
    )
    .digest('hex')
  return { sourceHash, segments }
}
export async function translateFormRecord(
  record: FormRecord,
  adapter?: TranslationAdapter,
): Promise<FormTranslation> {
  const { sourceHash, segments } = translationSource(record)
  const base: FormTranslation = {
    sourceHash,
    target: 'en',
    status: 'disabled',
    provider: adapter ? 'google-cloud-translation' : 'none',
    createdAt: Date.now(),
    revision: 1,
    segments,
  }
  if (!adapter) return base
  if (
    segments.length > 500 ||
    segments.reduce((sum, item) => sum + item.original.length, 0) > 30000
  )
    return { ...base, status: 'failed' }
  try {
    const translated: string[] = []
    // Bounded batches below Google's 128-string request maximum.
    for (let index = 0; index < segments.length; index += 50) {
      const result = await adapter.translate(
        segments.slice(index, index + 50).map((item) => item.original),
      )
      if (
        result.length !== Math.min(50, segments.length - index) ||
        result.some((item) => typeof item !== 'string' || !item.trim() || item.length > 20000)
      )
        throw new Error('Invalid translation response.')
      translated.push(...result)
    }
    if (translated.reduce((sum, item) => sum + item.length, 0) > 100000)
      throw new Error('Translation output too large.')
    return {
      ...base,
      status: 'ready',
      segments: segments.map((item, index) => ({ ...item, translated: translated[index]! })),
    }
  } catch {
    // Never save raw service errors, request bodies or credentials.
    return { ...base, status: 'failed' }
  }
}
/** Output-only projection. The stored submitted record and all field/instance IDs remain untouched. */
export function translatedFormProjection(
  record: FormRecord,
  translation: FormTranslation,
): FormRecord {
  const source = translationSource(record)
  if (translation.status !== 'ready' || !currentFormTranslation(record, translation)) return record
  const projection = structuredClone(record)
  const sourceKeys = new Set(source.segments.map((segment) => segment.key))
  const selected = new Map(
    translation.segments
      .filter((segment) => sourceKeys.has(segment.key))
      .map((segment) => [segment.key, segment]),
  )
  function visit(fields: FormField[], answers: FormAnswers, prefix = '') {
    for (const field of fields) {
      const key = prefix + field.id
      const value = answers[field.id]
      if (field.kind === 'repeat') {
        for (const instance of (value || []) as FormGroupInstance[])
          visit(field.fields || [], instance.answers, key + '/' + instance.instanceId + '/')
      } else if (typeof value === 'string') {
        const segment = selected.get(key)
        if (segment?.original === value && segment.translated)
          answers[field.id] = segment.translated
      } else if (['matrix', 'multiselect'].includes(field.kind) && Array.isArray(value)) {
        answers[field.id] = (value as string[]).map((item, index) => {
          const segment = selected.get(key + '/' + index)
          return segment?.original === item && segment.translated ? segment.translated : item
        })
      }
    }
  }
  visit(projection.definition.fields, projection.answers)
  return projection
}
