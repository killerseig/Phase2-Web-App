import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { docxFrame, prepareDocx, renderDocxPages } from './docxPreview'
function fixture(name: string) {
  const file = readFileSync(resolve('e2e/fixtures', name))
  return Uint8Array.from(file).buffer
}
describe('local Word page rendering', () => {
  it('reuses unchanged archive bytes while retaining images and all validation', async () => {
    const original = unzipSync(new Uint8Array(fixture('docx-poster.docx')))
    for (const [name, value] of Object.entries(original)) {
      if (!name.endsWith('.rels')) continue
      const xml = new DOMParser().parseFromString(strFromU8(value), 'text/xml')
      for (const relation of [...xml.getElementsByTagNameNS('*', 'Relationship')])
        if (relation.getAttribute('TargetMode')?.toLowerCase() === 'external' || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(relation.getAttribute('Target') || '')) relation.remove()
      original[name] = strToU8(new XMLSerializer().serializeToString(xml))
    }
    const bytes = new Uint8Array(zipSync(original)).buffer
    const prepared = prepareDocx(bytes)
    expect(prepared.omittedExternalContent).toBe(false)
    expect(prepared.bytes.buffer).toBe(bytes)
    const pages = await renderDocxPages(bytes)
    expect(pages.empty).toBe(false); expect(pages.markup).toContain('data:image/png;base64,')
  })
  it('preserves an image-only poster instead of depending on extracted text', async () => {
    const pages = await renderDocxPages(fixture('docx-poster.docx'))
    expect(pages.empty).toBe(false)
    const doc = new DOMParser().parseFromString(pages.markup, 'text/html')
    expect(doc.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
    expect(pages.pageCount).toBe(1)
  })
  it('renders saved page breaks, formatting, tables and literal script text', async () => {
    const pages = await renderDocxPages(fixture('docx-pages.docx'))
    expect(pages.pageCount).toBe(2)
    const doc = new DOMParser().parseFromString(pages.markup, 'text/html')
    expect(doc.querySelector('[aria-label="Document page 2 of 2"]')?.textContent).toContain('Second page heading')
    expect(doc.querySelector('table')?.textContent).toContain('Inspection')
    expect(pages.markup).toMatch(/font-weight:\s*bold/)
    expect(doc.querySelector('script')).toBeNull()
    expect(doc.body.textContent).toContain('<script>window.previewInjected=true</script>')
    expect(doc.querySelector('a[href]')).toBeNull()
    const html = docxFrame(pages, 390)
    expect(html).toContain("script-src 'none'")
    expect(html).toContain("connect-src 'none'")
    expect(html).toContain('zoom:0.')
  })
  it('recognizes whitespace-only documents as empty', async () => {
    expect((await renderDocxPages(fixture('docx-empty.docx'))).empty).toBe(true)
  })
  it('removes external relationships before the renderer can load them', () => {
    const prepared = prepareDocx(fixture('docx-pages.docx'))
    expect(prepared.omittedExternalContent).toBe(true)
    const parts = unzipSync(prepared.bytes)
    expect(strFromU8(parts['word/_rels/document.xml.rels']!)).not.toContain('example.invalid')
    expect(parts['word/media/poster.png']!.length).toBeGreaterThan(0)
  })
  it('rejects corrupt and oversized expanded packages without rendering', async () => {
    await expect(renderDocxPages(new Uint8Array([1, 2, 3]).buffer)).rejects.toThrow()
    const file = new Uint8Array(fixture('docx-empty.docx')), view = new DataView(file.buffer)
    for (let offset = 0; offset < file.length - 28; offset++) {
      if (view.getUint32(offset, true) === 0x02014b50) { view.setUint32(offset + 24, 65 * 1024 * 1024, true); break }
    }
    expect(() => prepareDocx(file.buffer)).toThrow('too complex')
  })
})
