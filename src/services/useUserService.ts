/**
 * User Service Composable
 * Wraps user-related Cloud Functions with type safety and error handling
 */

import { ref, Ref } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { Role, VALID_ROLES } from '@/constants/app'
import { normalizeError } from './serviceUtils'

export type UserRole = Role

export interface CreateUserRequest {
  email: string
  firstName: string
  lastName: string
  role?: UserRole
}

export interface CreateUserResponse {
  success: boolean
  message: string
  uid?: string
}

export interface DeleteUserRequest {
  uid: string
}

export interface DeleteUserResponse {
  success: boolean
  message: string
}

export interface UserServiceState {
  isLoading: boolean
  error: string | null
}

/**
 * User service composable
 * Usage:
 * const { createUserByAdmin, deleteUser, isLoading, error } = useUserService()
 * await createUserByAdmin({ email, firstName, lastName, role: 'employee' })
 */
export function useUserService() {
  const isLoading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)

  /**
   * Create a new user account (admin-only)
   * Generates password reset link and sends welcome email
   */
  const createUserByAdmin = async (request: CreateUserRequest): Promise<CreateUserResponse> => {
    isLoading.value = true
    error.value = null

    try {
      const createUserFunction = httpsCallable<CreateUserRequest, CreateUserResponse>(
        functions,
        'createUserByAdmin'
      )

      const result = await createUserFunction(request)
      return result.data
    } catch (err) {
      const errorMessage = normalizeError(err, 'Failed to create user')
      error.value = errorMessage
      console.error('[useUserService] createUserByAdmin error:', err)
      throw new Error(errorMessage)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Delete a user from both Firestore and Firebase Authentication
   * Only callable by authenticated admin users
   */
  const deleteUser = async (uid: string): Promise<DeleteUserResponse> => {
    isLoading.value = true
    error.value = null

    try {
      const deleteUserFunction = httpsCallable<DeleteUserRequest, DeleteUserResponse>(
        functions,
        'deleteUser'
      )

      const result = await deleteUserFunction({ uid })
      return result.data
    } catch (err) {
      const errorMessage = normalizeError(err, 'Failed to delete user')
      error.value = errorMessage
      console.error('[useUserService] deleteUser error:', err)
      throw new Error(errorMessage)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null
  }

  return {
    // Actions
    createUserByAdmin,
    deleteUser,

    // State
    isLoading,
    error,

    // Utilities
    clearError,
  }
}
