import { onMounted, onUnmounted, ref } from 'vue'
import {
  removeEmailFromAllRecipientLists,
  subscribeAllJobs,
  subscribeEmailSettings,
  updateDailyLogRecipients,
  updateDailyLogSubmitRecipientsGlobal,
  updateShopOrderSubmitRecipientsGlobal,
  updateTimecardSubmitRecipientsGlobal,
  type Job,
} from '@/services'
import { useEmailRecipients } from '@/composables/useEmailRecipients'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { useToast } from '@/composables/useToast'
import { normalizeError } from '@/services/serviceUtils'
import { isValidEmail } from '@/utils/emailValidation'
import { logWarn } from '@/utils'

type RecipientMessages = {
  saveSuccess: string
  saveError: string
  addSuccess?: string
  addError?: string
  removeSuccess?: string
  removeError?: string
}

export function useAdminEmailSettings() {
  const jobs = ref<Job[]>([])
  const loading = ref(true)
  const err = ref('')
  const purgeEmail = ref('')
  const purging = ref(false)
  const globalDefaultRecipients = ref<string[]>([])
  const timecardSubmitRecipients = ref<string[]>([])
  const shopOrderSubmitRecipients = ref<string[]>([])
  const jobRecipients = ref<Map<string, string[]>>(new Map())
  const openJobId = ref<string | null>(null)

  const toast = useToast()
  const subscriptions = useSubscriptionRegistry()
  const recipientActions = useEmailRecipients({
    toast,
    onError: (message) => {
      err.value = message
    },
  })
  const saving = recipientActions.saving

  const setError = (errorValue: unknown, fallback: string) => {
    err.value = normalizeError(errorValue, fallback)
  }

  const makeRecipientConfig = (
    getRecipients: () => string[],
    setRecipients: (emails: string[]) => void,
    saveRecipients: (emails: string[]) => Promise<void>,
    messages: RecipientMessages,
  ) => ({
    getRecipients,
    setRecipients,
    saveRecipients,
    messages,
  })

  function stopRealtime() {
    subscriptions.clearAll()
  }

  function loadJobs() {
    stopRealtime()
    loading.value = true
    err.value = ''

    try {
      subscriptions.replace('email-settings', subscribeEmailSettings(
        (settings) => {
          timecardSubmitRecipients.value = settings.timecardSubmitRecipients ?? []
          shopOrderSubmitRecipients.value = settings.shopOrderSubmitRecipients ?? []
          globalDefaultRecipients.value = settings.dailyLogSubmitRecipients ?? []
        },
        (settingsError) => {
          logWarn('AdminEmailSettings', 'Failed to subscribe global email settings, using defaults', settingsError)
          timecardSubmitRecipients.value = []
          shopOrderSubmitRecipients.value = []
          globalDefaultRecipients.value = []
        },
      ))

      subscriptions.replace('jobs', subscribeAllJobs(
        true,
        undefined,
        (nextJobs) => {
          jobs.value = nextJobs
          const recipientMap = new Map<string, string[]>()
          for (const job of nextJobs) {
            recipientMap.set(job.id, job.dailyLogRecipients ?? [])
          }
          jobRecipients.value = recipientMap
          loading.value = false
        },
        (jobsError) => {
          setError(jobsError, 'Failed to load jobs')
          toast.show('Failed to load jobs', 'error')
          loading.value = false
        },
      ))
    } catch (loadError) {
      setError(loadError, 'Failed to load jobs')
      toast.show('Failed to load jobs', 'error')
      loading.value = false
    }
  }

  async function addGlobalRecipient(email: string) {
    await recipientActions.addRecipient(email, makeRecipientConfig(
      () => globalDefaultRecipients.value,
      (emails) => {
        globalDefaultRecipients.value = emails
      },
      (emails) => updateDailyLogSubmitRecipientsGlobal(emails),
      {
        saveSuccess: 'Daily log global recipients updated',
        saveError: 'Failed to save daily log global recipients',
      },
    ))
  }

  async function removeGlobalRecipient(email: string) {
    await recipientActions.removeRecipient(email, makeRecipientConfig(
      () => globalDefaultRecipients.value,
      (emails) => {
        globalDefaultRecipients.value = emails
      },
      (emails) => updateDailyLogSubmitRecipientsGlobal(emails),
      {
        saveSuccess: 'Daily log global recipients updated',
        saveError: 'Failed to save daily log global recipients',
      },
    ))
  }

  async function addJobRecipient(jobId: string, email: string) {
    await recipientActions.addRecipient(email, makeRecipientConfig(
      () => jobRecipients.value.get(jobId) ?? [],
      (emails) => {
        jobRecipients.value.set(jobId, emails)
      },
      (emails) => updateDailyLogRecipients(jobId, emails),
      {
        saveSuccess: 'Email recipients updated',
        saveError: 'Failed to save recipients',
      },
    ))
  }

  async function removeJobRecipient(jobId: string, email: string) {
    await recipientActions.removeRecipient(email, makeRecipientConfig(
      () => jobRecipients.value.get(jobId) ?? [],
      (emails) => {
        jobRecipients.value.set(jobId, emails)
      },
      (emails) => updateDailyLogRecipients(jobId, emails),
      {
        saveSuccess: 'Email recipients updated',
        saveError: 'Failed to save recipients',
      },
    ))
  }

  async function addTimecardRecipient(email: string) {
    await recipientActions.addRecipient(email, makeRecipientConfig(
      () => timecardSubmitRecipients.value,
      (emails) => {
        timecardSubmitRecipients.value = emails
      },
      (emails) => updateTimecardSubmitRecipientsGlobal(emails),
      {
        saveSuccess: 'Timecard submit recipients updated',
        saveError: 'Failed to save timecard recipients',
      },
    ))
  }

  async function removeTimecardRecipient(email: string) {
    await recipientActions.removeRecipient(email, makeRecipientConfig(
      () => timecardSubmitRecipients.value,
      (emails) => {
        timecardSubmitRecipients.value = emails
      },
      (emails) => updateTimecardSubmitRecipientsGlobal(emails),
      {
        saveSuccess: 'Timecard submit recipients updated',
        saveError: 'Failed to save timecard recipients',
      },
    ))
  }

  async function addShopOrderRecipient(email: string) {
    await recipientActions.addRecipient(email, makeRecipientConfig(
      () => shopOrderSubmitRecipients.value,
      (emails) => {
        shopOrderSubmitRecipients.value = emails
      },
      (emails) => updateShopOrderSubmitRecipientsGlobal(emails),
      {
        saveSuccess: 'Shop order submit recipients updated',
        saveError: 'Failed to save shop order recipients',
      },
    ))
  }

  async function removeShopOrderRecipient(email: string) {
    await recipientActions.removeRecipient(email, makeRecipientConfig(
      () => shopOrderSubmitRecipients.value,
      (emails) => {
        shopOrderSubmitRecipients.value = emails
      },
      (emails) => updateShopOrderSubmitRecipientsGlobal(emails),
      {
        saveSuccess: 'Shop order submit recipients updated',
        saveError: 'Failed to save shop order recipients',
      },
    ))
  }

  async function removeEmailEverywhere() {
    const email = purgeEmail.value.trim()
    if (!email || !isValidEmail(email)) {
      toast.show('Enter a valid email address', 'error')
      return
    }

    purging.value = true

    try {
      const result = await removeEmailFromAllRecipientLists(email)
      const updatedJobs = Number(result?.updatedJobCount || 0)
      purgeEmail.value = ''
      toast.show(
        result?.removedFromRecipientLists
          ? `Removed from all recipient lists${updatedJobs > 0 ? ` (${updatedJobs} jobs updated)` : ''}`
          : 'Email was not found in recipient lists',
        'success',
      )
    } catch (removeError) {
      setError(removeError, 'Failed to remove email from recipient lists')
      toast.show('Failed to remove email from recipient lists', 'error')
    } finally {
      purging.value = false
    }
  }

  onMounted(loadJobs)
  onUnmounted(stopRealtime)

  return {
    jobs,
    loading,
    err,
    purgeEmail,
    purging,
    saving,
    globalDefaultRecipients,
    timecardSubmitRecipients,
    shopOrderSubmitRecipients,
    jobRecipients,
    openJobId,
    addGlobalRecipient,
    removeGlobalRecipient,
    addJobRecipient,
    removeJobRecipient,
    addTimecardRecipient,
    removeTimecardRecipient,
    addShopOrderRecipient,
    removeShopOrderRecipient,
    removeEmailEverywhere,
  }
}
