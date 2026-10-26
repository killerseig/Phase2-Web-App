import { previewFileUrl } from './formats'
export type RenewDocumentTicket = () => Promise<string>

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException('Document closed', 'AbortError'))
    if (signal.aborted) { cancel(); return }
    signal.addEventListener('abort', cancel, { once: true })
    promise.then(value => { signal.removeEventListener('abort', cancel); resolve(value) }, error => { signal.removeEventListener('abort', cancel); reject(error) })
  })
}

// One fresh authorization for a burst of expired ranges. A request retries only
// once; a renewed ticket that is denied cannot start another renewal loop.
export function createAuthorizedFetch(url: string, options: {
  signal: AbortSignal
  isCurrent: () => boolean
  renew?: RenewDocumentTicket
  onRenewing?: (value: boolean) => void
}) {
  let current = previewFileUrl(url), renewal: Promise<void> | undefined
  let failed: unknown
  function check() {
    if (options.signal.aborted || !options.isCurrent()) throw new DOMException('Document closed', 'AbortError')
    if (failed) throw failed
  }
  async function expired(response: Response) {
    if (response.status !== 403) return false
    if (response.headers.get('X-Document-Error') === 'ticket-expired') return true
    // Compatible with the previously deployed handler's exact expiry response.
    return (await response.clone().text()).trim() === 'This file link expired. Open it again from the SDS library.'
  }
  async function renew(previous: string) {
    check()
    if (current !== previous) return
    if (!renewal) {
      options.onRenewing?.(true)
      renewal = (async () => {
        if (!options.renew) throw new Error('Document access expired. Reopen the document to continue.')
        const next = previewFileUrl(await abortable(options.renew(), options.signal))
        check()
        if (next === previous) throw new Error('Document access could not be renewed.')
        current = next
      })().catch(error => { failed = error; throw error }).finally(() => { renewal = undefined; options.onRenewing?.(false) })
    }
    await abortable(renewal, options.signal)
  }
  return {
    async request(init: RequestInit = {}) {
      check()
      const previous = current
      let response = await fetch(previous, { ...init, cache: 'no-store', signal: options.signal })
      check()
      if (await expired(response)) {
        await renew(previous); check()
        response = await fetch(current, { ...init, cache: 'no-store', signal: options.signal })
        check()
      }
      if (!response.ok) {
        failed = new Error([401, 403].includes(response.status) ? 'Your document access has changed. Reopen the library or contact Admin.' : 'The document could not be loaded. Reopen it to try again.')
        throw failed
      }
      return response
    },
  }
}
