import { describe, expect, it, vi } from 'vitest'
vi.mock('./runtime', () => ({ db: {} }))
import { entryReaderAllowed } from './formEntryAccess'
import type { FormRecord } from './formModel'
const policy = { respondents: 'signed-in', identity: 'identified', respondentRoles: [], respondentUserIds: [], entryRoles: [], entryUserIds: [] }
const record = { ownerUid: 'approved-test-owner' } as FormRecord
const owner = { uid: record.ownerUid, role: 'admin', active: true }
const otherAdmin = { uid: 'another-admin', role: 'admin', active: true }
describe('private release-validation entry isolation', () => {
  it('preserves normal existing administrator access for real entries', () => {
    expect(entryReaderAllowed(record, otherAdmin, policy)).toBe(true)
  })
  it('restricts validation entries to the exact active test owner, including against other admins', () => {
    const fixture = { ...record, validationOwnerUid: record.ownerUid }
    expect(entryReaderAllowed(fixture, owner, policy)).toBe(true)
    expect(entryReaderAllowed(fixture, otherAdmin, policy)).toBe(false)
    expect(entryReaderAllowed(fixture, { ...owner, active: false }, policy)).toBe(false)
  })
  it('rejects malformed or mismatched validation-owner metadata rather than falling back to broader access', () => {
    expect(entryReaderAllowed({ ...record, validationOwnerUid: 'different-owner' }, owner, policy)).toBe(false)
    expect(entryReaderAllowed({ ...record, validationOwnerUid: 123 }, owner, policy)).toBe(false)
  })
})
