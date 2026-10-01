import config from '../vite.config'
import { defineConfig } from 'vite'
export default defineConfig({
  ...config,
  server: { ...config.server, proxy: {}, host: '127.0.0.1', port: 5195, strictPort: true },
})
