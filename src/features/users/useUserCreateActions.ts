import { watch } from 'vue'
import { useAdminRequestScope, type AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import { currentRoleCanHaveAccountJobAssignments } from '@/auth/roles'
import { createUserByAdmin, sendPendingInvitesByAdmin } from '@/services/users'
import type { UserCreateFormState } from '@/features/users/userViewHelpers'
import type { WritableRef } from '@/types/reactivity'

interface UseUserCreateActionsOptions {
  context?: AdminRequestContext
  createAction: WritableRef<'queue' | 'send' | null>
  createForm: UserCreateFormState
  inviteLoading: WritableRef<boolean>
  resetCreateMessages: () => void
  resetInviteMessages: () => void
  selectedUserId: WritableRef<string | 'new' | null>
  setCreateError: (error: unknown, fallback: string) => void
  setCreateErrorMessage: (message: string) => void
  setCreateInfo: (message: string) => void
  setInviteError: (error: unknown, fallback: string) => void
  setInviteInfo: (message: string) => void
}

export function useUserCreateActions({
  context,
  createAction,
  createForm,
  inviteLoading,
  resetCreateMessages,
  resetInviteMessages,
  selectedUserId,
  setCreateError,
  setCreateErrorMessage,
  setCreateInfo,
  setInviteError,
  setInviteInfo,
}: UseUserCreateActionsOptions) {
  const createScope = useAdminRequestScope(context, () => selectedUserId.value, () => createForm)
  const inviteScope = useAdminRequestScope(context)
  watch(createScope.revision, () => { createAction.value = null }, { flush: 'sync' })
  watch(inviteScope.revision, () => { inviteLoading.value = false }, { flush: 'sync' })
  async function handleCreateUser(sendInvite: boolean) {
    if (!createScope.allowed.value || createAction.value) return
    const request = createScope.capture()
    resetCreateMessages()

    if (!createForm.email.trim() || !createForm.firstName.trim() || !createForm.lastName.trim()) {
      setCreateErrorMessage('Enter the email, first name, and last name.')
      return
    }

    createAction.value = sendInvite ? 'send' : 'queue'
    try {
      const result = await createUserByAdmin({
        email: createForm.email,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        role: createForm.role,
        assignedJobIds: currentRoleCanHaveAccountJobAssignments(createForm.role) ? createForm.assignedJobIds : [],
        sendInvite,
      }, { isCurrent: request.current })

      if (!request.draftCurrent()) return
      createAction.value = null
      setCreateInfo(result.message || 'User created. Invite queued.')
      selectedUserId.value = result.uid
    } catch (error) {
      if (request.draftCurrent()) setCreateError(error, 'Failed to create user.')
    } finally {
      if (request.current()) createAction.value = null
    }
  }

  async function handleSendPendingInvites() {
    if (!inviteScope.allowed.value || inviteLoading.value) return
    const request = inviteScope.capture()
    resetInviteMessages()
    inviteLoading.value = true

    try {
      const result = await sendPendingInvitesByAdmin()
      if (request.current()) setInviteInfo(result.message || 'Pending invites sent.')
    } catch (error) {
      if (request.current()) setInviteError(error, 'Failed to send pending invites.')
    } finally {
      if (request.current()) inviteLoading.value = false
    }
  }

  return {
    handleCreateUser,
    handleSendPendingInvites,
  }
}
