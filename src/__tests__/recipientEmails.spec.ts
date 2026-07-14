import { describe, expect, it } from 'vitest'

import {
  isValidRecipientEmail,
  normalizeRecipientEmail,
  normalizeRecipientEmailList,
} from '@/utils/recipientEmails'

describe('recipient email helpers', () => {
  it('normalizes recipient email casing and whitespace', () => {
    expect(normalizeRecipientEmail('  PERSON@Example.COM  ')).toBe('person@example.com')
  })

  it('validates simple email addresses with the shared recipient rule', () => {
    expect(isValidRecipientEmail('person@example.com')).toBe(true)
    expect(isValidRecipientEmail('person@example')).toBe(false)
    expect(isValidRecipientEmail('person example.com')).toBe(false)
    expect(isValidRecipientEmail('')).toBe(false)
  })

  it('normalizes, filters, and de-duplicates recipient lists', () => {
    expect(normalizeRecipientEmailList([
      ' Admin@Example.com ',
      '',
      'admin@example.com',
      'field@example.com',
    ])).toEqual(['admin@example.com', 'field@example.com'])
  })
})
