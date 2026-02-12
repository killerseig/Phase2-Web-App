import { describe, expect, it } from 'vitest'
import { normalizeError } from '@/services/serviceUtils'

describe('serviceUtils', () => {
  it('returns message from error object', () => {
    const err = new Error('boom')
    expect(normalizeError(err, 'fallback')).toBe('boom')
  })

  it('returns fallback when message empty', () => {
    const err = { message: '   ' }
    expect(normalizeError(err, 'fallback')).toBe('fallback')
  })

  it('returns fallback when not an object', () => {
    expect(normalizeError(null, 'fallback')).toBe('fallback')
    expect(normalizeError(undefined, 'fallback')).toBe('fallback')
    expect(normalizeError(42 as any, 'fallback')).toBe('fallback')
  })
})
