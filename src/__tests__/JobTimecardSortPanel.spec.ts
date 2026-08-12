import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardSortPanel from '@/components/timecards/JobTimecardSortPanel.vue'

const SortModePickerStub = {
  props: ['modelValue', 'name'],
  emits: ['update:modelValue'],
  template: `
    <div data-testid="sort-picker">
      <label>
        <input
          type="radio"
          :name="name"
          value="number"
          :checked="modelValue === 'number'"
          @change="$emit('update:modelValue', 'number')"
        />
        Employee#
      </label>
      <label>
        <input
          type="radio"
          :name="name"
          value="name"
          :checked="modelValue === 'name'"
          @change="$emit('update:modelValue', 'name')"
        />
        Name
      </label>
    </div>
  `,
}

function mountPanel(overrides = {}) {
  return mount(JobTimecardSortPanel, {
    props: {
      sortMode: 'name',
      actionLoading: false,
      canEditWeek: true,
      cardCount: 3,
      mobileActive: true,
      ...overrides,
    },
    global: {
      stubs: {
        TimecardSortModePicker: SortModePickerStub,
      },
    },
  })
}

describe('JobTimecardSortPanel', () => {
  it('renders sort panel copy and forwards the selected sort mode', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('legend').text()).toBe('Sort Cards')
    expect(wrapper.get('input[value="name"]').attributes('checked')).toBeDefined()
    expect(wrapper.get('button').text()).toBe('Sort Cards')
  })

  it('emits sort mode and sort action events', async () => {
    const wrapper = mountPanel()

    await wrapper.get('input[value="number"]').setValue()
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('updateSortMode')?.[0]).toEqual(['number'])
    expect(wrapper.emitted('sortCards')).toHaveLength(1)
  })

  it('disables the sort action while loading, read-only, or fewer than two cards', () => {
    expect(mountPanel({ actionLoading: true }).get('button').attributes('disabled')).toBeDefined()
    expect(mountPanel({ canEditWeek: false }).get('button').attributes('disabled')).toBeDefined()
    expect(mountPanel({ cardCount: 1 }).get('button').attributes('disabled')).toBeDefined()
  })
})
