import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as UsersService from '../services/Users'
import type { UserProfile } from '@/types/models'

export const useUsersStore = defineStore('users', () => {
  const users = ref<UserProfile[]>([])
  const currentUserProfile = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const allUsers = computed(() => users.value)
  const activeUsers = computed(() => users.value.filter(u => u.active !== false))
  const adminUsers = computed(() => users.value.filter(u => u.role === 'admin'))
  const foremanUsers = computed(() => users.value.filter(u => u.role === 'foreman'))
  const isLoading = computed(() => loading.value)
  const hasError = computed(() => error.value !== null)

  // Actions
  async function fetchAllUsers() {
    loading.value = true
    error.value = null
    try {
      users.value = await UsersService.listUsers()
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load users'
      console.error('[Users Store] Error loading users:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchMyProfile() {
    loading.value = true
    error.value = null
    try {
      currentUserProfile.value = await UsersService.getMyUserProfile()
      return currentUserProfile.value
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load user profile'
      console.error('[Users Store] Error loading profile:', e)
    } finally {
      loading.value = false
    }
  }

  async function updateUserProfile(userId: string, updates: any) {
    error.value = null
    try {
      await UsersService.updateUser(userId, updates)
      
      // Update in list
      const idx = users.value.findIndex(u => u.id === userId)
      if (idx !== -1) {
        users.value[idx] = { ...users.value[idx], ...updates }
      }
      
      // Update current profile if it's the current user
      if (currentUserProfile.value?.id === userId) {
        currentUserProfile.value = { ...currentUserProfile.value, ...updates }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to update user profile'
      console.error('[Users Store] Error updating profile:', e)
      throw e
    }
  }

  async function deleteUser(userId: string) {
    error.value = null
    try {
      await UsersService.deleteUser(userId)
      users.value = users.value.filter(u => u.id !== userId)
      if (currentUserProfile.value?.id === userId) {
        currentUserProfile.value = null
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to delete user'
      console.error('[Users Store] Error deleting user:', e)
      throw e
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
      const result = await UsersService.createUserByAdmin(email, firstName, lastName, role)
      // Refresh users list after creation
      await fetchAllUsers()
      return result
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to create user'
      console.error('[Users Store] Error creating user:', e)
      throw e
    }
  }

  // Foreman Management
  async function assignJobToForeman(foremanId: string, jobId: string) {
    error.value = null
    try {
      await UsersService.assignJobToForeman(foremanId, jobId)
      
      // Update in list
      const idx = users.value.findIndex(u => u.id === foremanId)
      if (idx !== -1) {
        const user = users.value[idx]
        if (!user.assignedJobIds) user.assignedJobIds = []
        if (!user.assignedJobIds.includes(jobId)) {
          user.assignedJobIds.push(jobId)
          users.value[idx] = { ...user }
        }
      }

      // Update current profile if it's this user
      if (currentUserProfile.value?.id === foremanId) {
        if (!currentUserProfile.value.assignedJobIds) currentUserProfile.value.assignedJobIds = []
        if (!currentUserProfile.value.assignedJobIds.includes(jobId)) {
          currentUserProfile.value.assignedJobIds.push(jobId)
        }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to assign job to foreman'
      console.error('[Users Store] Error assigning job:', e)
      throw e
    }
  }

  async function removeJobFromForeman(foremanId: string, jobId: string) {
    error.value = null
    try {
      await UsersService.removeJobFromForeman(foremanId, jobId)
      
      // Update in list
      const idx = users.value.findIndex(u => u.id === foremanId)
      if (idx !== -1) {
        const user = users.value[idx]
        if (user.assignedJobIds) {
          user.assignedJobIds = user.assignedJobIds.filter(id => id !== jobId)
          users.value[idx] = { ...user }
        }
      }

      // Update current profile if it's this user
      if (currentUserProfile.value?.id === foremanId) {
        if (currentUserProfile.value.assignedJobIds) {
          currentUserProfile.value.assignedJobIds = currentUserProfile.value.assignedJobIds.filter(id => id !== jobId)
        }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to remove job from foreman'
      console.error('[Users Store] Error removing job:', e)
      throw e
    }
  }

  async function setForemanJobs(foremanId: string, jobIds: string[]) {
    error.value = null
    try {
      await UsersService.setForemanJobs(foremanId, jobIds)
      
      // Update in list
      const idx = users.value.findIndex(u => u.id === foremanId)
      if (idx !== -1) {
        users.value[idx] = { ...users.value[idx], assignedJobIds: jobIds }
      }

      // Update current profile if it's this user
      if (currentUserProfile.value?.id === foremanId) {
        currentUserProfile.value = { ...currentUserProfile.value, assignedJobIds: jobIds }
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to set foreman jobs'
      console.error('[Users Store] Error setting foreman jobs:', e)
      throw e
    }
  }

  function clearError() {
    error.value = null
  }

  function resetStore() {
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
    fetchMyProfile,
    updateUserProfile,
    deleteUser,
    deactivateUser,
    reactivateUser,
    changeUserRole,
    createUser,
    assignJobToForeman,
    removeJobFromForeman,
    setForemanJobs,
    clearError,
    resetStore,
  }
})
