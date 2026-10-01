import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import audit from '../../functions/src/committeeAudit.json' with { type: 'json' }
import { createRequire } from 'node:module'
import type { FormRecord, FormVersion } from '../../functions/src/formModel'
const { validateFormAnswers, validateFormDefinition } = createRequire(import.meta.url)(
  '../../functions/formModel.js',
) as typeof import('../../functions/src/formModel')
import { createJobsFixture, gotoPhase2App } from './phase2AppFixture.js'
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export async function setupFormServer(
  page: Page,
  options: {
    definition?: FormDefinition
    lostCreate?: boolean
    lostSave?: boolean
    lostSubmit?: boolean
    failedDelivery?: boolean
  } = {},
) {
  const fixture = createJobsFixture(),
    owner = fixture.auth.user.uid
  const definition = validateFormDefinition({
    ...(options.definition || audit),
    recipients: ['audit@example.com'],
  })
  const versions = new Map<number, FormVersion>([
    [1, { ...definition, version: 1, createdAt: '2026-10-01T00:00:00Z' }],
  ])
  const context = {
    created: 0,
    submitted: 0,
    emailRetries: 0,
    templatesRevision: 2,
    latestVersion: 1,
    definition,
    archived: false,
    records: new Map<string, FormRecord>(),
    delivery: new Map<string, string>(),
    issueNextVersion(next: FormDefinition) {
      context.definition = validateFormDefinition(next)
      context.latestVersion++
      versions.set(context.latestVersion, {
        ...clone(context.definition),
        version: context.latestVersion,
        createdAt: new Date().toISOString(),
      })
    },
    saveRequests: [] as string[],
    submitRequests: [] as string[],
    actions: [] as string[],
  }
  const createIds = new Map<string, string>(),
    saved = new Map<string, { requestId: string; fingerprint: string }>()
  await page.addInitScript(() => {
    window.__PHASE2_FORM_SERVER__ = true
  })
  const output = (record: FormRecord) => ({
    ...clone(record),
    definition: { ...clone(record.definition), recipients: [] },
    emailStatus: context.delivery.get(record.id) || 'not-submitted',
  })
  for (const name of ['formTemplates', 'formWorkspace', 'formEmail'])
    await page.route('**/' + name, async (route) => {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers })
        return
      }
      const data = route.request().postDataJSON().data
      context.actions.push(name + ':' + data.action)
      try {
        let result: unknown
        if (name === 'formTemplates') {
          if (data.action === 'list')
            result = {
              templates: [
                {
                  id: 'audit-e2e',
                  draft: clone(context.definition),
                  revision: context.templatesRevision,
                  latestVersion: context.latestVersion,
                  archived: context.archived,
                },
              ],
            }
          else if (data.action === 'save') {
            if (data.revision !== context.templatesRevision)
              throw new Error('Another edit changed this draft.')
            context.definition = validateFormDefinition(data.definition)
            context.templatesRevision++
            result = { id: 'audit-e2e', revision: context.templatesRevision }
          } else if (data.action === 'issue') {
            context.latestVersion++
            context.templatesRevision++
            versions.set(context.latestVersion, {
              ...clone(context.definition),
              version: context.latestVersion,
              createdAt: new Date().toISOString(),
            })
            result = { latestVersion: context.latestVersion, revision: context.templatesRevision }
          } else {
            context.archived = true
            context.templatesRevision++
            result = { archived: true }
          }
        } else if (name === 'formEmail') {
          context.emailRetries++
          context.delivery.set(data.id, 'sent')
          result = { emailStatus: 'sent' }
        } else if (data.action === 'list')
          result = { records: [...context.records.values()].map(output) }
        else if (data.action === 'create') {
          const previous = createIds.get(data.requestId)
          if (previous) result = output(context.records.get(previous)!)
          else {
            if (context.archived) throw new Error('Form archived.')
            const id = randomUUID(),
              definition = clone(versions.get(data.version)!)
            const record: FormRecord = {
              id,
              ownerUid: owner,
              templateId: 'audit-e2e',
              templateVersion: data.version,
              definition,
              answers: validateFormAnswers(definition, {}, false),
              status: 'draft',
              revision: 1,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
            context.records.set(id, record)
            createIds.set(data.requestId, id)
            context.created++
            result = output(record)
          }
          if (options.lostCreate) {
            options.lostCreate = false
            await route.abort()
            return
          }
        } else {
          const record = context.records.get(data.id)
          if (!record || record.ownerUid !== owner) {
            await route.fulfill({
              status: 403,
              headers,
              json: {
                error: {
                  status: 'PERMISSION_DENIED',
                  message: 'This form record belongs to another user.',
                },
              },
            })
            return
          }
          if (data.action === 'get') result = output(record)
          else if (data.action === 'photo')
            result = {
              base64:
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
              contentType: 'image/png',
            }
          else if (data.action === 'upload') {
            if (record.status !== 'draft') throw new Error('Submitted forms are immutable.')
            const id = randomUUID()
            ;(record.answers[data.fieldId] as string[]).push(id)
            record.revision++
            result = output(record)
          } else if (data.action === 'save') {
            context.saveRequests.push(data.requestId)
            const answers = validateFormAnswers(record.definition, data.answers, false),
              fingerprint = JSON.stringify(answers),
              previous = saved.get(record.id)
            if (previous?.requestId === data.requestId) {
              if (previous.fingerprint !== fingerprint) throw new Error('Changed save request.')
              result = output(record)
            } else {
              if (record.status !== 'draft' || record.revision !== data.revision)
                throw new Error('Another edit changed this draft.')
              record.answers = answers
              record.revision++
              saved.set(record.id, { requestId: data.requestId, fingerprint })
              result = output(record)
            }
            if (options.lostSave) {
              options.lostSave = false
              await route.abort()
              return
            }
          } else if (data.action === 'submit') {
            context.submitRequests.push(data.requestId)
            if (record.status !== 'submitted') {
              record.answers = validateFormAnswers(record.definition, record.answers, true)
              record.status = 'submitted'
              record.revision++
              context.submitted++
              context.delivery.set(record.id, options.failedDelivery ? 'failed' : 'disabled')
            }
            result = output(record)
            if (options.lostSubmit) {
              options.lostSubmit = false
              await route.abort()
              return
            }
          }
        }
        await route.fulfill({ headers, json: { result } })
      } catch (error) {
        await route.fulfill({
          status: 400,
          headers,
          json: { error: { status: 'INVALID_ARGUMENT', message: (error as Error).message } },
        })
      }
    })
  await gotoPhase2App(page, '/forms/audit-e2e', fixture)
  return context
}
export async function fillCommitteeAudit(page: Page) {
  for (const field of audit.fields) {
    if (field.kind === 'photo' || field.kind === 'textarea') continue
    const input = page.getByLabel(field.label, { exact: false })
    if (field.kind === 'choice') await input.selectOption(field.options[0]!)
    else if (field.kind === 'date') await input.fill('2026-10-01')
    else if (field.kind === 'number') await input.fill('4')
    else if (field.required) await input.fill('Synthetic ' + field.label)
  }
}
