import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FormDefinitionFields from './FormDefinitionFields.vue'
import type {
  FormAnswers,
  FormDefinition,
  FormGroupInstance,
} from '../../../functions/src/formModel'
const definition: FormDefinition = {
  title: 'Visit',
  description: '',
  recipients: [],
  fields: [
    {
      id: 'sites',
      kind: 'repeat',
      label: 'site',
      required: false,
      options: [],
      minInstances: 1,
      maxInstances: 2,
      fields: [
        { id: 'name', kind: 'text', label: 'Site visited', required: false, options: [] },
        { id: 'photos', kind: 'photo', label: 'Photos', required: false, options: [] },
      ],
    },
  ],
}
describe('repeat group rendering', () => {
  it('does not repeatedly initialize an already empty optional group', async () => {
    const optional = { ...definition, fields: [{ ...definition.fields[0]!, minInstances: 0 }] }
    const wrapper = mount(FormDefinitionFields, { props: { definition: optional, modelValue: { sites: [] } } })
    await wrapper.setProps({ modelValue: { sites: [] } })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
  it('initializes a blank minimum site when the server draft returns an empty array', () => {
    const wrapper = mount(FormDefinitionFields, { props: { definition, modelValue: { sites: [] } } })
    const answers = wrapper.emitted('update:modelValue')![0]![0] as FormAnswers
    expect(answers.sites as FormGroupInstance[]).toHaveLength(1)
    wrapper.unmount()
  })
  it('creates the minimum instance, adds bounded groups, and scopes field IDs', async () => {
    const wrapper = mount(FormDefinitionFields, {
      props: { definition, modelValue: {}, photosEnabled: true },
    })
    const initialized = wrapper.emitted('update:modelValue')![0]![0] as FormAnswers
    expect(initialized.sites as FormGroupInstance[]).toHaveLength(1)
    await wrapper.setProps({ modelValue: initialized })
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Add another'))!
      .trigger('click')
    const added = wrapper.emitted('update:modelValue')!.at(-1)![0] as FormAnswers
    await wrapper.setProps({ modelValue: added })
    expect(added.sites as FormGroupInstance[]).toHaveLength(2)
    const ids = wrapper.findAll('input').map((input) => input.attributes('id'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(
      wrapper
        .findAll('button')
        .find((button) => button.text().includes('Add another'))!
        .attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })
  it('emits photo uploads with the original child, group and stable instance IDs', async () => {
    const wrapper = mount(FormDefinitionFields, {
      props: {
        definition,
        modelValue: { sites: [{ instanceId: 'north', answers: { name: 'North', photos: [] } }] },
        photosEnabled: true,
      },
    })
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(wrapper.emitted('upload')![0]).toEqual(['photos', [file], 'sites', 'north'])
    wrapper.unmount()
  })
  it('allows private photo viewing on readonly completed repeated sites', async () => {
    const wrapper = mount(FormDefinitionFields, {
      props: {
        definition,
        readonly: true,
        photosEnabled: true,
        modelValue: {
          sites: [{ instanceId: 'one', answers: { name: 'North', photos: ['photo-one'] } }],
        },
      },
    })
    const view = wrapper.findAll('button').find((button) => button.text().includes('View Photos'))!
    expect(view.attributes('disabled')).toBeUndefined()
    await view.trigger('click')
    expect(wrapper.emitted('viewPhoto')![0]).toEqual(['photo-one'])
    expect(wrapper.find('input[type="text"]').attributes('readonly')).toBeDefined()
    wrapper.unmount()
  })
})
