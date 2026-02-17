<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import BaseAccordionCard from '../../components/common/BaseAccordionCard.vue'
import EmailRecipientInput from '../../components/admin/EmailRecipientInput.vue'
import {
  listAllJobs,
  updateDailyLogRecipients,
  getEmailSettings,
  updateTimecardSubmitRecipientsGlobal,
  updateShopOrderSubmitRecipientsGlobal,
  updateDailyLogSubmitRecipientsGlobal,
  type Job,
} from '@/services'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const jobs = ref<Job[]>([])
const loading = ref(true)
const err = ref('')
const saving = ref(false)

// Global default recipients
const globalDefaultRecipients = ref<string[]>([])
const timecardSubmitRecipients = ref<string[]>([])
const shopOrderSubmitRecipients = ref<string[]>([])

// Job-specific recipients
const jobRecipients = ref<Map<string, string[]>>(new Map())
const openJobId = ref<string | null>(null)

async function loadJobs() {
  loading.value = true
  err.value = ''
  try {
    // Load global email settings (timecards & shop orders)
    try {
      const settings = await getEmailSettings()
      timecardSubmitRecipients.value = settings.timecardSubmitRecipients ?? []
      shopOrderSubmitRecipients.value = settings.shopOrderSubmitRecipients ?? []
      globalDefaultRecipients.value = settings.dailyLogSubmitRecipients ?? []
    } catch (settingsError) {
      console.warn('[AdminEmailSettings] Failed to load global email settings, using defaults', settingsError)
      timecardSubmitRecipients.value = []
      shopOrderSubmitRecipients.value = []
      globalDefaultRecipients.value = []
    }

    jobs.value = await listAllJobs(true)
    
    // Initialize job recipient maps
    const recipientMap = new Map<string, string[]>()
    for (const job of jobs.value) {
      recipientMap.set(job.id, job.dailyLogRecipients ?? [])
    }
    jobRecipients.value = recipientMap
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load jobs'
    toastRef.value?.show('Failed to load jobs', 'error')
  } finally {
    loading.value = false
  }
}

function addGlobalRecipient(email: string) {
  if (globalDefaultRecipients.value.includes(email)) {
    toastRef.value?.show('Email already in the list', 'warning')
    return
  }
  globalDefaultRecipients.value.push(email)
  saveGlobalDailyLogRecipients()
}

function removeGlobalRecipient(email: string) {
  globalDefaultRecipients.value = globalDefaultRecipients.value.filter(e => e !== email)
  saveGlobalDailyLogRecipients()
}

function addJobRecipient(jobId: string, email: string) {
  const recipients = jobRecipients.value.get(jobId) ?? []
  if (recipients.includes(email)) {
    toastRef.value?.show('Email already in the list', 'warning')
    return
  }

  recipients.push(email)
  jobRecipients.value.set(jobId, [...recipients])
  saveJobRecipients(jobId)
}

function removeJobRecipient(jobId: string, email: string) {
  const recipients = jobRecipients.value.get(jobId) ?? []
  jobRecipients.value.set(jobId, recipients.filter(e => e !== email))
  saveJobRecipients(jobId)
}

function addTimecardRecipient(email: string) {
  if (timecardSubmitRecipients.value.includes(email)) {
    toastRef.value?.show('Email already in the list', 'warning')
    return
  }
  timecardSubmitRecipients.value = [...timecardSubmitRecipients.value, email]
  saveTimecardRecipients()
}

function removeTimecardRecipient(email: string) {
  timecardSubmitRecipients.value = timecardSubmitRecipients.value.filter(e => e !== email)
  saveTimecardRecipients()
}

function addShopOrderRecipient(email: string) {
  if (shopOrderSubmitRecipients.value.includes(email)) {
    toastRef.value?.show('Email already in the list', 'warning')
    return
  }
  shopOrderSubmitRecipients.value = [...shopOrderSubmitRecipients.value, email]
  saveShopOrderRecipients()
}

function removeShopOrderRecipient(email: string) {
  shopOrderSubmitRecipients.value = shopOrderSubmitRecipients.value.filter(e => e !== email)
  saveShopOrderRecipients()
}

async function saveJobRecipients(jobId: string) {
  saving.value = true
  try {
    const recipients = jobRecipients.value.get(jobId) ?? []
    await updateDailyLogRecipients(jobId, recipients)
    toastRef.value?.show('Email recipients updated', 'success')
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to save recipients'
    toastRef.value?.show('Failed to save recipients', 'error')
  } finally {
    saving.value = false
  }
}

async function saveTimecardRecipients() {
  saving.value = true
  try {
    await updateTimecardSubmitRecipientsGlobal(timecardSubmitRecipients.value)
    toastRef.value?.show('Timecard submit recipients updated', 'success')
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to save timecard recipients'
    toastRef.value?.show('Failed to save timecard recipients', 'error')
  } finally {
    saving.value = false
  }
}

async function saveShopOrderRecipients() {
  saving.value = true
  try {
    await updateShopOrderSubmitRecipientsGlobal(shopOrderSubmitRecipients.value)
    toastRef.value?.show('Shop order submit recipients updated', 'success')
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to save shop order recipients'
    toastRef.value?.show('Failed to save shop order recipients', 'error')
  } finally {
    saving.value = false
  }
}

async function saveGlobalDailyLogRecipients() {
  saving.value = true
  try {
    await updateDailyLogSubmitRecipientsGlobal(globalDefaultRecipients.value)
    toastRef.value?.show('Daily log global recipients updated', 'success')
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to save daily log global recipients'
    toastRef.value?.show('Failed to save daily log global recipients', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(loadJobs)
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4 wide-container-1200">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="h3 mb-1">Email Settings</h2>
      <p class="text-muted small mb-0">Configure recipients for daily logs (per job) and global recipients for timecards and shop orders.</p>
    </div>

    <!-- Global Timecard Recipients -->
    <AdminCardWrapper
      title="Timecard Submission Recipients"
      icon="clock"
      subtitle="These recipients will receive all submitted timecards."
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
      <div class="alert job-tip small mb-3" role="alert">
        <div class="d-flex align-items-start gap-2">
          <i class="bi bi-info-circle flex-shrink-0"></i>
          <div>
            <strong>Tip:</strong> Department supervisors can be added as job-specific recipients. When a daily log is submitted for a job, the supervisor's email will automatically receive the report.
          </div>
        </div>
      </div>

      <div v-if="jobs.length === 0" class="alert alert-info text-center mb-0">
        No jobs found.
      </div>

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

.wide-container-1200 {
  max-width: 1200px;
}

.job-tip {
  background: $surface-2;
  border: 1px solid $border-color;
  color: $body-color;
  box-shadow: $box-shadow-sm;
}

.job-tip .bi-info-circle {
  color: $primary;
  font-size: 1.1rem;
  margin-top: 1px;
}

.section-label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: $text-muted;
  margin-bottom: 0.35rem;
}

.mt-4 {
  margin-top: 1.5rem;
}
</style>
