import { describe, expect, it } from 'vitest'
import { suppliedReportStarter, suppliedStarterDecision } from './suppliedStarters'
import type { IntranetForm } from '@/features/intranet/content'
import { validateFormAnswers, validateFormDefinition } from '../../../functions/src/formModel'
const damage = (): IntranetForm => ({ id: 'foreman-source-b14', title: 'Vehicle/Equipment Damage Report', paragraphs: ['(use when not involved with other vehicle)'], fields: [
  { label: 'Date of Damage', type: 'text', required: true, signature: false },
  { label: 'Description of Damage', type: 'textarea', required: false, signature: false },
] })
const theft = (): IntranetForm => ({ id: 'foreman-source-b15', title: 'Equipment Theft Report', paragraphs: ['List missing item(s) with complete details.'], fields: [
  { label: 'JOB NAME', type: 'text', required: true, signature: false },
  { label: 'POLICE REPORT? YES / NO', type: 'text', required: false, signature: false },
  ...Array.from({ length: 7 }, (_, index) => ['Item Description', 'Phase 2 Number', 'Serial Number', 'Value of Item'].map(label => ({ label: 'Item ' + (index + 1) + ' \u2014 ' + label, type: 'text', required: false, signature: false }))).flat(),
] })
describe('supplied ideas adapted to the existing form model', () => {
  it('prepares a valid unsaved Admin-only damage draft with native date controls and no delivery', () => {
    const source = damage(), before = structuredClone(source), result = suppliedReportStarter(source)
    expect(validateFormDefinition(result).fields[0]!.kind).toBe('date')
    expect(result.fields[0]!.required).toBe(true)
    expect(result.access?.respondentRoles).toEqual(['admin'])
    expect(result.access?.entryRoles).toEqual([])
    expect(result.recipients).toEqual([])
    expect(result.versions).toEqual([])
    expect(result.output).toEqual({ requireLogin: true, pdf: false, template: '' })
    expect(source).toEqual(before)
    expect(suppliedReportStarter(source).id).not.toBe(result.id)
  })
  it('replaces seven rigid item rows with the existing repeat group and native Yes/No controls', () => {
    const result = suppliedReportStarter(theft()), group = result.fields.find(field => field.kind === 'repeat')!
    expect(result.fields).toHaveLength(3)
    expect(group.fields?.map(field => field.label)).toEqual(['Item Description', 'Phase 2 Number', 'Serial Number', 'Value of Item'])
    expect(group.fields?.at(-1)).toMatchObject({ kind: 'number', minimum: 0 })
    expect(group.maxInstances).toBe(20)
    expect(result.fields[1]).toMatchObject({ kind: 'radio', options: ['Yes', 'No'] })
    expect(() => validateFormDefinition(result)).not.toThrow()
    expect(() => validateFormAnswers(result, { 'supplied-0': 'Synthetic job', 'missing-items': [{ instanceId: 'item-a', answers: { 'item-3': -1 } }] }, true)).toThrow()
  })
  it('does not silently turn signatures, approvals or confidential employee forms into ordinary text fields', () => {
    for (const id of ['foreman-source-b17', 'pto-request-2024-fillable', 'unknown-source']) {
      const source = { ...damage(), id }
      expect(suppliedStarterDecision(source)).not.toBe('')
      expect(() => suppliedReportStarter(source)).toThrow()
    }
    const source = damage(); source.fields.push({ label: 'Employee Signature', type: 'text', required: false, signature: false })
    expect(() => suppliedReportStarter(source)).toThrow('Signature handling')
  })
  it('rejects unsupported field kinds instead of silently degrading them', () => {
    const source = damage(); source.fields[0]!.type = 'script'
    expect(() => suppliedReportStarter(source)).toThrow('unsupported fields')
  })
})
