import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({ plugins: [vue()], resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }, ssr: { noExternal: true }, build: { ssr: 'src/publicRenderer.ts', target: 'node22', outDir: 'functions/generated', emptyOutDir: false, minify: false, rolldownOptions: { output: { format: 'cjs', entryFileNames: 'publicWebsiteRenderer.cjs', inlineDynamicImports: true } } } })
