import { describe, expect, it } from 'vitest'

import {
  createEmptyDailyLogPayload,
  DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS,
} from '@/features/dailyLogs/schema'
import { validateDailyLogForSubmit } from '@/features/dailyLogs/validation'

function makeValidPayload() {
  const payload = createEmptyDailyLogPayload({
    actionItems: 'Follow up tomorrow',
    ahaReviewed: 'AHA reviewed',
    budgetConcerns: 'No budget concerns',
    deliveriesNeeded: 'No deliveries needed',
    deliveriesReceived: 'Materials arrived',
    manpowerAssessment: 'Crew was sufficient',
    newWorkAuthorizations: 'None',
    notesCorrespondence: 'Notes complete',
    qcAreasInspected: 'Level 1',
    qcAssignedTo: 'CJ',
    qcIssuesIdentified: 'No issues',
    qcIssuesResolved: 'No issues',
    safetyConcerns: 'No safety concerns',
    scheduleConcerns: 'No schedule concerns',
    weeklySchedule: 'Install panels',
  })

  payload.manpowerLines = [
    {
      addedByUserId: 'user-1',
      areas: 'Level 1',
      count: 3,
      trade: 'Acoustical Carpenter',
    },
  ]
  payload.indoorClimateReadings = [
    {
      area: 'Level 1',
      high: '72',
      humidity: '30',
      low: '68',
    },
  ]

  return payload
}

describe('validateDailyLogForSubmit', () => {
  it('accepts a complete daily log payload', () => {
    expect(validateDailyLogForSubmit(makeValidPayload())).toBe('')
  })

  it('requires each configured submit text field', () => {
    for (const field of DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS) {
      const payload = makeValidPayload()
      payload[field.key] = '   '

      expect(validateDailyLogForSubmit(payload)).toBe(
        `Complete "${field.label}" before submitting.`,
      )
    }
  })

  it('requires complete manpower rows with a trade and count of at least one', () => {
    const blankTrade = makeValidPayload()
    blankTrade.manpowerLines = [
      {
        addedByUserId: 'user-1',
        areas: 'Level 1',
        count: 3,
        trade: '',
      },
    ]

    expect(validateDailyLogForSubmit(blankTrade)).toBe('Complete manpower row 1 before submitting.')

    const zeroCount = makeValidPayload()
    zeroCount.manpowerLines = [
      {
        addedByUserId: 'user-1',
        areas: 'Level 1',
        count: 0,
        trade: 'Acoustical Carpenter',
      },
    ]

    expect(validateDailyLogForSubmit(zeroCount)).toBe('Complete manpower row 1 before submitting.')

    const secondRowInvalid = makeValidPayload()
    secondRowInvalid.manpowerLines.push({
      addedByUserId: 'user-1',
      areas: '',
      count: 0,
      trade: 'Painter',
    })

    expect(validateDailyLogForSubmit(secondRowInvalid)).toBe('Complete manpower row 2 before submitting.')
  })

  it('ignores fully blank extra manpower rows during submit validation', () => {
    const payload = makeValidPayload()
    payload.manpowerLines.push({
      addedByUserId: null,
      areas: '',
      count: 0,
      trade: '',
    })

    expect(validateDailyLogForSubmit(payload)).toBe('')
  })

  it('requires complete indoor climate rows', () => {
    const missingArea = makeValidPayload()
    missingArea.indoorClimateReadings = [
      {
        area: '',
        high: '72',
        humidity: '30',
        low: '68',
      },
    ]

    expect(validateDailyLogForSubmit(missingArea)).toBe(
      'Complete indoor climate row 1 before submitting.',
    )

    const secondRowMissingHumidity = makeValidPayload()
    secondRowMissingHumidity.indoorClimateReadings.push({
      area: 'Level 2',
      high: '73',
      humidity: '',
      low: '69',
    })

    expect(validateDailyLogForSubmit(secondRowMissingHumidity)).toBe(
      'Complete indoor climate row 2 before submitting.',
    )
  })

  it('ignores fully blank extra indoor climate rows during submit validation', () => {
    const payload = makeValidPayload()
    payload.indoorClimateReadings.push({
      area: '',
      high: '',
      humidity: '',
      low: '',
    })

    expect(validateDailyLogForSubmit(payload)).toBe('')
  })
})
