import type {
  DailyLogAttachmentRecord,
  DailyLogIndoorClimateReadingRecord,
  DailyLogManpowerLineRecord,
  DailyLogPayload,
} from '@/types/domain'

export type DailyLogTextFieldKey =
  | 'weeklySchedule'
  | 'manpowerAssessment'
  | 'safetyConcerns'
  | 'ahaReviewed'
  | 'scheduleConcerns'
  | 'budgetConcerns'
  | 'deliveriesReceived'
  | 'deliveriesNeeded'
  | 'newWorkAuthorizations'
  | 'qcAssignedTo'
  | 'qcAreasInspected'
  | 'qcIssuesIdentified'
  | 'qcIssuesResolved'
  | 'notesCorrespondence'
  | 'actionItems'

export type DailyLogTextSectionId =
  | 'schedule-assessment'
  | 'safety-concerns'
  | 'deliveries-materials'
  | 'quality-control'
  | 'notes-actions'

export type DailyLogManpowerFieldKey = keyof DailyLogManpowerLineRecord
export type DailyLogIndoorClimateFieldKey = keyof DailyLogIndoorClimateReadingRecord

export interface DailyLogTextFieldSchema {
  key: DailyLogTextFieldKey
  label: string
  rows: number
  placeholder?: string
}

export interface DailyLogTextSectionSchema {
  id: DailyLogTextSectionId
  title: string
  description: string
  fields: DailyLogTextFieldSchema[]
}

export interface DailyLogSiteInfoFieldSchema {
  key: 'projectName' | 'jobNumber' | 'projectManager' | 'foreman' | 'generalContractor' | 'address'
  label: string
}

export interface DailyLogRepeaterColumnSchema<Key extends string = string> {
  key: Key
  label: string
  placeholder?: string
  inputType?: 'text' | 'number'
  optional?: boolean
}

export const DAILY_LOG_SITE_INFO_FIELDS: DailyLogSiteInfoFieldSchema[] = [
  { key: 'projectName', label: 'Project Name' },
  { key: 'jobNumber', label: 'Job Number' },
  { key: 'projectManager', label: 'Project Manager' },
  { key: 'foreman', label: 'Foreman' },
  { key: 'generalContractor', label: 'General Contractor' },
  { key: 'address', label: 'Job Address' },
]

export const DAILY_LOG_MANPOWER_COLUMNS: DailyLogRepeaterColumnSchema<DailyLogManpowerFieldKey>[] = [
  { key: 'trade', label: 'Trade', placeholder: 'e.g. Acoustical Carpenter' },
  { key: 'count', label: 'Count', placeholder: 'e.g. 4', inputType: 'number' },
  { key: 'areas', label: 'Areas', placeholder: 'e.g. Level 2 west wing', optional: true },
]

export const DAILY_LOG_INDOOR_CLIMATE_COLUMNS: DailyLogRepeaterColumnSchema<DailyLogIndoorClimateFieldKey>[] = [
  { key: 'area', label: 'Floor / Area', placeholder: 'e.g. Level 2' },
  { key: 'high', label: 'High (degF)', placeholder: 'High' },
  { key: 'low', label: 'Low (degF)', placeholder: 'Low' },
  { key: 'humidity', label: 'Humidity (%)', placeholder: 'Humidity' },
]

export const DAILY_LOG_TEXT_SECTIONS: DailyLogTextSectionSchema[] = [
  {
    id: 'schedule-assessment',
    title: 'Schedule & Assessment',
    description: 'Track weekly planning and whether staffing still fits the work ahead.',
    fields: [
      { key: 'weeklySchedule', label: 'Weekly Schedule', rows: 4 },
      { key: 'manpowerAssessment', label: 'Manpower Assessment', rows: 3 },
    ],
  },
  {
    id: 'safety-concerns',
    title: 'Safety & Concerns',
    description: 'Capture the daily safety conversation and any schedule or budget risks.',
    fields: [
      { key: 'safetyConcerns', label: 'Safety Concerns', rows: 3 },
      { key: 'ahaReviewed', label: 'AHA Reviewed', rows: 2 },
      { key: 'scheduleConcerns', label: 'Schedule Concerns', rows: 3 },
      { key: 'budgetConcerns', label: 'Budget Concerns', rows: 3 },
    ],
  },
  {
    id: 'deliveries-materials',
    title: 'Deliveries & Materials',
    description: 'Record what arrived, what is still needed, and any approved new work.',
    fields: [
      { key: 'deliveriesReceived', label: 'Deliveries Received', rows: 3 },
      { key: 'deliveriesNeeded', label: 'Deliveries Needed', rows: 3 },
      { key: 'newWorkAuthorizations', label: 'New Work Authorizations', rows: 3 },
    ],
  },
  {
    id: 'quality-control',
    title: 'Quality Control',
    description: 'Keep the same QC questions from the old app so inspections stay consistent.',
    fields: [
      { key: 'qcAssignedTo', label: 'Who is assigned to do QC?', rows: 2 },
      { key: 'qcAreasInspected', label: 'What areas were inspected?', rows: 3 },
      { key: 'qcIssuesIdentified', label: 'What issues were identified?', rows: 3 },
      { key: 'qcIssuesResolved', label: 'What was done to fix the issues?', rows: 3 },
    ],
  },
  {
    id: 'notes-actions',
    title: 'Notes & Action Items',
    description: 'Wrap up the day with correspondence notes and what still needs follow-up.',
    fields: [
      { key: 'notesCorrespondence', label: 'Notes & Correspondence', rows: 3 },
      { key: 'actionItems', label: 'Action Items', rows: 3 },
    ],
  },
]

