import { computed } from 'vue'
import type { ReadonlyRef } from '@/types/reactivity'
import type { JobRecord, UserProfile } from '@/types/domain'
import { filterDirectoryRecords, type DirectoryStatusFilter } from '@/utils/directoryFilters'
import {
  getRoleBadgeLabel,
  getUserDisplayName,
  matchesAssignedJobSearch,
} from './userViewHelpers'

interface UseUserAdminViewStateOptions {
  createJobSearchTerm: ReadonlyRef<string>
  currentUserId: ReadonlyRef<string | null | undefined>
  detailJobSearchTerm: ReadonlyRef<string>
  jobs: ReadonlyRef<JobRecord[]>
  searchTerm: ReadonlyRef<string>
  selectedUserId: ReadonlyRef<string | 'new' | null>
  statusFilter: ReadonlyRef<DirectoryStatusFilter>
  users: ReadonlyRef<UserProfile[]>
}

const passiveUserDetailMessages = new Set([
  'Changes save automatically.',
  'Saving changes...',
  'All changes saved.',
])

export function shouldShowUserDetailSuccessToast(message: string) {
  return !passiveUserDetailMessages.has(message)
}

export function useUserAdminViewState({
  createJobSearchTerm,
  currentUserId,
  detailJobSearchTerm,
  jobs,
  searchTerm,
  selectedUserId,
  statusFilter,
  users,
}: UseUserAdminViewStateOptions) {
  const filteredUsers = computed(() => {
    return filterDirectoryRecords(users.value, statusFilter.value, searchTerm.value, (user) => [
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      user.email,
      getRoleBadgeLabel(user.role),
    ])
  })

  const selectedUser = computed(() =>
    users.value.find((user) => user.id === selectedUserId.value) ?? null,
  )

  const isCreateMode = computed(() => selectedUserId.value === 'new')
  const activeJobs = computed(() => jobs.value.filter((job) => job.active))
  const editingSelf = computed(() => selectedUser.value?.id === currentUserId.value)

  const filteredCreateJobs = computed(() => {
    const query = createJobSearchTerm.value.trim().toLowerCase()
    if (!query) return activeJobs.value

    return activeJobs.value.filter((job) => matchesAssignedJobSearch(job, query))
  })

  const filteredDetailJobs = computed(() => {
    const query = detailJobSearchTerm.value.trim().toLowerCase()
    if (!query) return activeJobs.value

    return activeJobs.value.filter((job) => matchesAssignedJobSearch(job, query))
  })

  const pendingInviteUsers = computed(() =>
    users.value.filter((user) => user.inviteStatus === 'pending' && user.email && user.active),
  )

  const pendingInviteCount = computed(() => pendingInviteUsers.value.length)

  const deleteUserConfirmMessage = computed(() => (
    selectedUser.value
      ? `Delete ${getUserDisplayName(selectedUser.value)}? This removes the user from Auth and Firestore.`
      : ''
  ))

  return {
    activeJobs,
    deleteUserConfirmMessage,
    editingSelf,
    filteredCreateJobs,
    filteredDetailJobs,
    filteredUsers,
    isCreateMode,
    pendingInviteCount,
    pendingInviteUsers,
    selectedUser,
  }
}
