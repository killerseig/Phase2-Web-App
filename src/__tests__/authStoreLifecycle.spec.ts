import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionUser } from '@/services/auth'
import type { UserProfile } from '@/types/domain'

const fake = vi.hoisted(() => ({
  profile: vi.fn<typeof import('@/services/auth').getOrCreateUserProfile>(),
  signIn: vi.fn<typeof import('@/services/auth').signInWithPassword>(),
  signOut: vi.fn<typeof import('@/services/auth').signOutOfAuthSession>(),
  subscribeAuth: vi.fn<typeof import('@/services/auth').subscribeAuthSession>(),
  subscribeProfile: vi.fn<typeof import('@/services/auth').subscribeUserProfile>(),
  clearExports: vi.fn<() => void>(),
  resetJobs: vi.fn<() => void>(),
}))
vi.mock('@/services/auth', () => ({
  getOrCreateUserProfile: fake.profile,
  signInWithPassword: fake.signIn,
  signOutOfAuthSession: fake.signOut,
  subscribeAuthSession: fake.subscribeAuth,
  subscribeUserProfile: fake.subscribeProfile,
}))
vi.mock('@/services/firebaseConfig', () => ({ hasConfiguredFirebase: true }))
vi.mock('@/stores/jobs', () => ({ useJobsStore: () => ({ $reset: fake.resetJobs }) }))
vi.mock('@/features/timecards/pdf-export', () => ({ clearTimecardPdfExports: fake.clearExports }))
vi.mock('@/testing/e2eRuntime', () => ({ isE2EActive: () => false, getE2EAuthState: () => null }))
import { useAuthStore } from '@/stores/auth'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const user = (uid: string): AuthSessionUser => ({
  uid,
  email: `${uid}@example.invalid`,
  displayName: uid,
})
const profile = (uid: string): UserProfile => ({
  id: uid,
  email: `${uid}@example.invalid`,
  firstName: uid,
  lastName: '',
  role: uid === 'a' ? 'admin' : 'foreman',
  active: true,
  assignedJobIds: [`${uid}-job`],
})
type ProfileListener = {
  uid: string
  next: (profile: UserProfile | null) => void
  error: (reason: unknown) => void
  stop: ReturnType<typeof vi.fn<() => void>>
}
const sessions: {
  next: (user: AuthSessionUser | null) => void
  stop: ReturnType<typeof vi.fn<() => void>>
}[] = []
const profiles: ProfileListener[] = []
const stores: ReturnType<typeof useAuthStore>[] = []
async function settle() {
  for (let index = 0; index < 12; index++) await Promise.resolve()
}
function fixture() {
  setActivePinia(createPinia())
  const store = useAuthStore()
  stores.push(store)
  const ready = store.init()
  const session = sessions.at(-1)!
  return { store, ready, session }
}
async function signedIn(uid = 'a') {
  const state = fixture()
  state.session.next(user(uid))
  await state.ready
  await settle()
  return state
}
beforeEach(() => {
  vi.clearAllMocks()
  sessions.length = 0
  profiles.length = 0
  fake.profile.mockReset().mockImplementation(async (uid) => profile(uid))
  fake.signIn.mockReset()
  fake.signOut.mockReset().mockResolvedValue(undefined)
  fake.subscribeAuth.mockImplementation((next) => {
    const stop = vi.fn<() => void>()
    sessions.push({ next, stop })
    return stop
  })
  fake.subscribeProfile.mockImplementation((uid, next, error) => {
    const stop = vi.fn<() => void>()
    profiles.push({ uid, next, error, stop })
    return stop
  })
})
afterEach(() => {
  stores.splice(0).forEach((store) => store.$dispose())
  vi.useRealTimers()
})

