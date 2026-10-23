// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readIntranetContent } from './intranet'
import { sampleContent } from '@/features/intranet/__tests__/fixtures'
const command = vi.hoisted(() => vi.fn())
vi.mock('./sds', () => ({ sdsCommand: command }))
afterEach(() => { vi.unstubAllGlobals(); command.mockReset() })
describe('private intranet content download', () => {
  it('uses the existing authorized read and same-origin private-ticket handler', async () => {
    const ticket = 'a'.repeat(64)
    command.mockResolvedValue({ extension: 'txt', url: 'https://service.invalid/download?ticket=' + ticket })
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(sampleContent())))
    vi.stubGlobal('fetch', fetcher)
    expect(await readIntranetContent('private-id', new AbortController().signal)).toEqual(sampleContent())
    expect(command).toHaveBeenCalledWith('openSheet', { id: 'private-id' })
    expect(fetcher).toHaveBeenCalledWith('/sds-file?ticket=' + ticket,
      expect.objectContaining({ credentials: 'omit', redirect: 'error', cache: 'no-store' }))
  })
  it('does not read an unavailable file or a different document format', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    command.mockResolvedValue({ extension: 'pdf', url: 'https://service.invalid/' })
    await expect(readIntranetContent('pdf', new AbortController().signal)).rejects.toThrow('text package')
    expect(fetcher).not.toHaveBeenCalled()
    command.mockResolvedValue({ extension: 'txt', url: 'https://service.invalid/?ticket=abc' })
    fetcher.mockResolvedValue(new Response('', { status: 403 }))
    await expect(readIntranetContent('blocked', new AbortController().signal)).rejects.toThrow('could not be read')
  })
  it('discards a canceled download before fetching content', async () => {
    const abort = new AbortController()
    command.mockImplementation(async () => { abort.abort(); return { extension: 'txt', url: 'https://service.invalid/' } })
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(readIntranetContent('id', abort.signal)).rejects.toThrow('Canceled')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
