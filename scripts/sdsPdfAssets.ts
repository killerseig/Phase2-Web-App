import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const root = fileURLToPath(new URL('../node_modules/pdfjs-dist/', import.meta.url))
const directories = ['cmaps', 'standard_fonts', 'wasm']
export function sdsPdfAssets(): Plugin {
  return {
    name: 'sds-pdf-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const match = request.url?.match(
          /^\/sds-pdf-assets\/(cmaps|standard_fonts|wasm)\/([\w.-]+)$/,
        )
        if (!match || match[2] === '.' || match[2] === '..') return next()
        try {
          const bytes = readFileSync(`${root}/${match[1]}/${match[2]}`)
          response.setHeader(
            'Content-Type',
            match[2]!.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
          )
          response.end(bytes)
        } catch {
          response.statusCode = 404
          response.end()
        }
      })
    },
    generateBundle() {
      for (const directory of directories)
        for (const filename of readdirSync(`${root}/${directory}`)) {
          this.emitFile({
            type: 'asset',
            fileName: `sds-pdf-assets/${directory}/${filename}`,
            source: readFileSync(`${root}/${directory}/${filename}`),
          })
        }
    },
  }
}
