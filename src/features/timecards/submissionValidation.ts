import { buildCardDisplayName } from '@/features/timecards/workbook'
import type { TimecardCardRecord, TimecardWorkbookLineRecord } from '@/types/domain'

export type TimecardSubmissionField = 'jobNumber' | 'subsectionArea' | 'account'

export interface TimecardSubmissionValidationIssue {
  cardId: string
  cardLabel: string
  lineIndex: number
  missingFields: TimecardSubmissionField[]
}

const requiredFieldLabels: Record<TimecardSubmissionField, string> = {
  jobNumber: 'Job #',
  subsectionArea: 'Area',
  account: 'Acct',
}

function hasPositiveHours(value: unknown) {
  const hours = Number(value)
  return Number.isFinite(hours) && hours > 0
}

function lineHasHours(line: TimecardWorkbookLineRecord) {
  return hasPositiveHours(line.offHours) || line.days.some((day) => hasPositiveHours(day.hours))
}

function isBlank(value: unknown) {
  return String(value ?? '').trim().length === 0
}

export function findTimecardSubmissionValidationIssues(
  cards: readonly TimecardCardRecord[],
): TimecardSubmissionValidationIssue[] {
  return cards.flatMap((card) => (card.lines ?? []).flatMap((line, lineIndex) => {
    if (!lineHasHours(line)) return []

    const missingFields = (Object.keys(requiredFieldLabels) as TimecardSubmissionField[])
      .filter((field) => isBlank(line[field]))
    if (!missingFields.length) return []

    return [{
      cardId: card.id,
      cardLabel: buildCardDisplayName(card),
      lineIndex,
      missingFields,
    }]
  }))
}

export function formatTimecardSubmissionValidationMessage(
  issues: readonly TimecardSubmissionValidationIssue[],
) {
  const firstIssue = issues[0]
  if (!firstIssue) return ''

  const missingLabels = firstIssue.missingFields.map((field) => requiredFieldLabels[field])
  const formattedMissingFields = missingLabels.length > 1
    ? `${missingLabels.slice(0, -1).join(', ')} and ${missingLabels[missingLabels.length - 1]}`
    : missingLabels[0]
  const additionalIssueCount = issues.length - 1
  const additionalIssueMessage = additionalIssueCount > 0
    ? ` ${additionalIssueCount} other incomplete ${additionalIssueCount === 1 ? 'line also needs' : 'lines also need'} attention.`
    : ''

  return `${firstIssue.cardLabel}, line ${firstIssue.lineIndex + 1} has hours but is missing ${formattedMissingFields}. Complete Job #, Area, and Acct on every line with hours before submitting.${additionalIssueMessage}`
}
