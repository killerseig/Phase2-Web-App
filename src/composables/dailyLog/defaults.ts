import type { DailyLogDraftInput } from '@/services'

export function createEmptyDailyLogDraft(projectName = ''): DailyLogDraftInput {
  return {
    jobSiteNumbers: '',
    foremanOnSite: '',
    siteForemanAssistant: '',
    projectName,
    manpower: '',
    weeklySchedule: '',
    manpowerAssessment: '',
    indoorClimateReadings: [{ area: '', high: '', low: '', humidity: '' }],
    manpowerLines: [{ trade: '', count: 0, areas: '' }],
    safetyConcerns: '',
    ahaReviewed: '',
    scheduleConcerns: '',
    budgetConcerns: '',
    deliveriesReceived: '',
    deliveriesNeeded: '',
    newWorkAuthorizations: '',
    qcInspection: '',
    qcAssignedTo: '',
    qcAreasInspected: '',
    qcIssuesIdentified: '',
    qcIssuesResolved: '',
    notesCorrespondence: '',
    actionItems: '',
    attachments: [],
  }
}
