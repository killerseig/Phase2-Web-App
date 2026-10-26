/** Open before awaiting authorization so normal popup blocking cannot break a valid click. */
export function createDocumentOpener() {
  let generation = 0
  let disposed = false
  const pending = new Set<Window>()
  function reset() {
    generation++
    pending.forEach(tab => tab.close())
    pending.clear()
  }
  async function open(resolve: () => Promise<{ url?: string }>, title: string, loadingText: string) {
    if (disposed) return
    const request = generation
    const tab = window.open('about:blank', '_blank')
    if (tab) {
      pending.add(tab)
      tab.opener = null
      tab.document.title = title
      tab.document.body.textContent = loadingText
    }
    try {
      const result = await resolve()
      if (disposed || request !== generation) return
      if (!tab) throw new Error('Allow a new tab to open the PDF, then try again.')
      if (!result.url) throw new Error('The document link is unavailable. Try again.')
      tab.location.replace(result.url)
    } catch (error) {
      tab?.close()
      if (!disposed && request === generation) throw error
    } finally {
      if (tab) pending.delete(tab)
    }
  }
  return { open, reset, dispose() { disposed = true; reset() } }
}
export type DocumentOpener = ReturnType<typeof createDocumentOpener>
