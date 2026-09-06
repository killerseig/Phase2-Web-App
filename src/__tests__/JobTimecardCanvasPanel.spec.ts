import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardCanvasPanel from '@/components/timecards/JobTimecardCanvasPanel.vue'
import type { TimecardCardRecord } from '@/types/domain'

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  return {
    id: 'card-1',
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
    ...overrides,
  }
}

const cards = [
  makeCard(),
  makeCard({
    id: 'custom-card',
    sourceType: 'custom',
    fullName: 'Custom Employee',
    firstName: 'Custom',
    lastName: 'Employee',
    employeeNumber: '0000',
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
    'getCardTestId',
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
        :data-card-test-id="getCardTestId(card)"
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
  ],
  emits: ['changed'],
  template: `
    <button type="button" :data-testid="'workbook-' + card.id" @click="$emit('changed')">
      {{ card.fullName }}
    </button>
  `,
}

function mountPanel(overrides = {}) {
  return mount(JobTimecardCanvasPanel, {
    props: {
      cards,
      cardsLoading: false,
      ensuringWeek: false,
      selectedWeekEndDate: '2026-06-20',
      selectedCardId: 'custom-card',
      emptyMessage: 'No timecards were saved for this week.',
      burden: 0.33,
      canEditWeek: true,
      actionLoading: false,
      isCardCompact: (cardId: string) => cardId === 'card-1',
      isCardReadOnly: (cardId: string) => cardId === 'readonly-card',
      getCardShellStyle: (cardId: string) => ({ minHeight: cardId === 'card-1' ? '100px' : '200px' }),
      getCardScaleStyle: (cardId: string) => ({ transform: cardId === 'card-1' ? 'scale(0.8)' : 'scale(1)' }),
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

describe('JobTimecardCanvasPanel', () => {
  it('forwards canvas state and renders job header metadata', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('[data-testid="canvas"]').attributes()).toMatchObject({
      'data-loading': 'false',
      'data-empty-message': 'No timecards were saved for this week.',
      'data-selected-card-id': 'custom-card',
    })
    expect(wrapper.text()).toContain('Time Cards')
    expect(wrapper.text()).toContain('6/20/2026')
    expect(wrapper.text()).toContain('2 Visible')
    expect(wrapper.get('[data-testid="canvas-row-card-1"]').attributes()).toMatchObject({
      'data-dom-id': 'timecard-card-card-1',
      'data-card-test-id': 'timecards-card-card-1',
      'data-has-footer': 'false',
      'data-compact': 'true',
    })
    expect(wrapper.get('[data-testid="canvas-row-custom-card"]').attributes()).toMatchObject({
      'data-has-footer': 'true',
      'data-compact': 'false',
    })
    expect(wrapper.get('[data-testid="timecard-card-source-card-1"]').text()).toBe('EMPLOYEE')
    expect(wrapper.get('[data-testid="timecard-card-source-custom-card"]').text()).toBe('ONE-OFF')
  })

  it('combines loading flags before passing them to the shared canvas shell', () => {
    expect(mountPanel({ cardsLoading: true }).get('[data-testid="canvas"]').attributes('data-loading')).toBe(
      'true',
    )
    expect(mountPanel({ ensuringWeek: true }).get('[data-testid="canvas"]').attributes('data-loading')).toBe(
      'true',
    )
  })

  it('forwards workbook props and emits workbook/remove/canvas events', async () => {
    const wrapper = mountPanel()
    const employeeWorkbook = wrapper.getComponent({ name: 'TimecardWorkbookCard' })

    expect(employeeWorkbook.props()).toMatchObject({
      card: cards[0],
      compact: true,
      weekEndDate: '2026-06-20',
      burden: 0.33,
      readOnly: false,
      showEmployeeWage: true,
    })

    await wrapper.get('[data-testid="emit-select-card-1"]').trigger('click')
    await wrapper.get('[data-testid="emit-toggle-card-1"]').trigger('click')
    await wrapper.get('[data-testid="emit-shell-card-1"]').trigger('click')
    await wrapper.get('[data-testid="emit-content-card-1"]').trigger('click')
    await wrapper.get('[data-testid="workbook-card-1"]').trigger('click')
    await wrapper.get('.timecards-canvas__item-footer-button').trigger('click')

    expect(wrapper.emitted('selectCard')).toEqual([['card-1']])
    expect(wrapper.emitted('toggleCardCompact')).toEqual([['card-1']])
    expect(wrapper.emitted('setShellElement')).toEqual([['card-1', null]])
    expect(wrapper.emitted('setContentElement')).toEqual([['card-1', null]])
    expect(wrapper.emitted('workbookChanged')).toEqual([[cards[0]]])
    expect(wrapper.emitted('removeCard')).toEqual([[cards[1]]])
  })

})
