import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium } from '@playwright/test'

// Real production assets + Hosting headers; all remote services are intercepted.
// Auth is seeded into the loaded Pinia store, never into a production account.
const root = resolve('dist')
const config = JSON.parse(await readFile('firebase.json', 'utf8'))
const headers = Object.fromEntries(
  config.hosting.headers[0].headers.map(({ key, value }) => [key, value]),
)
const documentFixtures = [
  { id: 'fixture', name: 'SDS preview fixture', extension: 'pdf', file: 'sds-preview.pdf', mime: 'application/pdf' },
  { id: 'word', name: 'Word notes', extension: 'docx', file: 'notes.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'excel', name: 'Workbook', extension: 'xlsx', file: 'materials.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { id: 'photo', name: 'Site photo', extension: 'png', file: 'site.png', mime: 'image/png' },
  { id: 'text', name: 'Text notes', extension: 'txt', file: 'notes.txt', mime: 'text/plain' },
]
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}
const server = createServer(async (request, response) => {
  const path = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname)
  if (!path.startsWith(root + sep)) {
    response.writeHead(400)
    response.end()
    return
  }
  let body, extension
  try {
    body = await readFile(path)
    extension = extname(path)
  } catch {
    body = await readFile(resolve(root, 'index.html'))
    extension = '.html'
  }
  const pathHeaders = Object.fromEntries(config.hosting.headers.slice(1).filter(entry => entry.source === request.url || (entry.source === '/assets/**' && request.url.startsWith('/assets/'))).flatMap(entry => entry.headers.map(({key, value}) => [key, value])))
  response.writeHead(200, {
    ...headers, ...pathHeaders,
    'Content-Type': mime[extension] || 'application/octet-stream',
  })
  response.end(body)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const websiteFixture = { name: 'Phase 2', accent: '#174878', pages: [{ id: 'home', title: 'Home', slug: 'home', description: 'Company introduction.', inNavigation: true, sections: [{ id: 'intro', type: 'hero', title: 'Website preview fixture', text: 'Public company introduction.', imageId: 'website-photo', alt: 'Example project', linkLabel: '', linkUrl: '', hidden: false, items: [] }] }] }
websiteFixture.theme = {background:'#f4f6f8',text:'#172c40',headingFont:'display',fontSize:18,spacing:24,contentWidth:1200}
websiteFixture.branding = { logoId: 'website-photo', logoAlt: 'Company logo', footerText: 'Company contact details', footerLinks: [{ id: 'contact', label: 'Contact', url: 'mailto:office@example.com' }] }
const entry = (await readdir(resolve(root, 'assets'))).find((f) => /^index-.*\.js$/.test(f))
websiteFixture.pages[0].grid = { visible: true, snap: true, spacingX: 1, spacingY: 1 }
websiteFixture.pages[0].sections[0].layout = { x: 0, y: 0, w: 24, h: 14, z: 1 }
websiteFixture.pages[0].sections.push({ id: 'custom-code', type: 'custom',title: 'Isolated widget',text:'',imageId:'',alt:'',linkLabel:'',linkUrl:'',hidden:false,items:[],layout:{x:0,y:15,w:24,h:8,z:2},custom:{inline:{id:'isolated',name:'Isolated widget',kind:'code',sections:[],html:'<h2>Isolated widget</h2>',css:'h2 {color:#123456}',fields:[]},values:{}} })
for (const [index, linkUrl] of ['https://youtu.be/abcdefghijk', 'https://vimeo.com/123456', 'https://media.example.test/video.webm'].entries()) {
  websiteFixture.pages[0].sections.push({ id: 'video-' + index, type: 'video', title: 'Video ' + index, text: '', imageId: '', alt: '', linkLabel: 'Open video', linkUrl, hidden: false, items: [], layout: { x: 0, y: 24 + index * 12, w: 24, h: 11, z: 3 + index } })
}
const companyItem = { id:'metric', title:'Projects', text:'Company detail', subtitle:'Completed work', value:42, imageId:'', alt:'', linkLabel:'', linkUrl:'' }
for (const [index, type] of ['chart','team','icon'].entries()) {
  websiteFixture.pages[0].sections.push({ ...companyItem, id:'component-' + type, type, title:'Component ' + type, hidden:false, icon:'shield', blockOptions:{chartType:'area',columns:1,showData:false}, items:type === 'icon' ? [] : [companyItem], layout:{x:0,y:62 + index * 16,w:24,h:15,z:8 + index} })
}
for (const [index,type] of ['card','metric','progress-ring','sparkline','data-table'].entries()) {
  websiteFixture.pages[0].sections.push({...companyItem,id:'compact-' + type,type,title:'Compact ' + type,value:42,hidden:false,appearance:{padding:12,headingSize:18,radius:10,borderWidth:1,borderColor:'#dbe1e7'},items:['sparkline','data-table'].includes(type)?[companyItem]:[],layout:{x:0,y:112+index*12,w:6,h:9,z:12+index}})
}
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const page = await browser.newPage()
  const failures = []
  page.on('pageerror', (error) => failures.push(error.message))
  page.on('console', (event) => {
    if (/content security policy|violates.*directive/i.test(event.text()))
      failures.push(event.text())
  })
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (['www.youtube-nocookie.com', 'player.vimeo.com'].includes(url.hostname)) {
      await route.fulfill({ contentType: 'text/html', body: '<p>Hosted video fixture</p>' })
      return
    }
    if (url.hostname === 'media.example.test') {
      await route.fulfill({ contentType: 'video/webm', body: Buffer.alloc(0) })
      return
    }
    if (url.pathname.endsWith('/dashboardWorkspace')) {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
      if (route.request().method() === 'OPTIONS') await route.fulfill({ status: 204, headers })
      else await route.fulfill({ headers, json: { result: { version: 0, canEdit: true, widgets: [{ id: 'documents', type: 'documents', span: 12, title: 'Documents', text: '' }] } } })
      return
    }
    if (url.pathname === '/website-image') {
      await route.fulfill({ path: 'e2e/fixtures/site.webp', contentType: 'image/webp' })
      return
    }
    if (url.pathname.endsWith('/websiteBuilder') || url.pathname.endsWith('/getPublishedWebsite')) {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
        return
      }
      const result = url.pathname.endsWith('/getPublishedWebsite') ? { site: websiteFixture }
        : route.request().postDataJSON()?.data?.action === 'getImage' ? { base64: (await readFile('e2e/fixtures/site.webp')).toString('base64') }
        : route.request().postDataJSON()?.data?.action === 'listImages' ? { images: [{ id: 'website-photo', name: 'Production image', size: 1000, createdAt: 1 }], nextCursor: null }
        : { draft: websiteFixture, version: 1, publishedAt: 1, hasPrevious: false }
      await route.fulfill({ json: { result }, headers: { 'access-control-allow-origin': '*' } })
      return
    }
    if (url.pathname === '/sds-file') {
      const file = documentFixtures.find((file) => file.id === url.searchParams.get('ticket'))
      if (!file) throw new Error('Unknown preview fixture')
      await route.fulfill({ path: `e2e/fixtures/${file.file}`, contentType: file.mime })
      return
    }
    if (url.origin === origin) {
      await route.continue()
      return
    }
    if (
      url.pathname.endsWith('/sdsWorkspace') ||
      url.pathname.endsWith('/listVisibleJobsForCurrentUser')
    ) {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        })
        return
      }
      const action = route.request().postDataJSON()?.data?.action
      const selectedFile = documentFixtures.find((file) => file.id === route.request().postDataJSON()?.data?.id)
      const result = url.pathname.endsWith('/listVisibleJobsForCurrentUser')
        ? { jobs: [] }
        : action === 'listResources'
          ? { resources: [] }
          : action === 'openSheet'
            ? {
                url: `https://us-central1-phase2-website.cloudfunctions.net/downloadSdsFile?ticket=${selectedFile.id}`,
                extension: selectedFile.extension,
              }
            : {
                version: 0,
                folders: [],
                sheets: documentFixtures.map(file => ({
                    ...file,
                    manufacturer: 'Example',
                    productCode: '',
                    language: 'English',
                    revisionId: 'r1',
                    revisionDate: '',
                    order: 0,
                    folderId: '',
                    archived: false,
                  })),
                binder: { version: 0, selections: [] },
              }
      await route.fulfill({ json: { result }, headers: { 'access-control-allow-origin': '*' } })
      return
    }
    await route.abort()
  })
  await page.goto(`${origin}/login`)
  await page.getByRole('button', { name: 'Login', exact: true }).waitFor()
  await page.evaluate(async (entry) => {
    const exports = await import(`/assets/${entry}`)
    const useAuth = Object.values(exports).find(
      (value) => typeof value === 'function' && value.$id === 'auth',
    )
    if (!useAuth) throw new Error('Could not find the production auth store')
    const auth = useAuth()
    auth.currentUser = { uid: 'local-production-review', email: 'review@example.invalid' }
    auth.profile = {
      id: 'local-production-review',
      role: 'admin',
      active: true,
      assignedJobIds: [],
      firstName: 'Local',
      lastName: 'Review',
    }
    auth.ready = true
    await document
      .querySelector('#app')
      .__vue_app__.config.globalProperties.$router.push('/dashboards/personal')
  }, entry)
  await page.getByRole('button', { name: 'Current folder actions', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Current folder actions', exact: true }).click()
  await page.getByRole('menu', { name: 'Root folder', exact: true }).waitFor()
  await page.getByRole('menuitem', { name: 'New folder', exact: true }).click()
  await page.getByRole('heading', { name: 'Add folder', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const pdfResponse = page.waitForResponse((response) => response.url().includes('/sds-file'))
  await page.getByRole('button', { name: 'SDS preview fixture', exact: true }).click()
  const response = await pdfResponse
  assert.equal(response.status(), 200)
  await response.finished()
  await page.getByRole('img', { name: 'PDF page 1 of 2', exact: true }).waitFor()
  await page.getByTestId('sds-module').screenshot({ path: '.security-work/sds-split-preview.png' })
  await page.getByRole('button', { name: 'Word notes', exact: true }).click()
  await page.locator('pre').filter({ hasText: 'Review the delivery schedule.' }).waitFor()
  await page.getByRole('button', { name: 'Workbook', exact: true }).click()
  await page.getByRole('cell', { name: 'Drywall', exact: true }).waitFor()
  await page.getByLabel('Worksheet', { exact: true }).selectOption({ label: 'Deliveries' })
  await page.getByRole('cell', { name: 'Monday delivery', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Site photo', exact: true }).click()
  await page.getByRole('img', { name: 'Site photo', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Text notes', exact: true }).click()
  await page.locator('pre').filter({ hasText: '<script>window.previewInjected=true</script>' }).waitFor()
  assert.equal(await page.evaluate(() => 'previewInjected' in window), false)
  assert.equal(await page.getByRole('link', { name: 'Personal Dashboard', exact: true }).count(), 0)
  assert.equal(await page.getByRole('link', { name: 'Role Dashboard', exact: true }).count(), 0)
  await page.evaluate(async () => {
    await document.querySelector('#app').__vue_app__.config.globalProperties.$router.push('/dashboards/role')
  })
  await page.getByRole('heading', { name: 'Documents', exact: true }).waitFor()
  assert.equal(await page.getByRole('main').getByRole('heading').count(), 1)
  await page.getByRole('link', { name: 'Expand explorer' }).click()
  await page.getByRole('heading', { name: 'Documents', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Current folder actions', exact: true }).waitFor()
  assert.equal(
    await page.getByRole('link', { name: 'Jobs', exact: true }).getAttribute('href'),
    '/jobs',
  )
  await page.getByRole('link', { name: 'Website Builder', exact: true }).click()
  await page.getByRole('heading', { name: 'Website Builder', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Website preview fixture', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Site settings', exact: true }).click()
  await page.getByRole('button', { name: 'Choose logo from library', exact: true }).click()
  await page.getByRole('dialog', { name: 'Website image library' }).getByRole('button', { name: 'Use Production image' }).waitFor()
  await page.waitForFunction(() => [...document.images].some(image => image.alt === 'Production image' && image.naturalWidth > 0))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => [...document.images].some(image => image.alt === 'Example project' && image.naturalWidth > 0))
  await page.goto(`${origin}/website`)
  await page.getByRole('heading', { name: 'Website preview fixture', exact: true }).waitFor()
  await page.getByRole('img', { name: 'Company logo', exact: true }).waitFor()
  await page.getByText('Company contact details', { exact: true }).waitFor()
  await page.waitForFunction(() => [...document.images].some(image => image.alt === 'Example project' && image.naturalWidth > 0))
  assert.equal(await page.getByRole('link', { name: 'Employee Login', exact: true }).getAttribute('href'), '/login')
  assert.equal(await page.getByRole('link', { name: 'Website Builder', exact: true }).count(), 0)
  await page.frameLocator('iframe').getByRole('heading', {name:'Isolated widget',exact:true}).waitFor()
  assert.equal(await page.frameLocator('iframe').locator('h2').evaluate(el=>getComputedStyle(el).color),'rgb(18, 52, 86)')
  assert.equal(await page.locator('iframe').count(), 1) // Custom widget only; videos wait for a click.
  for (let index = 0; index < 3; index++) {
    const widget = page.locator('.section-video').filter({ has: page.getByRole('heading', {name: 'Video ' + index, exact:true}) })
    const mediaResponse = index === 2 ? page.waitForResponse('https://media.example.test/video.webm') : null
    await widget.getByRole('button', {name:'Load video',exact:true}).click()
    if (index < 2) await widget.frameLocator('iframe').getByText('Hosted video fixture').waitFor()
    else {
      await widget.locator('video').waitFor()
      assert.equal((await mediaResponse).status(), 200)
    }
  }
  await page.locator('.section-chart').getByText('View chart data',{exact:true}).click()
  await page.locator('.section-chart').getByRole('cell',{name:'42',exact:true}).waitFor()
  await page.locator('.section-team').getByText('Completed work',{exact:true}).waitFor()
  assert.equal(await page.locator('.section-icon .pi-shield').count(),1)
  await page.locator('.section-metric .metric-value').getByText('42',{exact:true}).waitFor()
  assert.equal(await page.locator('.section-progress-ring [role=progressbar]').getAttribute('aria-valuenow'),'42')
  await page.locator('.section-sparkline').getByText('View data',{exact:true}).click()
  await page.locator('.section-sparkline').getByRole('cell',{name:'42',exact:true}).waitFor()
  await page.locator('.section-data-table').getByRole('table').waitFor()
  await page.locator('.section-metric').screenshot({path:'.security-work/compact-metric.png'})
  assert.equal(await page.locator('.website-canvas').evaluate(element => getComputedStyle(element).backgroundColor),'rgb(244, 246, 248)')
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('Saira') && font.status === 'loaded')),true)
  assert.equal(await page.locator('.section-hero img').first().getAttribute('loading'),'eager')
  assert.deepEqual(failures, [])
  websiteFixture.js = "window.sequence = ['site']; try { parent.document.body.dataset.leak = 'yes' } catch { window.isolated = true }"
  websiteFixture.pages[0].js = "window.sequence.push('page'); document.querySelector('.widget-title').textContent = window.sequence.join(' then ') + (window.isolated ? ' isolated' : ' UNSAFE')"
  await page.reload()
  const runtime = page.frameLocator('iframe[title="Website code preview"]')
  await runtime.getByRole('heading', {name:'site then page isolated',exact:true}).waitFor()
  assert.equal(await page.evaluate(() => document.body.dataset.leak), undefined)
  await runtime.getByRole('img', {name:'Example project',exact:true}).waitFor()
  assert.deepEqual(failures, [])
  console.log(
    'Production dashboards, document previews, Website Builder and signed-out public website render with Hosting headers; no page errors or CSP violations. Remote services were mocked and no production data was touched.',
  )
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
