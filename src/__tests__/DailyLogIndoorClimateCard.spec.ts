import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogIndoorClimateCard from '@/components/dailyLogs/DailyLogIndoorClimateCard.vue'
import { DAILY_LOG_INDOOR_CLIMATE_COLUMNS } from '@/features/dailyLogs/schema'
import type { DailyLogIndoorClimateReadingRecord } from '@/types/domain'

const readings: DailyLogIndoorClimateReadingRecord[] = [
  {
    area: 'Level 2',
    high: '72',
    low: '68',
    humidity: '30%',
  },
]

function mountClimateCard(overrides: Partial<InstanceType<typeof DailyLogIndoorClimateCard>['$props']> = {}) {
  return mount(DailyLogIndoorClimateCard, {
    props: {
      columns: DAILY_LOG_INDOOR_CLIMATE_COLUMNS,
      disabled: false,
      readings,
      ...overrides,
    },
  })
}

describe('DailyLogIndoorClimateCard', () => {
  it('renders the indoor-climate table labels, values, and placeholders', () => {
    const wrapper = mountClimateCard()
    const inputs = wrapper.findAll('input')
    const areaInput = inputs[0]!
    const highInput = inputs[1]!
    const lowInput = inputs[2]!
    const humidityInput = inputs[3]!

    expect(wrapper.text()).toContain('Indoor Temperature Readings')
    expect(wrapper.text()).toContain('Floor / Area')
    expect(wrapper.text()).toContain('High (degF)')
    expect(wrapper.text()).toContain('Low (degF)')
    expect(wrapper.text()).toContain('Humidity (%)')
    expect(areaInput.element).toHaveProperty('value', 'Level 2')
    expect(areaInput.attributes('placeholder')).toBe('e.g. Level 2')
    expect(highInput.element).toHaveProperty('value', '72')
    expect(highInput.attributes('placeholder')).toBe('High')
    expect(lowInput.element).toHaveProperty('value', '68')
    expect(lowInput.attributes('placeholder')).toBe('Low')
    expect(humidityInput.element).toHaveProperty('value', '30%')
    expect(humidityInput.attributes('placeholder')).toBe('Humidity')
  })

  it('emits add, remove, and field update events', async () => {
    const wrapper = mountClimateCard()
    const inputs = wrapper.findAll('input')
    const areaInput = inputs[0]!
    const highInput = inputs[1]!
    const lowInput = inputs[2]!
    const humidityInput = inputs[3]!

    await areaInput.setValue('Level 3')
    await highInput.setValue('75')
    await lowInput.setValue('65')
    await humidityInput.setValue('35%')
    await wrapper.get('button.daily-log-climate-card__add').trigger('click')
    await wrapper.get('button.daily-log-climate-card__remove').trigger('click')

    expect(wrapper.emitted('update-field')).toEqual([
      [{ index: 0, field: 'area', value: 'Level 3' }],
      [{ index: 0, field: 'high', value: '75' }],
      [{ index: 0, field: 'low', value: '65' }],
      [{ index: 0, field: 'humidity', value: '35%' }],
    ])
    expect(wrapper.emitted('add')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toEqual([[0]])
  })

  it('disables table inputs and row actions when the parent route is read-only', () => {
    const wrapper = mountClimateCard({
      disabled: true,
    })

    for (const input of wrapper.findAll('input')) {
      expect(input.attributes('disabled')).toBeDefined()
    }

    expect(wrapper.get('button.daily-log-climate-card__add').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button.daily-log-climate-card__remove').attributes('disabled')).toBeDefined()
  })
})
