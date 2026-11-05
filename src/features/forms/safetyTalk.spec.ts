import { describe, expect, it } from 'vitest'
import { reportingStarter } from './reportingStarters'
import { validateFormDefinition } from '../../../functions/src/formModel'
describe('safety-talk pilot starter', () => {
  it('creates an independent unpublished pilot with no configured email recipients', () => {
    const first = reportingStarter('safety-talk'), second = reportingStarter('safety-talk')
    expect(first.id).not.toBe(second.id)
    expect(first.versions).toEqual([])
    expect(first.recipients).toEqual([])
    expect(first.recipientGroups).toBeUndefined()
    expect(first.access?.respondentRoles).toEqual(['admin'])
    expect(first.access?.entryRoles).toEqual([])
    expect(first.output).toMatchObject({ pdf: true, requireLogin: true })
  })
  it('keeps job/site input and bounded sequential attendees in the existing form model', () => {
    const definition = validateFormDefinition(reportingStarter('safety-talk'))
    expect(definition.fields.find(field => field.id === 'job')?.required).toBe(true)
    expect(definition.fields.find(field => field.id === 'site')?.required).toBe(true)
    expect(definition.fields.find(field => field.id === 'attendees')).toMatchObject({ kind: 'repeat', sequential: true, maxInstances: 20 })
  })
})
