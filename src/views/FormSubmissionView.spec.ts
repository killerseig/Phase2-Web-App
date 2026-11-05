import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormSubmissionView from './FormSubmissionView.vue'
const api = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>())
const state = vi.hoisted(() => ({ auth: {} as Record<string, unknown>, route: {} as Record<string, unknown> }))
vi.mock('@/services/forms', () => ({ formApi: api }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => state.auth }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, RouterLink: { template: '<a><slot /></a>' } }))
beforeEach(() => {
  api.mockReset()
  state.auth = reactive({ init: async () => {}, currentUser: { uid: 'operator' }, hasWorkspaceAccess: true, rawRole: 'foreman', profile: { assignedJobIds: ['job'] } })
  state.route = reactive({ params: { id: 'entry' }, hash: '', fullPath: '/form-submissions/entry' })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: vi.fn<() => void>() })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close') })
function completed(id = 'entry') {
  return { id, definition: { title: 'Visit ' + id, fields: [{ id: 'photos', kind: 'photo', label: 'Photos', options: [] }] }, answers: { photos: ['asset'] }, templateVersion: 1, submittedAt: 0 }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
describe('private completed gallery authorization', () => {
  it('requests every photo through the authenticated viewer and shows denial without exposing an image', async () => {
    api.mockResolvedValueOnce({ id: 'entry', definition: { title: 'Visit', fields: [{ id: 'photos', kind: 'photo', label: 'Photos', options: [] }] }, answers: { photos: ['asset'] }, templateVersion: 1, submittedAt: 0 })
    api.mockRejectedValueOnce(new Error('Photo access denied'))
    const view = mount(FormSubmissionView, { global: { stubs: { FormEntryTranslation: true } } }); await flushPromises()
    expect(api).toHaveBeenNthCalledWith(1, 'formSubmissionViewer', { action: 'get', id: 'entry' })
    expect(view.find('#label-photos').exists()).toBe(true)
    await view.findAll('button').find(button => button.text().startsWith('View Photos'))!.trigger('click'); await flushPromises()
    expect(api).toHaveBeenNthCalledWith(2, 'formSubmissionViewer', { action: 'photo', id: 'entry', assetId: 'asset' })
    expect(view.find('[role="alert"]').text()).toContain('Photo access denied')
    expect(view.find('img').exists()).toBe(false)
    view.unmount()
  })
  it('does not render completed answers when the entry read is denied', async () => {
    api.mockRejectedValueOnce(new Error('Entry access denied'))
    const view = mount(FormSubmissionView, { global: { stubs: { FormEntryTranslation: true } } }); await flushPromises()
    expect(view.find('[role="alert"]').text()).toContain('Entry access denied')
    expect(view.find('article').exists()).toBe(false)
    expect(api).toHaveBeenCalledOnce()
    view.unmount()
  })
  it('keeps the saved entry and photo controls available after a PDF failure and permits retry', async () => {
    const create = vi.fn<() => string>(() => 'blob:pdf'), revoke = vi.fn<(url: string) => void>(), click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    api.mockResolvedValueOnce(completed()).mockRejectedValueOnce(new Error('PDF preparation failed')).mockResolvedValueOnce({ base64: 'JVBERg==', contentType: 'application/pdf', filename: 'entry.pdf' })
    const view = mount(FormSubmissionView); await flushPromises()
    const download = view.find('article > button')
    await download.trigger('click'); await flushPromises()
    expect(view.find('[role="alert"]').text()).toBe('PDF preparation failed')
    expect(view.find('#label-photos').exists()).toBe(true)
    expect(download.attributes('disabled')).toBeUndefined()
    await download.trigger('click'); await flushPromises()
    expect(view.find('[role="alert"]').exists()).toBe(false)
    expect(create).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith('blob:pdf')
    view.unmount()
  })
  it.each(['functions/internal', 'functions/resource-exhausted', 'functions/deadline-exceeded'])(
    'explains a PDF backend failure (%s) without losing saved answers or authorizing a send', async (code) => {
      api.mockResolvedValueOnce(completed()).mockRejectedValueOnce(Object.assign(new Error('internal [500]'), { code }))
      const view = mount(FormSubmissionView); await flushPromises()
      await view.find('article > button').trigger('click'); await flushPromises()
      expect(view.find('[role="alert"]').text()).toBe('The PDF could not be generated. Your saved report and photos are unchanged. Please try again.')
      expect(view.find('#label-photos').exists()).toBe(true)
      expect(view.find('article > button').attributes('disabled')).toBeUndefined()
      expect(api).toHaveBeenLastCalledWith('formSubmissionViewer', { action: 'pdf', id: 'entry' })
      expect(api).toHaveBeenCalledTimes(2)
      view.unmount()
    },
  )
  it('explains the exact internal [500] message even when no Firebase code is attached', async () => {
    api.mockResolvedValueOnce(completed()).mockRejectedValueOnce(new Error('internal [500]'))
    const view = mount(FormSubmissionView); await flushPromises()
    await view.find('article > button').trigger('click'); await flushPromises()
    expect(view.find('[role="alert"]').text()).toContain('Your saved report and photos are unchanged')
    view.unmount()
  })
  it('does not download a pending PDF after switching entries or duplicate its request', async () => {
    const pending = deferred<{ base64: string; contentType: string; filename: string }>(), create = vi.fn<() => string>()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn<(url: string) => void>() })
    api.mockResolvedValueOnce(completed()).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(completed('next'))
    const view = mount(FormSubmissionView); await flushPromises()
    await view.find('article > button').trigger('click')
    await view.find('article > button').trigger('click')
    expect(api).toHaveBeenCalledTimes(2)
    ;(state.route.params as { id: string }).id = 'next'
    await flushPromises()
    pending.resolve({ base64: 'JVBERg==', contentType: 'application/pdf', filename: 'old.pdf' }); await flushPromises()
    expect(view.find('h1').text()).toBe('Visit next')
    expect(create).not.toHaveBeenCalled()
    expect(view.find('article > button').attributes('disabled')).toBeUndefined()
    view.unmount()
  })
  it('clears private content on sign-out and ignores the old photo error', async () => {
    const pending = deferred<never>()
    api.mockResolvedValueOnce(completed()).mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error('Entry access denied'))
    const view = mount(FormSubmissionView); await flushPromises()
    await view.findAll('button').find(button => button.text().startsWith('View Photos'))!.trigger('click')
    state.auth.currentUser = null
    await flushPromises()
    pending.reject(new Error('Old photo failure')); await flushPromises()
    expect(view.find('article').exists()).toBe(false)
    expect(view.find('img').exists()).toBe(false)
    expect(view.find('[role="alert"]').text()).toBe('Entry access denied')
    view.unmount()
  })
  it('ignores an old action finishing while a new entry action is busy and after unmount', async () => {
    const old = deferred<never>(), next = deferred<{ base64: string; contentType: string; filename: string }>(), create = vi.fn<() => string>()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn<(url: string) => void>() })
    api.mockResolvedValueOnce(completed()).mockReturnValueOnce(old.promise).mockResolvedValueOnce(completed('next')).mockReturnValueOnce(next.promise)
    const view = mount(FormSubmissionView); await flushPromises()
    await view.find('article > button').trigger('click')
    ;(state.route.params as { id: string }).id = 'next'; await flushPromises()
    await view.find('article > button').trigger('click')
    old.reject(new Error('Stale PDF failure')); await flushPromises()
    expect(view.find('[role="alert"]').exists()).toBe(false)
    expect(view.find('article > button').attributes('disabled')).toBeDefined()
    view.unmount()
    next.resolve({ base64: 'JVBERg==', contentType: 'application/pdf', filename: 'next.pdf' }); await flushPromises()
    expect(create).not.toHaveBeenCalled()
  })
})