export const DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS = DAILY_LOG_TEXT_SECTIONS.flatMap((section) => section.fields)

export function getDailyLogTextSection(id: DailyLogTextSectionId): DailyLogTextSectionSchema {
  const section = DAILY_LOG_TEXT_SECTIONS.find((entry) => entry.id === id)
  if (!section) {
    throw new Error(`Missing daily log schema section: ${id}`)
  }

  return section
}

export function createEmptyManpowerLine(): DailyLogManpowerLineRecord {
  return {
    trade: '',
    count: 0,
    areas: '',
    addedByUserId: null,
  }
}

export function createEmptyIndoorClimateReading(): DailyLogIndoorClimateReadingRecord {
  return {
    area: '',
    high: '',
    low: '',
    humidity: '',
  }
}

export function cloneDailyLogAttachments(attachments: DailyLogAttachmentRecord[]): DailyLogAttachmentRecord[] {
  return attachments.map((attachment) => ({ ...attachment }))
}

export function cloneDailyLogPayload(payload: DailyLogPayload): DailyLogPayload {
  return {
    ...payload,
    manpowerLines: payload.manpowerLines.map((line) => ({ ...line })),
    indoorClimateReadings: payload.indoorClimateReadings.map((reading) => ({ ...reading })),
    attachments: cloneDailyLogAttachments(payload.attachments),
  }
}

export function createEmptyDailyLogPayload(initial?: Partial<DailyLogPayload>): DailyLogPayload {
  return {
    jobSiteNumbers: initial?.jobSiteNumbers ?? '',
    foremanOnSite: initial?.foremanOnSite ?? '',
    siteForemanAssistant: initial?.siteForemanAssistant ?? '',
    projectName: initial?.projectName ?? '',
    manpower: initial?.manpower ?? '',
    weeklySchedule: initial?.weeklySchedule ?? '',
    manpowerAssessment: initial?.manpowerAssessment ?? '',
    indoorClimateReadings: initial?.indoorClimateReadings?.length
      ? initial.indoorClimateReadings.map((reading) => ({ ...reading }))
      : [createEmptyIndoorClimateReading()],
    manpowerLines: initial?.manpowerLines?.length
      ? initial.manpowerLines.map((line) => ({ ...line }))
      : [createEmptyManpowerLine()],
    safetyConcerns: initial?.safetyConcerns ?? '',
    ahaReviewed: initial?.ahaReviewed ?? '',
    scheduleConcerns: initial?.scheduleConcerns ?? '',
    budgetConcerns: initial?.budgetConcerns ?? '',
    deliveriesReceived: initial?.deliveriesReceived ?? '',
    deliveriesNeeded: initial?.deliveriesNeeded ?? '',
    newWorkAuthorizations: initial?.newWorkAuthorizations ?? '',
    qcInspection: initial?.qcInspection ?? '',
    qcAssignedTo: initial?.qcAssignedTo ?? '',
    qcAreasInspected: initial?.qcAreasInspected ?? '',
    qcIssuesIdentified: initial?.qcIssuesIdentified ?? '',
    qcIssuesResolved: initial?.qcIssuesResolved ?? '',
    notesCorrespondence: initial?.notesCorrespondence ?? '',
    actionItems: initial?.actionItems ?? '',
    attachments: initial?.attachments?.length ? cloneDailyLogAttachments(initial.attachments) : [],
  }
}
