import { describe, expect, it, vi } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { docxFrame, renderDocxPages } from './docxPreview'

// Synthetic renderer output exercises the output boundary independently of what
// today's DOCX renderer happens to emit. No scripts or external resources run.
vi.mock('docx-preview', () => ({
  renderAsync: async (_bytes: Uint8Array, body: HTMLElement) => {
    body.innerHTML = '<section class="docx" style="width:612pt"><p onclick="bad()" onmouseover="bad()" onfocus="bad()">Safe text</p><a href="https://example.invalid" target="_blank" ping="https://example.invalid/ping">Label</a><img src="data:image/png;base64,AA==" onload="bad()" onerror="bad()"><img src="https://example.invalid/image"><script>bad()</script><iframe></iframe><form><input></form></section>'
  },
}))

describe('DOCX output sanitization', () => {
  it('removes consecutive event attributes and external links while retaining local images and text', async () => {
    const bytes = zipSync({ 'word/document.xml': strToU8('<document/>') })
    const pages = await renderDocxPages(new Uint8Array(bytes).buffer)
    const doc = new DOMParser().parseFromString(pages.markup, 'text/html')
    expect(doc.body.textContent).toContain('Safe text')
    expect(doc.querySelectorAll('[onclick],[onmouseover],[onfocus],[onload],[onerror],[href],[target],[ping]')).toHaveLength(0)
    expect(doc.querySelectorAll('script,iframe,form,input')).toHaveLength(0)
    expect(doc.querySelectorAll('img')).toHaveLength(1)
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AA==')
    expect(docxFrame(pages, 390)).toContain("script-src 'none'")
    expect(pages.pageCount).toBe(1)
  })
})
