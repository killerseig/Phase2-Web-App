import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive, watch } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FormResponseWorkspace from '@/components/forms/FormResponseWorkspace.vue'
import FormDefinitionFields from '@/components/forms/FormDefinitionFields.vue'
import { uploadFormPhoto } from '@/services/forms'

const api = vi.hoisted(() => vi.fn<(name: string, data: Record<string, unknown>) => Promise<unknown>>())
vi.mock('@/services/forms', () => ({ formApi: api, isFormServerEnabled: () => true, isFormEmulatorEnabled: () => false, uploadFormPhoto: vi.fn<typeof import('@/services/forms').uploadFormPhoto>() }))
const auth = reactive({ currentUser: { uid: 'respondent' } as { uid: string } | null, rawRole: 'foreman', hasWorkspaceAccess: true, profile: { active: true }, assignedJobIds: ['job-1'] })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
const hosts: VueWrapper[] = []
const definition = { title: 'Visit', description: '', recipients: [], fields: [{ id: 'notes', kind: 'text', label: 'Notes', required: false, options: [] }] }
const template = { id: 'visit', definition, latestVersion: 1 }
const draft = { id: 'draft', ownerUid: 'respondent', jobId: 'job-1', templateId: 'visit', templateVersion: 1, revision: 1, status: 'draft', definition: { ...definition, version: 1 }, answers: { notes: 'Private answer' }, updatedAt: 1 }
const submitted = { ...draft, id: 'submitted', status: 'submitted', answers: { notes: 'Submitted answer' } }
const activeKey = 'form-active-record:v1:respondent:visit:1:job:job-1'
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function render(job = true) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: FormResponseWorkspace, props: { templateId: 'visit', inline: true, allowFullInline: true, openForJob: job } }] })
  await router.push(job ? '/?dashboardJob=job-1' : '/'); await router.isReady()
  const host = mount(RouterView, { global: { plugins: [router], stubs: { BuilderConfirmDialog: true, FormRecipientVerification: true } } })
  hosts.push(host)
  await flushPromises()
  return { host, view: host.findComponent(FormResponseWorkspace) }
}
function serveRecord(record = draft) {
  api.mockImplementation(async (name, data) => {
    if (!auth.hasWorkspaceAccess || !auth.assignedJobIds.includes('job-1')) throw new Error('Access revoked')
    if (name === 'formTemplates') return { templates: [template] }
    if (data.action === 'list') return { records: [record] }
    if (data.action === 'get') return record
    throw new Error('Unexpected mutation')
  })
}
beforeEach(() => {
  api.mockReset(); localStorage.clear()
  vi.mocked(uploadFormPhoto).mockReset()
  Object.assign(auth, { currentUser: { uid: 'respondent' }, rawRole: 'foreman', hasWorkspaceAccess: true, profile: { active: true }, assignedJobIds: ['job-1'] })
})
afterEach(() => { for (const host of hosts.splice(0)) host.unmount(); localStorage.clear() })

