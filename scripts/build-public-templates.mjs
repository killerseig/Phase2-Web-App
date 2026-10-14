import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(process.argv[2] || 'dist'), html = readFileSync(resolve(root, 'public-site.html'), 'utf8')
// Hosting serves static index.html before rewrites. Keep the private app shell
// at an explicit filename so the public root reaches its HTML function.
if (existsSync(resolve(root, 'index.html'))) renameSync(resolve(root, 'index.html'), resolve(root, 'employee-app.html'))
const script = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/)?.[1]
if (!script?.startsWith('/public-assets/')) throw new Error('Missing isolated public entry asset')
const links = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map(x => x[1])
if (!links.length || links.some(x => !x.startsWith('/public-assets/'))) throw new Error('Missing public stylesheet assets')
writeFileSync(resolve(root, 'public-boot.js'), `import ${JSON.stringify(script)};\n`)
writeFileSync(resolve(root, 'public-style.css'), links.map(x => readFileSync(resolve(root, x.slice(1)), 'utf8')).join('\n'))
const template = html.replace(/<script[^>]+type="module"[^>]*><\/script>/g, '').replace(/<link[^>]+rel="(?:modulepreload|stylesheet)"[^>]*>/g, '').replace('</head>', '<link rel="stylesheet" href="/public-style.css"></head>').replace('</body>', '<script type="module" src="/public-boot.js"></script></body>')
mkdirSync('functions/generated', { recursive: true })
writeFileSync('functions/generated/publicTemplate.html', template)
console.log('Public boot/style pointers and server HTML template built.')
