// Paired production builds, loopback only. Synthetic images; no Firebase writes.
import { createServer } from 'node:http'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { createRequire } from 'node:module'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
 const { chromium } = require('@playwright/test')
const { generatePublicPages, servePublicHtml } = require('../functions/publicWebsiteSnapshot.js')
const sharp = require('../functions/node_modules/sharp')
const site = JSON.parse(readFileSync('.forms-local-data/public-site-fixture.json','utf8'))
const generated = await generatePublicPages(site, 42)
const image = await sharp({create:{width:1200,height:700,channels:3,background:'#67869b'}}).webp().toBuffer()
const optimized = resolve('.forms-local-data/optimized-dist'), baseline = resolve('.forms-local-data/baseline-dist')
let current = generated, requests = []
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon'}
function server(root, fast) {
 return createServer(async (req,res) => {
  const url = new URL(req.url,'http://localhost'); requests.push({fast,path:url.pathname})
  if(url.pathname.startsWith('/assets/'))res.setHeader('Access-Control-Allow-Origin','*')
  res.setHeader('Cache-Control',fast && url.pathname.startsWith('/assets/') ? 'public,max-age=31536000,immutable':'no-cache')
  let bytes, type
  if(url.pathname === '/getPublishedWebsite') { bytes=Buffer.from(JSON.stringify({result:{site:current?.site || null,version:current?.version || null}})); type='application/json' }
  else if(url.pathname === '/website-image') {bytes=image;type='image/webp';if(fast)res.setHeader('Cache-Control','public,max-age=300')}
  else if(fast && (url.pathname==='/' || url.pathname.startsWith('/website') && url.pathname!='/website-runtime.html')) {
   if(!current){res.writeHead(302,{Location:'/login'});res.end();return}
   const slug=url.pathname.replace(/^\/website\/?/,'').replace(/^\/+|\/+$/g,'') || 'home'
   if(!current.pages[slug]){res.writeHead(404);res.end('Page not found');return}
   bytes=Buffer.from(servePublicHtml(current.site,current.version,slug,current.pages[slug]));type='text/html'
  } else {let file=resolve(root,'.'+url.pathname);if(!file.startsWith(root)){res.writeHead(403);res.end();return}if(!existsSync(file)||url.pathname==='/')file=resolve(root,fast?'employee-app.html':'index.html');bytes=readFileSync(file);type=mime[extname(file)]||'application/octet-stream'}
  res.setHeader('Content-Type',type);res.setHeader('Content-Encoding','gzip');res.end(gzipSync(bytes))
 }).listen(fast ? 5832 : 5831,'127.0.0.1')
}
const servers=[server(baseline,false),server(optimized,true)]
await Promise.all(servers.map(s=>new Promise(r=>s.listening?r():s.once('listening',r))))
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']})
const results=[], parity=[]
try {
 for(const [i,s] of servers.entries()) {
  const origin=`http://127.0.0.1:${s.address().port}`
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const cdp=await context.newCDPSession(page)
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:500000,uploadThroughput:500000})
  for(const state of ['cold','warm']) {
   const start=Date.now();await page.goto(origin+'/website',{waitUntil:'domcontentloaded'})
   await page.waitForFunction(()=>document.querySelector('.public-website')?.innerText.trim().length>100)
   const useful=Date.now()-start;await page.waitForTimeout(500)
   results.push({build:i?'optimized':'baseline',state,usefulMs:useful,...await page.evaluate(()=>({scripts:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').reduce((n,r)=>n+r.transferSize,0),text:document.querySelector('.public-website').innerText.length}))})
  }
  const expected=site.pages.filter(p=>p.slug!=='site-layout')
  for(const p of expected){await page.goto(origin+'/website/'+p.slug);await page.waitForFunction(()=>document.querySelector('.public-website')?.innerText.trim().length>30);if(i)await page.waitForFunction(()=>document.getElementById('app')?.dataset.publicReady==='true');await page.waitForTimeout(300);parity.push({build:i?'optimized':'baseline',slug:p.slug,text:await page.locator('.public-website').innerText()})}
  await page.goto(origin+'/website');if(i)await page.waitForFunction(()=>document.getElementById('app')?.dataset.publicReady==='true');else await page.waitForFunction(()=>document.querySelector('.public-website')?.innerText.trim().length>100);await page.evaluate(()=>window.__documentMarker='same')
  const link=page.locator('a[href="/website/company"]').first();assert(await link.count(),'Company link exists');const start=Date.now();await link.click();await page.waitForURL('**/website/company');await page.waitForTimeout(150)
  results.push({build:i?'optimized':'baseline',navigationMs:Date.now()-start,sameDocument:await page.evaluate(()=>window.__documentMarker==='same')})
  assert.equal(normalizeText(await page.locator('.public-website').innerText()),normalizeText(parity.find(p=>p.build===(i?'optimized':'baseline')&&p.slug==='company').text),'Navbar destination body matches hard-loaded Company')
  console.log(JSON.stringify({checkpoint:results,ready:await page.locator('#app').getAttribute('data-public-ready')}))
  await page.goBack();await page.waitForURL('**/website');await page.goForward();await page.waitForURL('**/website/company')
  if(i){assert(await page.evaluate(()=>window.__documentMarker==='same'));for(let n=0;n<4;n++){await page.locator('a[href="/website"]').first().click();await page.waitForURL('**/website');await page.locator('a[href="/website/company"]').first().click();await page.waitForURL('**/website/company');assert(await page.evaluate(()=>window.__documentMarker==='same'))}await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile overflow');
   current=await generatePublicPages({...site,name:'Local changed publication'},43);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.title.includes('Local changed publication'))
   current=null;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForURL('**/login');current=generated
  }
  assert.deepEqual(errors,[]);await context.close()
  if(i){const noJs=await browser.newContext({javaScriptEnabled:false});const staticPage=await noJs.newPage();await staticPage.goto(origin+'/website');assert((await staticPage.locator('.public-website').innerText()).includes('Good work starts'));assert(await staticPage.locator('.public-website img').count());assert(await staticPage.locator('style').evaluateAll(nodes=>nodes.some(n=>n.textContent.includes('custom-eyebrow'))));await noJs.close();
   current=await generatePublicPages({...site,pages:site.pages.map((p,n)=>n? p:{...p,js:'window.localScriptParity = true'})},44);const scripted=await browser.newPage();await scripted.goto(origin+'/website');await scripted.waitForFunction(()=>document.querySelector('iframe'));const frame=scripted.locator('iframe').first().contentFrame();await frame.locator('body').waitFor({state:'attached',timeout:10000});await frame.locator('body').evaluate(()=>new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(window.localScriptParity===true)resolve(true);else if(Date.now()-start>10000)reject(new Error('Sandbox did not initialize'));else setTimeout(check,50)};check()}));await scripted.close();current=generated
  }
 }
 writeFileSync('.forms-local-data/public-parity-detail.json',JSON.stringify(parity,null,2))
 const normalize=normalizeText
 for(const p of site.pages){const a=parity.find(x=>x.build==='baseline'&&x.slug===p.slug),b=parity.find(x=>x.build==='optimized'&&x.slug===p.slug);if(a&&b)assert.equal(normalize(a.text),normalize(b.text),`Text parity ${p.slug}`)}
 writeFileSync('.forms-local-data/public-browser-results.json',JSON.stringify({conditions:'loopback,4Mbps,80ms,normal browser cache,synthetic equal images; baseline local transport substitution',results,pageParity:parity.map(({text,...p})=>({...p,textLength:text.length})),requests},null,2))
 console.log(JSON.stringify({results,pages:parity.length/2,mobile:true,history:true,refresh:true,unpublish:true},null,2))
} finally {await browser.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))))}
function normalizeText(t){return t.replace(/\s+/g,' ').trim()}
