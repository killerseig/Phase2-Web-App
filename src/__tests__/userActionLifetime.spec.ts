import { computed, effectScope, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminRequestContext } from '@/features/admin/useAdminRequestContext'
import { useUserCreateActions } from '@/features/users/useUserCreateActions'
import { useUserDetailActions } from '@/features/users/useUserDetailActions'
import {
  createUserByAdmin,
  deleteUserByAdmin,
  resendUserInviteByAdmin,
  sendPendingInvitesByAdmin,
  sendUserPasswordResetByAdmin,
  updateUser,
} from '@/services/users'
import type { UserProfile } from '@/types/domain'

vi.mock('@/services/users', () => ({
  createUserByAdmin: vi.fn<(typeof import('@/services/users'))['createUserByAdmin']>(),
  deleteUserByAdmin: vi.fn<(typeof import('@/services/users'))['deleteUserByAdmin']>(),
  resendUserInviteByAdmin: vi.fn<(typeof import('@/services/users'))['resendUserInviteByAdmin']>(),
  sendPendingInvitesByAdmin:
    vi.fn<(typeof import('@/services/users'))['sendPendingInvitesByAdmin']>(),
  sendUserPasswordResetByAdmin:
    vi.fn<(typeof import('@/services/users'))['sendUserPasswordResetByAdmin']>(),
  updateUser: vi.fn<(typeof import('@/services/users'))['updateUser']>(),
}))
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const scopes: ReturnType<typeof effectScope>[] = []
function fixture() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const uid = ref('admin-a'),
      enabled = ref(true),
      context = useAdminRequestContext(uid, enabled)
    const selectedUserId = ref<string | null>('a'),
      dirty = ref(true)
    const selectedUser = computed<UserProfile | null>(() =>
      selectedUserId.value && selectedUserId.value !== 'new'
        ? {
            id: selectedUserId.value,
            firstName: 'Synthetic',
            lastName: 'Person',
            email: `${selectedUserId.value}@example.test`,
            role: 'foreman',
            active: true,
            assignedJobIds: [],
          }
        : null,
    )
    const createForm = reactive({
      email: 'new@example.test',
      firstName: 'Synthetic',
      lastName: 'New',
      role: 'foreman' as const,
      assignedJobIds: [] as string[],
    })
    const detailForm = reactive({
      firstName: 'Synthetic',
      lastName: 'Person',
      role: 'foreman' as const,
      active: true,
      assignedJobIds: [] as string[],
    })
    const createInfo = ref(''),
      detailInfo = ref(''),
      detailError = ref(''),
      inviteInfo = ref('')
    const createAction = ref<'queue' | 'send' | null>(null),
      emailAction = ref<'invite' | 'reset' | null>(null)
    const inviteLoading = ref(false),
      saveLoading = ref(false),
      deleteLoading = ref(false),
      deleteConfirmOpen = ref(false)
    const create = useUserCreateActions({
      context,
      createAction,
      createForm,
      inviteLoading,
      selectedUserId,
      resetCreateMessages: () => {
        createInfo.value = ''
      },
      resetInviteMessages: () => {
        inviteInfo.value = ''
      },
      setCreateError: (_error, text) => {
        createInfo.value = text
      },
      setCreateErrorMessage: (text) => {
        createInfo.value = text
      },
      setCreateInfo: (text) => {
        createInfo.value = text
      },
      setInviteError: (_error, text) => {
        inviteInfo.value = text
      },
      setInviteInfo: (text) => {
        inviteInfo.value = text
      },
    })
    const actions = useUserDetailActions({
      context,
      deleteConfirmOpen,
      deleteLoading,
      detailError,
      emailAction,
      detailForm,
      editingSelf: ref(false),
      hasUnsavedDetailChanges: () => dirty.value,
      isCreateMode: computed(() => selectedUserId.value === 'new'),
      resetCreateForm: () => undefined,
      saveLoading,
      selectedUser,
      selectedUserId,
      syncingDetailForm: ref(false),
      toggleDetailAssignedJob: (id) => {
        detailForm.assignedJobIds.push(id)
      },
      setDetailError: (_error, text) => {
        detailError.value = text
      },
      setDetailErrorMessage: (text) => {
        detailError.value = text
      },
      setDetailInfo: (text) => {
        detailInfo.value = text
      },
    })
    return {
      scope,
      context,
      uid,
      enabled,
      selectedUserId,
      dirty,
      createForm,
      detailForm,
      createInfo,
      detailInfo,
      detailError,
      inviteInfo,
      createAction,
      emailAction,
      inviteLoading,
      saveLoading,
      deleteLoading,
      deleteConfirmOpen,
      ...actions,
      ...create,
    }
  })!
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.useRealTimers()
})

