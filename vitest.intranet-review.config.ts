import { mergeConfig, defineConfig } from 'vitest/config'
import base from './vitest.config'
export default mergeConfig(base, defineConfig({ envDir: false, cacheDir: '.intranet-cache/vitest' }))
