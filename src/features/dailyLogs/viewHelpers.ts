import {
  DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS,
  cloneDailyLogPayload,
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
  normalizeRecipientEmail,
  normalizeRecipientEmailList,
} from '@/utils/recipientEmails'

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
  options: { currentUserId: string | null; isAdmin: boolean },
) {
  if (options.isAdmin) return true
  return log.status === 'submitted' || log.foremanUserId === options.currentUserId
}

export function getVisibleDailyLogs(
  logs: readonly DailyLogRecord[],
  options: { currentUserId: string | null; isAdmin: boolean },
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

export function getDailyLogsTitle(job: JobRecord | null) {
  return job ? `${job.code || 'No Job #'} - ${job.name}` : 'Daily Logs'
}

export function canEditDailyLog(
  log: DailyLogRecord | null,
  options: { currentUserId: string | null; todayDate: string },
) {
  return (
    log?.status === 'draft'
    && log.logDate === options.todayDate
    && log.foremanUserId === options.currentUserId
  )
}

export function hasSubmittedDailyLogForDate(
  logs: readonly DailyLogRecord[],
  selectedDate: string,
  todayDate: string,
) {
  return selectedDate === todayDate && logs.some((log) => log.status === 'submitted')
}

export function canCreateDailyLogForDate(options: {
  selectedDate: string
  todayDate: string
  currentUserId: string | null
  visibleLogs: readonly DailyLogRecord[]
}) {
  if (options.selectedDate !== options.todayDate || !options.currentUserId) return false

  const hasOwnDraftForToday = options.visibleLogs.some((log) =>
    log.status === 'draft' && log.foremanUserId === options.currentUserId,
  )

  return !hasOwnDraftForToday
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

export function normalizeDailyLogRecipientEmail(value: string) {
  return normalizeRecipientEmail(value)
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

export function validateDailyLogForSubmit(payload: DailyLogPayload) {
  for (const field of DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS) {
    if (!(payload[field.key] ?? '').trim().length) {
      return `Complete "${field.label}" before submitting.`
    }
  }

  const invalidManpowerIndex = payload.manpowerLines.findIndex(
    (line) => !line.trade.trim().length || Math.round(Number(line.count) || 0) < 1,
  )
  if (invalidManpowerIndex !== -1) {
    return `Complete manpower row ${invalidManpowerIndex + 1} before submitting.`
  }

  const invalidClimateIndex = payload.indoorClimateReadings.findIndex(
    (reading) => !reading.area.trim() || !reading.high.trim() || !reading.low.trim() || !reading.humidity.trim(),
  )
  if (invalidClimateIndex !== -1) {
    return `Complete indoor climate row ${invalidClimateIndex + 1} before submitting.`
  }

  return ''
}
