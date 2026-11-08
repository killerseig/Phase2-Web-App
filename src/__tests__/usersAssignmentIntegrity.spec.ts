import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  data: new Map<string, Record<string, unknown>>(), versions: new Map<string, number>(), failCommit: false,
}))
vi.mock('@/firebase', () => ({ requireFirebaseServices: () => ({ db: {}, functions: {} }) }))
vi.mock('@/testing/e2eRuntime', () => ({ isE2EActive: () => false }))
vi.mock('firebase/functions', async original => ({ ...await original<typeof import('firebase/functions')>() }))
vi.mock('firebase/firestore', async importOriginal => {
  const original = await importOriginal<typeof import('firebase/firestore')>()
  type Write = { path: string; data: Record<string, unknown> }
  function snapshot(path: string) {
    const data = structuredClone(store.data.get(path))
    return { exists: () => !!data, data: () => data }
  }
  function apply(writes: Write[]) {
    if (store.failCommit) throw new Error('Synthetic commit failure')
    for (const write of writes) {
      store.data.set(write.path, { ...store.data.get(write.path), ...structuredClone(write.data) })
      store.versions.set(write.path, (store.versions.get(write.path) ?? 0) + 1)
    }
  }
  return { ...original,
    doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
    getDoc: async (path: string) => snapshot(path),
    updateDoc: async (path: string, data: Record<string, unknown>) => { apply([{ path, data }]) },
    writeBatch: () => {
      const writes: Write[] = []
      return { update: (path: string, data: Record<string, unknown>) => writes.push({ path, data }), commit: async () => { if (store.failCommit) throw new Error('Synthetic commit failure'); apply(writes) } }
    },
    runTransaction: async (_db: unknown, run: (transaction: { get: (path: string) => Promise<ReturnType<typeof snapshot>>; update: (path: string, data: Record<string, unknown>) => void }) => Promise<void>) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map<string, number>(), writes: Write[] = []
        await run({ get: async path => {
          if (writes.length) throw new Error('Read after write')
          reads.set(path, store.versions.get(path) ?? 0)
          return snapshot(path)
        }, update: (path, data) => { writes.push({ path, data }) } })
        if ([...reads].some(([path, version]) => (store.versions.get(path) ?? 0) !== version)) continue
        apply(writes)
        return
      }
      throw new Error('Conflict retries exhausted')
    },
  }
})
import { createUserByAdmin, updateUser } from '@/services/users'

const details = (assignedJobIds: string[]) => ({ firstName: 'Updated', lastName: 'User', role: 'foreman' as const, active: true, assignedJobIds })
beforeEach(() => {
  store.data.clear(); store.versions.clear(); store.failCommit = false
  store.data.set('users/a', { firstName: 'Original', role: 'foreman', assignedJobIds: [] })
  store.data.set('users/b', { firstName: 'Original', role: 'foreman', assignedJobIds: [] })
  store.data.set('jobs/shared', { assignedForemanIds: ['existing'] })
})
describe('user assignment atomicity', () => {
  it('preserves independent concurrent additions to the same job', async () => {
    await Promise.all([updateUser('a', details(['shared'])), updateUser('b', details(['shared']))])
    expect((store.data.get('jobs/shared')!.assignedForemanIds as string[]).sort()).toEqual(['a', 'b', 'existing'])
  })
  it('preserves an independent addition when another administrator removes a user', async () => {
    store.data.set('users/a', { role: 'foreman', assignedJobIds: ['shared'] })
    store.data.set('jobs/shared', { assignedForemanIds: ['a', 'existing'] })
    await Promise.all([updateUser('a', details([])), updateUser('b', details(['shared']))])
    expect((store.data.get('jobs/shared')!.assignedForemanIds as string[]).sort()).toEqual(['b', 'existing'])
  })
  it('does not leave the profile half updated if assignment persistence fails', async () => {
    // Reject the assignment commit; the old implementation already wrote the profile.
    const original = structuredClone(store.data.get('users/a'))
    const firestore = await import('firebase/firestore')
    const transaction = vi.spyOn(firestore, 'runTransaction').mockRejectedValueOnce(new Error('Synthetic commit failure'))
    const batch = vi.spyOn(firestore, 'writeBatch').mockImplementationOnce(() => ({ update: () => undefined, commit: async () => { throw new Error('Synthetic commit failure') } }) as unknown as ReturnType<typeof firestore.writeBatch>)
    await expect(updateUser('a', details(['shared']))).rejects.toThrow('Synthetic commit failure')
    expect(store.data.get('users/a')).toEqual(original)
    transaction.mockRestore(); batch.mockRestore()
  })
  it('removes field membership on a role transition while retaining permitted employee assignments', async () => {
    store.data.set('users/a', { role: 'foreman', assignedJobIds: ['shared'] })
    store.data.set('jobs/shared', { assignedForemanIds: ['a', 'existing'] })
    await updateUser('a', { ...details(['shared']), role: 'employee' })
    expect(store.data.get('users/a')?.assignedJobIds).toEqual(['shared'])
    expect(store.data.get('jobs/shared')?.assignedForemanIds).toEqual(['existing'])
  })

  it('does not start an assignment transaction after the creation owner is invalidated', async () => {
    const functions = await import('firebase/functions'), firestore = await import('firebase/firestore')
    let resolve!: (response: { data: { success: boolean; uid: string; message: string } }) => void
    const call = vi.fn<() => Promise<{ data: { success: boolean; uid: string; message: string } }>>()
      .mockImplementation(() => new Promise(done => { resolve = done }))
    const callable = vi.spyOn(functions, 'httpsCallable').mockReturnValue(call as unknown as ReturnType<typeof functions.httpsCallable>)
    const transaction = vi.spyOn(firestore, 'runTransaction')
    let current = true
    const creation = createUserByAdmin({ email: 'synthetic@example.invalid', firstName: 'New', lastName: 'User', role: 'foreman', assignedJobIds: ['shared'] }, { isCurrent: () => current })
    current = false
    resolve({ data: { success: true, uid: 'a', message: 'Account created.' } })
    const result = await creation
    expect(result.uid).toBe('a')
    expect(transaction).not.toHaveBeenCalled()
    expect(store.data.get('users/a')?.assignedJobIds).toEqual([])
    callable.mockRestore(); transaction.mockRestore()
  })
})
