import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SuppliedReferenceReader from './SuppliedReferenceReader.vue'
import { sampleContent } from '@/features/intranet/__tests__/fixtures'
describe('supplied reference reading in existing screens', () => {
  it('renders malicious source text literally without executable HTML or submission controls', () => {
    const form = sampleContent().forms[0]!
    form.paragraphs = ['<script>globalThis.executed=true</script>', '<img src=x onerror=alert(1)>']
    const view = mount(SuppliedReferenceReader, { props: { title: form.title, form } })
    expect(view.find('script,img,iframe,textarea,input').exists()).toBe(false)
    expect(view.text()).toContain('<script>globalThis.executed=true</script>')
    expect(view.text()).toContain('Completion, signatures and delivery are unavailable')
  })
  it('retains Spanish and the missing-source notice', async () => {
    const row = sampleContent().inspections[0]!
    const view = mount(SuppliedReferenceReader, { props: { title: row.title, paragraphs: row.paragraphs } })
    await view.get('select').setValue('es')
    expect(view.find('[lang=es]').text()).toBe(row.paragraphs[0]!.es)
    expect(view.find('[lang=en]').exists()).toBe(false)
    expect(view.text()).toContain('Original PDFs, orientation reading pages and video were omitted')
  })
})
