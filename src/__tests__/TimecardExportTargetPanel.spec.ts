import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportTargetPanel from '@/components/timecards/TimecardExportTargetPanel.vue'

const SelectStub = {
  props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder', 'disabled'],
  emits: ['update:modelValue'],
  template: `
    <select
      :disabled="disabled"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option value="">{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.id"
        :value="option.id"
      >
        {{ option.label }}
      </option>
    </select>
  `,
}

function mountPanel(overrides = {}) {
  return mount(TimecardExportTargetPanel, {
    props: {
      jobId: 'job-1',
      jobOptions: [
        { id: 'job-1', label: 'Shop (#736)' },
        { id: 'job-2', label: 'Lucky 3 Ranch (#5229)' },
      ],
      foremanId: 'foreman-1',
      foremanOptions: [
        { id: 'foreman-1', label: 'CJ Blanchard' },
        { id: 'foreman-2', label: 'Vince Hintz' },
      ],
      targetWeekExists: false,
      ...overrides,
    },
    global: {
      stubs: {
        Select: SelectStub,
      },
    },
  })
}

describe('TimecardExportTargetPanel', () => {
  it('renders the week target copy and selected job/foreman values', () => {
    const wrapper = mountPanel()
    const selects = wrapper.findAll('select')

    expect(wrapper.get('legend').text()).toBe('Week Target')
    expect(wrapper.text()).toContain('Pick The Job And Foreman')
    expect((selects[0]!.element as HTMLSelectElement).value).toBe('job-1')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('foreman-1')
    expect(wrapper.text()).toContain('New export cards use this job and foreman target.')
  })

  it('emits target updates from the job and foreman controls', async () => {
    const wrapper = mountPanel()
    const selects = wrapper.findAll('select')

    await selects[0]!.setValue('job-2')
    await selects[1]!.setValue('foreman-2')

    expect(wrapper.emitted('updateJobId')?.[0]).toEqual(['job-2'])
    expect(wrapper.emitted('updateForemanId')?.[0]).toEqual(['foreman-2'])
  })

  it('warns and disables foreman selection when a new target week has no assigned foremen', () => {
    const wrapper = mountPanel({
      foremanId: '',
      foremanOptions: [],
      targetWeekExists: false,
    })
    const selects = wrapper.findAll('select')

    expect(wrapper.text()).toContain('No foremen are assigned to this job.')
    expect(selects[1]!.attributes('disabled')).toBeDefined()
  })

  it('does not warn for an existing target week without assigned foremen', () => {
    const wrapper = mountPanel({
      foremanId: '',
      foremanOptions: [],
      targetWeekExists: true,
    })

    expect(wrapper.text()).not.toContain('No foremen are assigned to this job.')
  })
})
