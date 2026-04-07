import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { listTimecardsByJobAndWeek } from '@/services/Timecards'
import { useJobsStore } from '@/stores/jobs'
import { useUsersStore } from '@/stores/users'
import type { Job, UserProfile } from '@/services'
import type { JobFormInput, JobSortKey, SortDir } from '@/types/adminJobs'
import { createJobForm } from '@/types/adminJobs'
import { createDatePickerConfig, getTodayDateInputValue, isValidDateInputValue, toDateInputValue } from '@/utils/dateInputs'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { downloadCsv } from '@/utils/plexisIntegration'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useAdminJobTeam } from '@/composables/admin/useAdminJobTeam'
import { useToast } from '@/composables/useToast'
import { ROLES } from '@/constants/app'

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
      value: label,
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

  const jobTeam = useAdminJobTeam({
    selectedJob: activeJob,
    users: computed(() => allUsers.value),
  })

  function setJobForm(value: JobFormInput) {
    jobForm.value = value
  }

  function setShowJobForm(value: boolean) {
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

  function setInlineJob(job: Job) {
    editingJobId.value = job.id
    editingJobForm.value = {
      name: job.name || '',
      code: job.code || '',
      projectManager: job.projectManager || '',
      foreman: job.foreman || '',
      gc: job.gc || '',
      jobAddress: job.jobAddress || '',
      startDate: job.startDate || '',
      finishDate: job.finishDate || '',
      taxExempt: job.taxExempt || '',
      certified: job.certified || '',
      cip: job.cip || '',
      kjic: job.kjic || '',
      accountNumber: job.accountNumber || '',
      type: job.type || 'general',
    }
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
      editingJobForm.value.foreman.trim() !== (job.foreman || '') ||
      editingJobForm.value.gc.trim() !== (job.gc || '') ||
      editingJobForm.value.jobAddress.trim() !== (job.jobAddress || '') ||
      editingJobForm.value.startDate.trim() !== (job.startDate || '') ||
      editingJobForm.value.finishDate.trim() !== (job.finishDate || '') ||
      editingJobForm.value.taxExempt.trim() !== (job.taxExempt || '') ||
      editingJobForm.value.certified.trim() !== (job.certified || '') ||
      editingJobForm.value.cip.trim() !== (job.cip || '') ||
      editingJobForm.value.kjic.trim() !== (job.kjic || '') ||
      editingJobForm.value.accountNumber.trim() !== (job.accountNumber || '') ||
      editingJobForm.value.type !== (job.type || 'general')
    )
  }

  async function saveInlineJob(job: Job) {
    if (editingJobId.value !== job.id) return
    if (!isJobDirty(job)) return

    editingJobSaving.value = true
    try {
      await jobsStore.updateJob(job.id, {
        name: editingJobForm.value.name.trim(),
        code: editingJobForm.value.code.trim() || null,
        projectManager: editingJobForm.value.projectManager.trim() || null,
        foreman: editingJobForm.value.foreman.trim() || null,
        gc: editingJobForm.value.gc.trim() || null,
        jobAddress: editingJobForm.value.jobAddress.trim() || null,
        startDate: editingJobForm.value.startDate.trim() || null,
        finishDate: editingJobForm.value.finishDate.trim() || null,
        taxExempt: editingJobForm.value.taxExempt.trim() || null,
        certified: editingJobForm.value.certified.trim() || null,
        cip: editingJobForm.value.cip.trim() || null,
        kjic: editingJobForm.value.kjic.trim() || null,
        accountNumber: editingJobForm.value.accountNumber.trim() || null,
        type: editingJobForm.value.type,
      })
      toast.show('Job updated', 'success')
    } catch (error) {
      toast.show(formatErr(error), 'error')
    } finally {
      editingJobSaving.value = false
    }
  }

  async function toggleJobActions(job: Job) {
    const isOpen = activeJobActionsId.value === job.id
    if (isOpen) {
      await saveInlineJob(job)
      clearInlineJob()
      activeJobActionsId.value = ''
      return
    }

    clearInlineJob()
    setInlineJob(job)
    activeJobActionsId.value = job.id
  }

  async function submitJobForm() {
    creatingJob.value = true
    try {
      await jobsStore.createJob(jobForm.value.name, {
        code: jobForm.value.code,
        projectManager: jobForm.value.projectManager,
        foreman: jobForm.value.foreman,
        gc: jobForm.value.gc,
        jobAddress: jobForm.value.jobAddress,
        startDate: jobForm.value.startDate,
        finishDate: jobForm.value.finishDate,
        taxExempt: jobForm.value.taxExempt,
        certified: jobForm.value.certified,
        cip: jobForm.value.cip,
        kjic: jobForm.value.kjic,
        accountNumber: jobForm.value.accountNumber,
        type: jobForm.value.type,
      })
      toast.show('Job created successfully', 'success')
      showJobForm.value = false
      jobForm.value = createJobForm()
      loadJobs()
    } catch (error) {
      toast.show(formatErr(error), 'error')
    } finally {
      creatingJob.value = false
    }
  }

  function cancelJobForm() {
    jobForm.value = createJobForm()
    showJobForm.value = false
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
      loadJobs()
    } catch {
      toast.show('Failed to delete job', 'error')
    }
  }

  async function toggleArchive(job: Job, active: boolean) {
    togglingJobId.value = job.id
    try {
      await jobsStore.setJobActive(job.id, active)
      toast.show(active ? 'Job restored' : 'Job archived', 'success')
      loadJobs()
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
    asText,
    cancelJobForm,
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
    jobTeam,
    jobSortDir,
    jobSortKey,
    loadingJobs,
    setEditingJobForm,
    setExportDateInWeek,
    setJobForm,
    setShowJobForm,
    showJobForm,
    sortedJobs,
    submitJobForm,
    toggleArchive,
    toggleJobActions,
    togglingJobId,
  }
}
