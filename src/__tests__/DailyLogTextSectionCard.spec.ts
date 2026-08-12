import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DailyLogTextSectionCard from '@/components/dailyLogs/DailyLogTextSectionCard.vue'
import type { DailyLogTextSectionSchema } from '@/features/dailyLogs/schema'

const section: DailyLogTextSectionSchema = {
  id: 'schedule-assessment',
  title: 'Schedule & Assessment',
  description: 'Track schedule notes.',
  fields: [
    {
      key: 'weeklySchedule',
      label: 'Weekly Schedule',
      rows: 4,
      placeholder: 'What is planned this week?',
    },
    {
      key: 'manpowerAssessment',
      label: 'Manpower Assessment',
      rows: 3,
    },
  ],
}

function mountTextSection(overrides = {}) {
  return mount(DailyLogTextSectionCard, {
    props: {
      disabled: false,
      eyebrow: 'Daily Notes',
      section,
      values: {
        weeklySchedule: 'Hang grid on level 2.',
      },
      ...overrides,
    },
  })
}

describe('DailyLogTextSectionCard', () => {
  it('renders section copy, labels, values, row counts, and placeholders', () => {
    const wrapper = mountTextSection()
    const weeklySchedule = wrapper.get<HTMLTextAreaElement>('[data-testid="dailylog-weeklySchedule"]')
    const manpowerAssessment = wrapper.get<HTMLTextAreaElement>('[data-testid="dailylog-manpowerAssessment"]')

    expect(wrapper.text()).toContain('Daily Notes')
    expect(wrapper.text()).toContain('Schedule & Assessment')
    expect(wrapper.text()).toContain('Weekly Schedule')
    expect(wrapper.text()).toContain('Manpower Assessment')
    expect(weeklySchedule.element.value).toBe('Hang grid on level 2.')
    expect(weeklySchedule.attributes('rows')).toBe('4')
    expect(weeklySchedule.attributes('placeholder')).toBe('What is planned this week?')
    expect(manpowerAssessment.element.value).toBe('')
    expect(manpowerAssessment.attributes('rows')).toBe('3')
  })

  it('emits field updates and blur events with the field key', async () => {
    const wrapper = mountTextSection()
    const weeklySchedule = wrapper.get<HTMLTextAreaElement>('[data-testid="dailylog-weeklySchedule"]')

    await weeklySchedule.setValue('Frame soffits on level 3.')
    await weeklySchedule.trigger('blur')

    expect(wrapper.emitted('update-field')).toEqual([
      ['weeklySchedule', 'Frame soffits on level 3.'],
    ])
    expect(wrapper.emitted('blur-field')).toEqual([
      ['weeklySchedule'],
    ])
  })

  it('passes disabled state to every textarea', () => {
    const wrapper = mountTextSection({ disabled: true })

    for (const textarea of wrapper.findAll('textarea')) {
      expect(textarea.attributes('disabled')).toBeDefined()
    }
  })
})
