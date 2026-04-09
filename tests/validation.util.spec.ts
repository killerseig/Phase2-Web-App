import { describe, expect, it } from 'vitest'
import { getFirstValidationMessage, validateJobForm } from '@/utils/validation'

describe('validation utils', () => {
  it('requires a job name when validating job forms', () => {
    const result = validateJobForm({
      name: '',
      code: '',
      accountNumber: '',
      startDate: '',
      finishDate: '',
      productionBurden: '0.33',
    })

    expect(result.valid).toBe(false)
    expect(getFirstValidationMessage(result)).toBe('Job name is required')
  })

  it('rejects account numbers when using a 3-digit GL code', () => {
    const result = validateJobForm({
      name: 'Project One',
      code: '123',
      accountNumber: '9001',
      productionBurden: '0.33',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.message.includes('Account number must be blank'))).toBe(true)
  })

  it('rejects finish dates earlier than the start date', () => {
    const result = validateJobForm({
      name: 'Project One',
      startDate: '2026-04-10',
      finishDate: '2026-04-09',
      productionBurden: '0.33',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.message.includes('Finish date cannot be earlier'))).toBe(true)
  })

  it('rejects invalid negative production burden values', () => {
    const result = validateJobForm({
      name: 'Project One',
      productionBurden: '-1',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.message.includes('Burden must be a non-negative number'))).toBe(true)
  })
})
