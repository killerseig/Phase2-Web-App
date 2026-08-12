import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardSummaryPanel from '@/components/timecards/TimecardSummaryPanel.vue'

function getRequiredItem<T>(items: T[], index: number): T {
  const item = items[index]
  if (!item) {
    throw new Error(`Missing test item at index ${index}`)
  }
  return item
}

function mountSummary(overrides = {}) {
  return mount(TimecardSummaryPanel, {
    props: {
      cardCount: 3,
      totalHours: 46,
      totalProduction: 1527.667,
      accountsSummary: [
        {
          key: '736-133-513',
          jobNumber: '736',
          subsectionArea: 'Field',
          account: '133/513',
          hoursTotal: 36,
          productionTotal: 1527.667,
        },
        {
          key: 'missing-values',
          jobNumber: '',
          subsectionArea: '',
          account: '',
          hoursTotal: 10,
          productionTotal: 0,
        },
      ],
      ...overrides,
    },
  })
}

describe('TimecardSummaryPanel', () => {
  it('renders total cards, hours, and production with one-decimal formatting', () => {
    const wrapper = mountSummary()

    expect(wrapper.get('.timecard-summary__eyebrow').text()).toBe('Current Results')
    expect(wrapper.get('h2').text()).toBe('Totals')
    expect(wrapper.text()).toContain('Cards')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('Total Hours')
    expect(wrapper.text()).toContain('46.0')
    expect(wrapper.text()).toContain('Production')
    expect(wrapper.text()).toContain('1527.7')
  })

  it('renders account summary rows and uses dashes for missing labels', () => {
    const wrapper = mountSummary()
    const rows = wrapper.findAll('tbody tr')

    expect(wrapper.findAll('thead th').map((header) => header.text())).toEqual([
      'Job Number',
      'Area',
      'Account',
      'Total Hours',
      'Production',
    ])
    expect(rows).toHaveLength(2)
    const firstRow = getRequiredItem(rows, 0)
    const secondRow = getRequiredItem(rows, 1)

    expect(firstRow.findAll('td').map((cell) => cell.text())).toEqual([
      '736',
      'Field',
      '133/513',
      '36.0',
      '1527.7',
    ])
    expect(secondRow.findAll('td').map((cell) => cell.text())).toEqual([
      '-',
      '-',
      '-',
      '10.0',
      '0.0',
    ])
  })

  it('renders an empty account-total row when there are no summaries yet', () => {
    const wrapper = mountSummary({
      cardCount: 0,
      totalHours: 0,
      totalProduction: 0,
      accountsSummary: [],
    })
    const emptyCell = wrapper.get('.timecard-summary__empty')

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(emptyCell.text()).toBe('No account totals yet.')
    expect(emptyCell.attributes('colspan')).toBe('5')
  })
})
