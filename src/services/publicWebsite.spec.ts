import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPublicSnapshotCache, loadPublicSnapshot } from './publicWebsite'
const site = { name: 'Public', pages: [{ id: 'home', slug: 'home' }] }
beforeEach(() => { clearPublicSnapshotCache(); vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'demo-public-site'); })
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe('anonymous published snapshot cache', () => {
  it('deduplicates concurrent reads and reuses only public snapshots during navigation', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ result: { site, version: 'public-1' } }) }); vi.stubGlobal('fetch', fetch)
    const [a,b] = await Promise.all([loadPublicSnapshot(), loadPublicSnapshot()]); expect(a).toBe(b)
    await loadPublicSnapshot(); expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0]![1]).toMatchObject({ credentials: 'omit', cache: 'no-cache' })
  })
  it('refreshes versions, honors 304 and clears a published site when unpublish returns null', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: { site, version: 'public-1' } }) }).mockResolvedValueOnce({ status: 304 }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: { site: null, version: null } }) }); vi.stubGlobal('fetch', fetch)
    const first = await loadPublicSnapshot(); expect(await loadPublicSnapshot(true)).toBe(first)
    expect(fetch.mock.calls[1]![1].headers).toEqual({ 'If-None-Match': '"public-1"' })
    expect((await loadPublicSnapshot(true)).site).toBeNull()
  })
  it('keeps the legacy callable response protocol during staged backend upgrades', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ status: 400 }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: { site } }) }); vi.stubGlobal('fetch', fetch)
    expect((await loadPublicSnapshot()).site).toEqual(site)
    expect(fetch.mock.calls[1]![1]).toMatchObject({ method: 'POST', credentials: 'omit', body: '{"data":{}}' })
  })
})
