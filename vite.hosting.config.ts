import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import base from './vite.config'

// Public Firebase SDK configuration only. Never load workstation .env files.
const sdk = JSON.parse(readFileSync('.forms-local-data/hosting-sdk.json', 'utf8'))
if (sdk.projectId !== 'phase2-website' || sdk.appId !== '1:792793988588:web:4f3a132eb263f7f65ad4c9') {
  throw new Error('Unexpected production web application')
}
const names: Record<string, string> = {
  API_KEY: 'apiKey', AUTH_DOMAIN: 'authDomain', PROJECT_ID: 'projectId',
  STORAGE_BUCKET: 'storageBucket', MESSAGING_SENDER_ID: 'messagingSenderId', APP_ID: 'appId',
}
export default defineConfig({
  ...base,
  envDir: false,
  publicDir: false,
  define: {
    ...Object.fromEntries(Object.entries(names).map(([name, key]) => {
      if (!sdk[key]) throw new Error('Incomplete public SDK configuration')
      return [`import.meta.env.VITE_FIREBASE_${name}`, JSON.stringify(sdk[key])]
    })),
    'import.meta.env.VITE_FORM_EMULATORS': JSON.stringify('false'),
  },
  build: {
    ...base.build,
    outDir: 'hosting-dist',
    rolldownOptions: { input: { index: resolve('index.html') } },
  },
})
