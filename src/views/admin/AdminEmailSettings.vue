<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import EmailRecipientInput from '@/components/common/EmailRecipientInput.vue'
import {
  updateDailyLogRecipients,
  subscribeAllJobs,
  subscribeEmailSettings,
  updateTimecardSubmitRecipientsGlobal,
  updateShopOrderSubmitRecipientsGlobal,
  updateDailyLogSubmitRecipientsGlobal,
  removeEmailFromAllRecipientLists,
  type Job,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import { isValidEmail } from '@/utils/emailValidation'
import { logWarn } from '@/utils'
import { useEmailRecipients } from '@/composables/useEmailRecipients'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { useToast } from '@/composables/useToast'

const jobs = ref<Job[]>([])
const loading = ref(true)
const err = ref('')
const purgeEmail = ref('')
const purging = ref(false)
const toast = useToast()

// Global default recipients
const globalDefaultRecipients = ref<string[]>([])
const timecardSubmitRecipients = ref<string[]>([])
const shopOrderSubmitRecipients = ref<string[]>([])

// Job-specific recipients
const jobRecipients = ref<Map<string, string[]>>(new Map())
const openJobId = ref<string | null>(null)
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
  messages: {
    saveSuccess: string
    saveError: string
    addSuccess?: string
    addError?: string
    removeSuccess?: string
    removeError?: string
  }
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
      }
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
      }
    ))
  } catch (e) {
    setError(e, 'Failed to load jobs')
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
    }
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
    }
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
    }
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
    }
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
    }
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
    }
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
    }
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
    }
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
      'success'
    )
  } catch (e) {
    setError(e, 'Failed to remove email from recipient lists')
    toast.show('Failed to remove email from recipient lists', 'error')
  } finally {
    purging.value = false
  }
}

onMounted(loadJobs)
</script>

<template>
  
  
  <div class="app-page">
    <!-- Header -->
    <AppPageHeader eyebrow="Admin Panel" title="Email Settings" subtitle="Configure recipients for daily logs, timecards, and shop orders." />

    <AdminCardWrapper
      title="Remove Recipient Everywhere"
      icon="person-x"
      subtitle="Remove an email from all global recipient lists and all job-level daily log lists in one action."
    >
      <div class="row g-2 align-items-end">
        <div class="col-md-8">
          <label class="form-label small mb-1">Email to remove</label>
          <input
            v-model="purgeEmail"
            type="email"
            class="form-control"
            placeholder="user@example.com"
            :disabled="purging"
          />
        </div>
        <div class="col-md-4 d-grid">
          <button class="btn btn-outline-danger" :disabled="purging" @click="removeEmailEverywhere">
            <span v-if="purging" class="spinner-border spinner-border-sm me-2"></span>
            Remove From Everything
          </button>
        </div>
      </div>
    </AdminCardWrapper>

    <!-- Global Timecard Recipients -->
    <AdminCardWrapper
      title="Timecard Submission Recipients"
      icon="clock"
      subtitle="These recipients will receive all submitted timecards."
      class="mt-4"
    >
      <EmailRecipientInput
        :key="'timecard-recips'"
        :emails="timecardSubmitRecipients"
        label="Timecard recipients"
        input-name="timecard-recipient"
        autocomplete-section="timecard"
        :disabled="saving"
        @add="addTimecardRecipient"
        @remove="removeTimecardRecipient"
      />
    </AdminCardWrapper>

    <!-- Global Shop Order Recipients -->
    <AdminCardWrapper
      title="Shop Order Submission Recipients"
      icon="box-seam"
      subtitle="These recipients will receive all submitted shop orders."
      class="mt-4"
    >
      <EmailRecipientInput
        :key="'shop-order-recips'"
        :emails="shopOrderSubmitRecipients"
        label="Shop order recipients"
        input-name="shop-order-recipient"
        autocomplete-section="shop-order"
        :disabled="saving"
        @add="addShopOrderRecipient"
        @remove="removeShopOrderRecipient"
      />
    </AdminCardWrapper>

    <!-- Global Default Recipients -->
    <AdminCardWrapper
      title="Daily Log Global Defaults"
      icon="envelope"
      subtitle="These email addresses will receive daily logs from all jobs (unless overridden at the job level)."
      class="mt-4"
    >
      <EmailRecipientInput
        :key="'global-default-recips'"
        :emails="globalDefaultRecipients"
        label="Global Recipients"
        input-name="daily-log-global-recipient"
        autocomplete-section="daily-log-global"
        @add="addGlobalRecipient"
        @remove="removeGlobalRecipient"
      />
    </AdminCardWrapper>

    <!-- Job-Specific Recipients (Daily Logs only) -->
    <AdminCardWrapper
      title="Job-Specific Recipients"
      icon="briefcase"
      subtitle="Configure daily log recipients for individual jobs. These override the global defaults."
      :loading="loading"
      :error="err"
      class="mt-4"
    >
      <AppAlert
        class="app-note small mb-3"
        icon="bi bi-info-circle"
        icon-class="flex-shrink-0 mt-1"
        title="Tip:"
      >
        Department supervisors can be added as job-specific recipients. When a daily log is submitted for a job, the supervisor's email will automatically receive the report.
      </AppAlert>

      <AppEmptyState
        v-if="jobs.length === 0"
        compact
        icon="bi bi-briefcase"
        icon-class="fs-4"
        title="No jobs found"
        message="Job-specific recipient lists will appear here once jobs exist."
        message-class="small mb-0"
      />

      <div v-else>
        <BaseAccordionCard
          v-for="job in jobs"
          :key="job.id"
          :open="openJobId === job.id"
          :title="job.name"
          :subtitle="jobRecipients.get(job.id)?.length ? `${jobRecipients.get(job.id)?.length} recipients` : 'No recipients'"
          body-class="p-3"
          @update:open="(open) => { openJobId = open ? job.id : null }"
        >
          <h6 class="section-label">Daily Logs</h6>
          <EmailRecipientInput
            :emails="jobRecipients.get(job.id) ?? []"
            :label="`Recipients for ${job.name}`"
            :disabled="saving"
            @add="(email) => addJobRecipient(job.id, email)"
            @remove="(email) => removeJobRecipient(job.id, email)"
          />
        </BaseAccordionCard>
      </div>
    </AdminCardWrapper>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.section-label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: $text-muted;
  margin-bottom: 0.35rem;
}

</style>

