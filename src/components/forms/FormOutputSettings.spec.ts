import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FormOutputSettings from './FormOutputSettings.vue'
import { nearMissSafetyObservation, newField } from '../../features/forms/model'

vi.mock('@/services/forms', () => ({ formApi: vi.fn(), isFormServerEnabled: () => false }))

describe('matrix output preview sample values', () => {
  it('shows selected column answers for each original matrix row', async () => {
    const wrapper = mount(FormOutputSettings, {
      props: { definition: nearMissSafetyObservation(), templateId: 'preview' },
    })
    await wrapper.findAll('button').find(button => button.text() === 'Preview output')!.trigger('click')
    const html = wrapper.find('iframe[title="Completed form email preview"]').attributes('srcdoc')!
    for (const label of [
      'Safety training is adequate.',
      'Management responds quickly to hazards.',
      'Employees follow safety procedures.',
    ])
      expect(html).toContain(label)
    expect(html.match(/Strongly Disagree/g)?.length).toBe(3)
    wrapper.unmount()
  })
  it('also generates aligned matrix samples inside repeated groups', async () => {
    const group = newField('repeat', 'Site')
    const matrix = newField('matrix', 'Assessment')
    matrix.rows = [
      { id: 'r1', label: 'First statement' },
      { id: 'r2', label: 'Second statement' },
    ]
    matrix.options = ['Acceptable', 'Needs review']
    group.fields = [matrix]
    const wrapper = mount(FormOutputSettings, {
      props: {
        definition: { title: 'Group', description: '', recipients: [], fields: [group] },
        templateId: 'preview',
      },
    })
    await wrapper.findAll('button').find(button => button.text() === 'Preview output')!.trigger('click')
    const html = wrapper.find('iframe[title="Completed form email preview"]').attributes('srcdoc')!
    expect(html).toContain('First statement')
    expect(html).toContain('Second statement')
    expect(html.match(/Acceptable/g)?.length).toBe(2)
    wrapper.unmount()
  })
})
