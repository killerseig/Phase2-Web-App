import { fileURLToPath } from 'node:url'
import { existsSync, lstatSync } from 'node:fs'
import { defineConfig } from 'vite'
import base from '../vite.config'

if (process.env.PHASE2_CRITICAL_BUILT !== '1') throw new Error('Use the isolated critical-built verification command.')
for (const path of ['../.security-work', '../.security-work/critical-built', '../.security-work/critical-built/dist']) {
  const directory = fileURLToPath(new URL(path, import.meta.url))
  if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) throw new Error('Refusing verification output through a symbolic link.')
}
export default defineConfig({
  ...base,
  envDir: false,
  define: {
    'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify('demo-phase2-critical-built'),
    'import.meta.env.VITE_FORM_EMULATORS': JSON.stringify('false'),
  },
  // Keep every production plugin, including removal of the E2E fixture runtime.
  resolve: { ...base.resolve, alias: [
    { find: '@/firebase', replacement: fileURLToPath(new URL('./critical-built/firebase.ts', import.meta.url)) },
    { find: '@', replacement: fileURLToPath(new URL('../src', import.meta.url)) },
  ] },
  build: { ...base.build, outDir: '.security-work/critical-built/dist', emptyOutDir: true },
  server: { ...base.server, proxy: {} },
})
