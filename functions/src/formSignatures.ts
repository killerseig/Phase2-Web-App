import type { FormAnswers, FormDefinition, FormField, FormGroupInstance } from './formModel'

export interface FormSignature { strokes: number[][][]; signedAt?: number }
export const SIGNATURE_MAX_POINTS = 512
/** Numeric ink only, serialized as text so Firestore never receives nested arrays. */
export function parseFormSignature(value: string): FormSignature | undefined {
  if (!value) return undefined
  if (value.length > 12000) throw new Error('Signature exceeds its size limit.')
  let input: FormSignature
  try { input = JSON.parse(value) as FormSignature } catch { throw new Error('Invalid signature.') }
  if (!input || !Array.isArray(input.strokes) || !input.strokes.length || input.strokes.length > 40)
    throw new Error('Draw a signature before saving.')
  let count = 0
  const strokes = input.strokes.map(stroke => {
    if (!Array.isArray(stroke) || stroke.length < 2) throw new Error('Draw a signature before saving.')
    count += stroke.length
    return stroke.map(point => {
      if (!Array.isArray(point) || point.length !== 2 || point.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1))
        throw new Error('Invalid signature coordinates.')
      return point.map(n => Math.round(n * 1000) / 1000)
    })
  })
  if (count > SIGNATURE_MAX_POINTS || !strokes.some(stroke => stroke.some(point => point[0] !== stroke[0]![0] || point[1] !== stroke[0]![1])))
    throw new Error('Draw a readable signature within the size limit.')
  if (input.signedAt !== undefined && (!Number.isSafeInteger(input.signedAt) || input.signedAt <= 0 || input.signedAt > 8640000000000000))
    throw new Error('Invalid signature timestamp.')
  return { strokes, ...(input.signedAt ? { signedAt: input.signedAt } : {}) }
}
export function validatedSignature(value: unknown): string {
  if (value === undefined || value === '') return ''
  if (typeof value !== 'string') throw new Error('Invalid signature.')
  return JSON.stringify(parseFormSignature(value))
}
export function signatureCaption(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Not signed'
  const signature = parseFormSignature(value)
  return signature?.signedAt ? 'Signed: ' + new Date(signature.signedAt).toISOString() : 'Signature not yet saved'
}
/** Server owns signing times. Replays retain their time; client-supplied times are ignored. */
export function stampFormSignatures(definition: Pick<FormDefinition, 'fields'>, answers: FormAnswers, previous: FormAnswers, now: number): FormAnswers {
  const next = { ...answers }
  for (const field of definition.fields) {
    if (field.kind === 'repeat') {
      const old = (previous[field.id] || []) as FormGroupInstance[]
      next[field.id] = ((answers[field.id] || []) as FormGroupInstance[]).map(instance => ({
        ...instance,
        answers: stampFormSignatures({ fields: field.fields || [] }, instance.answers,
          old.find(item => item.instanceId === instance.instanceId)?.answers || {}, now),
      }))
    } else if (field.kind === 'signature' && answers[field.id]) {
      const signature = parseFormSignature(String(answers[field.id]))!
      const old = parseFormSignature(String(previous[field.id] || ''))
      const sameInk = old && JSON.stringify(old.strokes) === JSON.stringify(signature.strokes)
      if (sameInk && old.signedAt && definition.fields.some(sibling => sibling.id !== field.id && JSON.stringify(answers[sibling.id]) !== JSON.stringify(previous[sibling.id])))
        throw new Error(field.label + ': details changed after signing. Clear and save the signature before signing the corrected details.')
      next[field.id] = JSON.stringify({ strokes: signature.strokes, signedAt: sameInk && old.signedAt ? old.signedAt : now })
    }
  }
  return next
}
export function validateAttendeeHandoff(fields: FormField[], answers: FormAnswers, handoff: unknown, validate: (definition: FormDefinition, answers: unknown, final: boolean) => FormAnswers) {
  if (!handoff || typeof handoff !== 'object') throw new Error('Choose an attendee to save.')
  const { groupId, instanceId } = handoff as { groupId: unknown; instanceId: unknown }
  const group = fields.find(field => field.id === groupId && field.kind === 'repeat' && field.sequential)
  const instance = group && ((answers[group.id] || []) as FormGroupInstance[]).find(item => item.instanceId === instanceId)
  if (!group || !instance) throw new Error('Choose an attendee to save.')
  validate({ title: group.label, description: '', recipients: [], fields: group.fields || [] }, instance.answers, true)
}
