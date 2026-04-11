import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { isSelectableJobType } from '@/constants/jobs'
import { listTimecardsByJobAndWeek } from '@/services/Timecards'
import { linkForemanToJob, unlinkForemanFromJob } from '@/services'
import { useJobsStore } from '@/stores/jobs'
import { useUsersStore } from '@/stores/users'
import type { Job, UserProfile } from '@/services'
import type { JobFormInput, JobSortKey, SortDir } from '@/types/adminJobs'
import type { JobType } from '@/types/models'
import { createJobForm } from '@/types/adminJobs'
import { createDatePickerConfig, getTodayDateInputValue, isValidDateInputValue, toDateInputValue } from '@/utils/dateInputs'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { downloadCsv } from '@/utils/plexisIntegration'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { ROLES } from '@/constants/app'
import { formatProductionBurdenInput, normalizeProductionBurden } from '@/constants/timecards'
import { getFirstValidationMessage, validateJobForm } from '@/utils/validation'

type NonStatusSortKey = Exclude<JobSortKey, 'status'>

export function useAdminJobs() {
  const jobsStore = useJobsStore()
  const usersStore = useUsersStore()
  const { confirm } = useConfirmDialog()
  const toast = useToast()
  const { jobs, loading: loadingJobs, error: jobsError } = storeToRefs(jobsStore)
  const { users: allUsers } = storeToRefs(usersStore)

  const err = computed(() => jobsError.value || '')
  const jobSortKey = ref<JobSortKey>('name')
  const jobSortDir = ref<SortDir>('asc')

  const showJobForm = ref(false)
  const jobForm = ref<JobFormInput>(createJobForm())
  const creatingJob = ref(false)

  const togglingJobId = ref('')
  const editingJobId = ref('')
  const editingJobForm = ref<JobFormInput>(createJobForm())
  const editingJobSaving = ref(false)
  const activeJobActionsId = ref('')

  const orderedJobs = computed(() =>
    [...jobs.value].sort((a, b) => {
      if (a.active !== b.active) return Number(b.active) - Number(a.active)
      return (a.name || '').localeCompare(b.name || '')
    })
  )

  const activeJob = computed(() => (
    jobs.value.find((job) => job.id === activeJobActionsId.value) ?? null
  ))
  const activeJobDirty = computed(() => (
    activeJob.value ? isJobDirty(activeJob.value) : false
  ))

  const sortedJobs = computed(() => {
    const key = jobSortKey.value
    const dir = jobSortDir.value === 'asc' ? 1 : -1
    const normalize = (value: unknown) => {
      if (value === undefined || value === null) return ''
      if (typeof value === 'string') return value.toLowerCase()
      return String(value).toLowerCase()
    }

    return [...orderedJobs.value].sort((a, b) => {
      if (key === 'status') {
        if (a.active === b.active) return 0
        return a.active ? -dir : dir
      }
      const sortKey = key as NonStatusSortKey
      const aValue = normalize(a[sortKey])
      const bValue = normalize(b[sortKey])
      if (aValue === bValue) return 0
      return aValue > bValue ? dir : -dir
    })
  })

  const foremanUsers = computed(() => allUsers.value.filter(
    (user) => user.role === ROLES.FOREMAN && user.active
  ))

  const foremanOptions = computed(() => foremanUsers.value.map((foreman) => {
    const label = foremanDisplayName(foreman)
    return {
      value: foreman.id,
      label,
    }
  }))

  const currentWeekStart = computed(() => snapToSunday(getTodayDateInputValue()))
  const currentWeekEnd = computed(() => getSaturdayFromSunday(currentWeekStart.value))
  const currentWeekLabel = computed(() => formatWeekRange(currentWeekStart.value, currentWeekEnd.value))
  const exportDateInWeek = ref<string>(currentWeekEnd.value)
  const exportWeekStart = computed(() => {
    if (!isValidDateInputValue(exportDateInWeek.value)) return ''
    return snapToSunday(exportDateInWeek.value)
  })
  const exportWeekEnding = computed(() => {
    if (!exportWeekStart.value) return ''
    return getSaturdayFromSunday(exportWeekStart.value)
  })
  const exportWeekLabel = computed(() => {
    if (!exportWeekStart.value || !exportWeekEnding.value) return 'Invalid date'
    return formatWeekRange(exportWeekStart.value, exportWeekEnding.value)
  })

  const exportDateConfig = computed(() => createDatePickerConfig({
    maxDate: currentWeekEnd.value,
  }))

  watch(
    () => sortedJobs.value.map((job) => job.id).join('|'),
    (jobIds) => {
      if (!jobIds) {
        if (activeJobActionsId.value) {
          clearInlineJob()
          activeJobActionsId.value = ''
        }
        return
      }

      const selectedStillExists = sortedJobs.value.some((job) => job.id === activeJobActionsId.value)
      if (selectedStillExists) return

      const firstJob = sortedJobs.value[0]
      if (!firstJob) return
      setInlineJob(firstJob)
      activeJobActionsId.value = firstJob.id
    },
    { immediate: true }
  )

  function setJobForm(value: JobFormInput) {
    jobForm.value = value
  }

  function setShowJobForm(value: boolean) {
    if (!value) {
      jobForm.value = createJobForm()
    }
    showJobForm.value = value
  }

  function setEditingJobForm(value: JobFormInput) {
    editingJobForm.value = value
  }

  function setExportDateInWeek(value: string) {
    exportDateInWeek.value = value
  }

  function foremanDisplayName(user: UserProfile) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || ''
  }

  function toCsv(headers: string[], rows: (string | number)[][]): string {
    const escape = (value: string | number) => {
      const text = String(value ?? '')
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
  }

  async function exportAllSubmittedAllJobs() {
    try {
      const weekEnding = toDateInputValue(exportWeekEnding.value)
      if (!weekEnding) {
        toast.show('Please select a valid date.', 'error')
        return
      }

      const rows: (string | number)[][] = []

      for (const job of jobs.value) {
        const timecards = (await listTimecardsByJobAndWeek(job.id, weekEnding))
          .filter((card) => card.status === 'submitted')

        for (const card of timecards) {
          rows.push([
            job.name,
            job.code || '',
            card.weekEndingDate,
            card.employeeNumber,
            card.employeeName,
            card.occupation,
            card.days[0]?.hours ?? '',
            card.days[1]?.hours ?? '',
            card.days[2]?.hours ?? '',
            card.days[3]?.hours ?? '',
            card.days[4]?.hours ?? '',
            card.days[5]?.hours ?? '',
            card.days[6]?.hours ?? '',
            card.totals.hoursTotal ?? '',
            card.totals.productionTotal ?? '',
          ])
        }
      }

      if (rows.length === 0) {
        toast.show('No submitted timecards to export', 'info')
        return
      }

      const headers = [
        'Job Name',
        'Job Code',
        'Week Ending',
        'Employee #',
        'Name',
        'Occupation',
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Total Hours',
        'Total Production',
      ]

      downloadCsv(toCsv(headers, rows), `timecards-submitted-all-jobs-${weekEnding}.csv`)
      toast.show(`Exported ${rows.length} submitted timecard row(s)`, 'success')
    } catch (error) {
      toast.show(formatErr(error), 'error')
    }
  }

  function formatErr(error: unknown) {
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message?: unknown }).message ?? error)
    }
    return String(error)
  }

  function asText(value: unknown, fallback = '--') {
    if (value === null || value === undefined) return fallback
    const text = String(value).trim()
    return text ? text : fallback
  }

  function loadJobs() {
    jobsStore.subscribeAllJobs(true)
  }

  function getJobValidationMessage(form: JobFormInput) {
    return getFirstValidationMessage(validateJobForm({
      name: form.name,
      code: form.code,
      type: form.type,
      startDate: form.startDate,
      finishDate: form.finishDate,
      productionBurden: form.productionBurden,
    }))
  }

  function resolveForemanUserById(foremanId: string) {
    return foremanUsers.value.find((user) => user.id === foremanId) ?? null
  }

  function resolveJobForemanId(job: Job) {
    const assignedForemanId = (job.assignedForemanIds ?? []).find((foremanId) => (
      foremanUsers.value.some((user) => user.id === foremanId)
    ))
    if (assignedForemanId) return assignedForemanId

    const foremanLabel = String(job.foreman ?? '').trim()
    if (!foremanLabel) return ''

    return foremanUsers.value.find((user) => foremanDisplayName(user) === foremanLabel)?.id ?? ''
  }

  function createEditableJobType(job: Job) {
    return isSelectableJobType(job.type) ? job.type : ''
  }

  function createJobFormFromJob(job: Job): JobFormInput {
    return {
      name: job.name || '',
      code: job.code || '',
      projectManager: job.projectManager || '',
      foreman: resolveJobForemanId(job),
      gc: job.gc || '',
      jobAddress: job.jobAddress || '',
      startDate: job.startDate || '',
      finishDate: job.finishDate || '',
      taxExempt: job.taxExempt || '',
      certified: job.certified || '',
      cip: job.cip || '',
      kjic: job.kjic || '',
      productionBurden: formatProductionBurdenInput(job.productionBurden),
      type: createEditableJobType(job),
    }
  }

  function setInlineJob(job: Job) {
    editingJobId.value = job.id
    editingJobForm.value = createJobFormFromJob(job)
  }

  function clearInlineJob() {
    editingJobId.value = ''
    editingJobForm.value = createJobForm()
  }

  function isJobDirty(job: Job) {
    return (
      editingJobForm.value.name.trim() !== (job.name || '') ||
      editingJobForm.value.code.trim() !== (job.code || '') ||
      editingJobForm.value.projectManager.trim() !== (job.projectManager || '') ||
      editingJobForm.value.gc.trim() !== (job.gc || '') ||
      editingJobForm.value.jobAddress.trim() !== (job.jobAddress || '') ||
      editingJobForm.value.startDate.trim() !== (job.startDate || '') ||
      editingJobForm.value.finishDate.trim() !== (job.finishDate || '') ||
      editingJobForm.value.taxExempt.trim() !== (job.taxExempt || '') ||
      editingJobForm.value.certified.trim() !== (job.certified || '') ||
      editingJobForm.value.cip.trim() !== (job.cip || '') ||
      editingJobForm.value.kjic.trim() !== (job.kjic || '') ||
      editingJobForm.value.foreman !== resolveJobForemanId(job) ||
      normalizeProductionBurden(editingJobForm.value.productionBurden) !== normalizeProductionBurden(job.productionBurden) ||
      editingJobForm.value.type !== createEditableJobType(job)
    )
  }

  async function saveInlineJob(job: Job) {
    if (editingJobId.value !== job.id) return
    if (!isJobDirty(job)) return

    const validationMessage = getJobValidationMessage(editingJobForm.value)
    if (validationMessage) {
      toast.show(validationMessage, 'error')
      throw new Error(validationMessage)
    }

    const selectedForeman = resolveForemanUserById(editingJobForm.value.foreman)
    if (editingJobForm.value.foreman && !selectedForeman) {
      const message = 'Selected foreman could not be found'
      toast.show(message, 'error')
      throw new Error(message)
    }

    editingJobSaving.value = true
    try {
      const currentForemanIds = (job.assignedForemanIds ?? []).filter((foremanId) => typeof foremanId === 'string' && foremanId.trim())
      for (const foremanId of currentForemanIds) {
        if (foremanId === selectedForeman?.id) continue
        await unlinkForemanFromJob(foremanId, job.id)
      }
      if (selectedForeman && !currentForemanIds.includes(selectedForeman.id)) {
        await linkForemanToJob(selectedForeman.id, job.id)
      }

      await jobsStore.updateJob(job.id, {
        name: editingJobForm.value.name.trim(),
        code: editingJobForm.value.code.trim() || null,
        projectManager: editingJobForm.value.projectManager.trim() || null,
        foreman: selectedForeman ? foremanDisplayName(selectedForeman) : null,
        gc: editingJobForm.value.gc.trim() || null,
        jobAddress: editingJobForm.value.jobAddress.trim() || null,
        startDate: editingJobForm.value.startDate.trim() || null,
        finishDate: editingJobForm.value.finishDate.trim() || null,
        taxExempt: editingJobForm.value.taxExempt.trim() || null,
        certified: editingJobForm.value.certified.trim() || null,
        cip: editingJobForm.value.cip.trim() || null,
        kjic: editingJobForm.value.kjic.trim() || null,
        productionBurden: normalizeProductionBurden(editingJobForm.value.productionBurden),
        type: editingJobForm.value.type as JobType,
      })
      job.assignedForemanIds = selectedForeman ? [selectedForeman.id] : []
      toast.show('Job updated', 'success')
    } catch (error) {
      const message = formatErr(error)
      toast.show(message, 'error')
      throw error instanceof Error ? error : new Error(message)
    } finally {
      editingJobSaving.value = false
    }
  }

  async function saveActiveJob() {
    if (!activeJob.value) return
    try {
      await saveInlineJob(activeJob.value)
    } catch {
      return
    }
  }

  function resetActiveJobChanges() {
    if (!activeJob.value) return
    setInlineJob(activeJob.value)
  }

  async function selectJob(job: Job) {
    if (activeJob.value?.id === job.id) return
    if (activeJob.value) {
      try {
        await saveInlineJob(activeJob.value)
      } catch {
        return
      }
    }
    setInlineJob(job)
    activeJobActionsId.value = job.id
  }

  async function closeActiveJob() {
    if (activeJob.value) {
      try {
        await saveInlineJob(activeJob.value)
      } catch {
        return
      }
    }
    clearInlineJob()
    activeJobActionsId.value = ''
  }

  async function toggleJobActions(job: Job) {
    const isOpen = activeJobActionsId.value === job.id
    if (isOpen) {
      await closeActiveJob()
      return
    }
    try {
      await selectJob(job)
    } catch {
      return
    }
  }

  async function submitJobForm() {
    const validationMessage = getJobValidationMessage(jobForm.value)
    if (validationMessage) {
      toast.show(validationMessage, 'error')
      return
    }

    creatingJob.value = true
    try {
      const selectedForeman = resolveForemanUserById(jobForm.value.foreman)
      if (jobForm.value.foreman && !selectedForeman) {
        toast.show('Selected foreman could not be found', 'error')
        return
      }

      const createdJob = await jobsStore.createJob(jobForm.value.name, {
        code: jobForm.value.code,
        projectManager: jobForm.value.projectManager,
        gc: jobForm.value.gc,
        jobAddress: jobForm.value.jobAddress,
        startDate: jobForm.value.startDate,
        finishDate: jobForm.value.finishDate,
        taxExempt: jobForm.value.taxExempt,
        certified: jobForm.value.certified,
        cip: jobForm.value.cip,
        kjic: jobForm.value.kjic,
        productionBurden: normalizeProductionBurden(jobForm.value.productionBurden),
        type: jobForm.value.type as JobType,
      })

      if (createdJob && selectedForeman) {
        await linkForemanToJob(selectedForeman.id, createdJob.id)
        await jobsStore.updateJob(createdJob.id, {
          foreman: foremanDisplayName(selectedForeman),
        })
        createdJob.foreman = foremanDisplayName(selectedForeman)
        createdJob.assignedForemanIds = [selectedForeman.id]
      }

      toast.show('Job created successfully', 'success')
      showJobForm.value = false
      jobForm.value = createJobForm()
    } catch (error) {
      toast.show(formatErr(error), 'error')
    } finally {
      creatingJob.value = false
    }
  }

  function cancelJobForm() {
    setShowJobForm(false)
  }

  async function handleDeleteJob(job: Job) {
    const confirmed = await confirm(
      `Delete "${job.name}"? This action cannot be undone and will remove all associated data (daily logs, timecards, orders, etc.).`,
      {
        title: 'Delete Job',
        confirmText: 'Delete',
        variant: 'danger',
      }
    )
    if (!confirmed) return

    try {
      await jobsStore.deleteJob(job.id)
      toast.show('Job deleted', 'success')
      if (activeJobActionsId.value === job.id) {
        clearInlineJob()
        activeJobActionsId.value = ''
      }
    } catch {
      toast.show('Failed to delete job', 'error')
    }
  }

  async function toggleArchive(job: Job, active: boolean) {
    togglingJobId.value = job.id
    try {
      await jobsStore.setJobActive(job.id, active)
      toast.show(active ? 'Job restored' : 'Job archived', 'success')
    } catch (error) {
      toast.show(formatErr(error), 'error')
    } finally {
      togglingJobId.value = ''
    }
  }

  function handleJobSort(payload: { sortKey: string; sortDir: SortDir }) {
    jobSortKey.value = payload.sortKey as JobSortKey
    jobSortDir.value = payload.sortDir
  }

  onMounted(() => {
    loadJobs()
    usersStore.subscribeAllUsers()
  })

  onUnmounted(() => {
    jobsStore.stopJobsSubscription()
    usersStore.stopUsersSubscription()
  })

  return {
    activeJobActionsId,
    activeJob,
    activeJobDirty,
    asText,
    cancelJobForm,
    closeActiveJob,
    creatingJob,
    currentWeekEnd,
    currentWeekLabel,
    editingJobForm,
    editingJobId,
    editingJobSaving,
    err,
    exportAllSubmittedAllJobs,
    exportDateConfig,
    exportDateInWeek,
    exportWeekEnding,
    exportWeekLabel,
    foremanOptions,
    handleDeleteJob,
    handleJobSort,
    jobForm,
    jobSortDir,
    jobSortKey,
    loadingJobs,
    setEditingJobForm,
    setExportDateInWeek,
    setJobForm,
    setShowJobForm,
    selectJob,
    saveActiveJob,
    resetActiveJobChanges,
    showJobForm,
    sortedJobs,
    submitJobForm,
    toggleArchive,
    toggleJobActions,
    togglingJobId,
  }
}
