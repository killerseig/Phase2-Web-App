import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // Native Node tests and browser audits have their own runners. Keep
      // ignored local evidence out of maintained unit-test discovery.
      include: [
        'src/**/*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}',
        'functions/test/**/*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}',
        'functions/src/**/*.{test,spec}.{js,jsx,ts,tsx,mjs,cjs,mts,cts}',
        'scripts/**/*.spec.ts',
      ],
      exclude: [...configDefaults.exclude, 'e2e/**', 'functions/*.spec.js', 'functions/lib/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
