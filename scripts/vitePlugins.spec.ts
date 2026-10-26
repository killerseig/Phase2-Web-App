import { describe, expect, it, vi } from 'vitest'
import type { ViteDevServer } from 'vite'
import { excludeProductionTestRuntime, isolatedWebsiteRuntime } from './vitePlugins'

describe('production fixture isolation', () => {
  it('disables synthetic authentication/data hooks but keeps the real-date fallback', async () => {
    const hook = excludeProductionTestRuntime().transform
    if (typeof hook !== 'function') throw Error('Missing transform')
    const source = 'export function isE2EActive() { return true }\nexport function getE2ENowValue() { return "fixture date" }\nexport async function signInFixture() { return "fixture user" }'
    const result = await hook.call({} as never, source, 'C:\\project\\src\\testing\\e2eRuntime.ts', {})
    if (typeof result !== 'string') throw Error('Missing isolated module')
    const hooks = new Function(result.replace(/^export /gm, '') + ';return {isE2EActive,getE2ENowValue,signInFixture}')()
    expect(hooks.isE2EActive()).toBe(false)
    expect(hooks.getE2ENowValue()).toBeNull()
    expect(() => hooks.signInFixture()).toThrow('unavailable in production')
    expect(await hook.call({} as never, source, '/src/services/auth.ts', {})).toBeUndefined()
  })
})

describe('development website iframe isolation', () => {
  type Middleware = (request: { url: string; headers: { host: string } }, response: { setHeader: (key: string, value: string) => void }, next: () => void) => void
  function middleware(https = false) {
    let handler: Middleware | undefined
    const server = { config: { server: { https } }, middlewares: { use: (value: Middleware) => { handler = value } } }
    const hook = isolatedWebsiteRuntime().configureServer
    if (typeof hook !== 'function') throw Error('Missing middleware')
    hook(server as unknown as ViteDevServer)
    if (!handler) throw Error('Missing request handler')
    return handler
  }
  it.each(['localhost:5173', '127.0.0.1:5196'])('allows only its local asset origin for %s', host => {
    const setHeader = vi.fn(), next = vi.fn()
    middleware()({ url: '/website-runtime.html?preview=1', headers: { host } }, { setHeader }, next)
    expect(setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining(`script-src 'self' http://${host}`))
    expect(setHeader.mock.calls[0]![1]).toContain("connect-src 'none'")
    expect(setHeader.mock.calls[0]![1]).toContain("frame-ancestors 'self'")
    expect(next).toHaveBeenCalledOnce()
  })
  it('does not trust arbitrary request hosts or alter employee pages', () => {
    const setHeader = vi.fn()
    middleware(true)({ url: '/website-runtime.html', headers: { host: 'untrusted.example' } }, { setHeader }, vi.fn())
    expect(setHeader.mock.calls[0]![1]).not.toContain('untrusted.example')
    setHeader.mockClear()
    middleware()({ url: '/login', headers: { host: 'localhost:5173' } }, { setHeader }, vi.fn())
    expect(setHeader).not.toHaveBeenCalled()
  })
})
