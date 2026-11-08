import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { defineComponent, reactive, ref } from 'vue'
import PrimeVue from 'primevue/config'
import { emptyLibrary, newField, newTemplate, type FormTemplate } from '@/features/forms/model'
import { saveLibrary } from '@/features/forms/localLibrary'

const { ask } = vi.hoisted(() => ({ ask: vi.fn<() => Promise<boolean>>() }))
const account = reactive({ currentUser: { uid: 'field-admin' }, rawRole: 'admin', hasWorkspaceAccess: true })
vi.mock('@/services/forms', () => ({ formApi: vi.fn<() => Promise<unknown>>(), isFormServerEnabled: () => false, isFormEmulatorEnabled: () => false }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => account }))
vi.mock('@/layouts/AppShell.vue', () => ({ default: { template: '<main><slot :openNavigation="() => {}" :mobileNavOpen="false" /></main>' } }))
vi.mock('@/features/intranet/usePrivateReferences', () => ({ usePrivateReferences: () => ({ content: ref(), packages: ref([]), selectedPackage: ref(''), loading: ref(false), error: ref(''), notice: ref(''), selectSource: vi.fn<(id: string) => void>(), reload: vi.fn<() => void>() }) }))
import FormBuilderView from './FormBuilderView.vue'

let wrapper: VueWrapper | undefined
const button = (label: string) => wrapper!.findAll('button').find(item => item.attributes('aria-label') === label || item.text() === label)!
const rows = () => wrapper!.findAll('.field-row')
const rowIds = () => rows().map(row => row.attributes('data-widget-id'))
function template() {
  const form = newTemplate()
  form.title = 'Field fixture'; form.fields = [newField('text', 'First'), newField('number', 'Second')]
  return form
}
async function render(forms: FormTemplate[] = [template()]) {
  saveLibrary(localStorage, 'field-admin', { ...emptyLibrary(), templates: forms })
  const dialog = defineComponent({ setup(_props, { expose }) { expose({ ask, cancel: vi.fn<() => void>() }); return () => null } })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/forms', component: FormBuilderView }] })
  await router.push('/admin/forms'); await router.isReady()
  wrapper = mount(RouterView, { global: { plugins: [router, PrimeVue], stubs: { BuilderConfirmDialog: dialog } } })
  await flushPromises()
  await wrapper.get('[data-template-id="' + forms[0]!.id + '"] .library-target').trigger('click')
  await flushPromises()
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  ask.mockReset(); ask.mockResolvedValue(false)
  account.currentUser = { uid: 'field-admin' }; account.rawRole = 'admin'; account.hasWorkspaceAccess = true
  localStorage.clear()
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals(); localStorage.clear() })

