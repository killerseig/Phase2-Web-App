import type { FormDefinition } from './model'
/** Add the requested delivery control without changing source questions or permissions. */
export function withCompanyReportDelivery<T extends FormDefinition>(definition: T): T {
  return {
    ...definition,
    fields: definition.fields.some(field => field.kind === 'recipients') ? definition.fields :
      [...definition.fields, { id: 'report-recipients', kind: 'recipients', label: 'Send report to',
        hint: 'Receiving email does not grant private gallery access. Public recipients must verify their email address.', required: false, options: [] }],
    output: { requireLogin: definition.access?.respondents !== 'public', pdf: false, template: '' },
  }
}
