import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { phase2Site } from '../src/features/website/phase2Site.js'

async function setup(page: Page) {
  const draft = phase2Site({ logo: '', interior: '' })
  draft.pages = draft.pages.slice(0, 1)
  draft.pages[0]!.title = 'Original owner page'
  const actions: string[] = []
  let lastSaved: unknown
  await page.route('**/websiteBuilder', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({status:204,headers}); return }
    const data = route.request().postDataJSON().data
    actions.push(data.action)
    if (data.action === 'save') lastSaved = data.site
    const result = data.action === 'save' ? {version:2} : data.action === 'listRevisions' ? {revisions:[],activity:[]} : {draft,version:1,publishedAt:null,hasPrevious:false}
    await route.fulfill({headers,json:{result}})
  })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByText('Complete website starter', {exact:true}).click()
  return { actions, draft, saved: () => lastSaved }
}

test('starter cancel preserves the owner draft and never saves or publishes', async ({page}) => {
  const api = await setup(page)
  await page.getByRole('button', {name:'Review nine-page starter',exact:true}).click()
  const dialog = page.getByRole('dialog', {name:'Review the nine-page starter?'})
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
  await expect(page.getByRole('button',{name:'Original owner page /home'})).toBeVisible()
  expect(api.actions).not.toContain('save')
  expect(api.actions).not.toContain('publish')
})

test('starter backs up the owner draft and waits for explicit save', async ({page}) => {
  const api = await setup(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', {name:'Review nine-page starter',exact:true}).click()
  await page.getByRole('button', {name:'Back up and review starter',exact:true}).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^website-recovery/)
  await expect(page.getByText('Starter review: automatic saving is paused.', {exact:false})).toBeVisible()
  const backups = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('website-starter-backup:')).map(key => JSON.parse(localStorage.getItem(key)!)))
  expect(backups).toHaveLength(1)
  expect(backups[0].draft.pages[0].title).toBe('Original owner page')
  await page.waitForTimeout(3500)
  expect(api.actions).not.toContain('save')
  await page.getByRole('button', {name:'Save draft',exact:true}).click()
  await expect.poll(() => api.saved()).toBeTruthy()
  expect((api.saved() as typeof api.draft).pages).toHaveLength(9)
  expect((api.saved() as typeof api.draft).pages.flatMap(p => p.sections).filter(s => s.type === 'form').every(s => s.hidden)).toBe(true)
  expect(api.actions).not.toContain('publish')
})

test('failed starter backup leaves the owner draft unchanged', async ({page}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key,value) {
      if (key.startsWith('website-starter-backup:')) throw new DOMException('Quota exceeded','QuotaExceededError')
      return original.call(this,key,value)
    }
  })
  const api = await setup(page)
  await page.getByRole('button', {name:'Review nine-page starter',exact:true}).click()
  await page.getByRole('button', {name:'Back up and review starter',exact:true}).click()
  await expect(page.getByText('The starter was not imported because a draft backup could not be saved. Your current draft is unchanged.')).toBeVisible()
  await expect(page.getByRole('button',{name:'Original owner page /home'})).toBeVisible()
  expect(api.actions).not.toContain('save')
  expect(api.actions).not.toContain('publish')
})


test('recovered starter review remains paused until an explicit save', async ({page}) => {
  const api = await setup(page)
  await page.getByRole('button', {name:'Review nine-page starter',exact:true}).click()
  await page.getByRole('button', {name:'Back up and review starter',exact:true}).click()
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('website-recovery:')).some(key => {
    const record = JSON.parse(localStorage.getItem(key)!)
    return record.draft.pages.length === 9 && record.manualSave === true
  }))).toBe(true)
  await page.reload()
  await page.getByRole('button', {name:'Recover edits',exact:true}).click()
  await expect(page.getByText('Starter review: automatic saving is paused.', {exact:false})).toBeVisible()
  await page.waitForTimeout(3500)
  expect(api.actions).not.toContain('save')
  expect(api.actions).not.toContain('publish')
})


test('repeated starter reviews preserve separate backups without automatic saves', async ({page}) => {
  const api = await setup(page)
  for (let index = 0; index < 2; index++) {
    const summary = page.getByText('Complete website starter', {exact:true})
    await expect(page.getByRole('button', {name:'Review nine-page starter',exact:true})).toBeEnabled()
    if ((await summary.locator('..').getAttribute('open')) === null) await summary.click()
    await expect(page.getByRole('button', {name:'Review nine-page starter',exact:true})).toBeVisible()
    await page.getByRole('button', {name:'Review nine-page starter',exact:true}).click()
    await page.getByRole('button', {name:'Back up and review starter',exact:true}).click()
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('website-starter-backup:')).length)).toBe(index + 1)
  }
  const backups = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('website-starter-backup:')).map(key => JSON.parse(localStorage.getItem(key)!)))
  expect(backups.map(record => record.draft.pages.length).sort((a,b) => a-b)).toEqual([1,9])
  expect(api.actions).not.toContain('save')
  expect(api.actions).not.toContain('publish')
})
