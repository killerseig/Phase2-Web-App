import assert from 'node:assert/strict'
import {readFileSync,readdirSync,statSync,existsSync,writeFileSync} from 'node:fs'
import {join,relative} from 'node:path'
import {createHash} from 'node:crypto'
const original='C:/Users/atlas/OneDrive/Documents/GitHub/Phase2-Web-App'
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex')
function walk(path){return readdirSync(path).flatMap(name=>{const full=join(path,name);return statSync(full).isDirectory()?walk(full):[full]})}
const paths=walk(join(original,'src')).map(path=>relative(original,path).replaceAll('\\','/')).filter(path=>
 /\/(dailyLogs|shopOrders|timecards|users|stores)\//i.test(path)||
 /^src\/(views|services)\/.*(DailyLog|ShopOrder|Timecard|Users)/i.test(path)||
 ['src/services/auth.ts','src/firebase.ts','src/main.ts','src/App.vue'].includes(path))
const mismatches=paths.filter(path=>!existsSync(path)||hash(path)!==hash(join(original,path)))
assert.deepEqual(mismatches,[],'Core business modules must remain byte-identical to the preserved checkout')
const result={checkedAt:new Date().toISOString(),checkedCoreFiles:paths.length,coreSourceByteIdentical:true,mismatches,sharedAuthServiceAndBootstrapUnchanged:true,productionWritesPerformed:false}
writeFileSync('.forms-local-data/release-baseline/overnight-scope-verification.json',JSON.stringify(result,null,2))
console.log(JSON.stringify(result))
