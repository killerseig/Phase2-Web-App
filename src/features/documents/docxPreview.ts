import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

export interface DocxPages {
  markup: string
  styles: string
  pageCount: number
  pageWidth: number
  empty: boolean
  omittedExternalContent: boolean
}

// Work on an in-memory copy only. Never resolve external document relationships.
export function prepareDocx(bytes: ArrayBuffer) {
  let count = 0, expanded = 0, omittedExternalContent = false
  const files = unzipSync(new Uint8Array(bytes), { filter: entry => {
    count++; expanded += entry.originalSize
    if (count > 2000 || expanded > 64 * 1024 * 1024 || entry.originalSize > 24 * 1024 * 1024)
      throw new Error('This document is too complex for the browser preview. Open the original in Word.')
    return true
  } })
  if (!files['word/document.xml']) throw new Error('This is not a readable Word document.')
  for (const [name, data] of Object.entries(files)) {
    if (!name.endsWith('.rels')) continue
    const xml = new DOMParser().parseFromString(strFromU8(data), 'application/xml')
    if (xml.querySelector('parsererror')) throw new Error('The document contains unreadable relationships.')
    for (const relation of [...xml.getElementsByTagNameNS('*', 'Relationship')]) {
      const target = relation.getAttribute('Target') || ''
      if (relation.getAttribute('TargetMode')?.toLowerCase() === 'external' || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) {
        relation.remove(); omittedExternalContent = true
      }
    }
    files[name] = strToU8(new XMLSerializer().serializeToString(xml))
  }
  return { bytes: zipSync(files), omittedExternalContent }
}

export async function renderDocxPages(bytes: ArrayBuffer): Promise<DocxPages> {
  const prepared = prepareDocx(bytes)
  const { renderAsync } = await import('docx-preview')
  const body = document.createElement('div'), styles = document.createElement('div')
  await renderAsync(prepared.bytes, body, styles, {
    inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: false,
    useBase64URL: true, ignoreFonts: true, renderAltChunks: false,
    renderComments: false, experimental: false,
  })
  // Defense in depth: document content lives only in a scriptless sandbox below.
  for (const element of body.querySelectorAll('script,iframe,object,embed,form,input,button,link,meta,base,foreignObject')) element.remove()
  for (const element of body.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (/^on/i.test(attribute.name) || ['href', 'xlink:href', 'target', 'ping', 'srcset', 'action', 'formaction'].includes(attribute.name.toLowerCase())) element.removeAttribute(attribute.name)
    }
    if (element instanceof HTMLImageElement && !/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(element.getAttribute('src') || '')) element.remove()
  }
  const pages = [...body.querySelectorAll<HTMLElement>('section.docx')]
  let pageWidth = 816
  for (const [index, page] of pages.entries()) {
    page.setAttribute('role', 'region'); page.setAttribute('aria-label', `Document page ${index + 1} of ${pages.length}`)
    const width = page.style.width.match(/^([\d.]+)(pt|px|in|cm|mm)$/)
    if (width) {
      const units: Record<string, number> = { pt: 96 / 72, px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 }
      pageWidth = Math.max(pageWidth, Number(width[1]) * units[width[2]!]!)
    }
  }
  return {
    markup: body.innerHTML, styles: [...styles.querySelectorAll('style')].map(style => style.textContent || '').join('\n'),
    pageCount: pages.length, pageWidth,
    empty: !body.textContent?.trim() && !body.querySelector('img,svg,math'),
    omittedExternalContent: prepared.omittedExternalContent,
  }
}

export function docxFrame(pages: DocxPages, width: number) {
  const scale = Math.min(1, Math.max(.1, (width - 24) / pages.pageWidth))
  const csp = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  const document = new DOMParser().parseFromString('<!doctype html><html><head></head><body></body></html>', 'text/html')
  const meta = document.createElement('meta'); meta.httpEquiv = 'Content-Security-Policy'; meta.content = csp; document.head.append(meta)
  const title = document.createElement('title'); title.textContent = 'Word document pages'; document.head.append(title)
  const style = document.createElement('style')
  style.textContent = `${pages.styles.replace(/<\/style/gi, '<\\/style')}\nhtml,body{margin:0;background:#525659;color:#111} .docx-wrapper{padding:12px!important;width:${pages.pageWidth + 24}px;box-sizing:border-box;zoom:${scale}} section.docx{margin:0 auto 16px!important;box-shadow:0 1px 6px #0006} img{max-width:100%} a{color:inherit;cursor:text}`
  document.head.append(style)
  document.body.innerHTML = pages.markup
  return '<!doctype html>' + document.documentElement.outerHTML
}
