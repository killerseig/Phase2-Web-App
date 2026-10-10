import { describe, expect, it } from 'vitest'
import committee from '../../../functions/src/reportingSources/committee-inspection.json'
import bbs from '../../../functions/src/reportingSources/behavior-based-safety-observation.json'
import visit from '../../../functions/src/reportingSources/general-site-visit.json'
import { reportingStarter } from './reportingStarters'
import { validateFormAnswers, validateFormDefinition } from '../../../functions/src/formModel'

describe('source-faithful editable reporting starters', () => {
  it('preserves corrected Committee labels/order, optional flags and full wording', () => {
    const form = validateFormDefinition(reportingStarter('committee'))
    expect(form.fields.filter(field => field.kind !== 'recipients').map((field) => field.label)).toEqual(
      committee.fields_in_order.map((field) => field.label),
    )
    expect(form.fields.every((field) => !field.required)).toBe(true)
    expect(Math.max(...form.fields.map((field) => field.label.length))).toBeGreaterThan(160)
    expect(
      form.fields.some((field) => field.label === 'Job #' || field.label === 'Cord Check Complete'),
    ).toBe(false)
    expect(
      form.fields.filter((field) => field.kind === 'radio' || field.kind === 'choice'),
    ).toEqual([])
    expect(() => validateFormAnswers(form, {}, true)).not.toThrow()
  })
  it('preserves BBS nonexclusive checkbox groups, purpose, and blank optional answers', () => {
    const form = validateFormDefinition(reportingStarter('bbs'))
    expect(form.fields.filter(field => field.kind !== 'recipients').map((field) => field.label)).toEqual(
      bbs.fields_in_order.map((field) => field.label),
    )
    expect(form.description).toContain(bbs.purpose)
    const observation = form.fields.find((field) => field.id === 'observation')!
    expect(observation.kind).toBe('multiselect')
    expect(
      validateFormAnswers(form, { observation: observation.options }, true).observation,
    ).toEqual(observation.options)
    expect(form.access?.identity).toBe('form-fields')
    expect(form.fields.every((field) => !field.required)).toBe(true)
  })
  it('preserves blank visit metadata and per-stop optional content/photos', () => {
    const form = validateFormDefinition(reportingStarter('general-visit'))
    expect(form.fields.slice(0, 2).map((field) => field.label)).toEqual(
      visit.report_metadata.map((field) => field.label),
    )
    const sites = form.fields[2]!
    expect(sites.kind).toBe('repeat')
    expect(sites.minInstances).toBe(1)
    expect(sites.fields?.map((field) => field.label)).toEqual(
      visit.sites.fields_in_order.map((field) => field.label),
    )
    expect(sites.fields?.map((field) => field.hint || '')).toEqual(
      visit.sites.fields_in_order.map((field) => ('help' in field ? field.help : '')),
    )
    expect(() =>
      validateFormAnswers(form, { sites: [{ instanceId: 'first', answers: {} }] }, true),
    ).not.toThrow()
  })
  it('creates new editable drafts without fixed recipients or published versions', () => {
    for (const kind of ['committee', 'bbs', 'general-visit', 'near-miss'] as const) {
      const first = reportingStarter(kind),
        second = reportingStarter(kind)
      expect(first.id).not.toBe(second.id)
      expect(first.recipients).toEqual([])
      expect(first.versions).toEqual([])
      expect(first.archived).toBe(false)
    }
  })
})
