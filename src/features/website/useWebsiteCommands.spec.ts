import { computed, effectScope, nextTick, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWebsiteCommands } from './useWebsiteCommands'
import type { useWebsiteAutosave } from './useWebsiteAutosave'
type CommandOptions = Parameters<typeof useWebsiteCommands>[0]
type Autosave = ReturnType<typeof useWebsiteAutosave>
import { useWebsiteHistory } from './useWebsiteHistory'
import { withWebsiteDefaults, type WebsiteSite, type WebsiteState } from './types'

const fake = vi.hoisted(() => ({ command: vi.fn<(action: string, data: unknown) => Promise<unknown>>() }))
vi.mock('@/services/website', async importOriginal => ({ ...await importOriginal<typeof import('@/services/website')>(), websiteCommand: fake.command }))
const scopes: EffectScope[] = []
function fixture() {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => {
    const site = ref<WebsiteSite>(withWebsiteDefaults({ name: 'Synthetic', accent: '#174878', pages: [{ id: 'home', title: 'Home', slug: 'home', description: '', inNavigation: true, sections: [] }] }))
    const history = useWebsiteHistory(site); history.reset(site.value)
    const saved = ref(JSON.stringify(site.value)), version = ref(3), loading = ref(false), busy = ref(false)
    const identity = ref('project:admin')
    const autosave = {
      stash: vi.fn<Autosave['stash']>(), ready: ref(true), settle: vi.fn<Autosave['settle']>().mockResolvedValue(undefined), conflict: ref(false), problem: ref(''),
      discover: vi.fn<Autosave['discover']>(), begin: vi.fn<Autosave['begin']>(), online: ref(true), persist: vi.fn<Autosave['persist']>(), protectedLocally: computed(() => true), reportFailure: vi.fn<Autosave['reportFailure']>(),
    }
    const state = {
      site, saved, version, loading, busy, history, autosave, dirty: computed(() => JSON.stringify(site.value) !== saved.value),
      locked: computed(() => loading.value || busy.value), cssError: ref(''), publishBlocked: ref(false), saving: ref(false), error: ref(''), message: ref(''), starterReview: ref(false),
      publishedAt: ref<number | null>(null), hasPrevious: ref(false), homePageId: ref(''), selectedPage: ref(''), selectedSection: ref(''),
      canDiscard: vi.fn<CommandOptions['canDiscard']>().mockResolvedValue(true), confirm: vi.fn<CommandOptions['confirm']>().mockResolvedValue(true), onLoaded: vi.fn<CommandOptions['onLoaded']>(), onRestored: vi.fn<CommandOptions['onRestored']>(), fitView: vi.fn<CommandOptions['fitView']>(),
      scope: () => identity.value, cancelConfirmation: vi.fn<() => void>(), onInvalidated: vi.fn<() => void>(),
    }
    return { ...state, identity, lifetime: scope, ...useWebsiteCommands(state) }
  })!
}
beforeEach(() => { fake.command.mockReset() })
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()) })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('Website command orchestration preserves its existing save/publication model', () => {
  it('loads a draft through history and resets recovery/readiness metadata', async () => {
    const state = fixture()
    const result: WebsiteState = { draft: state.site.value, version: 7, publishedAt: 100, hasPrevious: true, savedAt: 90 }
    fake.command.mockResolvedValue(result)
    await state.load()
    expect(state.canDiscard).toHaveBeenCalledOnce()
    expect(state.autosave.stash).toHaveBeenCalledOnce()
    expect(state.version.value).toBe(7)
    expect(state.selectedPage.value).toBe('home')
    expect(state.publishedAt.value).toBe(100)
    expect(state.onLoaded).toHaveBeenCalledWith(7)
    expect(state.fitView).toHaveBeenCalledOnce()
    expect(state.autosave.begin).toHaveBeenCalledWith(false)
  })
  it('keeps offline saves in browser recovery without calling the server', async () => {
    const state = fixture(); state.autosave.online.value = false
    await state.command('save')
    expect(state.autosave.persist).toHaveBeenCalledOnce()
    expect(fake.command).not.toHaveBeenCalled()
    expect(state.message.value).toContain('sync when the connection returns')
  })
  it('keeps saved baseline on server failure and reports the failure to autosave', async () => {
    const state = fixture(), baseline = state.saved.value
    state.site.value.name = 'Unsaved change'
    const error = new Error('Version conflict'); fake.command.mockRejectedValue(error)
    await state.command('save')
    expect(state.error.value).toBe('Version conflict')
    expect(state.saved.value).toBe(baseline)
    expect(state.dirty.value).toBe(true)
    expect(state.autosave.reportFailure).toHaveBeenCalledWith(error)
    expect(state.busy.value).toBe(false)
    expect(state.saving.value).toBe(false)
  })
  it('publishes only after confirmation/readiness and does not add a new save action', async () => {
    const state = fixture()
    fake.command.mockResolvedValue({ version: 4, publishedAt: 200 })
    state.confirm.mockResolvedValueOnce(false)
    await state.command('publish')
    expect(fake.command).not.toHaveBeenCalled()
    state.publishBlocked.value = true
    await state.command('publish')
    expect(fake.command).not.toHaveBeenCalled()
    state.publishBlocked.value = false
    await state.command('publish')
    expect(fake.command).toHaveBeenCalledExactlyOnceWith('publish', { version: 3 })
    expect(state.publishedAt.value).toBe(200)
  })
  it('restores into the draft/history and leaves publication an explicit separate step', async () => {
    const state = fixture()
    const draft = structuredClone(JSON.parse(JSON.stringify(state.site.value))) as WebsiteSite
    draft.name = 'Restored draft'
    fake.command.mockResolvedValue({ version: 8, draft })
    await state.command('restoreRevision', 'revision-1')
    expect(fake.command).toHaveBeenCalledExactlyOnceWith('restoreRevision', { version: 3, revisionId: 'revision-1' })
    expect(state.site.value.name).toBe('Restored draft')
    expect(state.onRestored).toHaveBeenCalledWith(8)
    expect(state.saved.value).toBe(JSON.stringify(draft))
    expect(state.message.value).toContain('Review it before publishing')
  })

  it('rejects an obsolete load and readiness after the same account loses and regains access', async () => {
    const state = fixture(), request = deferred<WebsiteState>(), original = state.site.value
    fake.command.mockReturnValue(request.promise)
    const pending = state.load(); await nextTick(); await nextTick()
    state.identity.value = ''; state.identity.value = 'project:admin'
    request.resolve({ draft: original, version: 7, publishedAt: null, hasPrevious: false, savedAt: 1 })
    await pending
    expect(state.site.value).toBeUndefined()
    expect(state.autosave.begin).not.toHaveBeenCalled()
    expect(state.onLoaded).not.toHaveBeenCalled()
    expect(state.history.canUndo.value).toBe(false)
  })

  it('does not apply a pending load after disposal', async () => {
    const state = fixture(), request = deferred<WebsiteState>(), original = state.site.value
    fake.command.mockReturnValue(request.promise)
    const pending = state.load(); await nextTick(); await nextTick()
    state.lifetime.stop()
    request.resolve({ draft: original, version: 7, publishedAt: null, hasPrevious: false, savedAt: 1 }); await pending
    expect(state.onLoaded).not.toHaveBeenCalled()
    expect(state.autosave.begin).not.toHaveBeenCalled()
    expect(state.fitView).not.toHaveBeenCalled()
  })

  it('rejects a confirmation after scope change even if the same admin returns', async () => {
    const state = fixture(), confirmation = deferred<boolean>()
    state.confirm.mockReturnValue(confirmation.promise)
    fake.command.mockResolvedValue({ version: 4, publishedAt: 200 })
    const pending = state.command('publish')
    state.identity.value = ''; state.identity.value = 'project:admin'
    confirmation.resolve(true); await pending
    expect(fake.command).not.toHaveBeenCalled()
    expect(state.cancelConfirmation).toHaveBeenCalled()
  })

  it('rejects an edit-and-revert while publication confirmation is pending', async () => {
    const state = fixture(), confirmation = deferred<boolean>()
    state.confirm.mockReturnValue(confirmation.promise)
    fake.command.mockResolvedValue({ version: 4, publishedAt: 200 })
    const pending = state.command('publish'), original = state.site.value.name
    state.site.value.name = 'Temporary edit'; state.site.value.name = original
    confirmation.resolve(true); await pending
    expect(fake.command).not.toHaveBeenCalled()
    expect(state.cancelConfirmation).toHaveBeenCalled()
  })

  it('does not send a save after its autosave settlement outlives access', async () => {
    const state = fixture(), settlement = deferred<void>()
    state.autosave.settle.mockReturnValue(settlement.promise)
    fake.command.mockResolvedValue({ version: 4 })
    const pending = state.command('save')
    state.identity.value = ''
    settlement.resolve(); await pending
    expect(fake.command).not.toHaveBeenCalled()
    expect(state.autosave.persist).not.toHaveBeenCalled()
  })

  it('retains the newer save ownership when an older account request fails', async () => {
    const state = fixture(), old = deferred<{ version: number }>(), newer = deferred<{ version: number }>()
    fake.command.mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise)
    const previous = state.command('save'); await nextTick()
    state.identity.value = 'project:other-admin'
    state.history.reset(withWebsiteDefaults({ name: 'New account draft', accent: '#174878', pages: [] }))
    state.saved.value = JSON.stringify(state.site.value); state.version.value = 10
    const current = state.command('save'); await nextTick()
    old.reject(new Error('Old account failure')); await previous
    expect(state.busy.value).toBe(true)
    expect(state.saving.value).toBe(true)
    expect(state.error.value).toBe('')
    expect(state.autosave.reportFailure).not.toHaveBeenCalled()
    newer.resolve({ version: 11 }); await current
    expect(state.version.value).toBe(11)
    expect(state.busy.value).toBe(false)
    expect(state.message.value).toContain('Draft saved')
  })

  it('does not duplicate active loads or lose its spinner when a second reload is requested', async () => {
    const state = fixture(), request = deferred<WebsiteState>()
    fake.command.mockReturnValue(request.promise)
    const pending = state.load(); await nextTick(); await nextTick()
    await state.load()
    expect(fake.command).toHaveBeenCalledOnce()
    expect(state.loading.value).toBe(true)
    request.reject(new Error('Load failed')); await pending
    expect(state.loading.value).toBe(false)
    expect(state.autosave.begin).toHaveBeenCalledWith(true)
    fake.command.mockResolvedValue({ draft: state.site.value, version: 8, publishedAt: null, hasPrevious: false })
    await state.load()
    expect(state.version.value).toBe(8)
    expect(state.error.value).toBe('')
  })

  it('preserves edits made during save while refusing a restore that would replace newer edits', async () => {
    const state = fixture(), save = deferred<{ version: number }>()
    state.site.value.name = 'Sent edit'
    fake.command.mockReturnValue(save.promise)
    const saving = state.command('save'); await nextTick()
    state.site.value.name = 'Newer edit'
    save.resolve({ version: 4 }); await saving
    expect(state.site.value.name).toBe('Newer edit')
    expect(JSON.parse(state.saved.value).name).toBe('Sent edit')
    expect(state.dirty.value).toBe(true)
    const restore = deferred<{ version: number; draft: WebsiteSite }>()
    fake.command.mockReturnValue(restore.promise)
    const restoring = state.command('restore'); await nextTick(); await nextTick(); await nextTick()
    state.site.value.name = 'Keep newer work'
    restore.resolve({ version: 5, draft: withWebsiteDefaults({ name: 'Old published', accent: '#174878', pages: [] }) })
    await restoring
    expect(state.site.value.name).toBe('Keep newer work')
    expect(state.onRestored).not.toHaveBeenCalled()
    expect(state.busy.value).toBe(false)
  })

  it('captures draft-sensitive decisions separately from the context-only completion lifetime', () => {
    const state = fixture(), unchanged = state.capture(), current = state.capture(false)
    const name = state.site.value.name
    state.site.value.name = 'Transient'; state.site.value.name = name
    expect(unchanged()).toBe(false)
    expect(current()).toBe(true)
    state.identity.value = ''; state.identity.value = 'project:admin'
    expect(current()).toBe(false)
  })

  it('never asks for confirmation or writes while access is unavailable', async () => {
    const state = fixture()
    state.identity.value = ''
    await state.load(); await state.command('save'); await state.command('publish')
    expect(fake.command).not.toHaveBeenCalled()
    expect(state.canDiscard).not.toHaveBeenCalled()
    expect(state.confirm).not.toHaveBeenCalled()
  })
})
