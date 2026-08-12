import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import UserConfirmDialogs from '@/components/users/UserConfirmDialogs.vue'

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
  return mount(UserConfirmDialogs, {
    props: {
      deleteBusy: false,
      deleteMessage: 'Delete Chris Larsen? This removes the user from Auth and Firestore.',
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

describe('UserConfirmDialogs', () => {
  it('renders delete-user copy and destructive busy state', () => {
    const wrapper = mountDialogs({
      deleteBusy: true,
    })

    expect(wrapper.text()).toContain('Delete user?')
    expect(wrapper.text()).toContain('Delete Chris Larsen?')
    expect(wrapper.text()).toContain('Delete User')
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
