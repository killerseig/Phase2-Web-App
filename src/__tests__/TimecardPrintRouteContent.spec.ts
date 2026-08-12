import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import TimecardPrintRouteContent from '@/components/timecards/TimecardPrintRouteContent.vue'
import type { TimecardPdfExportCard, TimecardPdfExportPayload } from '@/features/timecards/pdf-export'

function makePrintCard(overrides: Partial<TimecardPdfExportCard> = {}): TimecardPdfExportCard {
  return {
    id: 'card-1',
    exportWeekEndDate: '2026-06-13',
    exportBurden: 0.33,
    ...overrides,
  } as TimecardPdfExportCard
}

function makePayload(
  cards: TimecardPdfExportCard[] = [makePrintCard()],
): TimecardPdfExportPayload {
  return {
    cards,
    exportId: 'export-1',
    generatedAt: Date.UTC(2026, 5, 13, 18, 30),
    subtitle: 'Week Ending 6/13/2026',
    title: 'Timecard Export',
  }
}

const TimecardPrintCardStub = {
  name: 'TimecardPrintCard',
  props: ['card', 'weekEndDate', 'burden'],
  template: `
    <section data-testid="stub-timecard-print-card">
      {{ card.id }} / {{ weekEndDate }} / {{ burden }}
    </section>
  `,
}

describe('TimecardPrintRouteContent', () => {
  it('renders the print toolbar, document shell, stored cards, and one-card empty slot', async () => {
    const card = makePrintCard()
    const triggerPrint = vi.fn()
    const wrapper = mount(TimecardPrintRouteContent, {
      global: {
        stubs: {
          TimecardPrintCard: TimecardPrintCardStub,
        },
      },
      props: {
        loadError: '',
        pagedCards: [[card]],
        payload: makePayload([card]),
        triggerPrint,
      },
    })

    expect(wrapper.get('[data-testid="timecard-export-print-page"]').classes()).toContain(
      'timecard-print-view',
    )
    expect(wrapper.text()).toContain('Timecard Export')
    expect(wrapper.text()).toContain('Week Ending 6/13/2026')
    expect(wrapper.text()).toContain('Generated')
    expect(wrapper.find('[data-testid="timecard-export-print-document"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="timecard-export-print-card-card-1"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="stub-timecard-print-card"]').text()).toContain(
      'card-1 / 2026-06-13 / 0.33',
    )
    expect(wrapper.find('.timecard-print-view__card-shell--empty').exists()).toBe(true)

    await wrapper.get('button').trigger('click')

    expect(triggerPrint).toHaveBeenCalledTimes(1)
  })

  it('renders the missing payload message without a document when loading fails', () => {
    const wrapper = mount(TimecardPrintRouteContent, {
      props: {
        loadError: 'No timecard export data was found.',
        pagedCards: [],
        payload: null,
        triggerPrint: vi.fn(),
      },
    })

    expect(wrapper.text()).toContain('No timecard export data was found.')
    expect(wrapper.find('[data-testid="timecard-export-print-document"]').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
