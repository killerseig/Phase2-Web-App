import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { sdsPdfAssets } from './scripts/sdsPdfAssets.ts'

// https://vite.dev/config/
export default defineConfig({
  optimizeDeps: { include: ['mammoth', 'read-excel-file/web-worker'] },
  build: { rolldownOptions: { input: { index: fileURLToPath(new URL('./index.html', import.meta.url)), websiteRuntime: fileURLToPath(new URL('./website-runtime.html', import.meta.url)) } } },
  server: {
    cors: { origin: ['null', /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/] },
    proxy: {
      '/website-image': {
        target: 'https://us-central1-phase2-website.cloudfunctions.net',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/website-image/, '/websiteImage'),
      },
      '/sds-file': {
        target: 'https://us-central1-phase2-website.cloudfunctions.net',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/sds-file/, '/downloadSdsFile'),
      },
    },
  },
  plugins: [
    vue(),
    {
      name: 'isolated-website-runtime',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] === '/website-runtime.html') {
            // The sandbox has an opaque origin. WebKit cannot use 'self' to
            // load its modules, so explicitly trust this local asset origin.
            const host = req.headers.host || ''
            const assetOrigin = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
              ? `${server.config.server.https ? 'https' : 'http'}://${host}`
              : ''
            res.setHeader('Content-Security-Policy', `sandbox allow-scripts allow-forms allow-top-navigation-by-user-activation; default-src 'none'; script-src 'self' ${assetOrigin} 'unsafe-inline'; style-src 'self' ${assetOrigin} 'unsafe-inline'; img-src 'self' ${assetOrigin} data: blob:; font-src 'self' ${assetOrigin} data:; connect-src 'none'; frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com; media-src https:; form-action 'none'; base-uri 'none'; frame-ancestors 'self'`)
          }
          next()
        })
      },
    },
    sdsPdfAssets(),
    {
      name: 'exclude-production-test-runtime',
      apply: 'build',
      enforce: 'pre',
      transform(code, id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/testing/e2eRuntime.ts')) return
        const names = [...code.matchAll(/^export (?:async )?function (\w+)/gm)].map(match => match[1])
        return names.map(name => {
          if (name === 'isE2EActive') return 'export function isE2EActive() { return false }'
          // Date helpers call this without enabling the test runtime. Preserve
          // their null fallback so production pages use the actual current date.
          if (name === 'getE2ENowValue') return 'export function getE2ENowValue() { return null }'
          return `export function ${name}() { throw new Error('Test runtime is unavailable in production.') }`
        }).join('\n')
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
