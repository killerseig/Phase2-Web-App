<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppToast } from '@/composables/useAppToast'
import { useToastMessages } from '@/composables/useToastMessages'
import AppShell from '@/layouts/AppShell.vue'
import {
  NOTIFICATION_MODULE_KEYS,
  createJobRecord,
  deleteJobRecord,
  setJobActive,
  subscribeGlobalNotificationRecipients,
  updateGlobalNotificationRecipients,
  updateJobNotificationRecipients,
  updateJobRecord,
} from '@/services/jobs'
import { subscribeUsers } from '@/services/users'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import type { JobRecord, JobType, NotificationModuleKey, NotificationRecipients, UserProfile } from '@/types/domain'
import { formatJobTypeLabel, toEffectiveRole } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface JobFormState {
  name: string
  code: string
  type: JobType | string
  gc: string
  jobAddress: string
  startDate: string
  finishDate: string
  productionBurden: string
  assignedForemanIds: string[]
}

const ALL_JOBS_ID = '__all_jobs__'

const NOTIFICATION_MODULES: Array<{ key: NotificationModuleKey; label: string }> = [
  { key: 'dailyLogs', label: 'Daily Logs' },
  { key: 'timecards', label: 'Timecards' },
  { key: 'shopOrders', label: 'Shop Orders' },
]

function createEmptyNotificationRecipients(): NotificationRecipients {
  return {
    dailyLogs: [],
    timecards: [],
    shopOrders: [],
  }
}

function createRecipientInputState(): Record<NotificationModuleKey, string> {
  return {
    dailyLogs: '',
    timecards: '',
    shopOrders: '',
  }
}

const auth = useAuthStore()
const jobsStore = useJobsStore()
const router = useRouter()
const toast = useAppToast()

const users = ref<UserProfile[]>([])
const searchTerm = ref('')
const foremanSearchTerm = ref('')
const showArchived = ref(false)
const editDrawerOpen = ref(false)
const selectedJobId = ref<string | 'new' | typeof ALL_JOBS_ID | null>(null)
const usersLoading = ref(false)
const usersError = ref('')
const createError = ref('')
const createInfo = ref('')
const detailError = ref('')
const detailInfo = ref('')
const createLoading = ref(false)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const archiveLoading = ref(false)
const recipientSaving = ref(false)
const globalNotificationRecipients = ref<NotificationRecipients>(createEmptyNotificationRecipients())

const createForm = reactive<JobFormState>({
  name: '',
  code: '',
  type: 'general',
  gc: '',
  jobAddress: '',
  startDate: '',
  finishDate: '',
  productionBurden: '0.33',
  assignedForemanIds: [],
})

const detailForm = reactive<JobFormState>({
  name: '',
  code: '',
  type: 'general',
  gc: '',
  jobAddress: '',
  startDate: '',
  finishDate: '',
  productionBurden: '0.33',
  assignedForemanIds: [],
})

const createNotificationRecipients = reactive<NotificationRecipients>(createEmptyNotificationRecipients())
const detailNotificationRecipients = reactive<NotificationRecipients>(createEmptyNotificationRecipients())
const createRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())
const detailRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())
const globalRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())

let unsubscribeUsers: (() => void) | null = null
let unsubscribeGlobalNotificationRecipients: (() => void) | null = null
let detailAutosaveTimer: ReturnType<typeof setTimeout> | null = null

const hydratingDetailForm = ref(false)
const lastSavedDetailSignature = ref('')

