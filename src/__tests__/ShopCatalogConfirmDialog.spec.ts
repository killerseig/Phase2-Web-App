import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import ShopCatalogConfirmDialog from '@/components/shopCatalog/ShopCatalogConfirmDialog.vue'

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
  return mount(ShopCatalogConfirmDialog, {
    props: {
      busy: false,
      confirmLabel: 'Archive Item',
      destructive: true,
      message: 'Archive this shop catalog item?',
      open: true,
      title: 'Archive item?',
      ...overrides,
    },
    global: {
      stubs: {
        ConfirmDialog: confirmDialogStub,
      },
    },
  })
}

describe('ShopCatalogConfirmDialog', () => {
  it('renders dynamic confirmation copy and state', () => {
    const wrapper = mountDialog({
      busy: true,
    })

    expect(wrapper.text()).toContain('Archive item?')
    expect(wrapper.text()).toContain('Archive this shop catalog item?')
    expect(wrapper.text()).toContain('Archive Item')
    expect(wrapper.get('[data-testid="busy"]').text()).toBe('busy')
    expect(wrapper.get('[data-testid="destructive"]').text()).toBe('destructive')
    expect(wrapper.get('[data-testid="open"]').text()).toBe('open')
  })

  it('supports non-destructive confirmation state', () => {
    const wrapper = mountDialog({
      confirmLabel: 'Restore Folder',
      destructive: false,
      message: 'Restore this folder?',
      title: 'Restore folder?',
    })

    expect(wrapper.text()).toContain('Restore folder?')
    expect(wrapper.text()).toContain('Restore Folder')
    expect(wrapper.get('[data-testid="destructive"]').text()).toBe('safe')
  })

  it('forwards close and confirm events to the parent', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="close"]').trigger('click')
    await wrapper.get('[data-testid="confirm"]').trigger('click')

    expect(wrapper.emitted('updateOpen')).toEqual([[false]])
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
