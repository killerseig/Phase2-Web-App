import { expect, test } from './helpers/test.js'
import { setupFormServer } from './helpers/formFixture.js'
import committee from '../functions/src/committee-inspection-native.json' with { type: 'json' }
import type { FormDefinition } from '../functions/src/formModel'

test('existing Committee correction remains draft-only until explicit save and keeps issued content', async ({
  page,
}) => {
  const legacy = structuredClone(committee) as FormDefinition
  legacy.fields.splice(4, 0, {
    id: 'committee-5',
    kind: 'text',
    label: 'Site Safety assistant',
    required: false,
    options: [],
  })
  legacy.fields.splice(
    -1,
    0,
    { id: 'committee-20', kind: 'text', label: 'Signature', required: false, options: [] },
    { id: 'committee-21', kind: 'text', label: 'Date', required: false, options: [] },
  )
  legacy.output = { pdf: true, requireLogin: false, template: '' }
  const server = await setupFormServer(page, { definition: legacy, initialPath: '/admin/forms' })
  await page.locator('[data-template-id="audit-e2e"] .library-target').click()
  await page.getByRole('button', { name: 'Form', exact: true }).click()
  await page
    .getByRole('button', { name: 'Apply approved Committee field removals', exact: true })
    .click()
  await expect(page.getByText('Date of Inspection', { exact: true }).first()).toBeVisible()
  expect(server.definition.fields.some((field) => field.label === 'Signature')).toBe(true)
  expect(server.actions.filter((action) => action === 'formTemplates:save')).toHaveLength(0)
  expect(server.latestVersion).toBe(1)
  await page.getByRole('button', { name: 'Save to local server', exact: true }).click()
  await expect(page.getByText('Draft saved to the local server.', { exact: true })).toBeVisible()
  expect(server.definition.fields.some((field) => field.label === 'Signature')).toBe(false)
  expect(server.definition.fields.some((field) => field.label === 'Date of Inspection')).toBe(true)
  expect(server.definition.output?.pdf).toBe(true)
  expect(server.definition.access).toEqual(legacy.access)
  expect(server.latestVersion).toBe(1)
  expect(server.actions.filter((action) => action === 'formTemplates:issue')).toHaveLength(0)
})
