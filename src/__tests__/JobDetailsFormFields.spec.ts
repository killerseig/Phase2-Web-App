import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobDetailsFormFields from '@/components/jobs/JobDetailsFormFields.vue'

const model = {
  name: 'Phase 2 Company Office',
  code: '111A1A',
  type: 'general',
  gc: 'Hillside',
  jobAddress: '123 Main St',
  startDate: '2026-06-01',
  finishDate: '2026-06-30',
  productionBurden: '0.33',
}

function mountFields(overrides = {}) {
  return mount(JobDetailsFormFields, {
    props: {
      model,
      jobTypeOptions: ['general', 'small-jobs', 'custom-type'],
      testIdPrefix: 'jobs-create',
      ...overrides,
    },
  })
}

describe('JobDetailsFormFields', () => {
  it('renders the job form labels, current values, field attrs, and formatted job type options', () => {
    const wrapper = mountFields()
    const labels = wrapper.findAll('.app-field__label').map((label) => label.text())

    expect(labels).toEqual([
      'Job Number',
      'Job Type',
      'Job Name',
      'GC',
      'Burden',
      'Start Date',
      'End Date',
      'Job Address',
    ])
    expect(wrapper.get<HTMLInputElement>('[data-testid="jobs-create-code"]').element.value).toBe(
      '111A1A',
    )
    expect(wrapper.get<HTMLInputElement>('[data-testid="jobs-create-name"]').element.value).toBe(
      'Phase 2 Company Office',
    )
    expect(wrapper.get<HTMLInputElement>('[data-testid="jobs-create-gc"]').element.value).toBe(
      'Hillside',
    )
    expect(
      wrapper.get<HTMLInputElement>('[data-testid="jobs-create-address"]').element.value,
    ).toBe('123 Main St')

    const typeSelect = wrapper.get<HTMLSelectElement>('select')
    expect(typeSelect.element.value).toBe('general')
    expect(typeSelect.findAll('option').map((option) => option.text())).toEqual([
      'General',
      'Small Jobs',
      'custom-type',
    ])

    const burdenInput = wrapper.get<HTMLInputElement>('input[type="number"]')
    expect(burdenInput.element.value).toBe('0.33')
    expect(burdenInput.attributes('min')).toBe('0')
    expect(burdenInput.attributes('step')).toBe('0.01')
    expect(burdenInput.attributes('inputmode')).toBe('decimal')

    const dateInputs = wrapper.findAll<HTMLInputElement>('input[type="date"]')
    expect(dateInputs.map((input) => input.element.value)).toEqual(['2026-06-01', '2026-06-30'])
    expect(wrapper.get('[data-testid="jobs-create-gc"]').attributes('list')).toBe('job-gc-options')
  })

  it('emits one typed update event for each edited field', async () => {
    const wrapper = mountFields()
    const dateInputs = wrapper.findAll<HTMLInputElement>('input[type="date"]')
    const startDateInput = dateInputs[0]
    const finishDateInput = dateInputs[1]

    if (!startDateInput || !finishDateInput) {
      throw new Error('Expected start and finish date inputs to render.')
    }

    await wrapper.get('[data-testid="jobs-create-code"]').setValue('7505')
    await wrapper.get('select').setValue('small-jobs')
    await wrapper.get('[data-testid="jobs-create-name"]').setValue('Lucky 3 Ranch')
    await wrapper.get('[data-testid="jobs-create-gc"]').setValue('Plexxis')
    await wrapper.get('input[type="number"]').setValue('0.42')
    await startDateInput.setValue('2026-07-01')
    await finishDateInput.setValue('2026-07-31')
    await wrapper.get('[data-testid="jobs-create-address"]').setValue('5229 Ranch Road')

    expect(wrapper.emitted('updateField')).toEqual([
      ['code', '7505'],
      ['type', 'small-jobs'],
      ['name', 'Lucky 3 Ranch'],
      ['gc', 'Plexxis'],
      ['productionBurden', '0.42'],
      ['startDate', '2026-07-01'],
      ['finishDate', '2026-07-31'],
      ['jobAddress', '5229 Ranch Road'],
    ])
  })

  it('keeps test ids optional for edit forms that do not need prefixed selectors', () => {
    const wrapper = mountFields({
      testIdPrefix: undefined,
    })

    expect(wrapper.find('[data-testid="jobs-create-code"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="jobs-create-name"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="jobs-create-gc"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="jobs-create-address"]').exists()).toBe(false)
  })
})
