import { effectScope, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clone, emptyLibrary, keepVersion, newField, newTemplate, type FormTemplate } from './model'
import { readLibrary, saveLibrary } from './localLibrary'
import { useFormAuthoring } from './useFormAuthoring'
import { useFormPersistence } from './useFormPersistence'
import type { ServerFormTemplate } from '@/services/forms'

const fake = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/services/forms', () => ({ formApi: fake.api }))

const scopes: EffectScope[] = []
function fixture(localPreview = false) {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const initial = newTemplate('Synthetic form')
    initial.fields = [newField('text', 'Notes')]
    const uid = ref('synthetic-admin'), draft = ref<FormTemplate>(initial)
    const library = ref(emptyLibrary()), dirty = ref(false), blocked = ref(false)
    const message = ref(''), error = ref('')
    const authoring = useFormAuthoring(draft, dirty)
    authoring.reset()
    const values = new Map<string, string>()
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    }
    const confirmPublish = vi.fn().mockResolvedValue(true), showPublicationIssues = vi.fn()
    const controller = useFormPersistence({
      uid, draft, library, dirty, blocked, message, error, authoring,
      serverEnabled: true, localPreview, storage: () => storage, confirmPublish, showPublicationIssues,
    })
    return { uid, draft, library, dirty, blocked, message, error, authoring, storage, controller, confirmPublish, showPublicationIssues }
  })!
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { resolve, promise }
}
function installServer(state: ReturnType<typeof fixture>) {
  const server: ServerFormTemplate = {
    id: state.draft.value.id, draft: clone(state.draft.value), revision: 4,
    latestVersion: 0, archived: false, used: false,
  }
  fake.api.mockImplementation(async (_name: string, data: Record<string, unknown>) => {
    if (data.action === 'list') return { templates: [clone(server)] }
    if (data.action === 'save') {
      expect(data.revision).toBe(server.revision)
      server.draft = clone(data.definition as FormTemplate)
      server.revision++
      return clone(server)
    }
    if (data.action === 'issue') {
      expect(data).toMatchObject({ id: server.id, revision: server.revision })
      server.latestVersion++
      return { ok: true }
    }
    throw new Error('Unexpected synthetic request')
  })
  return server
}
beforeEach(() => { fake.api.mockReset() })
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()) })

