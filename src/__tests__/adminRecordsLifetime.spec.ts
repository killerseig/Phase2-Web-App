import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  useAdminRequestContext,
  useAdminRequestScope,
} from '@/features/admin/useAdminRequestContext'
import { useAdminRecords } from '@/features/admin/useAdminRecords'

const scopes: ReturnType<typeof effectScope>[] = []
function fixture() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const uid = ref('a'),
      enabled = ref(true),
      role = ref('admin')
    const context = useAdminRequestContext(uid, enabled, role)
    const listeners: Array<{
      update: (value: string[]) => void
      error: (reason: unknown) => void
      off: () => void
    }> = []
    const records = useAdminRecords<string>(
      (update, error) => {
        const off = vi.fn<() => void>()
        listeners.push({ update, error, off })
        return off
      },
      { context, errorMessage: 'Unavailable' },
    )
    return { scope, context, uid, enabled, role, listeners, ...records }
  })!
}
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))

describe('admin record and session ownership', () => {
  it.each(['identity', 'access', 'role', 'relogin'] as const)(
    'clears records synchronously on %s changes and rejects queued callbacks',
    (kind) => {
      const state = fixture()
      state.start()
      const old = state.listeners[0]!
      old.update(['private record'])
      const request = state.context.capture()
      if (kind === 'identity') state.uid.value = 'b'
      else if (kind === 'access') state.enabled.value = false
      else if (kind === 'role') state.role.value = 'payroll'
      else {
        state.uid.value = ''
        state.uid.value = 'a'
      }
      expect(state.records.value).toEqual([])
      expect(old.off).toHaveBeenCalledOnce()
      expect(request()).toBe(false)
      old.update(['stale record'])
      old.error(new Error('Old failure'))
      expect(state.records.value).toEqual([])
      expect(state.error.value).toBe('')
    },
  )
  it('keeps data through transient errors, but clears and ends a denied listener', () => {
    const state = fixture()
    state.start()
    const listener = state.listeners[0]!
    listener.update(['record'])
    listener.error(Object.assign(new Error('Retry connection'), { code: 'unavailable' }))
    expect(state.records.value).toEqual(['record'])
    expect(state.error.value).toBe('Retry connection')
    listener.error(Object.assign(new Error('Denied'), { code: 'permission-denied' }))
    listener.update(['queued old record'])
    expect(state.records.value).toEqual([])
    expect(state.error.value).toContain('Permission denied.')
    expect(listener.off).toHaveBeenCalledOnce()
  })
  it('keeps retry ownership and clears disposed records', () => {
    const state = fixture()
    state.start()
    const first = state.listeners[0]!
    state.start()
    const second = state.listeners[1]!
    first.error(new Error('Late failure'))
    first.update(['old'])
    expect(state.loading.value).toBe(true)
    second.update(['current'])
    expect(state.records.value).toEqual(['current'])
    state.scope.stop()
    second.update(['late'])
    expect(state.records.value).toEqual([])
    expect(second.off).toHaveBeenCalledOnce()
    state.start()
    expect(state.listeners).toHaveLength(2)
  })
  it('does not start while access is unavailable', () => {
    const state = fixture()
    state.enabled.value = false
    state.start()
    expect(state.listeners).toHaveLength(0)
    expect(state.loading.value).toBe(false)
  })
  it('releases a listener created during a synchronous access change', () => {
    const state = fixture(),
      off = vi.fn<() => void>()
    const other = state.scope.run(() =>
      useAdminRecords<string>(
        () => {
          state.enabled.value = false
          return off
        },
        { context: state.context, errorMessage: 'Failed' },
      ),
    )!
    other.start()
    expect(off).toHaveBeenCalledOnce()
    expect(other.loading.value).toBe(false)
  })
  it('rejects edit/revert and selection A/B/A while allowing owned busy cleanup after an edit', () => {
    const state = fixture(),
      selection = ref('a'),
      draft = ref({ name: 'Original' })
    const owner = state.scope.run(() => useAdminRequestScope(state.context, selection, draft))!
    const request = owner.capture()
    draft.value.name = 'Edit'
    draft.value.name = 'Original'
    expect(request.current()).toBe(true)
    expect(request.draftCurrent()).toBe(false)
    selection.value = 'b'
    selection.value = 'a'
    expect(request.current()).toBe(false)
    state.scope.stop()
    expect(owner.capture().current()).toBe(false)
  })
})
