import { fileURLToPath, URL } from 'node:url'
import { realpathSync } from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { sdsPdfAssets } from './scripts/sdsPdfAssets.ts'
import { isolatedWebsiteRuntime, excludeProductionTestRuntime } from './scripts/vitePlugins.ts'

// https://vite.dev/config/
export default defineConfig({
  optimizeDeps: { include: ['mammoth', 'read-excel-file/web-worker'] },
  cacheDir: '.forms-local-data/vite-cache',
  build: { rolldownOptions: { input: { index: fileURLToPath(new URL('./index.html', import.meta.url)), publicSite: fileURLToPath(new URL('./public-site.html', import.meta.url)), websiteRuntime: fileURLToPath(new URL('./website-runtime.html', import.meta.url)) } } },
  server: {
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url)), realpathSync(fileURLToPath(new URL('./node_modules', import.meta.url)))] },
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
    isolatedWebsiteRuntime(),
    sdsPdfAssets(),
    excludeProductionTestRuntime(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
