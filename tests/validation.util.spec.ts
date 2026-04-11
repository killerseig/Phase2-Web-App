import { describe, expect, it } from 'vitest'
import { getFirstValidationMessage, validateJobForm } from '@/utils/validation'

describe('validation utils', () => {
  it('requires a job name when validating job forms', () => {
    const result = validateJobForm({
      name: '',
      code: '',
      type: '',
      startDate: '',
      finishDate: '',
      productionBurden: '0.33',
    })

    expect(result.valid).toBe(false)
    expect(getFirstValidationMessage(result)).toBe('Job name is required')
  })

  it('requires a job type when validating job forms', () => {
    const result = validateJobForm({
      name: 'Project One',
      type: '',
      productionBurden: '0.33',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.message.includes('Job type is required'))).toBe(true)
  })

  it('rejects finish dates earlier than the start date', () => {
    const result = validateJobForm({
      name: 'Project One',
      type: 'drywall',
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
      type: 'paint',
      productionBurden: '-1',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.message.includes('Burden must be a non-negative number'))).toBe(true)
  })
})
