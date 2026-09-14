import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
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
