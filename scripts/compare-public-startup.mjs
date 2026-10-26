import { createServer } from 'node:http'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
const require=createRequire(import.meta.url)
const {generatePublicPages,servePublicHtml}=require('../functions/lib/publicWebsiteSnapshot.js')
const {canonicalPublicSite}=require('../functions/lib/publicWebsiteRoutes.js')
const site=canonicalPublicSite(JSON.parse(readFileSync('.forms-local-data/public-site-fixture.json')))
const generated=await generatePublicPages(site,42)
const image=await require('../functions/node_modules/sharp')({create:{width:1200,height:700,channels:3,background:'#67869b'}}).webp().toBuffer()
const roots=['.forms-local-data/startup-before-dist','.forms-local-data/review-preview-dist'].map(root=>resolve(root))
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'}
const servers=roots.map(root=>createServer((req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;let bytes,type
 res.setHeader('Cache-Control',path.startsWith('/assets/')||path.startsWith('/public-assets/')?'public,max-age=31536000,immutable':'no-cache')
 res.setHeader('Access-Control-Allow-Origin','*')
 if(path==='/getPublishedWebsite'){bytes=Buffer.from(JSON.stringify({result:{site,version:generated.version}}));type='application/json'}
 else if(path==='/website-image'){bytes=image;type='image/webp'}
 else if(path==='/'||generated.pages[path.slice(1)]){bytes=Buffer.from(servePublicHtml(site,generated.version,path.slice(1)||'home',generated.pages[path.slice(1)||'home']));type='text/html'}
 else {const file=resolve(root,path==='/login'?'employee-app.html':'.'+path);assert(file.startsWith(root));if(!existsSync(file)){res.writeHead(404);res.end();return}bytes=readFileSync(file);type=types[extname(file)]||'application/octet-stream'}
 res.setHeader('Content-Type',type);res.setHeader('Content-Encoding','gzip');res.end(gzipSync(bytes))
 }catch(e){res.writeHead(503);res.end(e.message)}}).listen(0,'127.0.0.1'))
await Promise.all(servers.map(s=>new Promise(r=>s.listening?r():s.once('listening',r))))
const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']})
const results=[],parity=[]
try{
 for(const [i,server] of servers.entries()){
  const origin=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'})
  const page=await context.newPage(),cdp=await context.newCDPSession(page);let requests=[],scripts=0,cacheIds=new Set(),scriptIds=new Set()
  await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:500000,uploadThroughput:500000})
  cdp.on('Network.requestServedFromCache',e=>cacheIds.add(e.requestId))
  cdp.on('Network.responseReceived',e=>{if(e.type==='Script'){scriptIds.add(e.requestId);if(e.response.fromDiskCache)cacheIds.add(e.requestId)}})
  cdp.on('Network.loadingFinished',e=>{if(scriptIds.has(e.requestId)&&!cacheIds.has(e.requestId))scripts+=e.encodedDataLength})
  page.on('request',r=>requests.push(new URL(r.url()).pathname))
  for(const cache of ['cold','warm']){
   requests=[];scripts=0;cacheIds=new Set();scriptIds=new Set();const started=Date.now()
   await page.goto(origin+'/');await page.waitForFunction(()=>document.getElementById('app')?.dataset.publicReady==='true');await page.waitForTimeout(200)
   const readyMs=Date.now()-started
   if(i)assert(!requests.some(p=>/firebase|InlineEditor|WebsiteBuilder|ShopOrders|DailyLogs|Timecard|UsersView|\/assets\/index-/.test(p)),'No private/editor SDK requests during public startup')
   results.push({build:i?'after':'before',cache,readyMs,scriptTransferBytes:scripts,scriptRequests:requests.filter(p=>p.endsWith('.js')).length})
  }
  for(const p of site.pages){await page.goto(origin+(p.slug==='home'?'/':'/'+p.slug));await page.waitForFunction(()=>document.getElementById('app')?.dataset.publicReady==='true');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);parity.push({build:i?'after':'before',slug:p.slug,...await page.evaluate(()=>({text:document.querySelector('.public-website').innerText.replace(/\s+/g,' ').trim(),sections:[...document.querySelectorAll('.website-section')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {class:e.className,box:[r.width,r.height].map(Math.round),color:s.color,background:s.backgroundColor}})}))})}
  if(i){await page.goto(origin+'/');await page.waitForFunction(()=>document.getElementById('app')?.dataset.publicReady==='true');requests=[];await page.locator('a[href="/login"]').first().click();await page.waitForURL('**/login');await page.getByRole('textbox',{name:/email/i}).waitFor({timeout:15000});assert(requests.some(p=>/\/assets\/index-/.test(p)),'App entry loads the separate private bootstrap');assert(requests.some(p=>/firebase/.test(p)),'Firebase remains deferred until app entry')}
  await context.close()
 }
 for(const p of site.pages)assert.deepEqual(parity.find(r=>r.build==='after'&&r.slug===p.slug)?.sections,parity.find(r=>r.build==='before'&&r.slug===p.slug)?.sections,'Before/after public visual geometry '+p.slug)
 for(const p of site.pages)assert.equal(parity.find(r=>r.build==='after'&&r.slug===p.slug)?.text,parity.find(r=>r.build==='before'&&r.slug===p.slug)?.text,'Before/after content '+p.slug)
 writeFileSync('.forms-local-data/public-startup-comparison.json',JSON.stringify({conditions:'Identical loopback servers,1280px,4Mbps/80ms,normal cache,equal synthetic images; ready time waits public interactivity plus200ms; no production requests or submissions',results,privateDeferredUntilEntry:true,ninePageBeforeAfterParity:true},null,2));console.log(JSON.stringify(results,null,2))
}finally{await browser.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))))}
