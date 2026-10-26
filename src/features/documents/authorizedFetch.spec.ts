import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthorizedFetch } from './authorizedFetch'
const old = 'https://example.invalid/file?ticket=old', fresh = 'https://example.invalid/file?ticket=fresh'
const expired = () => new Response('Expired', { status: 403, headers: { 'X-Document-Error': 'ticket-expired' } })
function setup(renew = vi.fn().mockResolvedValue(fresh)) {
  const controller = new AbortController(), onRenewing = vi.fn()
  const client = createAuthorizedFetch(old, { signal: controller.signal, isCurrent: () => true, renew, onRenewing })
  return { client, controller, renew, onRenewing }
}
afterEach(() => vi.unstubAllGlobals())
describe('document expiry renewal', () => {
  it('singleflights concurrent expired ranges, retrying the same byte requests in place', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => { void init; return url.includes('old') ? expired() : new Response('bytes') })
    vi.stubGlobal('fetch', fetch)
    let finish!: (url: string) => void
    const renew = vi.fn(() => new Promise<string>(resolve => { finish = resolve }))
    const { client, onRenewing } = setup(renew)
    const first = client.request({ headers: { Range: 'bytes=0-9' } }), second = client.request({ headers: { Range: 'bytes=10-19' } })
    await vi.waitFor(() => expect(renew).toHaveBeenCalledOnce())
    finish(fresh)
    await Promise.all([first, second])
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(fetch.mock.calls.filter(([url]) => url.includes('fresh'))).toHaveLength(2)
    expect(onRenewing.mock.calls).toEqual([[true], [false]])
    expect(fetch.mock.calls.map(call => (call[1] as RequestInit | undefined)?.headers)).toEqual([{ Range: 'bytes=0-9' }, { Range: 'bytes=10-19' }, { Range: 'bytes=0-9' }, { Range: 'bytes=10-19' }])
  })
  it('does not renew real access denial or retry it in a loop', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('Revoked', { status: 403 }))
    vi.stubGlobal('fetch', fetch)
    const { client, renew } = setup()
    await expect(client.request()).rejects.toThrow('access has changed')
    await expect(client.request()).rejects.toThrow('access has changed')
    expect(renew).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledOnce()
  })
  it('retries at most once when the renewed ticket also fails', async () => {
    const fetch = vi.fn(async () => expired()); vi.stubGlobal('fetch', fetch)
    const { client, renew } = setup()
    await expect(client.request()).rejects.toThrow('access has changed')
    await expect(client.request()).rejects.toThrow('access has changed')
    expect(renew).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('aborts renewal on document exit and never fetches with its late result', async () => {
    const fetch = vi.fn(async () => expired()); vi.stubGlobal('fetch', fetch)
    let finish!: (url: string) => void
    const renew = vi.fn(() => new Promise<string>(resolve => { finish = resolve }))
    const { client, controller } = setup(renew)
    const pending = expect(client.request()).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(renew).toHaveBeenCalledOnce())
    controller.abort(); finish(fresh)
    await pending; expect(fetch).toHaveBeenCalledOnce()
  })
  it('rejects stale authorization contexts and supports the legacy expiry response', async () => {
    let current = true
    const fetch = vi.fn().mockResolvedValueOnce(new Response('This file link expired. Open it again from the SDS library.', { status: 403 }))
    vi.stubGlobal('fetch', fetch)
    const renew = vi.fn(async () => { current = false; return fresh })
    const client = createAuthorizedFetch(old, { signal: new AbortController().signal, isCurrent: () => current, renew })
    await expect(client.request()).rejects.toMatchObject({ name: 'AbortError' })
    expect(renew).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledOnce()
  })
  it('stops after a failed authorization and never retries an unchanged ticket', async () => {
    const fetch = vi.fn(async () => expired()); vi.stubGlobal('fetch', fetch)
    const { client, renew } = setup(vi.fn().mockRejectedValue(new Error('Permission denied')))
    await expect(client.request()).rejects.toThrow('Permission denied')
    await expect(client.request()).rejects.toThrow('Permission denied')
    expect(renew).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledOnce()
    const unchanged = setup(vi.fn().mockResolvedValue(old))
    await expect(unchanged.client.request()).rejects.toThrow('could not be renewed')
  })
})
