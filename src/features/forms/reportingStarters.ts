import committee from '../../../functions/src/committee-inspection-native.json'
import bbs from '../../../functions/src/behavior-based-safety-observation-native.json'
import visit from '../../../functions/src/general-site-visit-native.json'
import nearMiss from '../../../functions/src/nearMissSafetyObservation.json'
import { clone, type FormTemplate, type FormDefinition } from './model'
import { withCompanyReportDelivery } from './companyReports'

export const reportingStarterDefinitions = {
  committee,
  bbs,
  'general-visit': visit,
  'near-miss': nearMiss,
}
export type ReportingStarter = keyof typeof reportingStarterDefinitions
export function reportingStarter(kind: ReportingStarter): FormTemplate {
  return {
    ...(kind === 'near-miss' ? clone(reportingStarterDefinitions[kind] as FormDefinition) :
      withCompanyReportDelivery(clone(reportingStarterDefinitions[kind] as FormDefinition))),
    id: crypto.randomUUID(),
    archived: false,
    versions: [],
  }
}