describe('respondent session ownership', () => {
  it('clears answers when the current job assignment is revoked without changing UID or role', async () => {
    serveRecord()
    const { view } = await render()
    expect(view.findComponent(FormDefinitionFields).props('modelValue')).toEqual(draft.answers)
    auth.assignedJobIds = []
    await flushPromises()
    expect(view.findComponent(FormDefinitionFields).exists()).toBe(false)
    expect(view.text()).toContain('Access revoked')
  })

  it('rejects a reused draft after disposal without changing the saved active record', async () => {
    localStorage.setItem(activeKey, submitted.id)
    const pending = deferred<typeof draft>()
    api.mockImplementation(async (name, data) => {
      if (name === 'formTemplates') return { templates: [template] }
      if (data.action === 'list') return { records: [submitted, draft] }
      if (data.id === submitted.id) return submitted
      if (data.id === draft.id) return pending.promise
      throw new Error('Unexpected mutation')
    })
    const { host, view } = await render()
    await view.findAll('button').find(button => button.text() === 'Start draft')!.trigger('click')
    await flushPromises()
    expect(api).toHaveBeenCalledWith('formWorkspace', expect.objectContaining({ action: 'get', id: draft.id }))
    host.unmount(); hosts.splice(hosts.indexOf(host), 1)
    pending.resolve(draft); await flushPromises()
    expect(localStorage.getItem(activeKey)).toBe(submitted.id)
  })

  it('does not accept a pending read across a synchronous access revoke and restore', async () => {
    const pending = deferred<typeof draft>()
    serveRecord()
    const serve = api.getMockImplementation()!
    api.mockImplementation((name, data) => data.action === 'get' ? pending.promise : serve(name, data))
    const { view } = await render()
    api.mockRejectedValue(new Error('Current access check failed'))
    auth.hasWorkspaceAccess = false
    auth.hasWorkspaceAccess = true
    await flushPromises()
    pending.resolve(draft); await flushPromises()
    expect(view.findComponent(FormDefinitionFields).exists()).toBe(false)
    expect(view.text()).toContain('Current access check failed')
  })

  it('rejects a reused draft after an account change and preserves the newer loading status', async () => {
    localStorage.setItem(activeKey, submitted.id)
    const pending = deferred<typeof draft>(), newer = deferred<{ templates: typeof template[] }>()
    api.mockImplementation(async (name, data) => {
      if (auth.currentUser?.uid !== 'respondent') return name === 'formTemplates' ? newer.promise : { records: [] }
      if (name === 'formTemplates') return { templates: [template] }
      if (data.action === 'list') return { records: [submitted, draft] }
      return data.id === submitted.id ? submitted : pending.promise
    })
    const { view } = await render()
    await view.findAll('button').find(button => button.text() === 'Start draft')!.trigger('click'); await flushPromises()
    auth.currentUser = { uid: 'new-respondent' }; await flushPromises()
    pending.resolve(draft); await flushPromises()
    expect(view.findComponent(FormDefinitionFields).exists()).toBe(false)
    expect(await view.vm.prepareNavigation()).toBe(true)
    expect(localStorage.getItem('form-active-record:v1:new-respondent:visit:1:job:job-1')).toBeNull()
    newer.reject(new Error('Current user could not load')); await flushPromises()
    expect(view.text()).toContain('Current user could not load')
  })

  it('ignores stale save errors and finalizers while a new context is loading', async () => {
    serveRecord()
    const { view } = await render()
    const save = deferred<typeof draft>(), newer = deferred<never>()
    api.mockImplementation((_name, data) => data.action === 'save' ? save.promise : newer.promise)
    await view.get('input[type=text]').setValue('Changed answer')
    await view.findAll('button').find(button => button.text() === 'Save progress')!.trigger('click')
    auth.rawRole = 'employee'; await flushPromises()
    save.reject(new Error('Obsolete save failure')); await flushPromises()
    expect(view.text()).not.toContain('Obsolete save failure')
    expect(view.findComponent(FormDefinitionFields).exists()).toBe(false)
    expect(await view.vm.prepareNavigation()).toBe(true)
    newer.reject(new Error('Current audience denied')); await flushPromises()
    expect(view.text()).toContain('Current audience denied')
  })

  it('preserves an unsaved answer through assignment-order-only updates', async () => {
    auth.assignedJobIds = ['job-1', 'job-2']
    serveRecord()
    const { view } = await render()
    await view.get('input[type=text]').setValue('Keep my draft')
    api.mockClear()
    auth.assignedJobIds = ['job-2', 'job-1']; await flushPromises()
    expect(api).not.toHaveBeenCalled()
    expect(view.get<HTMLInputElement>('input[type=text]').element.value).toBe('Keep my draft')
  })

  it('does not begin uploading if access changes between saving and the upload continuation', async () => {
    serveRecord()
    const { view } = await render()
    const fields = view.findComponent(FormDefinitionFields)
    await view.get('input[type=text]').setValue('Changed answer')
    api.mockImplementation(async (_name, data) => {
      if (data.action === 'save') return { ...draft, answers: { notes: 'Saved by server' } }
      throw new Error('Current audience denied')
    })
    const stop = watch(() => fields.props('modelValue'), answers => {
      if (answers.notes === 'Saved by server') auth.rawRole = 'employee'
    }, { flush: 'post' })
    fields.vm.$emit('upload', 'photos', [new File(['synthetic'], 'photo.png', { type: 'image/png' })])
    await flushPromises(); stop()
    expect(uploadFormPhoto).not.toHaveBeenCalled()
    expect(view.text()).toContain('Current audience denied')
  })

  it('keeps anonymous public drafts in memory without requiring workspace access', async () => {
    auth.currentUser = null; auth.hasWorkspaceAccess = false
    const publicDefinition = { ...definition, access: { respondents: 'public', identity: 'anonymous' } }
    const publicTemplate = { ...template, definition: publicDefinition }
    const publicRecord = { ...draft, jobId: '', ownerUid: '', definition: { ...publicDefinition, version: 1 } }
    api.mockImplementation(async (name, data) => {
      if (name === 'formTemplates' && data.action === 'respondent') return publicTemplate
      if (data.action === 'create') return publicRecord
      throw new Error('Unexpected private read')
    })
    const { view } = await render(false)
    await view.findAll('button').find(button => button.text() === 'Start draft')!.trigger('click'); await flushPromises()
    expect(view.findComponent(FormDefinitionFields).exists()).toBe(true)
    expect(api).toHaveBeenCalledWith('formWorkspace', expect.objectContaining({ action: 'create', publicCapability: expect.any(String) }))
    expect(localStorage.length).toBe(0)
  })
})
