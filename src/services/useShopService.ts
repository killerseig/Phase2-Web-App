/**
 * Shop Service Composable
 * Wraps shop-related Cloud Functions (orders, emails) with type safety
 */

import { ref, Ref } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'

export interface SendShopOrderEmailRequest {
  shopOrderId: string
  recipients: string[]
}

export interface SendShopOrderEmailResponse {
  success: boolean
  message: string
}

export interface ShopServiceState {
  isLoading: boolean
  error: string | null
}

/**
 * Shop service composable
 * Usage:
 * const { sendShopOrderEmail, isLoading, error } = useShopService()
 * await sendShopOrderEmail({ shopOrderId: 'abc123', recipients: ['user@example.com'] })
 */
export function useShopService() {
  const isLoading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)

  /**
   * Send shop order via email
   */
  const sendShopOrderEmail = async (request: SendShopOrderEmailRequest): Promise<SendShopOrderEmailResponse> => {
    isLoading.value = true
    error.value = null

    try {
      const sendEmailFunction = httpsCallable<SendShopOrderEmailRequest, SendShopOrderEmailResponse>(
        functions,
        'sendShopOrderEmail'
      )

      const result = await sendEmailFunction(request)
      return result.data
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send shop order email'
      error.value = errorMessage
      console.error('[useShopService] sendShopOrderEmail error:', err)
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
    sendShopOrderEmail,

    // State
    isLoading,
    error,

    // Utilities
    clearError,
  }
}
