import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

function restoreUnchangedFile(path: string, expected: string, original: string) {
  if (readFileSync(path, 'utf8') === expected) writeFileSync(path, original)
}

test('npm run dev updates templates and CSS without discarding an unsaved dashboard edit', async ({
  page,
}) => {
  const view = fileURLToPath(new URL('../src/views/SharedDashboardView.vue', import.meta.url))
  const styles = fileURLToPath(new URL('../src/styles/shared-dashboards.css', import.meta.url))
  const source = readFileSync(view, 'utf8'),
    css = readFileSync(styles, 'utf8')
  const changedSource = source.replace('Find a widget<input', 'Find a widget (HMR check)<input')
  expect(changedSource).not.toBe(source)
  expect(changedSource.split('</script>')[0]).toBe(source.split('</script>')[0])
  const changedCss = css + '\n.shared-dashboard { --hmr-verification: ready; }\n'
  const updates: string[] = []
  const messages: string[] = []
  page.on('console', (event) => {
    if (/vite|hmr/i.test(event.text())) messages.push(event.text())
  })
  page.on('websocket', (socket) => {
    socket.on('framereceived', (event) => {
      updates.push(String(event.payload))
    })
  })
  const api = await mockDashboard(page)
  api.layouts.set('role-admin', {
    version: 1,
    widgets: [{ id: 'text', type: 'text', title: 'Original', text: '', span: 12 }],
  })
  await gotoPhase2App(page, '/dashboards/role', createJobsFixture())
  const servedModule = await page.request.get('/src/views/SharedDashboardView.vue')
  expect(await servedModule.text()).toContain(view.replaceAll('\\', '/'))
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Unsaved HMR draft')
  await page.evaluate(() => {
    Object.assign(window, { __phase2HmrMarker: 'same-document' })
  })
  try {
    writeFileSync(view, changedSource)
    await expect(page.getByLabel('Find a widget (HMR check)', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved HMR draft')
    writeFileSync(styles, changedCss)
    await expect
      .poll(() =>
        page
          .locator('.shared-dashboard')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--hmr-verification').trim(),
          ),
      )
      .toBe('ready')
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved HMR draft')
    expect(await page.evaluate(() => Reflect.get(window, '__phase2HmrMarker'))).toBe(
      'same-document',
    )
    expect(
      updates.some(
        (update) => update.includes('SharedDashboardView.vue') && update.includes('update'),
      ),
    ).toBe(true)
    expect(
      updates.some(
        (update) => update.includes('shared-dashboards.css') && update.includes('update'),
      ),
    ).toBe(true)
    expect(updates.some((update) => update.includes('full-reload'))).toBe(false)
    // Verify consecutive individual saves as well as the first update. The Vue
    // plugin can remount a component when multiple different files change in
    // one batch; do not promise state retention for that upstream behavior.
    writeFileSync(styles, css)
    await expect
      .poll(() =>
        page
          .locator('.shared-dashboard')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--hmr-verification').trim(),
          ),
      )
      .toBe('')
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved HMR draft')
    writeFileSync(view, source)
    await expect(page.getByLabel('Find a widget', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved HMR draft')
  } finally {
    // Do not overwrite a concurrent human edit made while this test was running.
    restoreUnchangedFile(view, changedSource, source)
    restoreUnchangedFile(styles, changedCss, css)
    await test
      .info()
      .attach('hmr-transport', {
        body: JSON.stringify({ updates, messages }),
        contentType: 'application/json',
      })
  }
})
