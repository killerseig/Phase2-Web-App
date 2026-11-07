import { effectScope, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServerFormTemplate } from '@/services/forms'
import { clone, emptyLibrary, newField, newTemplate, type FormTemplate } from './model'
import { useFormAuthoring } from './useFormAuthoring'
import { useFormEditorContext } from './useFormEditorContext'
import { useFormPersistence } from './useFormPersistence'

const fake = vi.hoisted(() => ({
  api: vi.fn<(name: string, data: Record<string, unknown>) => Promise<unknown>>(),
}))
vi.mock('@/services/forms', () => ({ formApi: fake.api }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const scopes: EffectScope[] = []
async function settle() {
  for (let index = 0; index < 16; index++) await Promise.resolve()
}
function fixture() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const initial = newTemplate('Synthetic lifecycle form')
    initial.fields = [newField('text', 'Notes')]
    const uid = ref('synthetic-admin'),
      enabled = ref(true)
    const draft = ref<FormTemplate | undefined>(initial)
    const library = ref(emptyLibrary()),
      dirty = ref(false),
      blocked = ref(false)
    const message = ref(''),
      error = ref('')
    const context = useFormEditorContext({ uid, enabled, draft })
    const authoring = useFormAuthoring(draft, dirty)
    authoring.reset()
    const saved = vi.spyOn(authoring, 'saved')
    const values = new Map<string, string>()
    const storage = {
      getItem: vi.fn<Storage['getItem']>((key) => values.get(key) ?? null),
      setItem: vi.fn<Storage['setItem']>((key, value) => {
        values.set(key, value)
      }),
      removeItem: vi.fn<Storage['removeItem']>((key) => {
        values.delete(key)
      }),
    }
    const confirmPublish = vi.fn<() => Promise<boolean | undefined>>().mockResolvedValue(true)
    const onDraftSelected = vi.fn<() => void>()
    const options = {
      uid,
      draft,
      library,
      dirty,
      blocked,
      message,
      error,
      authoring,
      context,
      serverEnabled: true,
      localPreview: false,
      storage: () => storage,
      confirmPublish,
      showPublicationIssues: vi.fn<() => void>(),
      onDraftSelected,
    }
    const controller = useFormPersistence(options)
    const server: ServerFormTemplate = {
      id: initial.id,
      draft: clone(initial),
      revision: 4,
      latestVersion: 0,
      archived: false,
      used: false,
    }
    const copies: ServerFormTemplate[] = []
    const queued = new Map<string, Promise<unknown>[]>()
    function deferAction<T>(action: string) {
      const pending = deferred<T>()
      const queue = queued.get(action) ?? []
      queue.push(pending.promise)
      queued.set(action, queue)
      return pending
    }
    fake.api.mockImplementation(async (_name, data) => {
      const action = String(data.action)
      const pending = queued.get(action)?.shift()
      if (pending) return pending
      if (action === 'list') return { templates: [clone(server), ...clone(copies)] }
      if (action === 'save') {
        if (data.revision !== server.revision) throw new Error('Synthetic save revision conflict')
        server.draft = clone(data.definition as FormTemplate)
        server.revision++
        return clone(server)
      }
      if (action === 'issue') {
        if (data.id !== server.id || data.revision !== server.revision)
          throw new Error('Synthetic publication revision conflict')
        server.latestVersion++
        return { id: server.id, revision: server.revision, latestVersion: server.latestVersion }
      }
      if (action === 'remove') {
        if (data.id !== server.id || data.revision !== server.revision)
          throw new Error('Synthetic removal revision conflict')
        server.archived = true
        return { archived: true }
      }
      if (action === 'duplicate') {
        const id = String(data.targetId)
        const existing = copies.find((copy) => copy.id === id)
        if (existing) return clone(existing)
        const copy = {
          ...clone(server),
          id,
          revision: 1,
          latestVersion: 0,
          used: false,
          draft: { ...clone(server.draft), id, versions: [] },
        }
        copies.push(copy)
        return clone(copy)
      }
      throw new Error('Unexpected synthetic request: ' + action)
    })
    const calls = (action: string) =>
      fake.api.mock.calls.filter(([, data]) => data.action === action)
    return {
      scope,
      uid,
      enabled,
      draft,
      library,
      dirty,
      blocked,
      message,
      error,
      context,
      authoring,
      saved,
      storage,
      confirmPublish,
      onDraftSelected,
      controller,
      server,
      deferAction,
      calls,
    }
  })!
}
beforeEach(() => {
  fake.api.mockReset()
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
})

