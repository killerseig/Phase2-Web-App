import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { randomUUID } from 'node:crypto'
import type { FormTemplate, FormFieldKind } from '../src/features/forms/model'
const newField = (kind: FormFieldKind, label: string) => ({
  id: randomUUID(),
  kind,
  label,
  required: false,
  options: [],
})
const newTemplate = (title: string): FormTemplate => ({
  id: randomUUID(),
  title,
  description: '',
  recipients: [],
  fields: [],
  archived: false,
  versions: [],
})
const keepVersion = (template: FormTemplate): FormTemplate => ({
  ...structuredClone(template),
  versions: [
    {
      title: template.title,
      description: template.description,
      recipients: [...template.recipients],
      fields: structuredClone(template.fields),
      version: 1,
      createdAt: new Date().toISOString(),
    },
  ],
})
const duplicateTemplate = (template: FormTemplate): FormTemplate => ({
  ...structuredClone(template),
  id: randomUUID(),
  title: template.title + ' (copy)',
  fields: template.fields.map((field) => ({ ...field, id: randomUUID() })),
  versions: [],
})

test('server library is authoritative; persisted duplicate has a retry-safe new identity and independent history', async ({
  page,
}) => {
  const fixture = createJobsFixture(),
    legacy = newTemplate('Legacy device draft')
  legacy.fields.push(newField('text', 'Legacy field'))
  const retained = keepVersion(legacy),
    library = { schema: 1, revision: 1, templates: [retained] }
  const original = {
    id: 'server-source',
    draft: {
      title: 'Persisted source',
      description: '',
      recipients: ['source@example.com'],
      fields: [
        { id: 'source-field', kind: 'text', label: 'Source field', required: true, options: [] },
      ],
    },
    revision: 2,
    latestVersion: 1,
    archived: false,
    used: true,
  }
  const templates = new Map([[original.id, structuredClone(original)]]),
    duplicateTargets: string[] = []
  let loseCopy = true
  await page.addInitScript(
    ({ key, library }) => {
      window.__PHASE2_FORM_SERVER__ = true
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(library))
    },
    { key: 'form-builder-local:v1:' + fixture.auth.user.uid, library },
  )
  await page.route('**/formTemplates', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    let result: unknown
    if (data.action === 'list') result = { templates: [...templates.values()] }
    else if (data.action === 'duplicate') {
      duplicateTargets.push(data.targetId)
      if (!templates.has(data.targetId)) {
        const source = templates.get(data.id)!
        const duplicate = duplicateTemplate({
          ...source.draft,
          id: source.id,
          archived: false,
          versions: [],
        })
        templates.set(data.targetId, {
          ...source,
          id: data.targetId,
          draft: duplicate,
          latestVersion: 0,
          revision: 1,
          used: false,
        })
      }
      result = templates.get(data.targetId)
      if (loseCopy) {
        loseCopy = false
        await route.abort()
        return
      }
    } else if (data.action === 'remove') {
      const source = templates.get(data.id)!
      source.archived = true
      source.revision++
      result = { archived: true }
    } else if (data.action === 'save') {
      const source = templates.get(data.id)
      const next = {
        id: data.id,
        draft: structuredClone(data.definition),
        revision: (source?.revision || 0) + 1,
        latestVersion: source?.latestVersion || 0,
        archived: false,
        used: source?.used || false,
      }
      templates.set(data.id, next)
      result = next
    }
    await route.fulfill({ headers, json: { result } })
  })
  await gotoPhase2App(page, '/admin/forms', fixture)
  await expect(
    page.getByText('Source of truth: local emulator server.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save local draft', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Legacy device draft', exact: true })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: 'Persisted source', exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate server form', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button', { name: 'Duplicate server form', exact: true }).click()
  await expect(page.getByLabel('Form title', { exact: true })).toHaveValue(
    'Persisted source (copy)',
  )
  expect(duplicateTargets[0]).toBe(duplicateTargets[1])
  expect(templates.size).toBe(2)
  const copy = templates.get(duplicateTargets[0]!)!
  expect(copy.id).not.toBe(original.id)
  expect(copy.latestVersion).toBe(0)
  expect(copy.draft.fields[0]!.id).not.toBe(original.draft.fields[0]!.id)
  await page.getByLabel('Selected field label', { exact: true }).fill('Independent copy edit')
  await page.getByRole('button', { name: 'Save to local server', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved to the local server')
  expect(templates.get(original.id)).toEqual(original)
  await page.reload()
  await page.getByRole('button', { name: 'Persisted source (copy)', exact: true }).click()
  await expect(page.getByLabel('Selected field label', { exact: true })).toHaveValue(
    'Independent copy edit',
  )
  await page.getByText('Import an existing device draft', { exact: true }).click()
  await page.getByLabel('Device draft to import', { exact: true }).selectOption(legacy.id)
  await page.getByRole('button', { name: 'Import as new server draft', exact: true }).click()
  await expect(page.getByLabel('Form title', { exact: true })).toHaveValue(
    'Legacy device draft (copy)',
  )
  await expect(page.getByRole('status')).toContainText('Draft saved to the local server')
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      'form-builder-local:v1:' + fixture.auth.user.uid,
    ),
  ).toEqual(library)
  expect(templates.size).toBe(3)
})

test('backend unavailability blocks edits without mixing legacy device drafts into the server library', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__PHASE2_FORM_SERVER__ = true
  })
  await page.route('**/formTemplates', (route) =>
    route.fulfill({
      status: 503,
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      json: { error: { status: 'UNAVAILABLE', message: 'Local backend unavailable' } },
    }),
  )
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await expect(page.getByText('Emulator backend unavailable.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New form', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save local draft', exact: true })).toHaveCount(0)
})
