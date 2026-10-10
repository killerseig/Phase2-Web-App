import { describe, expect, it } from 'vitest'
import {
  canReadFormEntry,
  canSubmitForm,
  validateFormAccess,
} from '../../../functions/src/formAccess'
const person = { uid: 'person', role: 'foreman', active: true }
describe('independent form and entry access', () => {
  it('keeps legacy forms signed in and entries private', () => {
    expect(canSubmitForm(undefined)).toBe(false)
    expect(canSubmitForm(undefined, person)).toBe(true)
    expect(canReadFormEntry(undefined, 'someone-else', person)).toBe(false)
    expect(canReadFormEntry(undefined, person.uid, person)).toBe(true)
  })
  it('Everyone does not grant entry access and clears the respondent audience', () => {
    const access = validateFormAccess({ respondents: 'public', respondentUserIds: ['secret'] })
    expect(access.respondentUserIds).toEqual([])
    expect(canSubmitForm(access)).toBe(true)
    expect(canReadFormEntry(access, 'other', person)).toBe(false)
  })
  it('supports identity through author-controlled form fields without adding mandatory contact', () => {
    const access = validateFormAccess({ respondents: 'public', identity: 'form-fields' })
    expect(access.identity).toBe('form-fields')
    expect(canSubmitForm(access)).toBe(true)
    expect(canReadFormEntry(access, 'other', person)).toBe(false)
  })
  it('entry audiences are independent of submit audiences and require an active reader', () => {
    const access = validateFormAccess({ respondentRoles: [], entryUserIds: [person.uid] })
    expect(canSubmitForm(access, person)).toBe(false)
    expect(canReadFormEntry(access, 'other', person)).toBe(true)
    expect(canReadFormEntry(access, 'other', { ...person, active: false })).toBe(false)
  })
  it('does not treat arbitrary email or unknown role as an audience', () => {
    expect(() => validateFormAccess({ entryUserIds: ['email@example.com'] })).toThrow()
    expect(() => validateFormAccess({ entryRoles: ['public'] })).toThrow()
    expect(() => validateFormAccess({ respondents: 'signed-in', identity: 'anonymous' })).toThrow(
      'requires Everyone',
    )
  })
})
