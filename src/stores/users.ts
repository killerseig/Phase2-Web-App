import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useJobsStore } from '@/stores/jobs'
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
import type { UserProfile } from '@/types/models'

type UserProfileUpdates = Partial<
  Pick<UserProfile, 'firstName' | 'lastName' | 'role' | 'active' | 'assignedJobIds'>
>

export const useUsersStore = defineStore('users', () => {
  const jobsStore = useJobsStore()
  const users = ref<UserProfile[]>([])
  const currentUserProfile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const unsubscribeUsers = ref<(() => void) | null>(null)
  const unsubscribeMyProfile = ref<(() => void) | null>(null)

  // Computed
  const allUsers = computed(() => users.value)
  const activeUsers = computed(() => users.value.filter(u => u.active !== false))
  const adminUsers = computed(() => users.value.filter(u => u.role === 'admin'))
  const foremanUsers = computed(() => users.value.filter(u => u.role === 'foreman'))
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => error.value !== null)

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const updateCachedUser = (userId: string, updater: (user: UserProfile) => void) => {
    const cachedUser = users.value.find((user) => user.id === userId)
    if (cachedUser) updater(cachedUser)
    if (currentUserProfile.value?.id === userId) updater(currentUserProfile.value)
  }

  const stopUsersSubscription = () => {
    if (!unsubscribeUsers.value) return
    unsubscribeUsers.value()
    unsubscribeUsers.value = null
  }

  const stopMyProfileSubscription = () => {
    if (!unsubscribeMyProfile.value) return
    unsubscribeMyProfile.value()
    unsubscribeMyProfile.value = null
  }

  // Actions
  async function fetchAllUsers() {
    loading.value = true
    error.value = null
    try {
      users.value = await listUsersService()
    } catch (err) {
      setStoreError(err, 'Failed to load users')
      console.error('[Users Store] Error loading users:', err)
    } finally {
      loading.value = false
    }
  }

  function subscribeAllUsers() {
    stopUsersSubscription()
    loading.value = true
    error.value = null

    unsubscribeUsers.value = subscribeUsersService(
      (nextUsers) => {
        users.value = nextUsers
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to users')
        loading.value = false
        console.error('[Users Store] Error subscribing to users:', err)
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
      console.error('[Users Store] Error loading profile:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  function subscribeMyProfile(userId: string) {
    stopMyProfileSubscription()
    loading.value = true
    error.value = null

    unsubscribeMyProfile.value = subscribeUserProfileService(
      userId,
      (profile) => {
        currentUserProfile.value = profile
        loading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to user profile')
        loading.value = false
        console.error('[Users Store] Error subscribing to profile:', err)
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
      console.error('[Users Store] Error updating profile:', err)
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
      console.error('[Users Store] Error deleting user:', err)
      throw err
    }
  }

  async function deactivateUser(userId: string) {
    return updateUserProfile(userId, { active: false })
  }

  async function reactivateUser(userId: string) {
    return updateUserProfile(userId, { active: true })
  }

  async function changeUserRole(userId: string, newRole: 'admin' | 'employee' | 'shop' | 'foreman' | 'none') {
    return updateUserProfile(userId, { role: newRole })
  }

  async function createUser(email: string, firstName: string, lastName: string, role: 'admin' | 'employee' | 'shop' | 'foreman' | 'none' = 'none') {
    error.value = null
    try {
      const result = await createUserByAdminService(email, firstName, lastName, role)
      // Refresh users list after creation
      await fetchAllUsers()
      return result
    } catch (err) {
      setStoreError(err, 'Failed to create user')
      console.error('[Users Store] Error creating user:', err)
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
      console.error('[Users Store] Error assigning job:', err)
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
      console.error('[Users Store] Error removing job:', err)
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
      console.error('[Users Store] Error setting foreman jobs:', err)
      throw err
    }
  }

  async function syncForemanAssignments(jobId: string) {
    error.value = null
    try {
      await syncForemanAssignmentsForJob(jobId)
      // Refresh cached data so UI reflects repaired links
      await Promise.all([fetchAllUsers(), jobsStore.fetchJob(jobId)])
    } catch (err) {
      setStoreError(err, 'Failed to sync foreman assignments')
      console.error('[Users Store] Error syncing foreman assignments:', err)
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  function resetStore() {
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
    allUsers,
    activeUsers,
    adminUsers,
    foremanUsers,
    isLoading,
    hasError,

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
    resetStore,
  }
})

