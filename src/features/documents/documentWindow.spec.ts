import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDocumentOpener } from './documentWindow'
afterEach(() => vi.restoreAllMocks())
function fakeTab() {
  return { opener: 'original', document: { title: '', body: { textContent: '' } }, location: { replace: vi.fn<(url: string) => void>() }, close: vi.fn<() => void>() }
}
describe('authorized document windows', () => {
  it('opens synchronously, isolates the opener and navigates only after authorization', async () => {
    const tab = fakeTab()
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const opener = createDocumentOpener()
    let finish!: (value: { url: string }) => void
    const authorize = vi.fn<() => Promise<{ url: string }>>(() => new Promise<{ url: string }>(resolve => { finish = resolve }))
    const pending = opener.open(authorize, 'Opening file', 'Loading…')
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank')
    expect(tab.opener).toBeNull()
    expect(tab.document.body.textContent).toBe('Loading…')
    expect(tab.location.replace).not.toHaveBeenCalled()
    finish({ url: '/synthetic-ticket' }); await pending
    expect(tab.location.replace).toHaveBeenCalledWith('/synthetic-ticket')
    opener.dispose()
    expect(tab.close).not.toHaveBeenCalled() // An already-opened document stays open.
  })
  it('closes a pending window and suppresses late results after context reset or disposal', async () => {
    const tab = fakeTab(); vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const opener = createDocumentOpener()
    let finish!: (value: { url: string }) => void
    const pending = opener.open(() => new Promise(resolve => { finish = resolve }), 'Opening', 'Loading')
    opener.reset(); finish({ url: '/old-context' }); await pending
    expect(tab.close).toHaveBeenCalledOnce()
    expect(tab.location.replace).not.toHaveBeenCalled()
    opener.dispose()
    const authorize = vi.fn<() => Promise<{ url: string }>>()
    await opener.open(authorize, 'Opening', 'Loading')
    expect(authorize).not.toHaveBeenCalled()
  })
  it('closes denied or missing links and reports popup blocking without bypassing authorization', async () => {
    const tab = fakeTab(); vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    const opener = createDocumentOpener()
    await expect(opener.open(() => Promise.reject(new Error('Denied')), 'Opening', 'Loading')).rejects.toThrow('Denied')
    await expect(opener.open(async () => ({}), 'Opening', 'Loading')).rejects.toThrow('link is unavailable')
    expect(tab.location.replace).not.toHaveBeenCalled()
    vi.mocked(window.open).mockReturnValue(null)
    const authorize = vi.fn<() => Promise<{ url: string }>>().mockResolvedValue({ url: '/permitted' })
    await expect(opener.open(authorize, 'Opening', 'Loading')).rejects.toThrow('Allow a new tab')
    expect(authorize).toHaveBeenCalledOnce()
    opener.dispose()
  })
})
