import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// Suppress known third-party legacy Sass API warnings until upstream fully migrates.
if (!process.env.SASS_SILENCE_DEPRECATIONS) {
  process.env.SASS_SILENCE_DEPRECATIONS = 'legacy-js-api'
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function', 'legacy-js-api'],
      },
    },
  },
  server: {
    headers: {
      'Cache-Control': 'public, max-age=0',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Firebase into its own chunk
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          // Split Vue and router into separate chunks
          'vue-vendor': ['vue', 'vue-router'],
          // Split Pinia store into its own chunk
          'pinia': ['pinia'],
        },
      },
    },
    // Set chunk size warning to 600kb (optional, but keeps warnings relevant)
    chunkSizeWarningLimit: 600,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
