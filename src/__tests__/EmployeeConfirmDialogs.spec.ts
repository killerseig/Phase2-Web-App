import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import EmployeeConfirmDialogs from '@/components/employees/EmployeeConfirmDialogs.vue'

const confirmDialogStub = defineComponent({
  props: {
    busy: Boolean,
    confirmLabel: String,
    destructive: Boolean,
    message: String,
    open: Boolean,
    title: String,
  },
  emits: ['confirm', 'update:open'],
  template: `
    <section data-testid="confirm-dialog">
      <h2>{{ title }}</h2>
      <p>{{ message }}</p>
      <span>{{ confirmLabel }}</span>
      <span data-testid="busy">{{ busy ? 'busy' : 'idle' }}</span>
      <span data-testid="destructive">{{ destructive ? 'destructive' : 'safe' }}</span>
      <span data-testid="open">{{ open ? 'open' : 'closed' }}</span>
      <button type="button" data-testid="close" @click="$emit('update:open', false)">Close</button>
      <button type="button" data-testid="confirm" @click="$emit('confirm')">Confirm</button>
    </section>
  `,
})

function mountDialogs(overrides = {}) {
  return mount(EmployeeConfirmDialogs, {
    props: {
      deleteBusy: false,
      deleteMessage: 'Delete CJ Blanchard from the employee directory?',
      deleteOpen: true,
      ...overrides,
    },
    global: {
      stubs: {
        ConfirmDialog: confirmDialogStub,
      },
    },
  })
}

describe('EmployeeConfirmDialogs', () => {
  it('renders delete-employee copy and destructive busy state', () => {
    const wrapper = mountDialogs({
      deleteBusy: true,
    })

    expect(wrapper.text()).toContain('Delete employee?')
    expect(wrapper.text()).toContain('Delete CJ Blanchard from the employee directory?')
    expect(wrapper.text()).toContain('Delete Employee')
    expect(wrapper.get('[data-testid="busy"]').text()).toBe('busy')
    expect(wrapper.get('[data-testid="destructive"]').text()).toBe('destructive')
    expect(wrapper.get('[data-testid="open"]').text()).toBe('open')
  })

  it('forwards close and confirm events to the parent', async () => {
    const wrapper = mountDialogs()

    await wrapper.get('[data-testid="close"]').trigger('click')
    await wrapper.get('[data-testid="confirm"]').trigger('click')

    expect(wrapper.emitted('updateDeleteOpen')).toEqual([[false]])
    expect(wrapper.emitted('confirmDelete')).toHaveLength(1)
  })
})
