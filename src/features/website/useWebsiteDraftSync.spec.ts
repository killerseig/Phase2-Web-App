import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, type EffectScope } from 'vue'
import { useWebsiteDraftSync } from './useWebsiteDraftSync'

type State = { version: number; draft: string }
const scopes: EffectScope[] = []
let online = true
let visibility: DocumentVisibilityState = 'visible'

function deferred() {
  let resolve!: (state: State) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<State>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function setup(load = vi.fn(async (): Promise<State> => ({ version: 2, draft: 'Remote' }))) {
  const scope = ref('project:admin')
  const snapshot = ref('Initial')
  const version = ref(1)
  const ready = ref(true)
  const dirty = ref(false)
  const blocked = ref(false)
  const apply = vi.fn((state: State) => {
    snapshot.value = state.draft
    version.value = state.version
  })
  const lifetime = effectScope()
  scopes.push(lifetime)
  const sync = lifetime.run(() =>
    useWebsiteDraftSync({
      scope: () => scope.value,
      snapshot,
      version,
      ready: () => ready.value,
      dirty: () => dirty.value,
      blocked: () => blocked.value,
      load,
      apply,
    }),
  )!
  return { scope, snapshot, version, ready, dirty, blocked, apply, load, sync, lifetime }
}

beforeEach(() => {
  vi.useFakeTimers()
  online = true
  visibility = 'visible'
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('shared website draft revalidation', () => {
  it('applies newer versions only while the draft remains clean and idle', async () => {
    const state = setup()
    await state.sync.check()
    expect(state.apply).toHaveBeenCalledWith({ version: 2, draft: 'Remote' })
    expect(state.snapshot.value).toBe('Remote')
    expect(state.version.value).toBe(2)
    expect(state.sync.newerVersion.value).toBeNull()
    expect(state.sync.checking.value).toBe(false)
  })

  it.each(['dirty', 'blocked'] as const)(
    'announces a newer version without replacing a %s editor',
    async (key) => {
      const state = setup()
      state[key].value = true
      await state.sync.check()
      expect(state.apply).not.toHaveBeenCalled()
      expect(state.snapshot.value).toBe('Initial')
      expect(state.version.value).toBe(1)
      expect(state.sync.newerVersion.value).toBe(2)
      state[key].value = false
      await state.sync.check()
      expect(state.apply).toHaveBeenCalledOnce()
      expect(state.sync.newerVersion.value).toBeNull()
    },
  )

  it('keeps edits begun while the remote read was in flight', async () => {
    const response = deferred()
    const state = setup(vi.fn(() => response.promise))
    const request = state.sync.check()
    state.snapshot.value = 'Typed while loading'
    state.dirty.value = true
    response.resolve({ version: 3, draft: 'Other administrator' })
    await request
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.snapshot.value).toBe('Typed while loading')
    expect(state.sync.newerVersion.value).toBe(3)
  })

  it('checks the snapshot even when a caller has not yet marked an edit dirty', async () => {
    const response = deferred()
    const state = setup(vi.fn(() => response.promise))
    const request = state.sync.check()
    state.snapshot.value = 'Changed snapshot'
    response.resolve({ version: 2, draft: 'Remote' })
    await request
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.sync.newerVersion.value).toBe(2)
  })

  it('does not replace an editor that started a save or recovery during the read', async () => {
    const response = deferred()
    const state = setup(vi.fn(() => response.promise))
    const request = state.sync.check()
    state.blocked.value = true
    response.resolve({ version: 2, draft: 'Remote' })
    await request
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.sync.newerVersion.value).toBe(2)
  })

  it('does not apply a response across a completed local save, even if a newer remote version exists', async () => {
    const response = deferred()
    const state = setup(vi.fn(() => response.promise))
    const request = state.sync.check()
    state.version.value = 2
    response.resolve({ version: 3, draft: 'Remote after local save' })
    await request
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.version.value).toBe(2)
    expect(state.sync.newerVersion.value).toBe(3)
  })

  it('ignores equal, older, and out-of-order versions and clears a superseded notice', async () => {
    const load = vi.fn(async (): Promise<State> => ({ version: 5, draft: 'Latest' }))
    const state = setup(load)
    state.dirty.value = true
    await state.sync.check()
    expect(state.sync.newerVersion.value).toBe(5)
    state.dirty.value = false
    load.mockResolvedValue({ version: 4, draft: 'Older response' })
    await state.sync.check()
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.sync.newerVersion.value).toBe(5)
    state.version.value = 5
    expect(state.sync.newerVersion.value).toBeNull()
    load.mockResolvedValue({ version: 5, draft: 'Same version' })
    await state.sync.check()
    load.mockResolvedValue({ version: 3, draft: 'Stale response' })
    await state.sync.check()
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.sync.newerVersion.value).toBeNull()
  })

  it('coalesces focus, visibility, reconnect, polling and manual checks into one request', async () => {
    const response = deferred()
    const state = setup(vi.fn(() => response.promise))
    const request = state.sync.check()
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(state.load).toHaveBeenCalledOnce()
    expect(state.sync.checking.value).toBe(true)
    response.resolve({ version: 2, draft: 'Remote' })
    await request
    expect(state.apply).toHaveBeenCalledOnce()
  })

  it('polls only a ready, visible, online, authenticated editor and rechecks on return', async () => {
    const state = setup()
    state.ready.value = false
    await vi.advanceTimersByTimeAsync(30_000)
    state.ready.value = true
    visibility = 'hidden'
    await vi.advanceTimersByTimeAsync(30_000)
    visibility = 'visible'
    online = false
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(30_000)
    online = true
    state.scope.value = ''
    await vi.advanceTimersByTimeAsync(30_000)
    expect(state.load).not.toHaveBeenCalled()
    state.scope.value = 'project:admin'
    document.dispatchEvent(new Event('visibilitychange'))
    await state.sync.check()
    expect(state.load).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(state.load).toHaveBeenCalledTimes(2)
  })

  it('does not apply when the editor becomes hidden or offline before the response', async () => {
    const response = deferred()
    const state = setup(vi.fn(() => response.promise))
    const request = state.sync.check()
    await Promise.resolve()
    visibility = 'hidden'
    response.resolve({ version: 2, draft: 'Remote' })
    await request
    expect(state.apply).not.toHaveBeenCalled()
    visibility = 'visible'
    online = false
    await state.sync.check()
    expect(state.load).toHaveBeenCalledOnce()
  })

  it('silently retries transient read failures on a later event', async () => {
    const load = vi.fn(async (): Promise<State> => ({ version: 2, draft: 'Remote' }))
    load.mockRejectedValueOnce(new Error('Network unavailable'))
    const state = setup(load)
    await state.sync.check()
    expect(state.snapshot.value).toBe('Initial')
    expect(state.sync.checking.value).toBe(false)
    expect(state.sync.newerVersion.value).toBeNull()
    window.dispatchEvent(new Event('online'))
    await state.sync.check()
    expect(state.load).toHaveBeenCalledTimes(2)
    expect(state.apply).toHaveBeenCalledOnce()
  })

  it('invalidates old requests across account changes without blocking the new account', async () => {
    const oldResponse = deferred()
    const newResponse = deferred()
    const load = vi.fn(() => oldResponse.promise).mockImplementationOnce(() => oldResponse.promise)
    const state = setup(load)
    const oldRequest = state.sync.check()
    await Promise.resolve()
    state.scope.value = 'project:other-admin'
    load.mockImplementation(() => newResponse.promise)
    const newRequest = state.sync.check()
    oldResponse.resolve({ version: 100, draft: 'Old account' })
    await oldRequest
    expect(state.apply).not.toHaveBeenCalled()
    expect(state.sync.checking.value).toBe(true)
    expect(state.sync.newerVersion.value).toBeNull()
    newResponse.resolve({ version: 2, draft: 'Current account' })
    await newRequest
    expect(state.apply).toHaveBeenCalledWith({ version: 2, draft: 'Current account' })
    expect(state.sync.checking.value).toBe(false)
  })

  it('invalidates a request even when an account changes away and back', async () => {
    const response = deferred()
    const state = setup(vi.fn(() => response.promise))
    const request = state.sync.check()
    await Promise.resolve()
    state.scope.value = ''
    state.scope.value = 'project:admin'
    response.resolve({ version: 2, draft: 'Old session' })
    await request
    expect(state.apply).not.toHaveBeenCalled()
  })

  it('does not start queued reads after stopping or changing accounts', async () => {
    const state = setup()
    const oldRequest = state.sync.check()
    state.scope.value = ''
    await oldRequest
    expect(state.load).not.toHaveBeenCalled()
    state.scope.value = 'project:admin'
    const request = state.sync.check()
    state.sync.stop()
    await request
    expect(state.load).not.toHaveBeenCalled()
  })

  it.each(['stop', 'dispose'] as const)(
    'cleans up events, polling, and in-flight work on %s',
    async (mode) => {
      const response = deferred()
      const state = setup(vi.fn(() => response.promise))
      const request = state.sync.check()
      await Promise.resolve()
      if (mode === 'stop') state.sync.stop()
      else state.lifetime.stop()
      response.resolve({ version: 2, draft: 'Late response' })
      await request
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(90_000)
      await state.sync.check()
      expect(state.load).toHaveBeenCalledOnce()
      expect(state.apply).not.toHaveBeenCalled()
      expect(state.sync.checking.value).toBe(false)
    },
  )
})
