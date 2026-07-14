import { formatJobTypeLabel, toEffectiveRole } from '@/types/domain'
import type { JobRecord, JobType, NotificationModuleKey, NotificationRecipients, UserProfile } from '@/types/domain'
import { filterDirectoryRecords, type DirectoryStatusFilter } from '@/utils/directoryFilters'

export interface JobFormState {
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

export type JobFormTextField = Exclude<keyof JobFormState, 'assignedForemanIds'>

export const ALL_JOBS_ID = '__all_jobs__'

const DEFAULT_JOB_TYPES = ['paint', 'acoustics', 'drywall', 'small-jobs', 'general', 'subcontractor']

export const JOB_NOTIFICATION_MODULES: Array<{ key: NotificationModuleKey; label: string }> = [
  { key: 'dailyLogs', label: 'Daily Logs' },
  { key: 'timecards', label: 'Timecards' },
  { key: 'shopOrders', label: 'Shop Orders' },
]

export const JOB_NOTIFICATION_MODULE_KEYS = JOB_NOTIFICATION_MODULES.map((module) => module.key)

export function createEmptyNotificationRecipients(): NotificationRecipients {
  return {
    dailyLogs: [],
    timecards: [],
    shopOrders: [],
  }
}

export function createRecipientInputState(): Record<NotificationModuleKey, string> {
  return {
    dailyLogs: '',
    timecards: '',
    shopOrders: '',
  }
}

export function createEmptyJobFormState(): JobFormState {
  return {
    name: '',
    code: '',
    type: 'general',
    gc: '',
    jobAddress: '',
    startDate: '',
    finishDate: '',
    productionBurden: '0.33',
    assignedForemanIds: [],
  }
}

export function resetJobFormState(target: JobFormState) {
  const emptyForm = createEmptyJobFormState()
  target.name = emptyForm.name
  target.code = emptyForm.code
  target.type = emptyForm.type
  target.gc = emptyForm.gc
  target.jobAddress = emptyForm.jobAddress
  target.startDate = emptyForm.startDate
  target.finishDate = emptyForm.finishDate
  target.productionBurden = emptyForm.productionBurden
  target.assignedForemanIds = [...emptyForm.assignedForemanIds]
}

export function applyJobRecordToFormState(target: JobFormState, job: JobRecord | null) {
  if (!job) {
    resetJobFormState(target)
    return
  }

  target.name = job.name
  target.code = job.code ?? ''
  target.type = job.type
  target.gc = job.gc ?? ''
  target.jobAddress = job.jobAddress ?? ''
  target.startDate = job.startDate ?? ''
  target.finishDate = job.finishDate ?? ''
  target.productionBurden = job.productionBurden == null ? '0.33' : String(job.productionBurden)
  target.assignedForemanIds = [...job.assignedForemanIds]
}

export function applyNotificationRecipients(
  target: NotificationRecipients,
  source?: Partial<NotificationRecipients> | null,
) {
  for (const moduleKey of JOB_NOTIFICATION_MODULE_KEYS) {
    target[moduleKey] = Array.isArray(source?.[moduleKey]) ? [...(source?.[moduleKey] ?? [])] : []
  }
}

export function resetRecipientInputs(target: Record<NotificationModuleKey, string>) {
  for (const moduleKey of JOB_NOTIFICATION_MODULE_KEYS) {
    target[moduleKey] = ''
  }
}

export function getJobDisplayName(job: Pick<JobRecord, 'name'>) {
  return job.name.trim() || 'Untitled Job'
}

export function getJobFieldUserDisplayName(
  user: Pick<UserProfile, 'email' | 'firstName' | 'lastName'>,
  fallback = 'Unnamed Foreman',
) {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  return fullName || user.email || fallback
}

export function toggleAssignedForeman(target: string[], userId: string) {
  if (target.includes(userId)) {
    const index = target.indexOf(userId)
    target.splice(index, 1)
    return
  }

  target.push(userId)
}

export function filterJobsForDirectory(
  jobs: readonly JobRecord[],
  statusFilter: DirectoryStatusFilter,
  search: string,
) {
  return filterDirectoryRecords(
    jobs.slice(),
    statusFilter,
    search,
    (job) => [
      job.name,
      job.code ?? '',
      formatJobTypeLabel(job.type),
      job.gc ?? '',
      job.jobAddress ?? '',
    ],
  )
}

export function getSelectedJobForJobsView(
  jobs: readonly JobRecord[],
  selectedJobId: string | null,
) {
  if (!selectedJobId || selectedJobId === 'new' || selectedJobId === ALL_JOBS_ID) return null
  return jobs.find((job) => job.id === selectedJobId) ?? null
}

export function buildJobForemanOptions(users: readonly UserProfile[]) {
  return users
    .filter((user) => toEffectiveRole(user.role) === 'foreman')
    .slice()
    .sort((left, right) => {
      const leftRank = left.active ? 0 : 1
      const rightRank = right.active ? 0 : 1
      if (leftRank !== rightRank) return leftRank - rightRank
      return getJobFieldUserDisplayName(left).localeCompare(getJobFieldUserDisplayName(right))
    })
}

export function filterJobForemanOptions(foremen: readonly UserProfile[], search: string) {
  const query = search.trim().toLowerCase()
  if (!query) return foremen.slice()

  return foremen.filter((user) => {
    const haystack = [
      getJobFieldUserDisplayName(user),
      user.email ?? '',
      user.active ? 'active' : 'inactive',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function getJobStatusCounts(jobs: readonly JobRecord[]) {
  return jobs.reduce(
    (counts, job) => {
      if (job.active) counts.active += 1
      else counts.archived += 1
      return counts
    },
    { active: 0, archived: 0 },
  )
}

export function buildJobTypeOptions(jobs: readonly JobRecord[]) {
  const liveTypes = jobs
    .map((job) => String(job.type ?? '').trim())
    .filter(Boolean)

  return Array.from(new Set([...DEFAULT_JOB_TYPES, ...liveTypes]))
}

export function buildJobGcSuggestions(jobs: readonly JobRecord[]) {
  return Array.from(
    new Set(jobs.map((job) => job.gc?.trim()).filter((value): value is string => Boolean(value))),
  ).sort((left, right) => left.localeCompare(right))
}

export function getArchiveJobConfirmTitle(job: JobRecord | null) {
  if (!job) return 'Update job?'
  return `${job.active ? 'Archive' : 'Restore'} job?`
}

export function getArchiveJobConfirmMessage(job: JobRecord | null) {
  if (!job) return ''
  return `${job.active ? 'Archive' : 'Restore'} ${getJobDisplayName(job)}?`
}

export function getArchiveJobConfirmLabel(job: JobRecord | null) {
  if (!job) return 'Update Job'
  return job.active ? 'Archive Job' : 'Restore Job'
}

export function getDeleteJobConfirmMessage(job: JobRecord | null) {
  if (!job) return ''
  return `Delete ${getJobDisplayName(job)}? This removes the job record and clears its field-user assignments.`
}

export function shouldHydrateJobDetailForm(options: {
  job: JobRecord
  previousJob: JobRecord | null
  lastHydratedJobId: string | null
  form: JobFormState
  lastSavedSignature: string
  isAdmin: boolean
  editDrawerOpen: boolean
  isCreateMode: boolean
}) {
  const nextJobId = options.job.id
  const previousJobId = options.previousJob?.id ?? null
  const selectionChanged = nextJobId !== previousJobId || nextJobId !== options.lastHydratedJobId

  if (selectionChanged) return true

  const localSignature = serializeJobForm(options.form)
  const incomingSignature = serializeJobRecord(options.job)
  const hasUnsavedLocalChanges =
    options.isAdmin
    && options.editDrawerOpen
    && !options.isCreateMode
    && localSignature !== options.lastSavedSignature

  if (hasUnsavedLocalChanges) return false
  if (incomingSignature === options.lastSavedSignature) return false
  if (options.editDrawerOpen && !options.isCreateMode && localSignature !== incomingSignature) return false

  return true
}

export function resolveJobsViewSelectionAfterVisibleJobsChange(options: {
  isAdmin: boolean
  selectedJobId: string | null
  nextJobs: readonly JobRecord[]
  editDrawerOpen: boolean
}): string | null | undefined {
  if (!options.isAdmin) {
    const firstJob = options.nextJobs[0]
    if (!options.selectedJobId && firstJob) return firstJob.id
    return undefined
  }

  if (options.selectedJobId === 'new') return undefined
  if (options.selectedJobId === ALL_JOBS_ID) return undefined

  const selectedStillVisible =
    typeof options.selectedJobId === 'string'
    && options.selectedJobId !== ALL_JOBS_ID
    && options.nextJobs.some((job) => job.id === options.selectedJobId)

  if (selectedStillVisible) return undefined
  return options.editDrawerOpen ? ALL_JOBS_ID : null
}

export function validateJobForm(form: JobFormState) {
  if (!form.code.trim()) return 'Enter the job number.'
  if (!form.name.trim()) return 'Enter the job name.'
  if (!String(form.type).trim()) return 'Select the job type.'
  return ''
}

export function getNotificationModuleLabel(moduleKey: NotificationModuleKey) {
  return JOB_NOTIFICATION_MODULES.find((module) => module.key === moduleKey)?.label ?? moduleKey
}

export function normalizeFormText(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function serializeJobForm(form: JobFormState) {
  return JSON.stringify({
    name: normalizeFormText(form.name),
    code: normalizeFormText(form.code),
    type: normalizeFormText(form.type),
    gc: normalizeFormText(form.gc),
    jobAddress: normalizeFormText(form.jobAddress),
    startDate: normalizeFormText(form.startDate),
    finishDate: normalizeFormText(form.finishDate),
    productionBurden: normalizeFormText(form.productionBurden),
    assignedForemanIds: [...form.assignedForemanIds].slice().sort(),
  })
}

export function serializeJobRecord(job: JobRecord | null) {
  return JSON.stringify({
    name: job?.name ?? '',
    code: job?.code ?? '',
    type: String(job?.type ?? 'general'),
    gc: job?.gc ?? '',
    jobAddress: job?.jobAddress ?? '',
    startDate: job?.startDate ?? '',
    finishDate: job?.finishDate ?? '',
    productionBurden: job?.productionBurden == null ? '0.33' : String(job.productionBurden),
    assignedForemanIds: [...(job?.assignedForemanIds ?? [])].slice().sort(),
  })
}