describe('Form persistence request and editor lifetimes', () => {
  it.each(['success', 'failure'] as const)(
    'does not let an older list %s replace a newer successful refresh',
    async (outcome) => {
      const state = fixture()
      const old = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
      const first = state.controller.loadServer()
      await state.controller.loadServer()
      state.message.value = 'Current operation'
      if (outcome === 'success')
        old.resolve({ templates: [{ ...clone(state.server), revision: 1 }] })
      else old.reject(new Error('Obsolete list failure'))
      await first
      expect(state.controller.serverTemplates.value[0]?.revision).toBe(4)
      expect(state.controller.serverAvailable.value).toBe(true)
      expect(state.error.value).toBe('')
      expect(state.message.value).toBe('Current operation')
    },
  )

  it.each(['account-roundtrip', 'access-loss', 'disposal'] as const)(
    'invalidates loaded and pending server data on %s',
    async (transition) => {
      const state = fixture()
      await state.controller.loadServer()
      const pending = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
      const loading = state.controller.loadServer()
      if (transition === 'account-roundtrip') {
        state.uid.value = ''
        state.uid.value = 'synthetic-admin'
      } else if (transition === 'access-loss') state.enabled.value = false
      else state.scope.stop()
      expect(state.controller.serverTemplates.value).toEqual([])
      expect(state.controller.serverAvailable.value).toBe(false)
      pending.resolve({ templates: [clone(state.server)] })
      await loading
      expect(state.controller.serverTemplates.value).toEqual([])
      expect(state.controller.serverAvailable.value).toBe(false)
    },
  )

  it.each(['access-loss', 'disposal'] as const)(
    'cannot continue publication after %s during confirmation',
    async (transition) => {
      const state = fixture()
      await state.controller.loadServer()
      const answer = deferred<boolean>()
      state.confirmPublish.mockReturnValue(answer.promise)
      const publishing = state.controller.issueServer()
      expect(state.controller.publishPhase.value).toBe('confirming')
      if (transition === 'access-loss') state.enabled.value = false
      else state.scope.stop()
      answer.resolve(true)
      await publishing
      expect(state.calls('save')).toHaveLength(0)
      expect(state.calls('issue')).toHaveLength(0)
      expect(state.controller.publishPhase.value).toBe('')
      expect(state.controller.serverBusy.value).toBe(false)
    },
  )

  it.each(['success', 'failure'] as const)(
    'an obsolete save %s cannot release or overwrite a new save',
    async (outcome) => {
      const state = fixture()
      await state.controller.loadServer()
      const old = state.deferAction<ServerFormTemplate>('save')
      const first = state.controller.saveServer()
      state.uid.value = 'another-admin'
      expect(state.controller.serverBusy.value).toBe(false)
      await state.controller.loadServer()
      const current = state.deferAction<ServerFormTemplate>('save')
      const second = state.controller.saveServer()
      state.message.value = 'Current save status'
      state.error.value = 'Current error'
      if (outcome === 'success') old.resolve(clone(state.server))
      else old.reject(new Error('Obsolete save failure'))
      await first
      expect(state.calls('save')).toHaveLength(2)
      expect(state.controller.serverBusy.value).toBe(true)
      expect(state.saved).not.toHaveBeenCalled()
      expect(state.message.value).toBe('Current save status')
      expect(state.error.value).toBe('Current error')
      current.resolve(clone(state.server))
      await second
      expect(state.controller.serverBusy.value).toBe(false)
      expect(state.saved).toHaveBeenCalledOnce()
    },
  )

  it('checks ownership again after the refresh following a successful save', async () => {
    const state = fixture()
    await state.controller.loadServer()
    state.draft.value!.title = 'Submitted edit'
    const refresh = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
    const saving = state.controller.saveServer()
    await settle()
    expect(state.calls('list')).toHaveLength(2)
    state.uid.value = 'another-admin'
    state.message.value = 'New account status'
    refresh.resolve({ templates: [clone(state.server)] })
    expect(await saving).toBeUndefined()
    expect(state.saved).not.toHaveBeenCalled()
    expect(state.dirty.value).toBe(true)
    expect(state.message.value).toBe('New account status')
  })

  it('does not issue after access is revoked while the required save is pending', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const pending = state.deferAction<ServerFormTemplate>('save')
    const publishing = state.controller.issueServer()
    await settle()
    expect(state.calls('save')).toHaveLength(1)
    state.enabled.value = false
    pending.resolve(clone(state.server))
    await publishing
    expect(state.calls('issue')).toHaveLength(0)
    expect(state.saved).not.toHaveBeenCalled()
    expect(state.controller.publishPhase.value).toBe('')
  })

  it.each(['issue', 'refresh'] as const)(
    'suppresses publication completion after context changes during %s',
    async (stage) => {
      const state = fixture()
      await state.controller.loadServer()
      const issue = state.deferAction<{ id: string; revision: number; latestVersion: number }>(
        'issue',
      )
      const publishing = state.controller.issueServer()
      await settle()
      expect(state.controller.publishPhase.value).toBe('publishing')
      const refresh =
        stage === 'refresh'
          ? state.deferAction<{ templates: ServerFormTemplate[] }>('list')
          : undefined
      if (refresh) {
        issue.resolve({ id: state.server.id, revision: state.server.revision, latestVersion: 1 })
        await settle()
      }
      expect(state.calls('list')).toHaveLength(stage === 'refresh' ? 3 : 2)
      state.uid.value = 'another-admin'
      state.message.value = 'New account status'
      state.error.value = 'New account error'
      if (refresh) refresh.resolve({ templates: [clone(state.server)] })
      else issue.resolve({ id: state.server.id, revision: state.server.revision, latestVersion: 1 })
      await publishing
      expect(state.message.value).toBe('New account status')
      expect(state.error.value).toBe('New account error')
      expect(state.controller.serverBusy.value).toBe(false)
      expect(state.controller.publishPhase.value).toBe('')
    },
  )

  it('does not mark a replaced draft saved even when its serialized data matches', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const pending = state.deferAction<ServerFormTemplate>('save')
    const saving = state.controller.saveServer()
    state.draft.value = clone(state.draft.value!)
    state.authoring.reset(true)
    pending.resolve(clone(state.server))
    await saving
    expect(state.saved).not.toHaveBeenCalled()
    expect(state.dirty.value).toBe(true)
  })

  it('requires a fresh publication confirmation after an edit and revert', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const answer = deferred<boolean>()
    state.confirmPublish.mockReturnValue(answer.promise)
    const publishing = state.controller.issueServer()
    const title = state.draft.value!.title
    state.draft.value!.title = 'Temporary edit'
    state.draft.value!.title = title
    answer.resolve(true)
    await publishing
    expect(state.calls('save')).toHaveLength(0)
    expect(state.calls('issue')).toHaveLength(0)
  })

  it('blocks new server and device writes after access loss', async () => {
    const state = fixture()
    await state.controller.loadServer()
    state.enabled.value = false
    fake.api.mockClear()
    await state.controller.loadServer()
    await state.controller.saveServer()
    await state.controller.issueServer()
    state.controller.save()
    state.controller.persist()
    expect(fake.api).not.toHaveBeenCalled()
    expect(state.storage.setItem).not.toHaveBeenCalled()
    expect(state.confirmPublish).not.toHaveBeenCalled()
  })

  it('still permits a normal retry and publishes the newly saved revision', async () => {
    const state = fixture()
    await state.controller.loadServer()
    state.draft.value!.title = 'Keep this edit'
    const failure = state.deferAction<ServerFormTemplate>('save')
    const saving = state.controller.saveServer()
    failure.reject(new Error('Temporary save failure'))
    await saving
    expect(state.dirty.value).toBe(true)
    expect(state.error.value).toBe('Temporary save failure')
    expect(state.controller.serverBusy.value).toBe(false)
    await state.controller.issueServer()
    expect(state.calls('issue')).toHaveLength(1)
    expect(state.calls('issue')[0]?.[1].revision).toBe(5)
    expect(state.dirty.value).toBe(false)
    expect(state.error.value).toBe('')
    expect(state.message.value).toContain('published')
  })

  it('does not remove a template after access changes while confirmation is open', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const answer = deferred<boolean>()
    const removing = state.controller.removeServer(clone(state.server), () => answer.promise)
    state.enabled.value = false
    answer.resolve(true)
    await removing
    expect(state.calls('remove')).toHaveLength(0)
    expect(state.draft.value?.id).toBe(state.server.id)
    expect(state.controller.serverBusy.value).toBe(false)
  })

  it('does not let an old remove failure overwrite a save after an account roundtrip', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const removal = state.deferAction<{ archived: boolean }>('remove')
    const removing = state.controller.removeServer(clone(state.server), async () => true)
    await settle()
    expect(state.calls('remove')).toHaveLength(1)
    state.uid.value = ''
    state.uid.value = 'synthetic-admin'
    await state.controller.loadServer()
    const save = state.deferAction<ServerFormTemplate>('save')
    const saving = state.controller.saveServer()
    state.error.value = 'Current save status'
    removal.reject(new Error('Old remove error'))
    await removing
    expect(state.controller.serverBusy.value).toBe(true)
    expect(state.error.value).toBe('Current save status')
    save.resolve(clone(state.server))
    await saving
    expect(state.controller.serverBusy.value).toBe(false)
  })

  it('does not clear a replacement draft after a removal refresh completes', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const refresh = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
    const removing = state.controller.removeServer(clone(state.server), async () => true)
    await settle()
    state.draft.value = clone(state.draft.value!)
    state.authoring.reset(true)
    refresh.resolve({ templates: [clone(state.server)] })
    await removing
    expect(state.draft.value?.id).toBe(state.server.id)
    expect(state.dirty.value).toBe(true)
  })

  it('does not select a duplicated template after context changes during its refresh', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const refresh = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
    const duplicating = state.controller.duplicateServer(clone(state.server))
    await settle()
    expect(state.calls('duplicate')).toHaveLength(1)
    expect(state.calls('list')).toHaveLength(2)
    state.uid.value = 'another-admin'
    state.message.value = 'Current account status'
    refresh.resolve({ templates: [clone(state.server)] })
    await duplicating
    expect(state.onDraftSelected).not.toHaveBeenCalled()
    expect(state.draft.value?.id).toBe(state.server.id)
    expect(state.message.value).toBe('Current account status')
  })

  it('retains the duplicate request ID for retry and selects only the successful independent copy', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const failure = state.deferAction<ServerFormTemplate>('duplicate')
    const first = state.controller.duplicateServer(clone(state.server))
    failure.reject(new Error('Temporary duplicate failure'))
    await first
    expect(state.error.value).toBe('Temporary duplicate failure')
    expect(state.controller.serverBusy.value).toBe(false)
    expect(state.onDraftSelected).not.toHaveBeenCalled()
    expect(state.storage.removeItem).not.toHaveBeenCalled()
    await state.controller.duplicateServer(clone(state.server))
    const ids = state.calls('duplicate').map(([, data]) => data.targetId)
    expect(ids).toHaveLength(2)
    expect(ids[0]).toBe(ids[1])
    expect(state.draft.value?.id).toBe(ids[1])
    expect(state.draft.value?.id).not.toBe(state.server.id)
    expect(state.dirty.value).toBe(false)
    expect(state.onDraftSelected).toHaveBeenCalledOnce()
    expect(state.storage.removeItem).toHaveBeenCalledOnce()
  })

  it.each(['save', 'issue'] as const)(
    'does not let a superseded post-%s refresh overwrite newer refresh status',
    async (stage) => {
      const state = fixture()
      await state.controller.loadServer()
      state.draft.value!.title = 'Submitted edit'
      const issue =
        stage === 'issue'
          ? state.deferAction<{ id: string; revision: number; latestVersion: number }>('issue')
          : undefined
      let oldRefresh =
        stage === 'save'
          ? state.deferAction<{ templates: ServerFormTemplate[] }>('list')
          : undefined
      const operation =
        stage === 'save' ? state.controller.saveServer() : state.controller.issueServer()
      await settle()
      expect(state.controller.publishPhase.value).toBe(stage === 'issue' ? 'publishing' : '')
      if (issue) {
        oldRefresh = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
        issue.resolve({ id: state.server.id, revision: state.server.revision, latestVersion: 1 })
        await settle()
      }
      const newer = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
      const loading = state.controller.loadServer()
      newer.reject(new Error('Newer library refresh failed'))
      await loading
      state.message.value = 'Newer refresh status'
      oldRefresh!.resolve({ templates: [clone(state.server)] })
      await operation
      expect(state.error.value).toBe('Newer library refresh failed')
      expect(state.message.value).toBe('Newer refresh status')
      expect(state.saved).toHaveBeenCalledTimes(stage === 'save' ? 0 : 1)
      expect(state.dirty.value).toBe(stage === 'save')
      expect(state.controller.serverBusy.value).toBe(false)
    },
  )

  it('keeps a successful save baseline when its refresh fails but does not issue without refreshed state', async () => {
    const state = fixture()
    await state.controller.loadServer()
    state.draft.value!.title = 'Saved before refresh failure'
    const refresh = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
    const publishing = state.controller.issueServer()
    await settle()
    expect(state.server.revision).toBe(5)
    refresh.reject(new Error('Saved, but library unavailable'))
    await publishing
    expect(state.saved).toHaveBeenCalledOnce()
    expect(state.dirty.value).toBe(false)
    expect(state.error.value).toBe('Saved, but library unavailable')
    expect(state.message.value).toBe('Draft saved.')
    expect(state.calls('issue')).toHaveLength(0)
    expect(state.controller.serverAvailable.value).toBe(false)
    expect(state.controller.serverBusy.value).toBe(false)
  })

  it('reports a completed publication accurately when its follow-up refresh fails', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const issue = state.deferAction<{ id: string; revision: number; latestVersion: number }>(
      'issue',
    )
    const publishing = state.controller.issueServer()
    await settle()
    const refresh = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
    issue.resolve({ id: state.server.id, revision: state.server.revision, latestVersion: 1 })
    await settle()
    refresh.reject(new Error('Published, but library unavailable'))
    await publishing
    expect(state.calls('issue')).toHaveLength(1)
    expect(state.error.value).toBe('Published, but library unavailable')
    expect(state.message.value).toContain('published')
    expect(state.message.value).toContain('Refresh')
    expect(state.dirty.value).toBe(false)
    expect(state.controller.serverBusy.value).toBe(false)
    expect(state.controller.publishPhase.value).toBe('')
  })

  it('reuses a successful duplicate request after its follow-up refresh fails', async () => {
    const state = fixture()
    await state.controller.loadServer()
    const refresh = state.deferAction<{ templates: ServerFormTemplate[] }>('list')
    const duplicating = state.controller.duplicateServer(clone(state.server))
    await settle()
    refresh.reject(new Error('Copy saved, but library unavailable'))
    await duplicating
    expect(state.storage.removeItem).not.toHaveBeenCalled()
    expect(state.onDraftSelected).not.toHaveBeenCalled()
    await state.controller.loadServer()
    await state.controller.duplicateServer(clone(state.server))
    const ids = state.calls('duplicate').map(([, data]) => data.targetId)
    expect(ids).toHaveLength(2)
    expect(ids[0]).toBe(ids[1])
    expect(
      state.controller.serverTemplates.value.filter((template) => template.id === ids[0]),
    ).toHaveLength(1)
    expect(state.onDraftSelected).toHaveBeenCalledOnce()
    expect(state.storage.removeItem).toHaveBeenCalledOnce()
  })
})
