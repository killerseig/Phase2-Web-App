import { previewFileUrl } from '@/features/documents/formats'
import { parseIntranetContent } from '@/features/intranet/content'
import { sdsCommand } from './sds'
/** Existing authenticated library read issues a short-lived ticket; no new access grant. */
export async function readIntranetContent(id: string, signal: AbortSignal) {
  const link = await sdsCommand<{ url: string; extension: string }>('openSheet', { id })
  if (signal.aborted) throw new DOMException('Canceled', 'AbortError')
  if (link.extension !== 'txt') throw new Error('Choose the prepared intranet text package.')
  const response = await fetch(previewFileUrl(link.url), {
    signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
  })
  if (!response.ok) throw new Error('The private content file could not be read. Refresh and try again.')
  const bytes = await response.arrayBuffer()
  if (!bytes.byteLength || bytes.byteLength > 2 * 1024 * 1024)
    throw new Error('The intranet text package must be no larger than 2 MB.')
  return parseIntranetContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
}
