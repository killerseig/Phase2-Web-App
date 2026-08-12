import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogManpowerCard from '@/components/dailyLogs/DailyLogManpowerCard.vue'
import { DAILY_LOG_MANPOWER_COLUMNS } from '@/features/dailyLogs/schema'
import type { DailyLogManpowerLineRecord } from '@/types/domain'

const lines: DailyLogManpowerLineRecord[] = [
  {
    trade: 'Acoustical Carpenter',
    count: 4,
    areas: 'Level 2 west wing',
    addedByUserId: 'user-1',
  },
]

function mountManpowerCard(overrides: Partial<InstanceType<typeof DailyLogManpowerCard>['$props']> = {}) {
  return mount(DailyLogManpowerCard, {
    props: {
      columns: DAILY_LOG_MANPOWER_COLUMNS,
      disabled: false,
      lines,
      ...overrides,
    },
  })
}

describe('DailyLogManpowerCard', () => {
  it('renders the manpower table labels, values, and placeholders', () => {
    const wrapper = mountManpowerCard()
    const inputs = wrapper.findAll('input')
    const tradeInput = inputs[0]!
    const countInput = inputs[1]!
    const areasInput = inputs[2]!

    expect(wrapper.text()).toContain('Crew On Site')
    expect(wrapper.text()).toContain('Trade')
    expect(wrapper.text()).toContain('Count')
    expect(wrapper.text()).toContain('Areas')
    expect(tradeInput.element).toHaveProperty('value', 'Acoustical Carpenter')
    expect(tradeInput.attributes('placeholder')).toBe('e.g. Acoustical Carpenter')
    expect(countInput.element).toHaveProperty('value', '4')
    expect(countInput.attributes('type')).toBe('number')
    expect(countInput.attributes('min')).toBe('1')
    expect(countInput.attributes('step')).toBe('1')
    expect(countInput.attributes('inputmode')).toBe('numeric')
    expect(areasInput.element).toHaveProperty('value', 'Level 2 west wing')
    expect(areasInput.attributes('placeholder')).toBe('e.g. Level 2 west wing')
  })

  it('emits add, remove, and field update events while preserving numeric count conversion', async () => {
    const wrapper = mountManpowerCard()
    const inputs = wrapper.findAll('input')
    const tradeInput = inputs[0]!
    const countInput = inputs[1]!
    const areasInput = inputs[2]!

    await tradeInput.setValue('Drywall')
    await countInput.setValue('6')
    await countInput.setValue('')
    await areasInput.setValue('Level 3')
    await wrapper.get('button.daily-log-manpower-card__add').trigger('click')
    await wrapper.get('button.daily-log-manpower-card__remove').trigger('click')

    expect(wrapper.emitted('update-field')).toEqual([
      [{ index: 0, field: 'trade', value: 'Drywall' }],
      [{ index: 0, field: 'count', value: 6 }],
      [{ index: 0, field: 'count', value: '' }],
      [{ index: 0, field: 'areas', value: 'Level 3' }],
    ])
    expect(wrapper.emitted('add')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toEqual([[0]])
  })

  it('disables table inputs and row actions when the parent route is read-only', () => {
    const wrapper = mountManpowerCard({
      disabled: true,
    })

    for (const input of wrapper.findAll('input')) {
      expect(input.attributes('disabled')).toBeDefined()
    }

    expect(wrapper.get('button.daily-log-manpower-card__add').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button.daily-log-manpower-card__remove').attributes('disabled')).toBeDefined()
  })
})
