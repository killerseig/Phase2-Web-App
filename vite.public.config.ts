import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
let reviewOnly = false
export default defineConfig({
  plugins: [vue(), { name: 'public-dependency-audit', enforce: 'pre', configResolved(config) { reviewOnly = config.mode === 'performance-test' }, transform(code, id) {
    if (reviewOnly && id.replaceAll('\\','/').endsWith('/src/services/website.ts')) return code.replace(/export async function submitWebsiteForm\(data: Record<string, unknown>\) \{[\s\S]*?\n\}/, "export async function submitWebsiteForm() { throw new Error('This local review preview does not submit forms or send email.') }")
  }, generateBundle(_, bundle) {
    mkdirSync('.forms-local-data', { recursive: true })
    writeFileSync('.forms-local-data/public-build-graph.json', JSON.stringify(Object.values(bundle).filter(chunk => chunk.type === 'chunk').map(chunk => ({ file: chunk.fileName, entry: chunk.isEntry, imports: chunk.imports, dynamicImports: chunk.dynamicImports, modules: Object.keys(chunk.modules) })), null, 2))
  } }],
  resolve: { alias: [{ find: /^.*(?:WebsiteSelectionHandles|WebsiteAlignmentGuides|WebsiteInlineEditor)\.vue$/, replacement: resolve('src/features/website/PublicEditorDecoration.ts') }, { find: '@/features/website/useTextBox', replacement: resolve('src/features/website/usePublicTextBox.ts') }, { find: '@', replacement: resolve('src') }] },
  build: { outDir: process.env.PUBLIC_BUILD_DIR || 'dist', assetsDir: 'public-assets', emptyOutDir: false, rolldownOptions: { input: { publicSite: resolve('public-site.html'), websiteRuntime: resolve('website-runtime.html') } } },
})
