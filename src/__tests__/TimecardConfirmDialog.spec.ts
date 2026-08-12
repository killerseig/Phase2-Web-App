import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import TimecardConfirmDialog from '@/components/timecards/TimecardConfirmDialog.vue'

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

function mountDialog(overrides = {}) {
  return mount(TimecardConfirmDialog, {
    props: {
      busy: false,
      confirmLabel: 'Submit Week',
      destructive: false,
      message: 'Submit this timecard week?',
      open: true,
      title: 'Submit timecards?',
      ...overrides,
    },
    global: {
      stubs: {
        ConfirmDialog: confirmDialogStub,
      },
    },
  })
}

describe('TimecardConfirmDialog', () => {
  it('renders dynamic timecard confirmation copy and state', () => {
    const wrapper = mountDialog({
      busy: true,
    })

    expect(wrapper.text()).toContain('Submit timecards?')
    expect(wrapper.text()).toContain('Submit this timecard week?')
    expect(wrapper.text()).toContain('Submit Week')
    expect(wrapper.get('[data-testid="busy"]').text()).toBe('busy')
    expect(wrapper.get('[data-testid="destructive"]').text()).toBe('safe')
    expect(wrapper.get('[data-testid="open"]').text()).toBe('open')
  })

  it('supports destructive confirmation state', () => {
    const wrapper = mountDialog({
      confirmLabel: 'Delete Card',
      destructive: true,
      message: 'Delete this timecard card?',
      title: 'Delete card?',
    })

    expect(wrapper.text()).toContain('Delete card?')
    expect(wrapper.text()).toContain('Delete Card')
    expect(wrapper.get('[data-testid="destructive"]').text()).toBe('destructive')
  })

  it('forwards close and confirm events to the parent', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="close"]').trigger('click')
    await wrapper.get('[data-testid="confirm"]').trigger('click')

    expect(wrapper.emitted('updateOpen')).toEqual([[false]])
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