describe('Form persistence orchestration with synthetic services and device storage', () => {
  it('can retry a failed library load and ignores a response belonging to a previous account', async () => {
    const state = fixture()
    fake.api.mockRejectedValueOnce(new Error('Service unavailable'))
    await state.controller.loadServer()
    expect(state.controller.serverAvailable.value).toBe(false)
    expect(state.error.value).toBe('Service unavailable')
    installServer(state)
    await state.controller.loadServer()
    expect(state.controller.serverAvailable.value).toBe(true)
    const pending = deferred<{ templates: ServerFormTemplate[] }>()
    fake.api.mockReturnValueOnce(pending.promise)
    const loading = state.controller.loadServer()
    state.uid.value = 'different-account'
    pending.resolve({ templates: [] })
    await loading
    expect(state.controller.serverTemplates.value).toHaveLength(1)
  })

  it('retries a failed server save without publishing or losing the dirty baseline', async () => {
    const state = fixture(), server = installServer(state)
    await state.controller.loadServer()
    state.draft.value.title = 'Retain this edit'
    fake.api.mockRejectedValueOnce(new Error('Revision conflict'))
    expect(await state.controller.saveServer()).toBeUndefined()
    expect(state.error.value).toBe('Revision conflict')
    expect(state.dirty.value).toBe(true)
    expect(state.controller.serverBusy.value).toBe(false)
    const saved = await state.controller.saveServer()
    expect(saved?.revision).toBe(5)
    expect(server.draft.title).toBe('Retain this edit')
    expect(state.dirty.value).toBe(false)
    expect(fake.api.mock.calls.some(([, data]) => data.action === 'issue')).toBe(false)
  })

  it('does not mark newer edits saved when a standalone save completes', async () => {
    const state = fixture(), server = installServer(state)
    await state.controller.loadServer()
    const pending = deferred<ServerFormTemplate>()
    state.draft.value.title = 'Submitted title'
    fake.api.mockReturnValueOnce(pending.promise)
    const saving = state.controller.saveServer()
    state.draft.value.title = 'Newer unsaved title'
    pending.resolve({ ...server, revision: 5 })
    await saving
    expect(state.draft.value.title).toBe('Newer unsaved title')
    expect(state.dirty.value).toBe(true)
  })

  it('retries failed publication by saving again and issuing only that returned revision', async () => {
    const state = fixture(), server = installServer(state)
    await state.controller.loadServer()
    const normal = fake.api.getMockImplementation()!
    let failIssue = true
    fake.api.mockImplementation(async (name: string, data: Record<string, unknown>) => {
      if (data.action === 'issue' && failIssue) throw new Error('Publication conflict')
      return normal(name, data)
    })
    state.draft.value.title = 'Publish this saved title'
    await state.controller.issueServer()
    expect(state.error.value).toContain('Draft saved, but publication failed: Publication conflict')
    expect(state.dirty.value).toBe(false)
    expect(server.revision).toBe(5)
    failIssue = false
    await state.controller.issueServer()
    expect(server.revision).toBe(6)
    expect(server.latestVersion).toBe(1)
    expect(state.controller.publishPhase.value).toBe('')
    expect(state.controller.serverBusy.value).toBe(false)
    expect(state.error.value).toBe('')
    expect(fake.api.mock.calls.filter(([, data]) => data.action === 'issue').map(([, data]) => data.revision)).toEqual([5, 6])
  })

  it('still permits emulator draft save but never publishes from local preview', async () => {
    const state = fixture(true)
    installServer(state)
    await state.controller.loadServer()
    await state.controller.saveServer()
    expect(state.message.value).toBe('Draft saved to the local server.')
    fake.api.mockClear()
    await state.controller.issueServer()
    expect(state.confirmPublish).not.toHaveBeenCalled()
    expect(fake.api).not.toHaveBeenCalled()
  })

  it('retains edited data on device-storage failure and clears dirty only after a verified retry', () => {
    const state = fixture()
    state.draft.value.title = 'Retain device edit'
    state.storage.setItem.mockImplementationOnce(() => { throw new Error('Storage full') })
    state.controller.save()
    expect(state.error.value).toBe('Storage full')
    expect(state.library.value.revision).toBe(0)
    expect(state.dirty.value).toBe(true)
    state.controller.save()
    expect(state.library.value.revision).toBe(1)
    expect(state.dirty.value).toBe(false)
    expect(readLibrary(state.storage, state.uid.value).templates[0]?.title).toBe('Retain device edit')
    expect(fake.api).not.toHaveBeenCalled()
  })

  it('retains immutable local versions across saves and reload', () => {
    const state = fixture()
    state.draft.value.title = 'Version one'
    state.controller.save(true)
    state.draft.value.title = 'Version two'
    state.controller.save(true)
    state.draft.value.title = 'Later draft'
    state.controller.save()
    const saved = readLibrary(state.storage, state.uid.value).templates[0]!
    expect(saved.title).toBe('Later draft')
    expect(saved.versions.map(version => [version.version, version.title])).toEqual([[1, 'Version one'], [2, 'Version two']])
    expect(state.dirty.value).toBe(false)
    expect(fake.api).not.toHaveBeenCalled()
  })

  it('does not overwrite another tab or clear edits after a device revision conflict', () => {
    const state = fixture()
    state.controller.save()
    saveLibrary(state.storage, state.uid.value, clone(state.library.value))
    state.draft.value.title = 'Unsaved conflicting edit'
    state.controller.save()
    expect(state.error.value).toContain('Another tab changed the library')
    expect(state.dirty.value).toBe(true)
    expect(readLibrary(state.storage, state.uid.value).templates[0]?.title).toBe('Synthetic form')
  })

  it('rejects an invalid device version without changing existing storage', () => {
    const state = fixture()
    state.controller.save()
    const before = readLibrary(state.storage, state.uid.value)
    state.draft.value.fields = []
    state.controller.save(true)
    expect(state.error.value).toContain('Add between 1 and 60 fields')
    expect(readLibrary(state.storage, state.uid.value)).toEqual(before)
    expect(state.dirty.value).toBe(true)
  })

  it('imports an independent copy, preserves original device versions, and can retry a failed save', async () => {
    const state = fixture()
    const source = keepVersion(state.draft.value)
    state.library.value.templates = [clone(source)]
    installServer(state)
    await state.controller.loadServer()
    const normal = fake.api.getMockImplementation()!
    let failSave = true
    fake.api.mockImplementation(async (name: string, data: Record<string, unknown>) => {
      if (data.action === 'save') {
        if (failSave) throw new Error('Import save failed')
        return { id: data.id, revision: 1, draft: data.definition, archived: false, used: false, latestVersion: 0 }
      }
      return normal(name, data)
    })
    await state.controller.importDeviceDraft(source.id)
    const copyId = state.draft.value.id
    expect(copyId).not.toBe(source.id)
    expect(state.draft.value.versions).toEqual([])
    expect(state.dirty.value).toBe(true)
    expect(state.error.value).toBe('Import save failed')
    expect(state.library.value.templates).toEqual([source])
    failSave = false
    await state.controller.saveServer()
    const saves = fake.api.mock.calls.filter(([, data]) => data.action === 'save')
    expect(saves.map(([, data]) => [data.id, data.revision])).toEqual([[copyId, 0], [copyId, 0]])
    expect(state.dirty.value).toBe(false)
    expect(state.library.value.templates).toEqual([source])
  })
})
