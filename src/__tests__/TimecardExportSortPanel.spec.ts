import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportSortPanel from '@/components/timecards/TimecardExportSortPanel.vue'

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

const SearchInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: `
    <input
      type="search"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
}

function mountPanel(overrides = {}) {
  return mount(TimecardExportSortPanel, {
    props: {
      sortMode: 'name',
      cardSearch: 'cj',
      mobileActive: true,
      ...overrides,
    },
    global: {
      stubs: {
        TimecardSortModePicker: SortModePickerStub,
        AppSearchInput: SearchInputStub,
      },
    },
  })
}

describe('TimecardExportSortPanel', () => {
  it('renders sort panel copy and forwards values to child controls', () => {
    const wrapper = mountPanel()

    expect(wrapper.get('legend').text()).toBe('Sort Cards')
    expect(wrapper.text()).toContain('Employee Search')
    expect(wrapper.get('input[value="name"]').attributes('checked')).toBeDefined()
    expect((wrapper.get('input[type="search"]').element as HTMLInputElement).value).toBe('cj')
  })

  it('emits sort mode and card search updates', async () => {
    const wrapper = mountPanel()

    await wrapper.get('input[value="number"]').setValue()
    await wrapper.get('input[type="search"]').setValue('vince')

    expect(wrapper.emitted('updateSortMode')?.[0]).toEqual(['number'])
    expect(wrapper.emitted('updateCardSearch')?.[0]).toEqual(['vince'])
  })
})
