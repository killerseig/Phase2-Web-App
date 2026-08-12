import { describe, expect, it } from 'vitest'

import {
  appendRecipientEmail,
  getRecipientAddResult,
  isValidRecipientEmail,
  normalizeRecipientEmail,
  normalizeRecipientEmailList,
  removeRecipientEmail,
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

  it('classifies recipient add requests before persistence', () => {
    expect(getRecipientAddResult('', [])).toEqual({ status: 'empty', email: '' })
    expect(getRecipientAddResult('not-an-email', [])).toEqual({ status: 'invalid', email: 'not-an-email' })
    expect(getRecipientAddResult('ADMIN@example.com', ['admin@example.com'])).toEqual({
      status: 'duplicate',
      email: 'admin@example.com',
    })
    expect(getRecipientAddResult('office@example.com', [], [' Office@Example.com '])).toEqual({
      status: 'duplicate',
      email: 'office@example.com',
    })
    expect(getRecipientAddResult(' Field@Example.com ', [])).toEqual({
      status: 'ready',
      email: 'field@example.com',
    })
  })

  it('adds and removes recipients using normalized email comparisons', () => {
    expect(appendRecipientEmail(['office@example.com'], ' Field@Example.com ')).toEqual([
      'office@example.com',
      'field@example.com',
    ])

    expect(removeRecipientEmail([
      'office@example.com',
      'Field@Example.com',
      'shop@example.com',
    ], ' field@example.com ')).toEqual([
      'office@example.com',
      'shop@example.com',
    ])
  })
})
