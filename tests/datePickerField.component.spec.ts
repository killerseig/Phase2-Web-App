import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createDatePickerConfig } from '@/utils/dateInputs'
import DatePickerField from '@/components/common/DatePickerField.vue'

const { openSpy } = vi.hoisted(() => ({
  openSpy: vi.fn(),
}))

vi.mock('vue-flatpickr-component', () => ({
  default: defineComponent({
    name: 'FlatPickrStub',
    props: {
      modelValue: {
        type: String,
        default: '',
      },
      placeholder: {
        type: String,
        default: '',
      },
      inputAriaLabel: {
        type: String,
        default: '',
      },
      disabled: {
        type: Boolean,
        default: false,
      },
    },
    emits: ['update:modelValue', 'on-change', 'focus'],
    setup(props, { emit, expose }) {
      expose({
        fp: {
          open: openSpy,
        },
      })

      return () => h('input', {
        value: props.modelValue,
        placeholder: props.placeholder,
        'aria-label': props.inputAriaLabel,
        disabled: props.disabled,
        onChange: () => emit('on-change', [new Date(2026, 2, 18)]),
        onFocus: () => emit('focus'),
      })
    },
  }),
}))

describe('DatePickerField', () => {
  it('emits normalized date values from flatpickr selections', async () => {
    const wrapper = mount(DatePickerField, {
      props: {
        modelValue: '2026-03-14',
        config: createDatePickerConfig(),
        inputAriaLabel: 'Select date',
      },
    })

    await wrapper.get('input').trigger('change')

    const emittedUpdates = wrapper.emitted('update:modelValue') ?? []
    expect(emittedUpdates[emittedUpdates.length - 1]).toEqual(['2026-03-18'])
    expect(wrapper.emitted('change')).toEqual([['2026-03-18']])
  })

  it('opens the picker on focus and button click when enabled', async () => {
    openSpy.mockClear()

    const wrapper = mount(DatePickerField, {
      props: {
        modelValue: '2026-03-14',
        config: createDatePickerConfig(),
        inputAriaLabel: 'Select date',
        label: 'Week',
        prependIcon: 'bi bi-calendar-date',
        showOpenButton: true,
        openOnFocus: true,
      },
    })

    await wrapper.get('input').trigger('focus')
    await wrapper.get('button').trigger('click')

    expect(wrapper.text()).toContain('Week')
    expect(wrapper.find('.input-group-text i.bi.bi-calendar-date').exists()).toBe(true)
    expect(openSpy).toHaveBeenCalledTimes(2)
  })
})
