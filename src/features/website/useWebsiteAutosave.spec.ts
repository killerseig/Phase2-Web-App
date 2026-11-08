import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { WebsiteSite } from './types'
import { useWebsiteAutosave } from './useWebsiteAutosave'

const wrappers: VueWrapper[] = []
type Save = () => Promise<{ version: number }>
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup(save = vi.fn<Save>(async () => ({ version: 2 })), account = 'project:admin') {
  const site = ref<WebsiteSite>({ name: 'Initial', accent: '#174878', pages: [] })
  const saved = ref(JSON.stringify(site.value))
  const version = ref(1)
  const scope = ref(account)
  const blocked = ref(false)
  let autosave!: ReturnType<typeof useWebsiteAutosave>
  const wrapper = mount(
    defineComponent({
      setup() {
        autosave = useWebsiteAutosave({
          site,
          saved,
          version,
          scope: () => scope.value,
          blocked: () => blocked.value,
          save,
        })
        autosave.ready.value = true
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  return { site, saved, version, scope, blocked, save, autosave, wrapper }
}
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
describe('website draft autosave', () => {
  it('rejects an old save across an access revoke and restore to the same scope', async () => {
    const old = deferred<{ version: number }>()
    const save = vi.fn<() => Promise<{ version: number }>>(() => old.promise)
    const state = setup(save)
    state.site.value.name = 'Old session edit'
    await vi.advanceTimersByTimeAsync(3100)
    expect(save).toHaveBeenCalledOnce()
    state.scope.value = ''; state.scope.value = 'project:admin'
    state.site.value = { name: 'Freshly loaded', accent: '#174878', pages: [] }
    state.saved.value = JSON.stringify(state.site.value); state.version.value = 10
    state.autosave.begin()
    old.resolve({ version: 2 }); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(state.version.value).toBe(10)
    expect(JSON.parse(state.saved.value).name).toBe('Freshly loaded')
    expect(state.autosave.problem.value).toBe('')
  })

  it('allows a new scope to save and keeps its busy/error ownership when an older save fails', async () => {
    const old = deferred<{ version: number }>(), newer = deferred<{ version: number }>()
    const save = vi.fn<Save>()
    save.mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise)
    const state = setup(save)
    state.site.value.name = 'Old session edit'; await vi.advanceTimersByTimeAsync(3100)
    state.scope.value = 'project:new-admin'
    state.site.value = { name: 'New baseline', accent: '#174878', pages: [] }
    state.saved.value = JSON.stringify(state.site.value); state.version.value = 10
    state.autosave.begin()
    state.site.value.name = 'New edit'; await vi.advanceTimersByTimeAsync(3100)
    expect(save).toHaveBeenCalledTimes(2)
    old.reject(new Error('Old save failure')); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(state.autosave.saving.value).toBe(true)
    expect(state.autosave.problem.value).toBe('')
    newer.resolve({ version: 11 }); await state.autosave.settle()
    expect(state.version.value).toBe(11)
    expect(state.autosave.saving.value).toBe(false)
  })
  it('does not save loading defaults until the user edits', async () => {
    const state = setup()
    state.autosave.ready.value = false
    state.site.value.name = 'Migrated default'
    state.autosave.begin()
    await vi.advanceTimersByTimeAsync(10000)
    expect(state.save).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    state.site.value.name = 'User edit'
    await vi.advanceTimersByTimeAsync(3100)
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'User edit' }), 1)
  })
  it('backs up edits before debounced saving and clears the local copy only after success', async () => {
    const state = setup()
    state.site.value.name = 'Local edit'
    await vi.advanceTimersByTimeAsync(250)
    expect(state.autosave.protectedLocally.value).toBe(true)
    expect(localStorage.length).toBe(1)
    expect(state.save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(3000)
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Local edit' }), 1)
    expect(state.version.value).toBe(2)
    expect(localStorage.length).toBe(0)
  })
  it('does not mark edits typed during an in-flight save as saved', async () => {
    let finish!: (value: { version: number }) => void
    const save = vi.fn<Save>(
      () =>
        new Promise<{ version: number }>((resolve) => {
          finish = resolve
        }),
    )
    const state = setup(save)
    state.site.value.name = 'First'
    await vi.advanceTimersByTimeAsync(3100)
    state.site.value.name = 'Second'
    finish({ version: 2 })
    await state.autosave.settle()
    expect(JSON.parse(state.saved.value).name).toBe('First')
    expect(state.site.value.name).toBe('Second')
    expect(state.autosave.protectedLocally.value).toBe(true)
    expect(JSON.parse(localStorage.getItem(localStorage.key(0)!)!).draft.name).toBe('Second')
  })
  it('keeps offline recovery across remounts, isolates users and does not publish', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const state = setup()
    state.site.value.name = 'Offline draft'
    window.dispatchEvent(new Event('pagehide'))
    state.wrapper.unmount()
    const resumed = setup()
    expect(resumed.autosave.recoveries.value[0]?.draft.name).toBe('Offline draft')
    const other = setup(undefined, 'project:another-admin')
    expect(other.autosave.recoveries.value).toEqual([])
    await vi.advanceTimersByTimeAsync(30000)
    expect(state.save).not.toHaveBeenCalled()
    expect(resumed.save).not.toHaveBeenCalled()
  })
  it('retries connection failures and saves when online again', async () => {
    const save = vi.fn<Save>()
    save.mockRejectedValueOnce({ code: 'functions/unavailable' })
      .mockResolvedValue({ version: 2 })
    const state = setup(save)
    state.site.value.name = 'Retry edit'
    await vi.advanceTimersByTimeAsync(3100)
    expect(state.autosave.problem.value).toContain('retry')
    expect(state.autosave.protectedLocally.value).toBe(true)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(300)
    expect(save).toHaveBeenCalledTimes(2)
    expect(state.autosave.problem.value).toBe('')
  })
  it('pauses version conflicts without losing the recovery copy', async () => {
    const save = vi.fn<Save>()
    save.mockRejectedValue({ code: 'functions/aborted' })
    const state = setup(save)
    state.site.value.name = 'Conflicting work'
    await vi.advanceTimersByTimeAsync(3100)
    expect(state.autosave.conflict.value).toBe(true)
    state.site.value.name = 'Still editable'
    await vi.advanceTimersByTimeAsync(60000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(state.autosave.protectedLocally.value).toBe(true)
  })
  it('reports unavailable browser storage and keeps separate copies for simultaneous editors', async () => {
    const first = setup()
    const second = setup()
    first.site.value.name = 'Tab one'
    second.site.value.name = 'Tab two'
    first.autosave.persist()
    second.autosave.persist()
    expect(localStorage.length).toBe(2)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    first.site.value.name = 'Unsaved locally'
    first.autosave.persist()
    expect(first.autosave.protectedLocally.value).toBe(false)
    expect(first.autosave.storageProblem.value).toContain('could not be saved')
    second.scope.value = 'project:different-user'
    await nextTick()
    expect(second.autosave.ready.value).toBe(false)
  })
})
