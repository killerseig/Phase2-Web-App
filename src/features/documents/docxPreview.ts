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
    let changed = false
    // Relationship/attribute collections are live: snapshot before removing entries.
    for (const relation of Array.from(xml.getElementsByTagNameNS('*', 'Relationship'))) {
      const target = relation.getAttribute('Target') || ''
      if (relation.getAttribute('TargetMode')?.toLowerCase() === 'external' || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) {
        relation.remove(); omittedExternalContent = true; changed = true
      }
    }
    if (changed) files[name] = strToU8(new XMLSerializer().serializeToString(xml))
  }
  // Most files need no relationship edits: preserve their original compressed
  // bytes instead of deflating every image and XML part again. All archive size
  // checks, relationship validation and sandbox/output sanitization still run.
  return { bytes: omittedExternalContent ? zipSync(files) : new Uint8Array(bytes), omittedExternalContent }
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
    for (const attribute of Array.from(element.attributes)) {
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

export function docxFrame(pages: DocxPages, width: number, zoom = 1) {
  // Fit the complete wrapper, including its padding, inside the frame after
  // reserving room for the vertical scrollbar. Zoom is relative to this fit.
  const padding = 12, wrapperWidth = pages.pageWidth + padding * 2
  const magnification = Math.max(.5, Math.min(3, zoom))
  const scale = Math.min(1, Math.max(.01, (width - 24) / wrapperWidth)) * magnification
  const csp = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  const document = new DOMParser().parseFromString('<!doctype html><html><head></head><body></body></html>', 'text/html')
  const meta = document.createElement('meta'); meta.httpEquiv = 'Content-Security-Policy'; meta.content = csp; document.head.append(meta)
  const title = document.createElement('title'); title.textContent = 'Word document pages'; document.head.append(title)
  const style = document.createElement('style')
  style.textContent = `${pages.styles.replace(/<\/style/gi, '<\\/style')}\nhtml,body{margin:0;background:#525659;color:#111} .docx-wrapper{padding:${padding}px!important;width:${wrapperWidth}px;box-sizing:border-box;zoom:${scale}} section.docx{margin:0 auto 16px!important;box-shadow:0 1px 6px #0006} img{max-width:100%} a{color:inherit;cursor:text}`
  // The scriptless frame fits against its own content container, which excludes
  // its actual scrollbar. Measuring a scrollbar in the parent document is not
  // reliable when the parent and iframe use different scrollbar presentation.
  // Older engines retain the conservative numeric fit above.
  style.textContent += '\n@supports (container-type:inline-size) and (zoom:calc(100cqw / 1px)){@media(max-width:900px){body{container-type:inline-size}.docx-wrapper{padding:0!important;width:' + pages.pageWidth + 'px;zoom:calc(min(1, max(.01, 100cqw / ' + pages.pageWidth + 'px)) * ' + magnification + ')}}}'
  // Native mobile scrollbars may overlay content or ignore custom dimensions.
  // Keep both scrolling axes usable, with a narrow desktop-engine fallback.
  style.textContent += '\n@media(max-width:900px){html{scrollbar-width:thin;scrollbar-color:#adb5bd #525659}html::-webkit-scrollbar{width:6px;height:6px}html::-webkit-scrollbar-thumb{background:#adb5bd;border-radius:6px}html::-webkit-scrollbar-track{background:#525659}}@media(forced-colors:active){html{scrollbar-color:auto}}'
  document.head.append(style)
  document.body.innerHTML = pages.markup
  return '<!doctype html>' + document.documentElement.outerHTML
}
