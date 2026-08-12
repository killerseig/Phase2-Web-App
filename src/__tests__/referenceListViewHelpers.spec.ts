import { describe, expect, it } from 'vitest'

import {
  getReferenceListTitle,
  normalizeReferenceListKey,
} from '@/features/referenceLists/viewHelpers'

describe('reference list view helpers', () => {
  it('normalizes known reference-list route keys', () => {
    expect(normalizeReferenceListKey('job-types')).toBe('job-types')
    expect(normalizeReferenceListKey('gcs')).toBe('gcs')
    expect(normalizeReferenceListKey('occupations')).toBe('occupations')
  })

  it('falls back unknown route keys to occupations', () => {
    expect(normalizeReferenceListKey('unknown')).toBe('occupations')
    expect(normalizeReferenceListKey(undefined)).toBe('occupations')
    expect(normalizeReferenceListKey(['job-types'])).toBe('occupations')
  })

  it('returns display titles for reference-list routes', () => {
    expect(getReferenceListTitle('job-types')).toBe('Job Types')
    expect(getReferenceListTitle('gcs')).toBe('GCs')
    expect(getReferenceListTitle('occupations')).toBe('Occupations')
    expect(getReferenceListTitle('missing')).toBe('Occupations')
  })
})
