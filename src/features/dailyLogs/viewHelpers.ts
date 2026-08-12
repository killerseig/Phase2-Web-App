import {
  cloneDailyLogPayload,
  getSubmittableDailyLogIndoorClimateReadings,
  getSubmittableDailyLogManpowerLines,
} from '@/features/dailyLogs/schema'
import type {
  DailyLogAttachmentRecord,
  DailyLogAttachmentType,
  DailyLogPayload,
  DailyLogRecord,
  JobRecord,
  NotificationRecipients,
} from '@/types/domain'
import {
  normalizeRecipientEmailList,
} from '@/utils/recipientEmails'
export { validateDailyLogForSubmit } from '@/features/dailyLogs/validation'

export interface DailyLogSiteInfoDisplay {
  projectName: string
  jobNumber: string
  projectManager: string
  foreman: string
  generalContractor: string
  address: string
}

export type DailyLogAttachmentSectionKey = 'photo' | 'ptp' | 'qc'
export type SavedDailyLogFieldKey = 'weeklySchedule' | 'safetyConcerns' | 'budgetConcerns' | 'deliveriesNeeded'

export const savedDailyLogFieldKeys: SavedDailyLogFieldKey[] = [
  'weeklySchedule',
  'safetyConcerns',
  'budgetConcerns',
  'deliveriesNeeded',
]

export function isDailyLogVisibleToUser(
  log: DailyLogRecord,
  options: { currentUserId: string | null; canViewAllDailyLogs: boolean },
) {
  if (options.canViewAllDailyLogs) return true
  return log.status === 'submitted' || log.foremanUserId === options.currentUserId
}

export function getVisibleDailyLogs(
  logs: readonly DailyLogRecord[],
  options: { currentUserId: string | null; canViewAllDailyLogs: boolean },
) {
  return logs.filter((log) => isDailyLogVisibleToUser(log, options))
}

export function getPreferredDailyLog(logs: readonly DailyLogRecord[], currentUserId: string | null) {
  const ownedDraft = logs.find(
    (log) => log.status === 'draft' && log.foremanUserId === currentUserId,
  )
  if (ownedDraft) return ownedDraft

  const ownedSubmitted = logs.find(
    (log) => log.status === 'submitted' && log.foremanUserId === currentUserId,
  )
  if (ownedSubmitted) return ownedSubmitted

  return logs[0] ?? null
}

export function getNextDailyLogSelectionId(
  logs: readonly DailyLogRecord[],
  options: {
    canViewAllDailyLogs: boolean
    currentSelectedLogId: string | null
    currentUserId: string | null
  },
) {
  const visibleLogs = getVisibleDailyLogs(logs, {
    currentUserId: options.currentUserId,
    canViewAllDailyLogs: options.canViewAllDailyLogs,
  })

  if (options.currentSelectedLogId) {
    const selectedStillVisible = visibleLogs.some((log) => log.id === options.currentSelectedLogId)
    if (selectedStillVisible) return options.currentSelectedLogId
  }

  return getPreferredDailyLog(visibleLogs, options.currentUserId)?.id ?? null
}

export function getDailyLogsTitle(job: JobRecord | null) {
  return job ? `${job.code || 'No Job #'} - ${job.name}` : 'Daily Logs'
}

export function canEditDailyLog(
  log: DailyLogRecord | null,
  options: { currentUserId: string | null; todayDate: string },
) {
  return (
    log?.status === 'draft'
    && log.logDate <= options.todayDate
    && log.foremanUserId === options.currentUserId
  )
}

export function canDeleteDailyLogDraft(
  log: DailyLogRecord | null,
  options: { currentUserId: string | null; todayDate: string; canViewAllDailyLogs: boolean },
) {
  if (log?.status !== 'draft') return false
  if (options.canViewAllDailyLogs) return true

  return canEditDailyLog(log, {
    currentUserId: options.currentUserId,
    todayDate: options.todayDate,
  })
}

export function hasSubmittedDailyLogForDate(
  logs: readonly DailyLogRecord[],
  selectedDate: string,
) {
  return logs.some((log) => log.status === 'submitted' && log.logDate === selectedDate)
}

