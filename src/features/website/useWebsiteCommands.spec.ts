import { computed, effectScope, ref, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWebsiteCommands } from './useWebsiteCommands'
import { useWebsiteHistory } from './useWebsiteHistory'
import { withWebsiteDefaults, type WebsiteSite, type WebsiteState } from './types'

const fake = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/services/website', async importOriginal => ({ ...await importOriginal<typeof import('@/services/website')>(), websiteCommand: fake.command }))
const scopes: EffectScope[] = []
function fixture() {
  const scope = effectScope(); scopes.push(scope)
  return scope.run(() => {
    const site = ref<WebsiteSite>(withWebsiteDefaults({ name: 'Synthetic', accent: '#174878', pages: [{ id: 'home', title: 'Home', slug: 'home', description: '', inNavigation: true, sections: [] }] }))
    const history = useWebsiteHistory(site); history.reset(site.value)
    const saved = ref(JSON.stringify(site.value)), version = ref(3), loading = ref(false), busy = ref(false)
    const autosave = {
      stash: vi.fn(), ready: ref(true), settle: vi.fn().mockResolvedValue(undefined), conflict: ref(false), problem: ref(''),
      discover: vi.fn(), begin: vi.fn(), online: ref(true), persist: vi.fn(), protectedLocally: computed(() => true), reportFailure: vi.fn(),
    }
    const state = {
      site, saved, version, loading, busy, history, autosave, dirty: computed(() => JSON.stringify(site.value) !== saved.value),
      locked: computed(() => loading.value || busy.value), cssError: ref(''), publishBlocked: ref(false), saving: ref(false), error: ref(''), message: ref(''), starterReview: ref(false),
      publishedAt: ref<number | null>(null), hasPrevious: ref(false), homePageId: ref(''), selectedPage: ref(''), selectedSection: ref(''),
      canDiscard: vi.fn().mockResolvedValue(true), confirm: vi.fn().mockResolvedValue(true), onLoaded: vi.fn(), onRestored: vi.fn(), fitView: vi.fn(),
    }
    return { ...state, ...useWebsiteCommands(state) }
  })!
}
beforeEach(() => { fake.command.mockReset() })
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()) })

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
})
