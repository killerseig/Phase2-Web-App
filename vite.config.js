import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

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
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
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
})