describe('auth store session lifetime', () => {
  it('ignores late A hydration after B becomes the current user', async () => {
    const pending = deferred<UserProfile>()
    fake.profile.mockImplementation((uid) =>
      uid === 'a' ? pending.promise : Promise.resolve(profile(uid)),
    )
    const { store, ready, session } = fixture()
    session.next(user('a'))
    session.next(user('b'))
    await ready
    expect(store.profile?.id).toBe('b')
    pending.resolve(profile('a'))
    await settle()
    expect(store.currentUser?.uid).toBe('b')
    expect(store.profile?.id).toBe('b')
    expect(profiles.map((listener) => listener.uid)).toEqual(['b'])
  })

  it('clears A access immediately on B entry and ignores queued A listener callbacks', async () => {
    const { store, session } = await signedIn()
    const old = profiles[0]!,
      pending = deferred<UserProfile>()
    fake.profile.mockReturnValue(pending.promise)
    const resets = fake.resetJobs.mock.calls.length
    session.next(user('b'))
    expect(store.profile).toBeNull()
    expect(store.rawRole).toBe('none')
    expect(store.assignedJobIds).toEqual([])
    expect(old.stop).toHaveBeenCalledOnce()
    expect(fake.resetJobs.mock.calls.length).toBeGreaterThan(resets)
    old.next(profile('a'))
    old.error(new Error('Old listener denied'))
    await settle()
    expect(store.currentUser?.uid).toBe('b')
    expect(store.profile).toBeNull()
    expect(fake.signOut).not.toHaveBeenCalled()
    pending.resolve(profile('b'))
    await settle()
    expect(store.profile?.id).toBe('b')
  })

  it('does not sign B out when A hydration fails late', async () => {
    const pending = deferred<UserProfile>()
    fake.profile.mockImplementation((uid) =>
      uid === 'a' ? pending.promise : Promise.resolve(profile(uid)),
    )
    const { store, ready, session } = fixture()
    session.next(user('a'))
    session.next(user('b'))
    await ready
    pending.reject(new Error('Old profile denied'))
    await settle()
    expect(fake.signOut).not.toHaveBeenCalled()
    expect(store.profile?.id).toBe('b')
  })

  it('clears local state before provider signout and rejects in-flight hydration', async () => {
    const hydration = deferred<UserProfile>(),
      provider = deferred<void>()
    fake.profile.mockReturnValue(hydration.promise)
    fake.signOut.mockReturnValue(provider.promise)
    const { store, session, ready } = fixture()
    session.next(user('a'))
    const signingOut = store.signOut()
    expect(store.currentUser).toBeNull()
    expect(store.profile).toBeNull()
    expect(store.hasWorkspaceAccess).toBe(false)
    hydration.resolve(profile('a'))
    await settle()
    expect(store.profile).toBeNull()
    expect(profiles).toEqual([])
    provider.resolve()
    await signingOut
    await ready
  })

  it('does not clear a newer B session when an older provider signout completes', async () => {
    const { store, session } = await signedIn()
    const provider = deferred<void>()
    fake.signOut.mockReturnValue(provider.promise)
    const signingOut = store.signOut()
    session.next(user('b'))
    await settle()
    expect(store.profile?.id).toBe('b')
    provider.resolve()
    await signingOut
    expect(store.currentUser?.uid).toBe('b')
    expect(store.profile?.id).toBe('b')
  })

  it.each(['success', 'failure'] as const)(
    'ignores stale listener-retry %s after switching users',
    async (outcome) => {
      vi.useFakeTimers()
      const { store, session } = await signedIn()
      const pending = deferred<UserProfile>()
      fake.profile.mockImplementation((uid) =>
        uid === 'a' ? pending.promise : Promise.resolve(profile(uid)),
      )
      profiles[0]!.error(Object.assign(new Error('Retry'), { code: 'unavailable' }))
      await vi.advanceTimersByTimeAsync(1500)
      session.next(user('b'))
      await settle()
      if (outcome === 'success') pending.resolve(profile('a'))
      else pending.reject(new Error('Old retry denied'))
      await settle()
      expect(store.profile?.id).toBe('b')
      expect(profiles.map((listener) => listener.uid)).toEqual(['a', 'b'])
      expect(fake.signOut).not.toHaveBeenCalled()
    },
  )

  it('stops profile backoff when the session changes', async () => {
    vi.useFakeTimers()
    fake.profile.mockImplementation((uid) =>
      uid === 'a'
        ? Promise.reject(Object.assign(new Error('Retry'), { code: 'permission-denied' }))
        : Promise.resolve(profile(uid)),
    )
    const { store, session, ready } = fixture()
    session.next(user('a'))
    await settle()
    session.next(user('b'))
    await ready
    await vi.advanceTimersByTimeAsync(1100)
    expect(fake.profile.mock.calls.filter(([uid]) => uid === 'a')).toHaveLength(1)
    expect(store.profile?.id).toBe('b')
    expect(fake.signOut).not.toHaveBeenCalled()
  })

  it('shares login hydration with its auth observer and installs one listener', async () => {
    const { store, session, ready } = fixture()
    session.next(null)
    await ready
    const pending = deferred<UserProfile>()
    fake.profile.mockReturnValue(pending.promise)
    fake.signIn.mockImplementation(async () => {
      session.next(user('a'))
      return user('a')
    })
    const login = store.login('a@example.invalid', 'synthetic-password')
    await settle()
    expect(fake.profile).toHaveBeenCalledOnce()
    pending.resolve(profile('a'))
    await login
    await settle()
    expect(store.profile?.id).toBe('a')
    expect(profiles.map((listener) => listener.uid)).toEqual(['a'])
  })

  it('also shares hydration when the login result arrives before its observer event', async () => {
    const { store, session, ready } = fixture()
    session.next(null)
    await ready
    const pending = deferred<UserProfile>()
    fake.profile.mockReturnValue(pending.promise)
    fake.signIn.mockResolvedValue(user('a'))
    const login = store.login('a@example.invalid', 'synthetic-password')
    await settle()
    session.next(user('a'))
    await settle()
    expect(fake.profile).toHaveBeenCalledOnce()
    pending.resolve(profile('a'))
    await login
    await settle()
    expect(store.hasWorkspaceAccess).toBe(true)
    expect(profiles.map((listener) => listener.uid)).toEqual(['a'])
  })

  it.each(['signout', 'another-user'] as const)(
    'rejects a credential response superseded by %s',
    async (change) => {
      const { store, session, ready } = fixture()
      session.next(null)
      await ready
      const credentials = deferred<AuthSessionUser>()
      fake.signIn.mockReturnValue(credentials.promise)
      const login = store.login('a@example.invalid', 'synthetic-password')
      const result = login.catch((error: unknown) => error)
      await settle()
      if (change === 'signout') await store.signOut()
      else {
        session.next(user('b'))
        await settle()
      }
      credentials.resolve(user('a'))
      expect(await result).toMatchObject({ message: 'Sign-in attempt is no longer current. Please try again.' })
      expect(store.currentUser?.uid ?? null).toBe(change === 'signout' ? null : 'b')
      expect(fake.profile.mock.calls.some(([uid]) => uid === 'a')).toBe(false)
    },
  )

  it('rejects a stale login completion while the newer account is still hydrating', async () => {
    const { store, session, ready } = fixture()
    session.next(null)
    await ready
    const old = deferred<UserProfile>(),
      current = deferred<UserProfile>()
    fake.profile.mockImplementation((uid) => (uid === 'a' ? old.promise : current.promise))
    fake.signIn.mockResolvedValue(user('a'))
    const login = store.login('a@example.invalid', 'synthetic-password')
    const result = login.catch((error: unknown) => error)
    await settle()
    session.next(user('b'))
    old.resolve(profile('a'))
    expect(await result).toMatchObject({ message: 'Sign-in attempt is no longer current. Please try again.' })
    expect(store.currentUser?.uid).toBe('b')
    expect(store.profile).toBeNull()
    expect(fake.signOut).not.toHaveBeenCalled()
    current.resolve(profile('b'))
    await settle()
    expect(store.profile?.id).toBe('b')
  })

  it('does not accept an earlier A request after signing out and back in as A', async () => {
    const pending = deferred<UserProfile>()
    fake.profile.mockReturnValueOnce(pending.promise)
    const { store, session, ready } = fixture()
    session.next(user('a'))
    session.next(null)
    await ready
    session.next(user('a'))
    await settle()
    pending.resolve({ ...profile('a'), firstName: 'Old profile' })
    await settle()
    expect(store.profile?.firstName).toBe('a')
    expect(profiles.map((listener) => listener.uid)).toEqual(['a'])
  })

  it('recovers a current profile with bounded backoff and installs its live listener', async () => {
    vi.useFakeTimers()
    const retryable = Object.assign(new Error('Permission propagation'), {
      code: 'permission-denied',
    })
    fake.profile.mockRejectedValueOnce(retryable).mockRejectedValueOnce(retryable)
    const { store, session, ready } = fixture()
    session.next(user('a'))
    await settle()
    await vi.advanceTimersByTimeAsync(249)
    expect(fake.profile).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fake.profile).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(800)
    await ready
    expect(fake.profile).toHaveBeenCalledTimes(3)
    expect(store.hasWorkspaceAccess).toBe(true)
    expect(profiles).toHaveLength(1)
    profiles[0]!.next({ ...profile('a'), firstName: 'Updated' })
    expect(store.displayName).toBe('Updated')
  })

  it('recovers a current transient listener failure and retires the failed subscription', async () => {
    vi.useFakeTimers()
    const { store } = await signedIn()
    const old = profiles[0]!
    old.error(Object.assign(new Error('Temporarily unavailable'), { code: 'unavailable' }))
    await vi.advanceTimersByTimeAsync(1500)
    expect(fake.profile).toHaveBeenCalledTimes(2)
    expect(old.stop).toHaveBeenCalledOnce()
    expect(profiles).toHaveLength(2)
    old.error(new Error('Late old failure'))
    old.next({ ...profile('a'), role: 'none' })
    expect(store.rawRole).toBe('admin')
    expect(fake.signOut).not.toHaveBeenCalled()
    profiles[1]!.next({ ...profile('a'), role: 'foreman' })
    expect(store.rawRole).toBe('foreman')
  })

  it.each(['missing', 'inactive'] as const)(
    'revokes a current %s profile before provider signout resolves',
    async (state) => {
      const { store } = await signedIn()
      const provider = deferred<void>()
      fake.signOut.mockReturnValue(provider.promise)
      profiles[0]!.next(state === 'missing' ? null : { ...profile('a'), active: false })
      expect(store.currentUser).toBeNull()
      expect(store.profile).toBeNull()
      expect(store.hasWorkspaceAccess).toBe(false)
      expect(fake.signOut).toHaveBeenCalledOnce()
      provider.resolve()
      await settle()
    },
  )

  it('disposes subscriptions, pending retry timers and late callbacks per store', async () => {
    vi.useFakeTimers()
    const { store, session } = await signedIn()
    const old = profiles[0]!
    old.error(Object.assign(new Error('Retry'), { code: 'unavailable' }))
    store.$dispose()
    expect(session.stop).toHaveBeenCalledOnce()
    expect(old.stop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    const calls = fake.profile.mock.calls.length
    session.next(user('b'))
    old.next(profile('b'))
    old.error(new Error('Old error'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(fake.profile).toHaveBeenCalledTimes(calls)
    expect(fake.signOut).not.toHaveBeenCalled()
    const another = fixture()
    another.session.next(user('b'))
    await another.ready
    expect(fake.subscribeAuth).toHaveBeenCalledTimes(2)
    expect(another.store.profile?.id).toBe('b')
  })

  it('does not install a listener after disposal during hydration', async () => {
    const pending = deferred<UserProfile>()
    fake.profile.mockReturnValue(pending.promise)
    const { store, session, ready } = fixture()
    session.next(user('a'))
    store.$dispose()
    pending.resolve(profile('a'))
    await settle()
    await ready
    expect(store.profile).toBeNull()
    expect(profiles).toEqual([])
  })

  it('cancels hydration backoff on disposal without starting another request', async () => {
    vi.useFakeTimers()
    fake.profile.mockRejectedValue(Object.assign(new Error('Retry'), { code: 'permission-denied' }))
    const { store, session, ready } = fixture()
    session.next(user('a'))
    await settle()
    expect(vi.getTimerCount()).toBe(1)
    store.$dispose()
    await ready
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fake.profile).toHaveBeenCalledOnce()
    expect(fake.signOut).not.toHaveBeenCalled()
  })
})
