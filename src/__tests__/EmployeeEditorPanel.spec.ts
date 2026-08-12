import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EmployeeEditorPanel from '@/components/employees/EmployeeEditorPanel.vue'
import type { EmployeeRecord } from '@/types/domain'

function makeEmployee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 'employee-1',
    employeeNumber: '5133',
    firstName: 'Chris',
    lastName: 'Larsen',
    occupation: 'Foreman',
    active: true,
    isContractor: false,
    jobId: null,
    ...overrides,
  }
}

function makeForm(overrides: Partial<InstanceType<typeof EmployeeEditorPanel>['$props']['createForm']> = {}) {
  return {
    employeeNumber: '5133',
    firstName: 'Chris',
    lastName: 'Larsen',
    occupation: 'Foreman',
    active: true,
    isContractor: false,
    ...overrides,
  }
}

function mountEditor(overrides: Partial<InstanceType<typeof EmployeeEditorPanel>['$props']> = {}) {
  const selectedEmployee = makeEmployee()

  return mount(EmployeeEditorPanel, {
    props: {
      isCreateMode: false,
      createForm: makeForm({
        employeeNumber: '9001',
        firstName: 'New',
        lastName: 'Employee',
        occupation: 'Painter',
      }),
      detailForm: makeForm(),
      selectedEmployee,
      createLoading: false,
      saveLoading: false,
      deleteLoading: false,
      detailInfo: 'All changes saved.',
      activeEmployeesCount: 12,
      inactiveEmployeesCount: 3,
      ...overrides,
    },
  })
}

describe('EmployeeEditorPanel', () => {
  it('renders create mode fields, settings metadata, and forwards create-form events', async () => {
    const wrapper = mountEditor({
      isCreateMode: true,
      selectedEmployee: null,
    })
    const inputs = wrapper.findAll('input.app-text-input')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')

    expect(wrapper.text()).toContain('Create Employee')
    expect(wrapper.text()).toContain('Directory Settings')
    expect(wrapper.text()).toContain('12 active / 3 inactive')
    expect(wrapper.text()).toContain('Type: Employee')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('9001')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('New')
    expect((inputs[2]!.element as HTMLInputElement).value).toBe('Employee')
    expect((inputs[3]!.element as HTMLInputElement).value).toBe('Painter')
    expect((checkboxes[0]!.element as HTMLInputElement).checked).toBe(true)
    expect((checkboxes[1]!.element as HTMLInputElement).checked).toBe(false)

    await inputs[0]!.setValue('9002')
    await inputs[1]!.setValue('CJ')
    await inputs[2]!.setValue('Blanchard')
    await inputs[3]!.setValue('Shop Foreman')
    await checkboxes[0]!.setValue(false)
    await checkboxes[1]!.setValue(true)
    await wrapper.get('form').trigger('submit')
    await wrapper.get('.employees-detail__mobile-back').trigger('click')

    expect(wrapper.emitted('updateCreateTextField')).toEqual([
      ['employeeNumber', '9002'],
      ['firstName', 'CJ'],
      ['lastName', 'Blanchard'],
      ['occupation', 'Shop Foreman'],
    ])
    expect(wrapper.emitted('updateCreateBooleanField')).toEqual([
      ['active', false],
      ['isContractor', true],
    ])
    expect(wrapper.emitted('createSubmit')).toHaveLength(1)
    expect(wrapper.emitted('backToDirectory')).toHaveLength(1)
  })

  it('shows create loading copy and locks the create submit action', () => {
    const wrapper = mountEditor({
      isCreateMode: true,
      selectedEmployee: null,
      createLoading: true,
    })
    const submitButton = wrapper.get('button.app-button--primary')

    expect(submitButton.text()).toBe('Creating Employee...')
    expect(submitButton.attributes('disabled')).toBeDefined()
    expect(submitButton.attributes('aria-busy')).toBe('true')
  })

  it('renders selected employee details and forwards edit, blur-save, toggle-save, submit, delete, and back events', async () => {
    const wrapper = mountEditor({
      selectedEmployee: makeEmployee({
        active: false,
        isContractor: true,
      }),
      detailForm: makeForm({
        active: false,
        isContractor: true,
      }),
    })
    const inputs = wrapper.findAll('input.app-text-input')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')

    expect(wrapper.text()).toContain('Selected Employee')
    expect(wrapper.text()).toContain('Chris Larsen')
    expect(wrapper.text()).toContain('Contractor')
    expect(wrapper.text()).toContain('Inactive')
    expect(wrapper.text()).toContain('Employee #5133')
    expect(wrapper.text()).toContain('Delete Employee')
    expect(wrapper.text()).toContain('All changes saved')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('5133')
    expect((checkboxes[0]!.element as HTMLInputElement).checked).toBe(false)
    expect((checkboxes[1]!.element as HTMLInputElement).checked).toBe(true)

    await inputs[0]!.setValue('5134')
    await inputs[0]!.trigger('blur')
    await inputs[1]!.setValue('Christopher')
    await inputs[2]!.setValue('L')
    await inputs[3]!.setValue('Superintendent')
    await checkboxes[0]!.setValue(true)
    await checkboxes[1]!.setValue(false)
    await wrapper.get('form').trigger('submit')
    await wrapper.get('button.app-button--danger').trigger('click')
    await wrapper.get('.employees-detail__mobile-back').trigger('click')

    expect(wrapper.emitted('updateDetailTextField')).toEqual([
      ['employeeNumber', '5134'],
      ['firstName', 'Christopher'],
      ['lastName', 'L'],
      ['occupation', 'Superintendent'],
    ])
    expect(wrapper.emitted('detailFieldBlur')).toHaveLength(1)
    expect(wrapper.emitted('updateDetailBooleanField')).toEqual([
      ['active', true],
      ['isContractor', false],
    ])
    expect(wrapper.emitted('detailToggleChange')).toHaveLength(2)
    expect(wrapper.emitted('detailSubmit')).toHaveLength(1)
    expect(wrapper.emitted('deleteEmployee')).toHaveLength(1)
    expect(wrapper.emitted('backToDirectory')).toHaveLength(1)
  })

  it('locks detail edits and destructive actions while saving or deleting', () => {
    const savingWrapper = mountEditor({
      saveLoading: true,
    })
    const deletingWrapper = mountEditor({
      deleteLoading: true,
    })

    expect(savingWrapper.text()).toContain('Saving')
    expect(savingWrapper.findAll('input.app-text-input')[0]!.attributes('disabled')).toBeDefined()
    expect(savingWrapper.findAll('input[type="checkbox"]')[0]!.attributes('disabled')).toBeDefined()
    expect(savingWrapper.get('button.app-button--danger').attributes('disabled')).toBeDefined()

    const deleteButton = deletingWrapper.get('button.app-button--danger')
    expect(deleteButton.text()).toBe('Deleting...')
    expect(deleteButton.attributes('disabled')).toBeDefined()
    expect(deleteButton.attributes('aria-busy')).toBe('true')
  })
})
