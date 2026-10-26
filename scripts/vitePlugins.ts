import type { Plugin } from 'vite'

// Keep the development iframe isolated exactly as it is on Hosting. It has an
// opaque origin, so WebKit needs the explicitly allowed local asset origin.
export function isolatedWebsiteRuntime(): Plugin {
  return {
    name: 'isolated-website-runtime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/website-runtime.html') {
          const host = req.headers.host || ''
          const assetOrigin = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
            ? `${server.config.server.https ? 'https' : 'http'}://${host}`
            : ''
          res.setHeader('Content-Security-Policy', `sandbox allow-scripts allow-forms allow-top-navigation-by-user-activation; default-src 'none'; script-src 'self' ${assetOrigin} 'unsafe-inline'; style-src 'self' ${assetOrigin} 'unsafe-inline'; img-src 'self' ${assetOrigin} data: blob:; font-src 'self' ${assetOrigin} data:; connect-src 'none'; frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com; media-src https:; form-action 'none'; base-uri 'none'; frame-ancestors 'self'`)
        }
        next()
      })
    },
  }
}

// Synthetic authentication/data hooks are unavailable in every production build.
export function excludeProductionTestRuntime(): Plugin {
  return {
    name: 'exclude-production-test-runtime',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/testing/e2eRuntime.ts')) return
      const names = [...code.matchAll(/^export (?:async )?function (\w+)/gm)].map(match => match[1])
      return names.map(name => {
        if (name === 'isE2EActive') return 'export function isE2EActive() { return false }'
        // Date helpers need their null fallback without enabling the test runtime.
        if (name === 'getE2ENowValue') return 'export function getE2ENowValue() { return null }'
        return `export function ${name}() { throw new Error('Test runtime is unavailable in production.') }`
      }).join('\n')
    },
  }
}
