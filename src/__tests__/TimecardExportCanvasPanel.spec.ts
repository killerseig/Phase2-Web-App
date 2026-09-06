import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TimecardExportCanvasPanel from '@/components/timecards/TimecardExportCanvasPanel.vue'
import type { TimecardExportArchiveCardRecord } from '@/features/timecards/exportViewHelpers'

function makeCard(overrides: Partial<TimecardExportArchiveCardRecord> = {}): TimecardExportArchiveCardRecord {
  return {
    id: 'export-card-1',
    sourceType: 'employee',
    employeeId: 'employee-1',
    firstName: 'Chris',
    lastName: 'Larsen',
    fullName: 'Chris Larsen',
    employeeNumber: '513',
    occupation: 'Foreman',
    wageRate: 42.5,
    isContractor: false,
    sortIndex: 0,
    lines: [],
    footerJobOrGl: '',
    footerAccount: '',
    footerOffice: '',
    footerAmount: '',
    footerSecondJobOrGl: '',
    footerSecondAccount: '',
    footerSecondOffice: '',
    footerSecondAmount: '',
    notes: '',
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    totals: {
      hoursByDay: [0, 0, 0, 0, 0, 0],
      productionByDay: [0, 0, 0, 0, 0, 0],
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    archiveWeekId: 'week-1',
    archiveWeekStartDate: '2026-06-14',
    archiveWeekEndDate: '2026-06-20',
    archiveWeekStatus: 'draft',
    archiveJobId: 'job-1',
    archiveJobCode: '736',
    archiveJobName: 'Shop',
    archiveForemanName: 'CJ Blanchard',
    archiveBurden: 0.33,
    ...overrides,
  }
}

const cards = [
  makeCard(),
  makeCard({
    id: 'readonly-card',
    sourceType: 'custom',
    employeeId: null,
    fullName: 'Locked Employee',
    firstName: 'Locked',
    lastName: 'Employee',
    archiveWeekEndDate: '2026-06-27',
    archiveBurden: 0.4,
  }),
]

const CanvasStub = {
  name: 'TimecardCanvasPanel',
  props: [
    'cards',
    'loading',
    'emptyMessage',
    'selectedCardId',
    'isCardCompact',
    'getCardShellStyle',
    'getCardScaleStyle',
    'getCardDomId',
    'hasCardFooter',
  ],
  emits: ['select-card', 'toggle-card-compact', 'set-shell-element', 'set-content-element'],
  template: `
    <section
      data-testid="canvas"
      :data-loading="String(loading)"
      :data-empty-message="emptyMessage"
      :data-selected-card-id="selectedCardId"
    >
      <slot name="header" />
      <div
        v-for="card in cards"
        :key="card.id"
        :data-testid="'canvas-row-' + card.id"
        :data-dom-id="getCardDomId(card)"
        :data-shell-style="JSON.stringify(getCardShellStyle(card.id))"
        :data-scale-style="JSON.stringify(getCardScaleStyle(card.id))"
        :data-has-footer="String(hasCardFooter(card))"
        :data-compact="String(isCardCompact(card.id))"
      >
        <button type="button" :data-testid="'emit-select-' + card.id" @click="$emit('select-card', card.id)" />
        <button type="button" :data-testid="'emit-toggle-' + card.id" @click="$emit('toggle-card-compact', card.id)" />
        <button type="button" :data-testid="'emit-shell-' + card.id" @click="$emit('set-shell-element', card.id, null)" />
        <button type="button" :data-testid="'emit-content-' + card.id" @click="$emit('set-content-element', card.id, null)" />
        <slot name="itemActions" :card="card" />
        <slot name="card" :card="card" />
        <slot v-if="hasCardFooter(card)" name="footer" :card="card" />
      </div>
    </section>
  `,
}

const WorkbookStub = {
  name: 'TimecardWorkbookCard',
  props: [
    'card',
    'compact',
    'weekEndDate',
    'burden',
    'readOnly',
    'showEmployeeWage',
    'showCostValues',
  ],
  emits: ['changed'],
  template: `
    <button type="button" :data-testid="'workbook-' + card.id" @click="$emit('changed')">
      {{ card.fullName }}
    </button>
  `,
}

function mountPanel(overrides = {}) {
  return mount(TimecardExportCanvasPanel, {
    props: {
      cards,
      cardsLoading: false,
      weeksLoading: false,
      heading: 'Filtered Timecards',
      packageCountLabel: '2 packages',
      jobsLabel: '1 job',
      foremenLabel: '1 foreman',
      emptyMessage: 'No timecards match the current filters.',
      selectedCardId: 'export-card-1',
      canEditWeek: true,
      actionLoading: false,
      showEmployeeWage: true,
      showCostValues: true,
      isCardCompact: (cardId: string) => cardId === 'readonly-card',
      isCardEditable: (cardId: string) => cardId === 'export-card-1',
      isCardReadOnly: (cardId: string) => cardId !== 'export-card-1',
      getCardShellStyle: (cardId: string) => ({ minHeight: cardId === 'export-card-1' ? '100px' : '200px' }),
      getCardScaleStyle: (cardId: string) => ({ transform: cardId === 'export-card-1' ? 'scale(0.8)' : 'scale(1)' }),
      setCardShellElement: vi.fn(),
      setCardContentElement: vi.fn(),
      ...overrides,
    },
    global: {
      stubs: {
        TimecardCanvasPanel: CanvasStub,
        TimecardWorkbookCard: WorkbookStub,
      },
    },
  })
}

describe('TimecardExportCanvasPanel', () => {
  it('forwards canvas state and renders export header metadata', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('[data-testid="canvas"]').attributes()).toMatchObject({
      'data-loading': 'false',
      'data-empty-message': 'No timecards match the current filters.',
      'data-selected-card-id': 'export-card-1',
    })
    expect(wrapper.text()).toContain('Time Cards')
    expect(wrapper.text()).toContain('Filtered Timecards')
    expect(wrapper.text()).toContain('2 packages')
    expect(wrapper.text()).toContain('1 job')
    expect(wrapper.text()).toContain('1 foreman')
    expect(wrapper.get('[data-testid="canvas-row-export-card-1"]').attributes()).toMatchObject({
      'data-dom-id': 'timecard-export-card-export-card-1',
      'data-has-footer': 'true',
      'data-compact': 'false',
    })
    expect(wrapper.get('[data-testid="canvas-row-readonly-card"]').attributes()).toMatchObject({
      'data-dom-id': 'timecard-export-card-readonly-card',
      'data-has-footer': 'false',
      'data-compact': 'true',
    })
    expect(wrapper.get('[data-testid="timecard-card-source-export-card-1"]').text()).toBe('EMPLOYEE')
    expect(wrapper.get('[data-testid="timecard-card-source-readonly-card"]').text()).toBe('ONE-OFF')
  })

  it('combines loading flags before passing them to the shared canvas shell', () => {
    expect(mountPanel({ cardsLoading: true }).get('[data-testid="canvas"]').attributes('data-loading')).toBe(
      'true',
    )
    expect(mountPanel({ weeksLoading: true }).get('[data-testid="canvas"]').attributes('data-loading')).toBe(
      'true',
    )
  })

  it('renders edit-mode actions and forwards workbook props/events', async () => {
    const wrapper = mountPanel()
    const workbooks = wrapper.findAllComponents({ name: 'TimecardWorkbookCard' })

    expect(wrapper.get('[data-testid="canvas-row-export-card-1"]').text()).toContain('Lock Card')
    expect(wrapper.get('[data-testid="canvas-row-readonly-card"]').text()).toContain('Edit Card')
    expect(workbooks[0]?.props()).toMatchObject({
      card: cards[0],
      compact: false,
      weekEndDate: '2026-06-20',
      burden: 0.33,
      readOnly: false,
      showEmployeeWage: true,
      showCostValues: true,
    })
    expect(workbooks[1]?.props()).toMatchObject({
      compact: true,
      weekEndDate: '2026-06-27',
      burden: 0.4,
      readOnly: true,
    })

    await wrapper.get('[data-testid="emit-select-export-card-1"]').trigger('click')
    await wrapper.get('[data-testid="emit-toggle-export-card-1"]').trigger('click')
    await wrapper.get('[data-testid="workbook-export-card-1"]').trigger('click')
    await wrapper.get('.timecards-canvas__item-header-button--edit').trigger('click')
    await wrapper.get('.timecards-canvas__item-footer-button').trigger('click')

    expect(wrapper.emitted('selectCard')).toEqual([['export-card-1']])
    expect(wrapper.emitted('toggleCardCompact')).toEqual([['export-card-1']])
    expect(wrapper.emitted('workbookChanged')).toEqual([[cards[0]]])
    expect(wrapper.emitted('toggleCardEditMode')).toEqual([['export-card-1']])
    expect(wrapper.emitted('removeCard')).toEqual([[cards[0]]])
  })

  it('passes measurement events to the provided callback props', async () => {
    const setCardShellElement = vi.fn()
    const setCardContentElement = vi.fn()
    const wrapper = mountPanel({
      setCardShellElement,
      setCardContentElement,
    })

    await wrapper.get('[data-testid="emit-shell-export-card-1"]').trigger('click')
    await wrapper.get('[data-testid="emit-content-export-card-1"]').trigger('click')

    expect(setCardShellElement).toHaveBeenCalledWith('export-card-1', null)
    expect(setCardContentElement).toHaveBeenCalledWith('export-card-1', null)
  })

  it('hides edit and delete actions when the week cannot be edited', () => {
    const wrapper = mountPanel({ canEditWeek: false })

    expect(wrapper.find('.timecards-canvas__item-header-button--edit').exists()).toBe(false)
    expect(wrapper.find('.timecards-canvas__item-footer-button').exists()).toBe(false)
  })
})
