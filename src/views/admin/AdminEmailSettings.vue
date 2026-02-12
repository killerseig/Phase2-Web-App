<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import EmailRecipientInput from '../../components/admin/EmailRecipientInput.vue'
import { listAllJobs, updateDailyLogRecipients, type Job } from '@/services'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const jobs = ref<Job[]>([])
const loading = ref(true)
const err = ref('')
const saving = ref(false)

// Global default recipients
const globalDefaultRecipients = ref<string[]>([])

// Job-specific recipients
const jobRecipients = ref<Map<string, string[]>>(new Map())

async function loadJobs() {
  loading.value = true
  err.value = ''
  try {
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
  toastRef.value?.show('Email recipient added', 'success')
}

function removeGlobalRecipient(email: string) {
  globalDefaultRecipients.value = globalDefaultRecipients.value.filter(e => e !== email)
  toastRef.value?.show('Email recipient removed', 'success')
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

onMounted(loadJobs)
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4 wide-container-1200">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="h3 mb-1">Email Settings</h2>
      <p class="text-muted small mb-0">Configure email recipients for daily logs</p>
    </div>

    <!-- Global Default Recipients -->
    <AdminCardWrapper
      title="Global Default Recipients"
      icon="envelope"
      subtitle="These email addresses will receive daily logs from all jobs (unless overridden at the job level)."
    >
      <EmailRecipientInput
        :emails="globalDefaultRecipients"
        label="Global Recipients"
        @add="addGlobalRecipient"
        @remove="removeGlobalRecipient"
      />
    </AdminCardWrapper>

    <!-- Job-Specific Recipients -->
    <AdminCardWrapper
      title="Job-Specific Recipients"
      icon="briefcase"
      subtitle="Configure email recipients for individual jobs. These override the global defaults."
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

      <div v-else class="accordion" id="jobsAccordion">
        <div 
          v-for="job in jobs" 
          :key="job.id" 
          class="accordion-item"
        >
          <h2 class="accordion-header">
            <button
              class="accordion-button collapsed"
              type="button"
              :data-bs-target="`#job-${job.id}`"
              data-bs-toggle="collapse"
              :aria-controls="`job-${job.id}`"
            >
              <strong>{{ job.name }}</strong>
              <span v-if="jobRecipients.get(job.id)?.length" class="badge text-bg-secondary ms-2">
                {{ jobRecipients.get(job.id)?.length }} recipients
              </span>
            </button>
          </h2>
          <div
            :id="`job-${job.id}`"
            class="accordion-collapse collapse"
            :data-bs-parent="`#jobsAccordion`"
          >
            <div class="accordion-body">
              <EmailRecipientInput
                :emails="jobRecipients.get(job.id) ?? []"
                :label="`Recipients for ${job.name}`"
                :disabled="saving"
                @add="(email) => addJobRecipient(job.id, email)"
                @remove="(email) => removeJobRecipient(job.id, email)"
              />
            </div>
          </div>
        </div>
      </div>
    </AdminCardWrapper>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.accordion-item {
  border: 1px solid $border-color;
}

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
</style>
