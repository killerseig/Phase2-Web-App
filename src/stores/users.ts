import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useJobsStore } from '@/stores/jobs'
import { ROLES, type Role } from '@/constants/app'
import {
  assignJobToForeman as assignJobToForemanService,
  createUserByAdmin as createUserByAdminService,
  deleteUser as deleteUserService,
  getMyUserProfile as getMyUserProfileService,
  listUsers as listUsersService,
  removeJobFromForeman as removeJobFromForemanService,
  setForemanJobs as setForemanJobsService,
  subscribeUserProfile as subscribeUserProfileService,
  subscribeUsers as subscribeUsersService,
  syncForemanAssignmentsForJob,
  updateUser as updateUserService,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import { logError } from '@/utils'
import type { UserProfile } from '@/types/models'

type UserProfileUpdates = Partial<
  Pick<UserProfile, 'firstName' | 'lastName' | 'role' | 'active' | 'assignedJobIds'>
>

export const useUsersStore = defineStore('users', () => {
  const users = ref<UserProfile[]>([])
  const currentUserProfile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let unsubscribeUsers: (() => void) | null = null
  let unsubscribeMyProfile: (() => void) | null = null

  // Computed
  const activeUsers = computed(() => users.value.filter(u => u.active !== false))
  const adminUsers = computed(() => users.value.filter(u => u.role === ROLES.ADMIN))
  const foremanUsers = computed(() => users.value.filter(u => u.role === ROLES.FOREMAN))

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const updateCachedUser = (userId: string, updater: (user: UserProfile) => void) => {
    const cachedUser = users.value.find((user) => user.id === userId)
    if (cachedUser) updater(cachedUser)
    if (currentUserProfile.value?.id === userId) updater(currentUserProfile.value)
  }

  const stopUsersSubscription = () => {
    if (!unsubscribeUsers) return
    unsubscribeUsers()
    unsubscribeUsers = null
  }

  const stopMyProfileSubscription = () => {
    if (!unsubscribeMyProfile) return
    unsubscribeMyProfile()
    unsubscribeMyProfile = null
  }

  // Actions
  async function fetchAllUsers() {
    loading.value = true
    error.value = null
    try {
      users.value = await listUsersService()
    } catch (err) {
      setStoreError(err, 'Failed to load users')
      logError('Users Store', 'Error loading users', err)
    } finally {
      loading.value = false
    }
  }

  function subscribeAllUsers() {
    stopUsersSubscription()
    loading.value = true
    error.value = null

    unsubscribeUsers = subscribeUsersService(
      (nextUsers) => {
        users.value = nextUsers
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to users')
        loading.value = false
        logError('Users Store', 'Error subscribing to users', err)
      }
    )
  }

  async function fetchMyProfile() {
    loading.value = true
    error.value = null
    try {
      currentUserProfile.value = await getMyUserProfileService()
      return currentUserProfile.value
    } catch (err) {
      setStoreError(err, 'Failed to load user profile')
      logError('Users Store', 'Error loading profile', err)
      return null
    } finally {
      loading.value = false
    }
  }

  function subscribeMyProfile(userId: string) {
    stopMyProfileSubscription()
    loading.value = true
    error.value = null

    unsubscribeMyProfile = subscribeUserProfileService(
      userId,
      (profile) => {
        currentUserProfile.value = profile
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to user profile')
        loading.value = false
        logError('Users Store', 'Error subscribing to profile', err)
      }
    )
  }

  async function updateUserProfile(userId: string, updates: UserProfileUpdates) {
    error.value = null
    try {
      await updateUserService(userId, updates)
      updateCachedUser(userId, (user) => Object.assign(user, updates))
    } catch (err) {
      setStoreError(err, 'Failed to update user profile')
      logError('Users Store', 'Error updating profile', err)
      throw err
    }
  }

  async function deleteUser(userId: string) {
    error.value = null
    try {
      const result = await deleteUserService(userId)
      users.value = users.value.filter(u => u.id !== userId)
      if (currentUserProfile.value?.id === userId) {
        currentUserProfile.value = null
      }
      return result
    } catch (err) {
      setStoreError(err, 'Failed to delete user')
      logError('Users Store', 'Error deleting user', err)
      throw err
    }
  }

  async function deactivateUser(userId: string) {
    return updateUserProfile(userId, { active: false })
  }

  async function reactivateUser(userId: string) {
    return updateUserProfile(userId, { active: true })
  }

  async function changeUserRole(userId: string, newRole: Role) {
    return updateUserProfile(userId, { role: newRole })
  }

  async function createUser(email: string, firstName: string, lastName: string, role: Role = ROLES.NONE) {
    error.value = null
    try {
      const result = await createUserByAdminService(email, firstName, lastName, role)
      // Refresh users list after creation
      await fetchAllUsers()
      return result
    } catch (err) {
      setStoreError(err, 'Failed to create user')
      logError('Users Store', 'Error creating user', err)
      throw err
    }
  }

  // Foreman Management
  async function assignJobToForeman(foremanId: string, jobId: string) {
    error.value = null
    try {
      await assignJobToForemanService(foremanId, jobId)
      updateCachedUser(foremanId, (user) => {
        if (!user.assignedJobIds) user.assignedJobIds = []
        if (!user.assignedJobIds.includes(jobId)) {
          user.assignedJobIds.push(jobId)
        }
      })
    } catch (err) {
      setStoreError(err, 'Failed to assign job to foreman')
      logError('Users Store', 'Error assigning job', err)
      throw err
    }
  }

  async function removeJobFromForeman(foremanId: string, jobId: string) {
    error.value = null
    try {
      await removeJobFromForemanService(foremanId, jobId)
      updateCachedUser(foremanId, (user) => {
        if (user.assignedJobIds) {
          user.assignedJobIds = user.assignedJobIds.filter(id => id !== jobId)
        }
      })
    } catch (err) {
      setStoreError(err, 'Failed to remove job from foreman')
      logError('Users Store', 'Error removing job', err)
      throw err
    }
  }

  async function setForemanJobs(foremanId: string, jobIds: string[]) {
    error.value = null
    try {
      await setForemanJobsService(foremanId, jobIds)
      updateCachedUser(foremanId, (user) => {
        user.assignedJobIds = [...jobIds]
      })
    } catch (err) {
      setStoreError(err, 'Failed to set foreman jobs')
      logError('Users Store', 'Error setting foreman jobs', err)
      throw err
    }
  }

  async function syncForemanAssignments(jobId: string) {
    error.value = null
    try {
      const jobsStore = useJobsStore()
      await syncForemanAssignmentsForJob(jobId)
      // Refresh cached data so UI reflects repaired links
      await Promise.all([fetchAllUsers(), jobsStore.fetchJob(jobId)])
    } catch (err) {
      setStoreError(err, 'Failed to sync foreman assignments')
      logError('Users Store', 'Error syncing foreman assignments', err)
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  function $reset() {
    stopUsersSubscription()
    stopMyProfileSubscription()
    users.value = []
    currentUserProfile.value = null
    loading.value = false
    error.value = null
  }

  return {
    // State
    users,
    currentUserProfile,
    loading,
    error,

    // Computed
    activeUsers,
    adminUsers,
    foremanUsers,

    // Actions
    fetchAllUsers,
    subscribeAllUsers,
    fetchMyProfile,
    subscribeMyProfile,
    updateUserProfile,
    deleteUser,
    deactivateUser,
    reactivateUser,
    changeUserRole,
    createUser,
    assignJobToForeman,
    removeJobFromForeman,
    setForemanJobs,
    syncForemanAssignments,
    stopUsersSubscription,
    stopMyProfileSubscription,
    clearError,
    $reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUsersStore, import.meta.hot))
}

