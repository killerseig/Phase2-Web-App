import { formApi, type ServerFormTemplate } from '@/services/forms'
import type { FormDefinition } from './model'

interface TemplateRequests {
  list: undefined
  save: { id: string; revision: number; definition: FormDefinition }
  issue: { id: string; revision: number }
  remove: { id: string; revision: number }
  duplicate: { id: string; revision: number; targetId: string }
}
interface TemplateResponses {
  list: { templates: ServerFormTemplate[] }
  save: ServerFormTemplate
  issue: { id: string; latestVersion: number; revision: number }
  remove: { archived: boolean }
  duplicate: ServerFormTemplate
}
/** Authoring calls are Admin-only; the backend remains the authorization authority. */
export function adminTemplateCommand<A extends keyof TemplateRequests>(
  action: A,
  ...payload: TemplateRequests[A] extends undefined
    ? [data?: undefined]
    : [data: TemplateRequests[A]]
): Promise<TemplateResponses[A]> {
  return formApi<TemplateResponses[A]>('formTemplates', { ...payload[0], action })
}
