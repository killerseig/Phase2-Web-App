import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'

import ConfirmDialog from '@/components/ConfirmDialog.vue'

function mountDialog(overrides = {}) {
  return mount(ConfirmDialog, {
    attachTo: document.body,
    props: {
      message: 'This action cannot be undone.',
      open: true,
      title: 'Delete record?',
      ...overrides,
    },
  })
}

function unmountDialog(wrapper: VueWrapper) {
  wrapper.unmount()
  document.body.innerHTML = ''
}

function getBodyElement<T extends HTMLElement>(selector: string) {
  const element = document.body.querySelector<T>(selector)
  if (!element) throw new Error(`Expected ${selector} to render`)
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ConfirmDialog', () => {
  it('renders the open dialog with accessible title, message, and default actions', () => {
    const wrapper = mountDialog()

    const dialog = document.body.querySelector('[role="dialog"]')
    const buttons = document.body.querySelectorAll('button')

    expect(dialog?.getAttribute('aria-label')).toBe('Delete record?')
    expect(document.body.textContent).toContain('Delete record?')
    expect(document.body.textContent).toContain('This action cannot be undone.')
    expect(buttons[1]?.textContent?.trim()).toBe('Cancel')
    expect(buttons[2]?.textContent?.trim()).toBe('Confirm')

    unmountDialog(wrapper)
  })

  it('does not render the dialog when closed', () => {
    const wrapper = mountDialog({ open: false })

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()

    unmountDialog(wrapper)
  })

  it('emits cancel and closes from cancel controls and escape', async () => {
    const wrapper = mountDialog({ cancelLabel: 'Keep it' })

    getBodyElement<HTMLButtonElement>('.confirm-dialog__actions .app-button').click()
    await nextTick()
    await wrapper.setProps({ open: true })
    getBodyElement('.confirm-dialog').dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    }))
    await nextTick()

    expect(wrapper.emitted('update:open')).toEqual([[false], [false]])
    expect(wrapper.emitted('cancel')).toEqual([[], []])

    unmountDialog(wrapper)
  })

  it('emits confirm from the primary action and supports destructive styling', async () => {
    const wrapper = mountDialog({
      confirmLabel: 'Delete',
      destructive: true,
    })

    const confirmButton = document.body.querySelectorAll<HTMLButtonElement>('.confirm-dialog__actions .app-button')[1]
    if (!confirmButton) throw new Error('Expected confirm button to render')

    expect(Array.from(confirmButton.classList)).toContain('app-button--danger')
    confirmButton.click()
    await nextTick()

    expect(wrapper.emitted('confirm')).toEqual([[]])
    expect(wrapper.emitted('update:open')).toBeUndefined()

    unmountDialog(wrapper)
  })

  it('locks all actions while busy', async () => {
    const wrapper = mountDialog({ busy: true })
    const actionButtons = document.body.querySelectorAll<HTMLButtonElement>('.confirm-dialog__actions .app-button')

    expect(document.body.textContent).toContain('Working...')
    expect(getBodyElement<HTMLButtonElement>('.confirm-dialog__backdrop').disabled).toBe(true)
    expect(actionButtons[0]?.disabled).toBe(true)
    expect(actionButtons[1]?.disabled).toBe(true)

    getBodyElement<HTMLButtonElement>('.confirm-dialog__backdrop').click()
    getBodyElement('.confirm-dialog').dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    }))
    actionButtons[1]?.click()
    await nextTick()

    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.emitted('confirm')).toBeUndefined()

    unmountDialog(wrapper)
  })
})
