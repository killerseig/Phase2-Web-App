import { createUserByAdmin, sendPendingInvitesByAdmin } from '@/services/users'
import type { UserCreateFormState } from '@/features/users/userViewHelpers'
import { roleCanBeAssignedJobs } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface UseUserCreateActionsOptions {
  createAction: Ref<'queue' | 'send' | null>
  createForm: UserCreateFormState
  inviteLoading: Ref<boolean>
  resetCreateMessages: () => void
  resetInviteMessages: () => void
  selectedUserId: Ref<string | 'new' | null>
  setCreateError: (error: unknown, fallback: string) => void
  setCreateErrorMessage: (message: string) => void
  setCreateInfo: (message: string) => void
  setInviteError: (error: unknown, fallback: string) => void
  setInviteInfo: (message: string) => void
}

export function useUserCreateActions({
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
  async function handleCreateUser(sendInvite: boolean) {
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
        assignedJobIds: roleCanBeAssignedJobs(createForm.role) ? createForm.assignedJobIds : [],
        sendInvite,
      })

      setCreateInfo(result.message || 'User created. Invite queued.')
      selectedUserId.value = result.uid
    } catch (error) {
      setCreateError(error, 'Failed to create user.')
    } finally {
      createAction.value = null
    }
  }

  async function handleSendPendingInvites() {
    resetInviteMessages()
    inviteLoading.value = true

    try {
      const result = await sendPendingInvitesByAdmin()
      setInviteInfo(result.message || 'Pending invites sent.')
    } catch (error) {
      setInviteError(error, 'Failed to send pending invites.')
    } finally {
      inviteLoading.value = false
    }
  }

  return {
    handleCreateUser,
    handleSendPendingInvites,
  }
}
