import { readFirstQueryParam } from '@/utils/routerQuery'
import type { TimecardPdfExportCard } from './pdf-export'

export const missingTimecardPrintPayloadMessage = 'No timecard export data was found. Return to Timecard Export and try again.'

export function getTimecardPrintExportId(query: { exportId?: unknown }) {
  return readFirstQueryParam(query.exportId) || undefined
}

export function getTimecardPrintPages<TCard extends Pick<TimecardPdfExportCard, 'id'>>(
  cards: readonly TCard[],
  cardsPerPage = 2,
) {
  if (cardsPerPage < 1) return []

  const pages: TCard[][] = []

  for (let index = 0; index < cards.length; index += cardsPerPage) {
    pages.push(cards.slice(index, index + cardsPerPage))
  }

  return pages
}

export function formatTimecardPrintGeneratedAt(value: number) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}