const allJobs = computed(() => jobsStore.jobs)
const visibleJobs = computed(() => {
  const source = auth.isAdmin
    ? allJobs.value.filter((job) => showArchived.value || job.active)
    : jobsStore.activeJobs

  const query = searchTerm.value.trim().toLowerCase()
  if (!query) return source

  return source.filter((job) => {
    const haystack = [
      job.name,
      job.code ?? '',
      formatJobTypeLabel(job.type),
      job.gc ?? '',
      job.jobAddress ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
})

const selectedJob = computed(() =>
  typeof selectedJobId.value === 'string' && selectedJobId.value !== 'new'
    && selectedJobId.value !== ALL_JOBS_ID
    ? allJobs.value.find((job) => job.id === selectedJobId.value) ?? null
    : null,
)

const isCreateMode = computed(() => auth.isAdmin && selectedJobId.value === 'new')
const isAllJobsMode = computed(() => auth.isAdmin && selectedJobId.value === ALL_JOBS_ID)
const foremen = computed(() =>
  users.value
    .filter((user) => toEffectiveRole(user.role) === 'foreman')
    .slice()
    .sort((left, right) => {
      const leftRank = left.active ? 0 : 1
      const rightRank = right.active ? 0 : 1
      if (leftRank !== rightRank) return leftRank - rightRank
      return getUserDisplayName(left).localeCompare(getUserDisplayName(right))
    }),
)
const filteredForemen = computed(() => {
  const query = foremanSearchTerm.value.trim().toLowerCase()
  if (!query) return foremen.value

  return foremen.value.filter((user) => {
    const haystack = [
      getUserDisplayName(user),
      user.email ?? '',
      user.active ? 'active' : 'inactive',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
})
const activeJobCount = computed(() => allJobs.value.filter((job) => job.active).length)
const archivedJobCount = computed(() => allJobs.value.filter((job) => !job.active).length)
const showAllJobsEntry = computed(() => auth.isAdmin && editDrawerOpen.value)
const jobTypeOptions = computed(() => {
  const seededTypes = ['paint', 'acoustics', 'drywall', 'small-jobs', 'general', 'subcontractor']
  const liveTypes = allJobs.value
    .map((job) => String(job.type ?? '').trim())
    .filter(Boolean)

  return Array.from(new Set([...seededTypes, ...liveTypes]))
})
const gcSuggestions = computed(() =>
  Array.from(
    new Set(allJobs.value.map((job) => job.gc?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right)),
)

const passiveJobDetailMessages = new Set(['Saving...', 'All changes saved.'])

useToastMessages([
  { source: usersError, severity: 'error', summary: 'Jobs' },
  { source: createError, severity: 'error', summary: 'Create Job' },
  { source: createInfo, severity: 'success', summary: 'Create Job' },
  { source: detailError, severity: 'error', summary: 'Job Editor' },
  {
    source: detailInfo,
    severity: 'success',
    summary: 'Job Editor',
    when: (message) => !passiveJobDetailMessages.has(message),
  },
])

function resetCreateForm() {
  createForm.name = ''
  createForm.code = ''
  createForm.type = 'general'
  createForm.gc = ''
  createForm.jobAddress = ''
  createForm.startDate = ''
  createForm.finishDate = ''
  createForm.productionBurden = '0.33'
  createForm.assignedForemanIds = []
  applyNotificationRecipients(createNotificationRecipients)
  resetRecipientInputs(createRecipientInputs)
  createError.value = ''
  createInfo.value = ''
}

function applyNotificationRecipients(target: NotificationRecipients, source?: Partial<NotificationRecipients> | null) {
  for (const moduleKey of NOTIFICATION_MODULE_KEYS) {
    target[moduleKey] = Array.isArray(source?.[moduleKey]) ? [...(source?.[moduleKey] ?? [])] : []
  }
}

function resetRecipientInputs(target: Record<NotificationModuleKey, string>) {
  for (const moduleKey of NOTIFICATION_MODULE_KEYS) {
    target[moduleKey] = ''
  }
}

function applySelectedJobToForm(job: JobRecord | null) {
  detailError.value = ''
  detailInfo.value = ''
  hydratingDetailForm.value = true

  if (!job) {
    detailForm.name = ''
    detailForm.code = ''
    detailForm.type = 'general'
    detailForm.gc = ''
    detailForm.jobAddress = ''
    detailForm.startDate = ''
    detailForm.finishDate = ''
    detailForm.productionBurden = '0.33'
    detailForm.assignedForemanIds = []
    applyNotificationRecipients(detailNotificationRecipients)
    resetRecipientInputs(detailRecipientInputs)
    lastSavedDetailSignature.value = ''
    hydratingDetailForm.value = false
    return
  }

  detailForm.name = job.name
  detailForm.code = job.code ?? ''
  detailForm.type = job.type
  detailForm.gc = job.gc ?? ''
  detailForm.jobAddress = job.jobAddress ?? ''
  detailForm.startDate = job.startDate ?? ''
  detailForm.finishDate = job.finishDate ?? ''
  detailForm.productionBurden = job.productionBurden == null ? '0.33' : String(job.productionBurden)
  detailForm.assignedForemanIds = [...job.assignedForemanIds]
  applyNotificationRecipients(detailNotificationRecipients, job.notificationRecipients)
  resetRecipientInputs(detailRecipientInputs)
  lastSavedDetailSignature.value = serializeJobForm(detailForm)
  hydratingDetailForm.value = false
}

function getJobDisplayName(job: JobRecord) {
  return job.name.trim() || 'Untitled Job'
}

function getJobCode(job: Pick<JobRecord, 'code'>) {
  return job.code?.trim() || 'No Job Number'
}

function getJobMeta(job: JobRecord) {
  const parts = [formatJobTypeLabel(job.type)]
  if (job.gc?.trim()) parts.push(job.gc.trim())
  return parts.join(' / ')
}

function getUserDisplayName(user: UserProfile) {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  return fullName || user.email || 'Unnamed Foreman'
}

function toggleAssignedForeman(target: string[], userId: string) {
  if (target.includes(userId)) {
    const index = target.indexOf(userId)
    target.splice(index, 1)
    return
  }

  target.push(userId)
}

function validateJobForm(form: JobFormState) {
  if (!form.code.trim()) return 'Enter the job number.'
  if (!form.name.trim()) return 'Enter the job name.'
  if (!String(form.type).trim()) return 'Select the job type.'
  if (form.assignedForemanIds.length === 0) return 'Assign at least one foreman.'
  return ''
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getNotificationModuleLabel(moduleKey: NotificationModuleKey) {
  return NOTIFICATION_MODULES.find((module) => module.key === moduleKey)?.label ?? moduleKey
}

function serializeJobForm(form: JobFormState) {
  return JSON.stringify({
    name: form.name.trim(),
    code: form.code.trim(),
    type: String(form.type).trim(),
    gc: form.gc.trim(),
    jobAddress: form.jobAddress.trim(),
    startDate: form.startDate.trim(),
    finishDate: form.finishDate.trim(),
    productionBurden: form.productionBurden.trim(),
    assignedForemanIds: [...form.assignedForemanIds].slice().sort(),
  })
}

function clearDetailAutosaveTimer() {
  if (!detailAutosaveTimer) return
  clearTimeout(detailAutosaveTimer)
  detailAutosaveTimer = null
}

function queueDetailAutosave() {
  if (!auth.isAdmin || !editDrawerOpen.value || isCreateMode.value || !selectedJob.value || hydratingDetailForm.value) {
    return
  }

  const nextSignature = serializeJobForm(detailForm)
  if (nextSignature === lastSavedDetailSignature.value) {
    return
  }

  clearDetailAutosaveTimer()
  detailAutosaveTimer = setTimeout(async () => {
    if (!selectedJob.value) return

    const validationMessage = validateJobForm(detailForm)
    if (validationMessage) {
      detailError.value = validationMessage
      detailInfo.value = ''
      return
    }

    saveLoading.value = true
    detailError.value = ''
    detailInfo.value = 'Saving...'

    try {
      await updateJobRecord(selectedJob.value.id, {
        ...detailForm,
        assignedForemanIds: [...detailForm.assignedForemanIds],
        notificationRecipients: detailNotificationRecipients,
        active: selectedJob.value.active,
      })

      lastSavedDetailSignature.value = nextSignature
      detailInfo.value = 'All changes saved.'
    } catch (error) {
      detailError.value = normalizeError(error, 'Failed to update job.')
      detailInfo.value = ''
    } finally {
      saveLoading.value = false
    }
  }, 450)
}

function openCreateMode() {
  if (!auth.isAdmin) return
  editDrawerOpen.value = true
  selectedJobId.value = 'new'
  resetCreateForm()
}

function openEditDrawer(jobId?: string) {
  if (!auth.isAdmin) return

  editDrawerOpen.value = true

  if (jobId) {
    selectedJobId.value = jobId
    return
  }

  if (selectedJobId.value === 'new') return

  selectedJobId.value = ALL_JOBS_ID
}

function closeEditDrawer() {
  editDrawerOpen.value = false
}

function handleJobPrimaryAction(job: JobRecord) {
  if (auth.isAdmin && editDrawerOpen.value) {
    selectedJobId.value = job.id
    return
  }

  void router.push(`/jobs/${job.id}`)
}

async function handleCreateJob() {
  createError.value = ''
  createInfo.value = ''

  const validationMessage = validateJobForm(createForm)
  if (validationMessage) {
    createError.value = validationMessage
    return
  }

  createLoading.value = true
  try {
    const jobId = await createJobRecord({
      ...createForm,
      assignedForemanIds: [...createForm.assignedForemanIds],
      notificationRecipients: createNotificationRecipients,
      active: true,
    })

    createInfo.value = 'Job created.'
    selectedJobId.value = jobId
  } catch (error) {
    createError.value = normalizeError(error, 'Failed to create job.')
  } finally {
    createLoading.value = false
  }
}

async function handleSaveJob() {
  if (!selectedJob.value) return

  detailError.value = ''
  detailInfo.value = ''

  const validationMessage = validateJobForm(detailForm)
  if (validationMessage) {
    detailError.value = validationMessage
    return
  }

  saveLoading.value = true
  try {
    await updateJobRecord(selectedJob.value.id, {
      ...detailForm,
      assignedForemanIds: [...detailForm.assignedForemanIds],
      notificationRecipients: detailNotificationRecipients,
      active: selectedJob.value.active,
    })

    detailInfo.value = 'Job updated.'
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to update job.')
  } finally {
    saveLoading.value = false
  }
}

async function addRecipientToTarget(
  mode: 'create' | 'job' | 'all',
  moduleKey: NotificationModuleKey,
) {
  const inputs = mode === 'create'
    ? createRecipientInputs
    : mode === 'job'
      ? detailRecipientInputs
      : globalRecipientInputs
  const recipients = mode === 'create'
    ? createNotificationRecipients
    : mode === 'job'
      ? detailNotificationRecipients
      : globalNotificationRecipients.value
  const email = inputs[moduleKey].trim().toLowerCase()
  const errorTarget = mode === 'create' ? createError : detailError
  const infoTarget = mode === 'create' ? createInfo : detailInfo

  errorTarget.value = ''

  if (!email.length) {
    errorTarget.value = `Enter a ${getNotificationModuleLabel(moduleKey)} email first.`
    return
  }

  if (!isEmail(email)) {
    errorTarget.value = 'Enter a valid email address.'
    return
  }

  if (recipients[moduleKey].includes(email)) {
    infoTarget.value = 'That recipient is already on the list.'
    inputs[moduleKey] = ''
    return
  }

  if (mode === 'create') {
    recipients[moduleKey] = [...recipients[moduleKey], email]
    inputs[moduleKey] = ''
    infoTarget.value = 'Recipient added.'
    return
  }

  recipientSaving.value = true
  infoTarget.value = ''
  try {
    const nextRecipients = [...recipients[moduleKey], email]
    if (mode === 'job' && selectedJob.value) {
      await updateJobNotificationRecipients(selectedJob.value.id, moduleKey, nextRecipients)
      recipients[moduleKey] = nextRecipients
    } else if (mode === 'all') {
      await updateGlobalNotificationRecipients(moduleKey, nextRecipients)
      globalNotificationRecipients.value = {
        ...globalNotificationRecipients.value,
        [moduleKey]: nextRecipients,
      }
    }

    inputs[moduleKey] = ''
    infoTarget.value = 'Recipient added.'
  } catch (error) {
    errorTarget.value = normalizeError(error, `Failed to add the ${getNotificationModuleLabel(moduleKey)} recipient.`)
  } finally {
    recipientSaving.value = false
  }
}

async function removeRecipientFromTarget(
  mode: 'create' | 'job' | 'all',
  moduleKey: NotificationModuleKey,
  email: string,
) {
  const recipients = mode === 'create'
    ? createNotificationRecipients
    : mode === 'job'
      ? detailNotificationRecipients
      : globalNotificationRecipients.value
  const errorTarget = mode === 'create' ? createError : detailError
  const infoTarget = mode === 'create' ? createInfo : detailInfo

  errorTarget.value = ''

  if (mode === 'create') {
    recipients[moduleKey] = recipients[moduleKey].filter((entry) => entry !== email)
    infoTarget.value = 'Recipient removed.'
    return
  }

  recipientSaving.value = true
  infoTarget.value = ''
  try {
    const nextRecipients = recipients[moduleKey].filter((entry) => entry !== email)
    if (mode === 'job' && selectedJob.value) {
      await updateJobNotificationRecipients(selectedJob.value.id, moduleKey, nextRecipients)
      recipients[moduleKey] = nextRecipients
    } else if (mode === 'all') {
      await updateGlobalNotificationRecipients(moduleKey, nextRecipients)
      globalNotificationRecipients.value = {
        ...globalNotificationRecipients.value,
        [moduleKey]: nextRecipients,
      }
    }

    infoTarget.value = 'Recipient removed.'
  } catch (error) {
    errorTarget.value = normalizeError(error, `Failed to remove the ${getNotificationModuleLabel(moduleKey)} recipient.`)
  } finally {
    recipientSaving.value = false
  }
}

async function handleToggleArchive() {
  if (!selectedJob.value) return

  const nextActive = !selectedJob.value.active
  const confirmed = window.confirm(`${nextActive ? 'Restore' : 'Archive'} ${getJobDisplayName(selectedJob.value)}?`)
  if (!confirmed) return

  detailError.value = ''
  detailInfo.value = ''
  archiveLoading.value = true
  try {
    await setJobActive(selectedJob.value.id, nextActive)
    detailInfo.value = nextActive ? 'Job restored.' : 'Job archived.'
  } catch (error) {
    detailError.value = normalizeError(error, `Failed to ${nextActive ? 'restore' : 'archive'} job.`)
  } finally {
    archiveLoading.value = false
  }
}

async function handleDeleteJob() {
  if (!selectedJob.value) return

  const confirmed = window.confirm(
    `Delete ${getJobDisplayName(selectedJob.value)}? This removes the job record and clears its foreman assignments.`,
  )
  if (!confirmed) return

  detailError.value = ''
  detailInfo.value = ''
  deleteLoading.value = true
  try {
    await deleteJobRecord(selectedJob.value.id)
    detailInfo.value = 'Job deleted.'
    selectedJobId.value = visibleJobs.value[0]?.id ?? 'new'
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to delete job.')
  } finally {
    deleteLoading.value = false
  }
}

watch(selectedJob, (job) => {
  if (!job) {
    applySelectedJobToForm(null)
    return
  }

  applySelectedJobToForm(job)
})

watch(
  visibleJobs,
  (nextJobs) => {
    if (!auth.isAdmin) {
      const firstJob = nextJobs[0]
      if (!selectedJobId.value && firstJob) {
        selectedJobId.value = firstJob.id
      }
      return
    }

    if (selectedJobId.value === 'new') return
    if (selectedJobId.value === ALL_JOBS_ID) return

    const selectedStillVisible =
      typeof selectedJobId.value === 'string'
      && selectedJobId.value !== ALL_JOBS_ID
      && nextJobs.some((job) => job.id === selectedJobId.value)

    if (!selectedStillVisible) {
      if (editDrawerOpen.value) {
        selectedJobId.value = ALL_JOBS_ID
      } else {
        selectedJobId.value = null
      }
    }
  },
  { immediate: true },
)

watch(editDrawerOpen, (isOpen) => {
  if (!auth.isAdmin) return

  if (isOpen && !selectedJobId.value) {
    selectedJobId.value = ALL_JOBS_ID
  }

  if (!isOpen) {
    clearDetailAutosaveTimer()
  }
})

watch(
  detailForm,
  () => {
    queueDetailAutosave()
  },
  { deep: true },
)

watch(
  () => jobsStore.error,
  (message, previous) => {
    if (!message || message === previous) return
    toast.error(message, 'Jobs')
  },
)

onMounted(() => {
  jobsStore.subscribeVisibleJobs()

  if (auth.isAdmin) {
    usersLoading.value = true
    unsubscribeUsers = subscribeUsers(
      (nextUsers) => {
        users.value = nextUsers
        usersLoading.value = false
      },
      (error) => {
        usersError.value = normalizeError(error, 'Failed to load foremen.')
        usersLoading.value = false
      },
    )

    unsubscribeGlobalNotificationRecipients = subscribeGlobalNotificationRecipients(
      (nextRecipients) => {
        globalNotificationRecipients.value = nextRecipients
      },
      (error) => {
        detailError.value = normalizeError(error, 'Failed to load all-jobs recipients.')
      },
    )
  }
})

onBeforeUnmount(() => {
  clearDetailAutosaveTimer()
  jobsStore.stopJobsSubscription()
  unsubscribeUsers?.()
  unsubscribeGlobalNotificationRecipients?.()
})
</script>

<template>
  <AppShell>
    <template v-if="auth.isAdmin" #topbar-actions>
      <button
        type="button"
        class="app-button app-button--primary app-shell__topbar-button"
        @click="editDrawerOpen ? closeEditDrawer() : openEditDrawer()"
      >
        {{ editDrawerOpen ? 'Done Editing' : 'Edit Mode' }}
      </button>
    </template>

    <div
      class="jobs-workspace"
      :class="{ 'jobs-workspace--split': auth.isAdmin && editDrawerOpen }"
    >
      <section class="jobs-browser">
        <header class="jobs-browser__header">
          <div>
            <span class="jobs-workspace__eyebrow">{{ auth.isAdmin ? 'Admin' : 'Field Workspace' }}</span>
            <h1 class="jobs-workspace__title">Jobs</h1>
          </div>
          <button
            v-if="auth.isAdmin && editDrawerOpen"
            class="app-button app-button--primary"
            type="button"
            @click="openCreateMode"
          >
            New Job
          </button>
        </header>

        <div class="jobs-browser__body">
          <div class="jobs-browser__search">
            <input v-model="searchTerm" type="search" placeholder="Search jobs" />
          </div>

          <div class="jobs-browser__filters">
            <div class="jobs-browser__summary">
              <span>{{ activeJobCount }} active</span>
              <span v-if="auth.isAdmin">{{ archivedJobCount }} archived</span>
              <span>{{ visibleJobs.length }} visible</span>
            </div>

            <label v-if="auth.isAdmin && editDrawerOpen" class="jobs-browser__toggle">
              <input v-model="showArchived" type="checkbox" />
              <span>Show Archived</span>
            </label>
          </div>

          <div class="jobs-browser__list">
            <div v-if="jobsStore.loading" class="jobs-browser__empty">Loading jobs...</div>

            <button
              v-if="showAllJobsEntry"
              type="button"
              class="jobs-browser__row jobs-browser__row--global"
              :class="{ 'jobs-browser__row--active': selectedJobId === ALL_JOBS_ID }"
              @click="selectedJobId = ALL_JOBS_ID"
            >
              <div class="jobs-browser__row-main">
                <strong>All Jobs</strong>
                <span>Global notification defaults</span>
                <span class="jobs-browser__secondary">Daily Logs / Timecards / Shop Orders</span>
              </div>
            </button>

            <button
              v-for="job in visibleJobs"
              :key="job.id"
              type="button"
              class="jobs-browser__row"
              :class="{ 'jobs-browser__row--active': auth.isAdmin && editDrawerOpen && selectedJobId === job.id }"
              @click="handleJobPrimaryAction(job)"
            >
              <div class="jobs-browser__row-main">
                <strong>{{ getJobDisplayName(job) }}</strong>
                <span>{{ getJobMeta(job) }}</span>
                <span class="jobs-browser__secondary">Job #{{ getJobCode(job) }}</span>
              </div>
            </button>

            <div v-if="!jobsStore.loading && visibleJobs.length === 0" class="jobs-browser__empty">
              No jobs match this view.
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="auth.isAdmin && editDrawerOpen"
        class="jobs-detail"
      >
        <template v-if="isCreateMode">
          <header class="jobs-detail__header">
            <div>
              <span class="jobs-workspace__eyebrow">Create</span>
              <h2 class="jobs-detail__title">New Job</h2>
            </div>
          </header>

          <div class="jobs-detail__body">
            <form class="jobs-form" @submit.prevent="handleCreateJob">
              <div class="jobs-form__grid">
                <label class="jobs-form__field">
                  <span>Job Number</span>
                  <input v-model="createForm.code" type="text" autocomplete="off" />
                </label>
                <label class="jobs-form__field">
                  <span>Job Type</span>
                  <select v-model="createForm.type" class="app-select">
                    <option v-for="option in jobTypeOptions" :key="option" :value="option">
                      {{ formatJobTypeLabel(option) }}
                    </option>
                  </select>
                </label>
                <label class="jobs-form__field jobs-form__field--full">
                  <span>Job Name</span>
                  <input v-model="createForm.name" type="text" autocomplete="off" />
                </label>
                <label class="jobs-form__field">
                  <span>GC</span>
                  <input v-model="createForm.gc" type="text" list="job-gc-options" autocomplete="off" />
                </label>
                <label class="jobs-form__field">
                  <span>Burden</span>
                  <input v-model="createForm.productionBurden" type="number" min="0" step="0.01" inputmode="decimal" />
                </label>
                <label class="jobs-form__field">
                  <span>Start Date</span>
                  <input v-model="createForm.startDate" type="date" />
                </label>
                <label class="jobs-form__field">
                  <span>End Date</span>
                  <input v-model="createForm.finishDate" type="date" />
                </label>
                <label class="jobs-form__field jobs-form__field--full">
                  <span>Job Address</span>
                  <input v-model="createForm.jobAddress" type="text" autocomplete="street-address" />
                </label>
              </div>

              <section class="jobs-foremen-panel">
                <div class="jobs-foremen-panel__header">
                  <strong>Assigned Foremen</strong>
                  <span>{{ createForm.assignedForemanIds.length }} selected</span>
                </div>

                <div class="jobs-foremen-panel__search">
                  <input v-model="foremanSearchTerm" type="search" placeholder="Search foremen" />
                </div>

                <div v-if="usersLoading" class="jobs-browser__empty">Loading foremen...</div>
                <div v-else class="jobs-foremen-grid">
                  <label v-for="user in filteredForemen" :key="user.id" class="jobs-foreman-toggle">
                    <input
                      :checked="createForm.assignedForemanIds.includes(user.id)"
                      type="checkbox"
                      @change="toggleAssignedForeman(createForm.assignedForemanIds, user.id)"
                    />
                    <span class="jobs-foreman-toggle__text">
                      <span class="jobs-foreman-toggle__name">{{ getUserDisplayName(user) }}</span>
                      <span class="jobs-foreman-toggle__meta">
                        {{ user.email || 'No email' }} - {{ user.active ? 'Active' : 'Inactive' }}
                      </span>
                    </span>
                  </label>
                  <div v-if="filteredForemen.length === 0" class="jobs-browser__empty jobs-browser__empty--compact">
                    No foremen match your search.
                  </div>
                </div>
              </section>

              <section class="jobs-notifications-panel">
                <div class="jobs-notifications-panel__header">
                  <strong>Email Recipients</strong>
                  <span>Applies only to this new job</span>
                </div>

                <div
                  v-for="module in NOTIFICATION_MODULES"
                  :key="`create-${module.key}`"
                  class="jobs-recipient-section"
                >
                  <div class="jobs-recipient-section__header">
                    <div class="jobs-recipient-section__title">
                      <strong>{{ module.label }}</strong>
                      <span>{{ createNotificationRecipients[module.key].length }} recipients</span>
                    </div>
                  </div>

                  <div class="jobs-inline-input">
                    <input
                      v-model="createRecipientInputs[module.key]"
                      type="email"
                      autocomplete="email"
                      placeholder="name@example.com"
                      @keydown.enter.prevent="addRecipientToTarget('create', module.key)"
                    />
                    <button
                      type="button"
                      class="app-button app-button--primary"
                      @click="addRecipientToTarget('create', module.key)"
                    >
                      Add
                    </button>
                  </div>

                  <div
                    v-if="createNotificationRecipients[module.key].length === 0"
                    class="jobs-browser__empty jobs-browser__empty--compact"
                  >
                    No recipients yet.
                  </div>

                  <div v-else class="jobs-recipient-list">
                    <article
                      v-for="email in createNotificationRecipients[module.key]"
                      :key="`create-${module.key}-${email}`"
                      class="jobs-recipient-row"
                    >
                      <span>{{ email }}</span>
                      <button
                        type="button"
                        class="jobs-inline-remove"
                        @click="removeRecipientFromTarget('create', module.key, email)"
                        aria-label="Remove recipient"
                        title="Remove recipient"
                      >
                        X
                      </button>
                    </article>
                  </div>
                </div>
              </section>

              <div class="jobs-detail__actions">
                <button class="app-button app-button--primary" :disabled="createLoading" type="submit">
                  {{ createLoading ? 'Creating...' : 'Create Job' }}
                </button>
              </div>
            </form>
          </div>
        </template>

        <template v-else-if="isAllJobsMode">
          <header class="jobs-detail__header">
            <div>
              <span class="jobs-workspace__eyebrow">Global Scope</span>
              <h2 class="jobs-detail__title">All Jobs</h2>
            </div>
            <div class="jobs-detail__status-group">
              <span class="jobs-browser__status jobs-browser__status--global">Defaults</span>
            </div>
          </header>

          <div class="jobs-detail__body">
            <section class="jobs-notifications-panel">
              <div class="jobs-notifications-panel__header">
                <strong>Email Recipients</strong>
                <span>Sent for every job unless that job adds more recipients</span>
              </div>

              <div
                v-for="module in NOTIFICATION_MODULES"
                :key="`global-${module.key}`"
                class="jobs-recipient-section"
              >
                <div class="jobs-recipient-section__header">
                  <div class="jobs-recipient-section__title">
                    <strong>{{ module.label }}</strong>
                    <span>{{ globalNotificationRecipients[module.key].length }} recipients</span>
                  </div>
                </div>

                <div class="jobs-inline-input">
                  <input
                    v-model="globalRecipientInputs[module.key]"
                    type="email"
                    autocomplete="email"
                    :disabled="recipientSaving"
                    placeholder="name@example.com"
                    @keydown.enter.prevent="addRecipientToTarget('all', module.key)"
                  />
                  <button
                    type="button"
                    class="app-button app-button--primary"
                    :disabled="recipientSaving"
                    @click="addRecipientToTarget('all', module.key)"
                  >
                    Add
                  </button>
                </div>

                <div
                  v-if="globalNotificationRecipients[module.key].length === 0"
                  class="jobs-browser__empty jobs-browser__empty--compact"
                >
                  No recipients yet.
                </div>

                <div v-else class="jobs-recipient-list">
                  <article
                    v-for="email in globalNotificationRecipients[module.key]"
                    :key="`global-${module.key}-${email}`"
                    class="jobs-recipient-row"
                  >
                    <span>{{ email }}</span>
                    <button
                      type="button"
                      class="jobs-inline-remove"
                      :disabled="recipientSaving"
                      @click="removeRecipientFromTarget('all', module.key, email)"
                      aria-label="Remove recipient"
                      title="Remove recipient"
                    >
                      X
                    </button>
                  </article>
                </div>
              </div>
            </section>
          </div>
        </template>

        <template v-else-if="selectedJob">
          <header class="jobs-detail__header">
            <div>
              <span class="jobs-workspace__eyebrow">Selected Job</span>
              <h2 class="jobs-detail__title">{{ getJobDisplayName(selectedJob) }}</h2>
            </div>
            <div class="jobs-detail__status-group">
              <span :class="['jobs-browser__status', { 'jobs-browser__status--inactive': !selectedJob.active }]">
                {{ selectedJob.active ? 'Active' : 'Archived' }}
              </span>
            </div>
          </header>

          <div class="jobs-detail__body">
            <form class="jobs-form" @submit.prevent="handleSaveJob">
              <div class="jobs-form__grid">
                <label class="jobs-form__field">
                  <span>Job Number</span>
                  <input v-model="detailForm.code" type="text" autocomplete="off" />
                </label>
                <label class="jobs-form__field">
                  <span>Job Type</span>
                  <select v-model="detailForm.type" class="app-select">
                    <option v-for="option in jobTypeOptions" :key="option" :value="option">
                      {{ formatJobTypeLabel(option) }}
                    </option>
                  </select>
                </label>
                <label class="jobs-form__field jobs-form__field--full">
                  <span>Job Name</span>
                  <input v-model="detailForm.name" type="text" autocomplete="off" />
                </label>
                <label class="jobs-form__field">
                  <span>GC</span>
                  <input v-model="detailForm.gc" type="text" list="job-gc-options" autocomplete="off" />
                </label>
                <label class="jobs-form__field">
                  <span>Burden</span>
                  <input v-model="detailForm.productionBurden" type="number" min="0" step="0.01" inputmode="decimal" />
                </label>
                <label class="jobs-form__field">
                  <span>Start Date</span>
                  <input v-model="detailForm.startDate" type="date" />
                </label>
                <label class="jobs-form__field">
                  <span>End Date</span>
                  <input v-model="detailForm.finishDate" type="date" />
                </label>
                <label class="jobs-form__field jobs-form__field--full">
                  <span>Job Address</span>
                  <input v-model="detailForm.jobAddress" type="text" autocomplete="street-address" />
                </label>
              </div>

              <section class="jobs-foremen-panel">
                <div class="jobs-foremen-panel__header">
                  <strong>Assigned Foremen</strong>
                  <span>{{ detailForm.assignedForemanIds.length }} selected</span>
                </div>

                <div class="jobs-foremen-panel__search">
                  <input v-model="foremanSearchTerm" type="search" placeholder="Search foremen" />
                </div>

                <div v-if="usersLoading" class="jobs-browser__empty">Loading foremen...</div>
                <div v-else class="jobs-foremen-grid">
                  <label v-for="user in filteredForemen" :key="user.id" class="jobs-foreman-toggle">
                    <input
                      :checked="detailForm.assignedForemanIds.includes(user.id)"
                      type="checkbox"
                      @change="toggleAssignedForeman(detailForm.assignedForemanIds, user.id)"
                    />
                    <span class="jobs-foreman-toggle__text">
                      <span class="jobs-foreman-toggle__name">{{ getUserDisplayName(user) }}</span>
                      <span class="jobs-foreman-toggle__meta">
                        {{ user.email || 'No email' }} - {{ user.active ? 'Active' : 'Inactive' }}
                      </span>
                    </span>
                  </label>
                  <div v-if="filteredForemen.length === 0" class="jobs-browser__empty jobs-browser__empty--compact">
                    No foremen match your search.
                  </div>
                </div>
              </section>

              <section class="jobs-notifications-panel">
                <div class="jobs-notifications-panel__header">
                  <strong>Email Recipients</strong>
                  <span>Added on top of All Jobs defaults for this job only</span>
                </div>

                <div
                  v-for="module in NOTIFICATION_MODULES"
                  :key="`detail-${module.key}`"
                  class="jobs-recipient-section"
                >
                  <div class="jobs-recipient-section__header">
                    <div class="jobs-recipient-section__title">
                      <strong>{{ module.label }}</strong>
                      <span>{{ detailNotificationRecipients[module.key].length }} recipients</span>
                    </div>
                  </div>

                  <div class="jobs-inline-input">
                    <input
                      v-model="detailRecipientInputs[module.key]"
                      type="email"
                      autocomplete="email"
                      :disabled="recipientSaving"
                      placeholder="name@example.com"
                      @keydown.enter.prevent="addRecipientToTarget('job', module.key)"
                    />
                    <button
                      type="button"
                      class="app-button app-button--primary"
                      :disabled="recipientSaving"
                      @click="addRecipientToTarget('job', module.key)"
                    >
                      Add
                    </button>
                  </div>

                  <div
                    v-if="detailNotificationRecipients[module.key].length === 0"
                    class="jobs-browser__empty jobs-browser__empty--compact"
                  >
                    No recipients yet.
                  </div>

                  <div v-else class="jobs-recipient-list">
                    <article
                      v-for="email in detailNotificationRecipients[module.key]"
                      :key="`detail-${module.key}-${email}`"
                      class="jobs-recipient-row"
                    >
                      <span>{{ email }}</span>
                      <button
                        type="button"
                        class="jobs-inline-remove"
                        :disabled="recipientSaving"
                        @click="removeRecipientFromTarget('job', module.key, email)"
                        aria-label="Remove recipient"
                        title="Remove recipient"
                      >
                        X
                      </button>
                    </article>
                  </div>
                </div>
              </section>

              <div class="jobs-detail__actions">
                <button class="app-button" :disabled="archiveLoading" type="button" @click="handleToggleArchive">
                  {{ archiveLoading ? 'Updating...' : selectedJob.active ? 'Archive Job' : 'Restore Job' }}
                </button>
                <button class="app-button jobs-detail__danger" :disabled="deleteLoading" type="button" @click="handleDeleteJob">
                  {{ deleteLoading ? 'Deleting...' : 'Delete Job' }}
                </button>
              </div>
            </form>
            <div
              v-if="saveLoading || detailInfo === 'All changes saved.'"
              :class="[
                'jobs-workspace__note',
                { 'jobs-workspace__note--success': detailInfo === 'All changes saved.' },
              ]"
            >
              {{ saveLoading ? 'Saving...' : 'All changes saved.' }}
            </div>
          </div>
        </template>

        <template v-else>
          <div class="jobs-detail__body">
            <div class="jobs-browser__empty">
              Select a job to edit, or create a new one.
            </div>
          </div>
        </template>
      </section>
    </div>

    <datalist id="job-gc-options">
      <option v-for="gc in gcSuggestions" :key="gc" :value="gc" />
    </datalist>
  </AppShell>
</template>

<style scoped>
.jobs-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.jobs-workspace--split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.jobs-browser,
.jobs-detail {
  display: grid;
  gap: 1rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.jobs-browser {
  grid-template-rows: auto minmax(0, 1fr);
}

.jobs-detail {
  grid-template-rows: auto minmax(0, 1fr);
}

.jobs-browser__body {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.jobs-detail__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 0.15rem;
}

.jobs-browser__header,
.jobs-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.jobs-workspace__eyebrow {
  color: var(--accent-strong);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.jobs-workspace__title,
.jobs-detail__title {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
}

.jobs-browser__search input,
.jobs-foremen-panel__search input,
.jobs-form__field input {
  width: 100%;
  min-height: 2.8rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
}

.jobs-form__field .app-select {
  --app-select-min-height: 2.8rem;
  --app-select-padding-x: 0.9rem;
  --app-select-background: rgba(255, 255, 255, 0.045);
}

.jobs-browser__filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.jobs-browser__toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-muted);
}

.jobs-browser__toggle input,
.jobs-foreman-toggle input {
  margin-top: 0.1rem;
  accent-color: var(--accent-strong);
}

.jobs-browser__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--text-soft);
  font-size: 0.76rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.jobs-browser__list {
  display: grid;
  gap: 0.55rem;
  align-content: start;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.jobs-browser__row {
  display: grid;
  gap: 0.7rem;
  width: 100%;
  padding: 0.9rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.jobs-browser__row:hover,
.jobs-browser__row--active {
  border-color: rgba(88, 186, 233, 0.28);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    rgba(255, 255, 255, 0.04);
  transform: translateY(-1px);
}

.jobs-browser__row--global {
  gap: 0.45rem;
  border-style: dashed;
}

.jobs-browser__row-main {
  display: grid;
  gap: 0.2rem;
}

.jobs-browser__row-main span,
.jobs-browser__empty,
.jobs-browser__secondary {
  color: var(--text-muted);
}

.jobs-browser__secondary {
  font-size: 0.84rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.jobs-browser__row-meta,
.jobs-detail__status-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.jobs-browser__status {
  display: inline-flex;
  align-items: center;
  min-height: 1.85rem;
  padding: 0 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border: 1px solid rgba(103, 213, 157, 0.2);
  background: rgba(50, 92, 72, 0.22);
  color: var(--success);
}

.jobs-browser__status--inactive {
  border-color: rgba(255, 125, 107, 0.2);
  background: rgba(104, 52, 45, 0.22);
  color: var(--danger);
}

.jobs-browser__status--global {
  border-color: rgba(88, 186, 233, 0.24);
  background: rgba(38, 74, 96, 0.24);
  color: var(--accent);
}

.jobs-detail__header,
.jobs-foremen-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.jobs-form {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.jobs-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.jobs-form__field {
  display: grid;
  gap: 0.45rem;
  color: var(--text-muted);
}

.jobs-form__field--full {
  grid-column: 1 / -1;
}

.jobs-form__field span {
  font-size: 0.9rem;
}

.jobs-foremen-panel {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.03);
}

.jobs-notifications-panel {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.03);
}

.jobs-notifications-panel__header {
  display: grid;
  gap: 0.2rem;
}

.jobs-notifications-panel__header strong {
  color: var(--text);
  font-size: 1rem;
}

.jobs-notifications-panel__header span {
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.4;
}

.jobs-foremen-panel__header span {
  color: var(--text-muted);
}

.jobs-recipient-section {
  display: grid;
  gap: 0.75rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.jobs-recipient-section:first-of-type {
  padding-top: 0;
  border-top: 0;
}

.jobs-recipient-section__header {
  display: block;
}

.jobs-recipient-section__title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.85rem;
  color: var(--text-muted);
}

.jobs-recipient-section__title strong {
  color: var(--text);
  font-size: 1rem;
}

.jobs-recipient-section__title span {
  flex: 0 0 auto;
  font-size: 0.86rem;
  white-space: nowrap;
}

.jobs-inline-input {
  display: flex;
  align-items: stretch;
  gap: 0.6rem;
  max-width: 28rem;
}

.jobs-inline-input .app-button {
  flex: 0 0 auto;
  min-width: 4.25rem;
  min-height: 2.25rem;
  padding: 0 0.95rem;
  border-radius: 9px;
  white-space: nowrap;
}

.jobs-inline-input input {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  min-height: 2.25rem;
  padding: 0 0.8rem;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
  font-size: 0.92rem;
}

.jobs-recipient-list,
.jobs-browser__empty--compact {
  max-width: 42rem;
}

.jobs-browser__empty--compact {
  min-height: 3.4rem;
  padding: 0.9rem 1rem;
}

.jobs-recipient-list {
  display: grid;
  gap: 0.55rem;
}

.jobs-recipient-row {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
}

.jobs-recipient-row span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.jobs-inline-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid rgba(255, 125, 107, 0.24);
  border-radius: 999px;
  background: transparent;
  color: var(--danger);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
}

.jobs-inline-remove:disabled {
  cursor: default;
  opacity: 0.6;
}

.jobs-foremen-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.6rem;
  max-height: 22rem;
  overflow: auto;
  padding-right: 0.15rem;
}

.jobs-foreman-toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.65rem;
  min-height: 4.6rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
}

.jobs-foreman-toggle__text {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.jobs-foreman-toggle__name {
  color: var(--text);
  line-height: 1.35;
  word-break: break-word;
}

.jobs-foreman-toggle__meta,
.jobs-browser__empty {
  color: var(--text-muted);
}

.jobs-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.jobs-detail__danger {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.jobs-workspace__note {
  padding: 0.95rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-muted);
}

.jobs-workspace__note--error {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.jobs-workspace__note--success {
  border-color: rgba(103, 213, 157, 0.24);
  color: var(--success);
}

.jobs-browser__empty {
  display: grid;
  place-content: center;
  min-height: 12rem;
  padding: 1.5rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  text-align: center;
}

.jobs-browser__empty--compact {
  min-height: 6rem;
}

@media (max-width: 1100px) {
  .jobs-workspace--split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .jobs-workspace {
    grid-template-columns: 1fr;
  }

  .jobs-form__grid {
    grid-template-columns: 1fr;
  }

  .jobs-browser__header,
  .jobs-detail__header,
  .jobs-foremen-panel__header,
  .jobs-browser__filters {
    flex-direction: column;
    align-items: flex-start;
  }

  .jobs-inline-input {
    flex-direction: column;
    max-width: none;
  }

  .jobs-recipient-section__title {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }
}
</style>