describe('user request and confirmation ownership', () => {
  it('does not select a created account after selection changed', async () => {
    const request = deferred<Awaited<ReturnType<typeof createUserByAdmin>>>()
    vi.mocked(createUserByAdmin).mockReturnValue(request.promise)
    const state = fixture()
    state.selectedUserId.value = 'new'
    const pending = state.handleCreateUser(false)
    state.selectedUserId.value = 'b'
    const lifecycle = vi.mocked(createUserByAdmin).mock.calls[0]?.[1]
    expect(lifecycle?.isCurrent()).toBe(false)
    request.resolve({ uid: 'created', success: true, message: 'Created' })
    await pending
    expect(state.selectedUserId.value).toBe('b')
    expect(state.createInfo.value).toBe('')
  })
  it.each(['selection', 'relogin', 'access', 'disposal'] as const)(
    'revokes pending deletion on %s',
    async (kind) => {
      const state = fixture()
      await state.handleDeleteUser()
      if (kind === 'selection') {
        state.selectedUserId.value = 'b'
        state.selectedUserId.value = 'a'
      } else if (kind === 'relogin') {
        state.uid.value = ''
        state.uid.value = 'admin-a'
      } else if (kind === 'access') state.enabled.value = false
      else state.scope.stop()
      await state.confirmDeleteUser()
      expect(deleteUserByAdmin).not.toHaveBeenCalled()
    },
  )
  it('deletes only the captured target and preserves a later selection on completion', async () => {
    const request = deferred<Awaited<ReturnType<typeof deleteUserByAdmin>>>()
    vi.mocked(deleteUserByAdmin).mockReturnValue(request.promise)
    const state = fixture()
    await state.handleDeleteUser()
    const pending = state.confirmDeleteUser()
    state.selectedUserId.value = 'b'
    request.resolve({ success: true, message: 'Deleted A' })
    await pending
    expect(deleteUserByAdmin).toHaveBeenCalledExactlyOnceWith('a')
    expect(state.selectedUserId.value).toBe('b')
    expect(state.detailInfo.value).not.toBe('Deleted A')
  })
  it('keeps a new save busy and suppresses the previous failure', async () => {
    const first = deferred<void>(),
      second = deferred<void>()
    vi.mocked(updateUser).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const state = fixture()
    const old = state.handleAutoSaveUser()
    state.selectedUserId.value = 'b'
    const current = state.handleAutoSaveUser()
    first.reject(new Error('Old failure'))
    await old
    expect(state.saveLoading.value).toBe(true)
    expect(state.detailError.value).toBe('')
    second.resolve()
    await current
    expect(state.saveLoading.value).toBe(false)
  })
  it.each(['invite', 'reset'] as const)(
    'does not send %s after access changes during the preparatory save',
    async (action) => {
      const request = deferred<void>()
      vi.mocked(updateUser).mockReturnValue(request.promise)
      const state = fixture()
      const pending =
        action === 'invite' ? state.handleResendInvite() : state.handleSendPasswordReset()
      state.enabled.value = false
      request.resolve()
      await pending
      expect(resendUserInviteByAdmin).not.toHaveBeenCalled()
      expect(sendUserPasswordResetByAdmin).not.toHaveBeenCalled()
      expect(state.emailAction.value).toBeNull()
    },
  )
  it('cancels queued saves on disposal', () => {
    vi.useFakeTimers()
    const state = fixture()
    state.queueDetailSave()
    state.scope.stop()
    vi.runAllTimers()
    expect(updateUser).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('suppresses obsolete pending-invite results across same-account relogin', async () => {
    const request = deferred<Awaited<ReturnType<typeof sendPendingInvitesByAdmin>>>()
    vi.mocked(sendPendingInvitesByAdmin).mockReturnValue(request.promise)
    const state = fixture()
    const pending = state.handleSendPendingInvites()
    state.uid.value = ''
    state.uid.value = 'admin-a'
    request.resolve({ success: true, sentCount: 1, skippedCount: 0, message: 'Old result' })
    await pending
    expect(state.inviteInfo.value).toBe('')
    expect(state.inviteLoading.value).toBe(false)
  })
  it('preserves an owned email action after an unchanged successful save', async () => {
    vi.mocked(updateUser).mockResolvedValue()
    vi.mocked(sendUserPasswordResetByAdmin).mockResolvedValue({
      success: true,
      message: 'Queued',
      email: 'a@example.test',
    })
    const state = fixture()
    await state.handleSendPasswordReset()
    expect(sendUserPasswordResetByAdmin).toHaveBeenCalledExactlyOnceWith('a')
    expect(state.detailInfo.value).toBe('Queued')
    expect(state.emailAction.value).toBeNull()
  })
  it.each(['identical', 'normalized'] as const)(
    'continues an owned email action after %s server form synchronization',
    async (kind) => {
      const request = deferred<void>()
      vi.mocked(updateUser).mockReturnValue(request.promise)
      vi.mocked(resendUserInviteByAdmin).mockResolvedValue({
        success: true,
        message: 'Sent',
        email: 'a@example.test',
      })
      const state = fixture()
      if (kind === 'normalized') state.detailForm.firstName = ' Synthetic '
      const pending = state.handleResendInvite()
      state.detailForm.assignedJobIds = [...state.detailForm.assignedJobIds]
      state.detailForm.firstName = 'Synthetic'
      request.resolve()
      await pending
      expect(resendUserInviteByAdmin).toHaveBeenCalledExactlyOnceWith('a')
      expect(state.detailInfo.value).toBe('Sent')
    },
  )
  it('does not send an email after an actual edit and revert during its save', async () => {
    const request = deferred<void>()
    vi.mocked(updateUser).mockReturnValue(request.promise)
    const state = fixture(),
      pending = state.handleResendInvite()
    state.detailForm.firstName = 'Different'
    state.detailForm.firstName = 'Synthetic'
    request.resolve()
    await pending
    expect(resendUserInviteByAdmin).not.toHaveBeenCalled()
  })
})
