import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const targets = [
  { name: 'Study4Wyoming live', url: 'https://study4wyoming.com/' },
  { name: 'Phase2 live', url: 'https://phase2-website.web.app/' },
  { name: 'Phase2 localhost candidate', url: 'http://127.0.0.1:5822/' },
].filter(target => !process.argv.includes('--live-only') || !target.url.startsWith('http://127.'))
const browser = await chromium.launch({ headless: true })
const rows = []
try {
  for (const mobile of [false, true]) for (const target of targets) for (let sample = 1; sample <= 2; sample++) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
    const page = await context.newPage(), cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 500000, uploadThroughput: 500000 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 })
    await page.addInitScript(() => {
      window.__lastLcp = 0
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__lastLcp = entry.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    })
    let resources, pending, cached
    cdp.on('Network.requestServedFromCache', event => cached?.add(event.requestId))
    cdp.on('Network.requestWillBeSent', event => { pending?.add(event.requestId) })
    cdp.on('Network.responseReceived', event => resources?.set(event.requestId, { type: event.type, encoded: 0, status: event.response.status, cached: !!event.response.fromDiskCache }))
    cdp.on('Network.loadingFinished', event => { pending?.delete(event.requestId); if (resources?.has(event.requestId)) resources.get(event.requestId).encoded = cached?.has(event.requestId) || resources.get(event.requestId).cached ? 0 : event.encodedDataLength })
    cdp.on('Network.loadingFailed', event => pending?.delete(event.requestId))
    for (const cache of ['cold', 'warm']) {
      resources = new Map(); pending = new Set(); cached = new Set()
      const started = Date.now()
      await page.goto(target.url, { waitUntil: 'commit', timeout: 30000 })
      await page.waitForFunction(name => {
        const element = name.startsWith('Phase2') ? document.querySelector('.public-website') : document.querySelector('main') || document.body
        return element && element.innerText.trim().length > 120 && !element.innerText.startsWith('Loading website')
      }, target.name, { timeout: 20000 })
      const usableContentMs = Date.now() - started
      await page.waitForTimeout(4500)
      const paints = await page.evaluate(() => ({ fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null, lcpMs: window.__lastLcp || null, ttfbMs: performance.getEntriesByType('navigation')[0].responseStart, finalUrl: location.href }))
      const observed = [...resources.values()]
      rows.push({ target: target.name, device: mobile ? '390px mobile / CPU4x' : '1280px desktop / CPU1x', sample, cache, domContentReadyMs: usableContentMs, ...paints, requestCount: observed.length, observedTransferBytes: observed.reduce((sum, r) => sum + r.encoded, 0), scriptTransferBytes: observed.filter(r => r.type === 'Script').reduce((sum, r) => sum + r.encoded, 0), imageTransferBytes: observed.filter(r => r.type === 'Image').reduce((sum, r) => sum + r.encoded, 0), fontTransferBytes: observed.filter(r => r.type === 'Font').reduce((sum, r) => sum + r.encoded, 0), unfinishedAtMeasurement: pending.size })
      console.log(JSON.stringify(rows.at(-1)))
    }
    await context.close()
  }
  writeFileSync(process.argv.includes('--live-only') ? '.forms-local-data/public-release/live-site-comparison.json' : '.forms-local-data/read-only-site-comparison.json', JSON.stringify({ checkedAt: new Date().toISOString(), browser: 'Chromium, fresh context for each cold/warm pair, normal HTTP cache; no routing/interception', conditions: '4Mbps/80ms imposed plus actual server/network latency; LCP captured 4.5s after readable content; two pairs per target/device; localhost is not a live-server comparison', rows }, null, 2))
} finally { await browser.close() }