export function canCreateDailyLogForDate(options: {
  selectedDate: string
  todayDate: string
  currentUserId: string | null
  visibleLogs: readonly DailyLogRecord[]
}) {
  if (!options.currentUserId || options.selectedDate > options.todayDate) return false

  const hasOwnDraftForSelectedDate = options.visibleLogs.some((log) =>
    log.status === 'draft'
    && log.logDate === options.selectedDate
    && log.foremanUserId === options.currentUserId,
  )

  return !hasOwnDraftForSelectedDate
}

export function getDailyLogCreateButtonLabel(hasSubmittedLogForToday: boolean) {
  return hasSubmittedLogForToday ? 'Another Daily Log' : 'Create Daily Log'
}

export function getSavedDailyLogFieldValue(
  log: DailyLogRecord | null,
  fieldKey: SavedDailyLogFieldKey,
) {
  return String(log?.payload[fieldKey] ?? '')
}

export function buildDailyLogSiteInfo(options: {
  authDisplayName: string
  job: JobRecord | null
  payload: DailyLogPayload
  selectedLog: DailyLogRecord | null
}): DailyLogSiteInfoDisplay {
  const { authDisplayName, job, payload, selectedLog } = options

  return {
    projectName: String(job?.name ?? payload.projectName ?? '').trim(),
    jobNumber: String(job?.code ?? payload.jobSiteNumbers ?? '').trim(),
    projectManager: String(job?.projectManager ?? payload.siteForemanAssistant ?? '').trim(),
    foreman: String(selectedLog?.foremanName ?? authDisplayName ?? payload.foremanOnSite ?? '').trim(),
    generalContractor: String(job?.gc ?? '').trim(),
    address: String(job?.jobAddress ?? '').trim(),
  }
}

export function prepareDailyLogPayload(
  payload: DailyLogPayload,
  siteInfo: DailyLogSiteInfoDisplay,
) {
  const nextPayload = cloneDailyLogPayload(payload)
  nextPayload.projectName = siteInfo.projectName
  nextPayload.jobSiteNumbers = siteInfo.jobNumber
  nextPayload.foremanOnSite = siteInfo.foreman
  nextPayload.siteForemanAssistant = siteInfo.projectManager
  nextPayload.manpowerLines = getSubmittableDailyLogManpowerLines(nextPayload.manpowerLines)
  nextPayload.indoorClimateReadings = getSubmittableDailyLogIndoorClimateReadings(nextPayload.indoorClimateReadings)
  nextPayload.manpower = nextPayload.manpowerLines
    .filter((line) => line.trade.trim().length > 0 && Number(line.count) > 0)
    .map((line) => {
      const count = Math.max(0, Math.round(Number(line.count) || 0))
      const areas = line.areas.trim()
      return areas ? `${line.trade.trim()}: ${count} (${areas})` : `${line.trade.trim()}: ${count}`
    })
    .join('; ')
  nextPayload.qcInspection = nextPayload.qcAreasInspected.trim()
  return nextPayload
}

export function createDailyLogPayloadPreparer(options: {
  getPayload: () => DailyLogPayload
  getSiteInfo: () => DailyLogSiteInfoDisplay
}) {
  return (payload?: DailyLogPayload) => prepareDailyLogPayload(
    payload ?? options.getPayload(),
    options.getSiteInfo(),
  )
}

export function getDailyLogAttachmentsByType(
  attachments: readonly DailyLogAttachmentRecord[],
  types: readonly DailyLogAttachmentType[],
) {
  return attachments.filter((attachment) => types.includes(attachment.type))
}

export function toDailyLogAttachmentSection(type: DailyLogAttachmentType): DailyLogAttachmentSectionKey {
  if (type === 'ptp') return 'ptp'
  if (type === 'qc') return 'qc'
  return 'photo'
}

export function getAdminDailyLogRecipients(options: {
  globalRecipients: NotificationRecipients
  job: JobRecord | null
}) {
  const jobRecipients = options.job?.notificationRecipients?.dailyLogs ?? options.job?.dailyLogRecipients ?? []
  const legacyOfficeRecipients = options.job?.adminDailyLogRecipients ?? []

  return normalizeRecipientEmailList([
    ...options.globalRecipients.dailyLogs,
    ...jobRecipients,
    ...legacyOfficeRecipients,
  ])
}

export function getAdditionalDailyLogRecipients(
  selectedLog: DailyLogRecord | null,
  adminRecipients: readonly string[],
) {
  const adminRecipientSet = new Set(adminRecipients)
  return (selectedLog?.additionalRecipients ?? []).filter((email) => !adminRecipientSet.has(email))
}
