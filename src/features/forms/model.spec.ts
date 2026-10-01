import { describe, expect, it } from 'vitest'
import {
  committeeAudit,
  duplicateTemplate,
  emptyLibrary,
  keepVersion,
  moveField,
  removeOrArchive,
  definitionErrors,
} from './model'
import { validateFormAnswers } from '../../../functions/src/formModel'
import { readLibrary, saveLibrary } from './localLibrary'
function storage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}
describe('local Form Builder foundation', () => {
  it('retains immutable versions and archives versioned templates instead of deleting', () => {
    const original = committeeAudit()
    const issued = keepVersion(original)
    issued.fields[0]!.label = 'Later title'
    issued.recipients.push('dan@example.com')
    expect(issued.versions[0]!.fields[0]!.label).toBe('Date of inspection')
    expect(issued.versions[0]!.recipients).toEqual(['dan2@phase2co.com'])
    expect(original.versions).toEqual([])
    const library = emptyLibrary()
    library.templates.push(issued)
    expect(removeOrArchive(library, issued.id).templates[0]!.archived).toBe(true)
    expect(library.templates[0]!.archived).toBe(false)
    library.templates = [original]
    expect(removeOrArchive(library, original.id).templates).toEqual([])
  })
  it('copies fresh identities and moves fields without dropping data', () => {
    const original = committeeAudit()
    const duplicate = duplicateTemplate(keepVersion(original))
    expect(duplicate.id).not.toBe(original.id)
    expect(duplicate.versions).toEqual([])
    expect(
      duplicate.fields.every((field) => !original.fields.some((source) => source.id === field.id)),
    ).toBe(true)
    const note = duplicate.fields.find((field) => field.requiredWhen)!
    expect(duplicate.fields.find((field) => field.id === note.requiredWhen!.fieldId)?.kind).toBe(
      'choice',
    )
    expect(definitionErrors(duplicate)).toEqual([])
    const ids = duplicate.fields.map((field) => field.id)
    moveField(duplicate, ids[0]!, 2)
    expect(duplicate.fields.map((field) => field.id)).toEqual([
      ids[1],
      ids[2],
      ids[0],
      ...ids.slice(3),
    ])
    moveField(duplicate, 'missing', 0)
    expect(duplicate.fields).toHaveLength(ids.length)
  })
  it('rejects invalid configuration before retaining a version', () => {
    const template = committeeAudit()
    template.recipients = ['bad address']
    expect(definitionErrors(template)).toContain('Use up to 20 valid recipient email addresses.')
    expect(() => keepVersion(template)).toThrow()
    expect(template.versions).toEqual([])
    template.recipients = ['dan@example.com']
    expect(definitionErrors(template)).toEqual([])
  })
  it('validates dedicated email, phone and minute-precision time controls', () => {
    const definition = {
      title: 'Basics',
      description: '',
      recipients: [],
      fields: ['email', 'phone', 'time'].map((kind) => ({
        id: kind,
        kind: kind as 'email' | 'phone' | 'time',
        label: kind,
        required: true,
        options: [],
      })),
    }
    expect(definitionErrors(definition)).toEqual([])
    const answers = { email: 'employee@example.com', phone: '+1 (555) 010-0200', time: '14:30' }
    expect(validateFormAnswers(definition, answers, true)).toEqual(answers)
    for (const [id, value] of [
      ['email', 'not-an-email'],
      ['phone', 'call-me'],
      ['time', '25:00'],
    ])
      expect(() => validateFormAnswers(definition, { ...answers, [id!]: value }, false)).toThrow()
    expect(() => validateFormAnswers(definition, { ...answers, email: '' }, true)).toThrow(
      'email is required',
    )
  })
  it('opening creates nothing, separates users and preserves saved revisions after reload', () => {
    const cache = storage()
    expect(readLibrary(cache, 'admin-a')).toEqual(emptyLibrary())
    const library = emptyLibrary()
    library.templates.push(committeeAudit())
    const saved = saveLibrary(cache, 'admin-a', library)
    expect(readLibrary(cache, 'admin-a')).toEqual(saved)
    expect(readLibrary(cache, 'admin-b').templates).toEqual([])
    expect(() => readLibrary(cache, '')).toThrow('Sign in')
  })
  it('rejects conflicting, corrupt and quota-failed saves without advancing the editor state', () => {
    const cache = storage()
    const original = emptyLibrary()
    saveLibrary(cache, 'admin', original)
    expect(() => saveLibrary(cache, 'admin', original)).toThrow('Another tab')
    expect(original.revision).toBe(0)
    const corrupt = { ...cache, getItem: () => '{bad json' }
    expect(() => readLibrary(corrupt, 'admin')).toThrow('preserved')
    const quota = {
      ...cache,
      setItem: () => {
        throw new Error('Quota exceeded')
      },
    }
    const saved = readLibrary(cache, 'admin')
    expect(() => saveLibrary(quota, 'admin', saved)).toThrow('Quota')
    expect(readLibrary(cache, 'admin')).toEqual(saved)
  })
})