describe('Form Builder selected field commands', () => {
  it('copies and repeatedly pastes distinct fields; duplicate/reorder undo restores selection', async () => {
    await render()
    const original = rowIds()
    await rows()[0]!.trigger('keydown', { key: 'c', ctrlKey: true })
    await rows()[0]!.trigger('keydown', { key: 'v', ctrlKey: true })
    expect(rows()).toHaveLength(3)
    const firstPaste = rowIds()[1]
    await rows()[1]!.trigger('keydown', { key: 'v', metaKey: true })
    expect(rows()).toHaveLength(4)
    expect(new Set(rowIds()).size).toBe(4)
    await button('Undo').trigger('click')
    expect(rowIds()).toEqual([original[0], firstPaste, original[1]])
    expect(wrapper!.get('.field-row.selected').attributes('data-widget-id')).toBe(firstPaste)
    await rows()[1]!.trigger('keydown', { key: 'ArrowUp', altKey: true })
    expect(rowIds()).toEqual([firstPaste, ...original])
    await button('Undo').trigger('click')
    expect(rowIds()).toEqual([original[0], firstPaste, original[1]])
    await button('Duplicate selected field').trigger('click')
    expect(rows()).toHaveLength(4)
    expect(new Set(rowIds()).size).toBe(4)
  })

  it('ignores typing, composition, handled events, unsupported modifiers and preview mode', async () => {
    await render()
    await wrapper!.get('input[maxlength="1000"]').trigger('keydown', { key: 'd', ctrlKey: true })
    await rows()[0]!.trigger('keydown', { key: 'd', ctrlKey: true, isComposing: true })
    await rows()[0]!.trigger('keydown', { key: 'd', ctrlKey: true, altKey: true })
    await rows()[0]!.trigger('keydown', { key: 'd', ctrlKey: true, shiftKey: true })
    const handled = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true })
    handled.preventDefault(); rows()[0]!.element.dispatchEvent(handled)
    await flushPromises()
    expect(rows()).toHaveLength(2)
    await button('Preview').trigger('click')
    await wrapper!.get('.form-builder').trigger('keydown', { key: 'd', ctrlKey: true })
    await button('Edit').trigger('click')
    expect(rows()).toHaveLength(2)
  })

  it('blocks structural shortcuts and buttons during an unanswered confirmation', async () => {
    await render()
    await wrapper!.get('input[maxlength="1000"]').setValue('Unsaved label')
    let resolve!: (answer: boolean) => void
    ask.mockReturnValue(new Promise(done => { resolve = done }))
    await button('New form').trigger('click')
    expect(ask).toHaveBeenCalledOnce()
    await rows()[0]!.trigger('keydown', { key: 'd', ctrlKey: true })
    await rows()[0]!.trigger('keydown', { key: 'ArrowDown', altKey: true })
    await rows()[0]!.trigger('keydown', { key: 'Delete' })
    expect(rows()).toHaveLength(2)
    expect(wrapper!.get('input[maxlength="1000"]').element).toHaveProperty('value', 'Unsaved label')
    resolve(false); await flushPromises()
    await rows()[0]!.trigger('keydown', { key: 'd', ctrlKey: true })
    expect(rows()).toHaveLength(3)
  })

  it('clears its private clipboard when access is lost and restored', async () => {
    const form = template()
    await render([form])
    await rows()[0]!.trigger('keydown', { key: 'c', ctrlKey: true })
    account.hasWorkspaceAccess = false; account.hasWorkspaceAccess = true
    await flushPromises()
    await wrapper!.get('[data-template-id="' + form.id + '"] .library-target').trigger('click')
    await flushPromises()
    await rows()[0]!.trigger('keydown', { key: 'v', ctrlKey: true })
    expect(rows()).toHaveLength(2)
    expect(button('Paste field').attributes('disabled')).toBeDefined()
  })

  it('blocks shortcuts while a pointer is armed, before the drag threshold', async () => {
    await render()
    const pointer = new MouseEvent('pointerdown', { button: 0, clientX: 20, clientY: 20, bubbles: true, cancelable: true })
    Object.defineProperty(pointer, 'pointerId', { value: 1 })
    button('Drag First').element.dispatchEvent(pointer)
    await rows()[0]!.trigger('keydown', { key: 'd', ctrlKey: true })
    await rows()[0]!.trigger('keydown', { key: 'Delete' })
    expect(rows()).toHaveLength(2)
    window.dispatchEvent(new Event('pointercancel'))
    await rows()[0]!.trigger('keydown', { key: 'd', ctrlKey: true })
    expect(rows()).toHaveLength(3)
  })

  it('does not change archived forms through structural keyboard commands', async () => {
    const form = template(); form.archived = true
    await render([form])
    const before = rowIds()
    for (const event of [{ key: 'd', ctrlKey: true }, { key: 'ArrowDown', altKey: true }, { key: 'Delete' }])
      await rows()[0]!.trigger('keydown', event)
    expect(rowIds()).toEqual(before)
    expect(button('Duplicate selected field').attributes('disabled')).toBeDefined()
  })
})
