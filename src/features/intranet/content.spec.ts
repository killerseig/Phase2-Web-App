import { describe, expect, it } from 'vitest'
import { parseIntranetContent } from './content'
import { sampleContent } from './__tests__/fixtures'
describe('intranet data boundary', () => {
  it('retains supplied reading data and discards executable or local-path fields', () => {
    const raw = { ...sampleContent(), html: '<script>throw 1</script>', path: 'C:/private/source' }
    const parsed = parseIntranetContent(raw)
    expect(parsed).toEqual(sampleContent())
    expect('html' in parsed).toBe(false)
    expect('path' in parsed).toBe(false)
  })
  it('rejects incompatible packages, fabricated included documents and ambiguous IDs', () => {
    expect(() => parseIntranetContent({ ...sampleContent(), version: 2 })).toThrow()
    const wrong = sampleContent(); wrong.source.documentsIncluded = true as never
    expect(() => parseIntranetContent(wrong)).toThrow()
    const duplicate = sampleContent(); duplicate.resources.push(duplicate.resources[0]!)
    expect(() => parseIntranetContent(duplicate)).toThrow()
    expect(() => parseIntranetContent({ ...sampleContent(), resources: null })).toThrow()
  })
  it('bounds untrusted text and categories before it reaches the reader', () => {
    const raw = sampleContent(); raw.resources[0]!.category = 'Public' as never
    expect(() => parseIntranetContent(raw)).toThrow()
    const long = sampleContent(); long.forms[0]!.paragraphs = ['x'.repeat(10001)]
    expect(() => parseIntranetContent(long)).toThrow()
  })
})
