import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopOrderConfirmDialogs from '@/components/shopOrders/ShopOrderConfirmDialogs.vue'

function mountDialogs(overrides = {}) {
  return mount(ShopOrderConfirmDialogs, {
    props: {
      busy: false,
      deleteDraftOpen: true,
      removeItemMessage: 'Remove "AHA Book" from this order?',
      removeItemOpen: true,
      submitOpen: true,
      ...overrides,
    },
    global: {
      stubs: {
        ConfirmDialog: {
          props: [
            'busy',
            'confirmLabel',
            'destructive',
            'message',
            'open',
            'title',
          ],
          emits: ['confirm', 'update:open'],
          template: `
            <section
              v-if="open"
              role="dialog"
              :aria-label="title"
              :data-busy="String(Boolean(busy))"
              :data-destructive="String(destructive !== false && destructive !== undefined && destructive !== null)"
            >
              <p>{{ message }}</p>
              <button type="button" @click="$emit('update:open', false)">Close</button>
              <button type="button" @click="$emit('confirm')">{{ confirmLabel }}</button>
            </section>
          `,
        },
      },
    },
  })
}

describe('ShopOrderConfirmDialogs', () => {
  it('renders the three shop-order confirmation dialogs with existing copy', () => {
    const wrapper = mountDialogs()

    expect(wrapper.get('[aria-label="Remove item?"]').text()).toContain('Remove "AHA Book" from this order?')
    expect(wrapper.get('[aria-label="Remove item?"]').text()).toContain('Remove Item')
    expect(wrapper.get('[aria-label="Delete draft?"]').text()).toContain('Delete this draft shop order?')
    expect(wrapper.get('[aria-label="Delete draft?"]').text()).toContain('Delete Draft')
    expect(wrapper.get('[aria-label="Submit shop order?"]').text()).toContain(
      'Submit this shop order? The order will become read-only.',
    )
    expect(wrapper.get('[aria-label="Submit shop order?"]').text()).toContain('Submit Order')
  })

  it('forwards close updates and confirm events to the parent-owned workflow state', async () => {
    const wrapper = mountDialogs()
    const removeDialog = wrapper.get('[aria-label="Remove item?"]')
    const deleteDialog = wrapper.get('[aria-label="Delete draft?"]')
    const submitDialog = wrapper.get('[aria-label="Submit shop order?"]')
    const removeButtons = removeDialog.findAll('button')
    const deleteButtons = deleteDialog.findAll('button')
    const submitButtons = submitDialog.findAll('button')

    if (!removeButtons[0] || !removeButtons[1]) throw new Error('Expected remove dialog buttons to render')
    if (!deleteButtons[0] || !deleteButtons[1]) throw new Error('Expected delete dialog buttons to render')
    if (!submitButtons[0] || !submitButtons[1]) throw new Error('Expected submit dialog buttons to render')

    await removeButtons[0].trigger('click')
    await deleteButtons[0].trigger('click')
    await submitButtons[0].trigger('click')
    await removeButtons[1].trigger('click')
    await deleteButtons[1].trigger('click')
    await submitButtons[1].trigger('click')

    expect(wrapper.emitted('update:removeItemOpen')).toEqual([[false]])
    expect(wrapper.emitted('update:deleteDraftOpen')).toEqual([[false]])
    expect(wrapper.emitted('update:submitOpen')).toEqual([[false]])
    expect(wrapper.emitted('confirmRemoveItem')).toEqual([[]])
    expect(wrapper.emitted('confirmDeleteDraft')).toEqual([[]])
    expect(wrapper.emitted('confirmSubmitOrder')).toEqual([[]])
  })

  it('passes shared busy state and destructive intent to the underlying dialogs', () => {
    const wrapper = mountDialogs({ busy: true })

    expect(wrapper.get('[aria-label="Remove item?"]').attributes('data-busy')).toBe('true')
    expect(wrapper.get('[aria-label="Delete draft?"]').attributes('data-busy')).toBe('true')
    expect(wrapper.get('[aria-label="Submit shop order?"]').attributes('data-busy')).toBe('true')
    expect(wrapper.get('[aria-label="Remove item?"]').attributes('data-destructive')).toBe('true')
    expect(wrapper.get('[aria-label="Delete draft?"]').attributes('data-destructive')).toBe('true')
    expect(wrapper.get('[aria-label="Submit shop order?"]').attributes('data-destructive')).toBe('false')
  })
})
