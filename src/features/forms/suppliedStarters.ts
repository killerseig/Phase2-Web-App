import type { IntranetForm } from '@/features/intranet/content'
import { newTemplate, type FormField, type FormTemplate } from './model'
import { validateFormDefinition } from '../../../functions/src/formModel'

export function suppliedStarterDecision(form: IntranetForm): string {
  if (form.id === 'foreman-source-b14' || form.id === 'foreman-source-b15') {
    if (form.fields.some(field => field.signature || /\bsignature\b/i.test(field.label))) return 'Signature handling requires review before preparing this draft.'
    if (form.fields.some(field => !['text', 'textarea', 'date', 'number'].includes(field.type))) return 'This source contains unsupported fields; review it before preparing a draft.'
    return ''
  }
  if (form.id === 'foreman-source-b17') return 'Employee warning submissions need an approved confidential audience and signature process.'
  if (form.id === 'pto-request-2024-fillable') return 'PTO requests need an approved signature and foreman, operations and final approval process.'
  return 'This source needs review before it can become an editable report.'
}

/** Prepare an unsaved definition only. Never saves, publishes, sets recipients or grants employee access. */
export function suppliedReportStarter(form: IntranetForm): FormTemplate {
  const decision = suppliedStarterDecision(form)
  if (decision) throw new Error(decision)
  let itemGroupAdded = false
  const itemLabel = (label: string) => label.match(/^Item\s+(\d+)\s*[-\u2013\u2014]\s*(.+)$/i)
  const fields: FormField[] = []
  for (const [index, source] of form.fields.entries()) {
    const item = itemLabel(source.label)
    if (form.id === 'foreman-source-b15' && item) {
      if (itemGroupAdded) continue
      const first = form.fields.filter(field => itemLabel(field.label)?.[1] === '1')
      if (first.length !== 4) throw new Error('Review the missing-item source fields before preparing this draft.')
      fields.push({ id: 'missing-items', kind: 'repeat', label: 'Missing items', required: false, options: [], minInstances: 1, maxInstances: 20,
        fields: first.map((field, child) => ({ id: 'item-' + child, label: itemLabel(field.label)![2]!,
          kind: /Value of Item$/i.test(field.label) ? 'number' : 'text', required: false, options: [],
          ...(/Value of Item$/i.test(field.label) ? { minimum: 0 } : {}),
        })) })
      itemGroupAdded = true
      continue
    }
    const label = source.label.replace(/\?\s*YES\s*\/\s*NO$/i, '?')
    const yesNo = /\?\s*YES\s*\/\s*NO$/i.test(source.label)
    const date = /^(Date|Date of Damage|DATE OF LOSS)$/i.test(label)
    const money = /^TOTAL VALUE OF ITEMS REPORTED$/i.test(label)
    fields.push({ id: 'supplied-' + index, label, required: source.required,
      kind: yesNo ? 'radio' : date ? 'date' : money ? 'number' : source.type as FormField['kind'],
      options: yesNo ? ['Yes', 'No'] : [], ...(money ? { minimum: 0 } : {}),
    })
  }
  const context = form.paragraphs.find(paragraph => form.id === 'foreman-source-b14'
    ? /use when not involved with other vehicle/i.test(paragraph) : /^List missing item/i.test(paragraph)) || ''
  const template = { ...newTemplate(form.title), fields,
    description: [context, 'Administrator review required before publication. Review the audience and delivery settings before use.'].filter(Boolean).join('\n\n'),
    access: { respondents: 'signed-in' as const, identity: 'identified' as const, respondentRoles: ['admin'], respondentUserIds: [], entryRoles: [], entryUserIds: [] },
    output: { requireLogin: true, pdf: false, template: '' },
  }
  validateFormDefinition(template)
  return template
}
