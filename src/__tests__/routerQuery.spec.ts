import { describe, expect, it } from 'vitest'

import { readFirstQueryParam } from '@/utils/routerQuery'

describe('router query helpers', () => {
  it('reads string query params directly', () => {
    expect(readFirstQueryParam('person@example.com')).toBe('person@example.com')
  })

  it('reads the first string value from repeated query params', () => {
    expect(readFirstQueryParam(['first', 'second'])).toBe('first')
  })

  it('falls back to an empty string for missing or non-string values', () => {
    expect(readFirstQueryParam(undefined)).toBe('')
    expect(readFirstQueryParam(null)).toBe('')
    expect(readFirstQueryParam(123)).toBe('')
    expect(readFirstQueryParam([123, 'second'])).toBe('')
  })
})
