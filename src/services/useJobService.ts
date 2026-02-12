/**
 * Job Service Composable
 * Wraps job-related Cloud Functions (daily logs, timecards emails) with type safety
 */

import { ref, Ref } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useJobAccess } from '@/composables/useJobAccess'
import { normalizeError } from './serviceUtils'

export interface SendDailyLogEmailRequest {
  jobId: string
  dailyLogId: string
  recipients: string[]
}

export interface SendDailyLogEmailResponse {
  success: boolean
  message: string
}

export interface SendTimecardEmailRequest {
  jobId: string
  timecardIds: string[]
  weekStart: string
  recipients: string[]
}

export interface SendTimecardEmailResponse {
  success: boolean
  message: string
}

export interface JobServiceState {
  isLoading: boolean
  error: string | null
}

/**
 * Job service composable
 * Usage:
 * const { sendDailyLogEmail, sendTimecardEmail, isLoading, error } = useJobService()
 * await sendDailyLogEmail({ jobId: 'job123', dailyLogId: 'abc123', recipients: ['user@example.com'] })
 */
export function useJobService() {
  const isLoading: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)
  const jobAccess = useJobAccess()

  const assertJobAccess = (jobId: string) => {
    if (!jobAccess.canAccessJob(jobId)) {
      throw new Error('You do not have access to this job')
    }
  }

  /**
   * Send daily log via email
   */
  const sendDailyLogEmail = async (request: SendDailyLogEmailRequest): Promise<SendDailyLogEmailResponse> => {
    isLoading.value = true
    error.value = null

    try {
      assertJobAccess(request.jobId)

      const sendEmailFunction = httpsCallable<SendDailyLogEmailRequest, SendDailyLogEmailResponse>(
        functions,
        'sendDailyLogEmail'
      )

      const result = await sendEmailFunction(request)
      return result.data
    } catch (err) {
      const errorMessage = normalizeError(err, 'Failed to send daily log email')
      error.value = errorMessage
      console.error('[useJobService] sendDailyLogEmail error:', err)
      throw new Error(errorMessage)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Send timecard via email
   */
  const sendTimecardEmail = async (request: SendTimecardEmailRequest): Promise<SendTimecardEmailResponse> => {
    isLoading.value = true
    error.value = null

    try {
      assertJobAccess(request.jobId)

      const sendEmailFunction = httpsCallable<SendTimecardEmailRequest, SendTimecardEmailResponse>(
        functions,
        'sendTimecardEmail'
      )

      const result = await sendEmailFunction(request)
      return result.data
    } catch (err) {
      const errorMessage = normalizeError(err, 'Failed to send timecard email')
      error.value = errorMessage
      console.error('[useJobService] sendTimecardEmail error:', err)
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
    sendDailyLogEmail,
    sendTimecardEmail,

    // State
    isLoading,
    error,

    // Utilities
    clearError,
  }
}
