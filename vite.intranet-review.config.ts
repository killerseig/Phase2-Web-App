import { defineConfig } from 'vite'
import base from './vite.config'
import { resolve } from 'node:path'
export default defineConfig({
  ...base, envDir: false, cacheDir: '.intranet-cache/vite', publicDir: false,
  define: {
    'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify('offline-fixture-only'),
    'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify('demo-phase2-security.invalid'),
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('demo-phase2-security'),
    'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify('demo-phase2-security.appspot.com'),
    'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify('123456'),
    'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify('offline-fixture-only'),
    'import.meta.env.VITE_FORM_EMULATORS': JSON.stringify('true'),
  },
  server: { ...base.server, proxy: {}, host: '127.0.0.1', port: 5202, strictPort: true },
  build: { ...base.build, outDir: 'evidence/employee-build', rolldownOptions: { input: { index: resolve('index.html') } } },
})
