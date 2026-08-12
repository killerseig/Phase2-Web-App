import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import JobTimecardCreateTray from '@/components/timecards/JobTimecardCreateTray.vue'
import type { EmployeeRecord } from '@/types/domain'

const employee: EmployeeRecord = {
  id: 'employee-1',
  employeeNumber: '513',
  firstName: 'Chris',
  lastName: 'Larsen',
  occupation: 'Foreman',
  active: true,
  isContractor: false,
  jobId: null,
}

const EmployeePanelStub = {
  name: 'JobTimecardEmployeePanel',
  props: ['search', 'employees', 'loading', 'disabled'],
  emits: ['update-search', 'add-employee'],
  template: `
    <section data-testid="employee-panel">
      <button type="button" data-testid="emit-search" @click="$emit('update-search', 'vince')" />
      <button type="button" data-testid="emit-employee" @click="$emit('add-employee', employees[0])" />
    </section>
  `,
}

const CustomCardPanelStub = {
  name: 'JobTimecardCustomCardPanel',
  props: [
    'firstName',
    'lastName',
    'employeeNumber',
    'occupation',
    'wageRate',
    'isContractor',
    'disabled',
  ],
  emits: [
    'update-first-name',
    'update-last-name',
    'update-employee-number',
    'update-occupation',
    'update-wage-rate',
    'update-is-contractor',
    'add-custom-card',
  ],
  template: `
    <section data-testid="custom-panel">
      <button type="button" data-testid="emit-first-name" @click="$emit('update-first-name', 'Rocky')" />
      <button type="button" data-testid="emit-last-name" @click="$emit('update-last-name', 'Rodriguez')" />
      <button type="button" data-testid="emit-number" @click="$emit('update-employee-number', '9411')" />
      <button type="button" data-testid="emit-occupation" @click="$emit('update-occupation', 'Painter')" />
      <button type="button" data-testid="emit-wage" @click="$emit('update-wage-rate', '42.50')" />
      <button type="button" data-testid="emit-contractor" @click="$emit('update-is-contractor', true)" />
      <button type="button" data-testid="emit-add-custom" @click="$emit('add-custom-card')" />
    </section>
  `,
}

function mountTray(overrides = {}) {
  return mount(JobTimecardCreateTray, {
    props: {
      employeeSearch: 'chris',
      employees: [employee],
      employeesLoading: false,
      actionLoading: false,
      canEditWeek: true,
      customFirstName: 'Custom',
      customLastName: 'Employee',
      customEmployeeNumber: '0000',
      customOccupation: 'Helper',
      customWageRate: '25.00',
      customIsContractor: false,
      ...overrides,
    },
    global: {
      stubs: {
        JobTimecardEmployeePanel: EmployeePanelStub,
        JobTimecardCustomCardPanel: CustomCardPanelStub,
      },
    },
  })
}

describe('JobTimecardCreateTray', () => {
  it('forwards employee and custom-card state to child panels', () => {
    const wrapper = mountTray()

    const employeePanel = wrapper.getComponent({ name: 'JobTimecardEmployeePanel' })
    const customPanel = wrapper.getComponent({ name: 'JobTimecardCustomCardPanel' })

    expect(employeePanel.props()).toMatchObject({
      search: 'chris',
      employees: [employee],
      loading: false,
      disabled: false,
    })
    expect(customPanel.props()).toMatchObject({
      firstName: 'Custom',
      lastName: 'Employee',
      employeeNumber: '0000',
      occupation: 'Helper',
      wageRate: '25.00',
      isContractor: false,
      disabled: false,
    })
  })

  it('disables both panels while loading or when the selected week is read-only', () => {
    const loadingWrapper = mountTray({ actionLoading: true })
    const readOnlyWrapper = mountTray({ canEditWeek: false })

    expect(loadingWrapper.getComponent({ name: 'JobTimecardEmployeePanel' }).props('disabled')).toBe(true)
    expect(loadingWrapper.getComponent({ name: 'JobTimecardCustomCardPanel' }).props('disabled')).toBe(true)
    expect(readOnlyWrapper.getComponent({ name: 'JobTimecardEmployeePanel' }).props('disabled')).toBe(true)
    expect(readOnlyWrapper.getComponent({ name: 'JobTimecardCustomCardPanel' }).props('disabled')).toBe(true)
  })

  it('forwards child panel events to the parent contract', async () => {
    const wrapper = mountTray()

    await wrapper.get('[data-testid="emit-search"]').trigger('click')
    await wrapper.get('[data-testid="emit-employee"]').trigger('click')
    await wrapper.get('[data-testid="emit-first-name"]').trigger('click')
    await wrapper.get('[data-testid="emit-last-name"]').trigger('click')
    await wrapper.get('[data-testid="emit-number"]').trigger('click')
    await wrapper.get('[data-testid="emit-occupation"]').trigger('click')
    await wrapper.get('[data-testid="emit-wage"]').trigger('click')
    await wrapper.get('[data-testid="emit-contractor"]').trigger('click')
    await wrapper.get('[data-testid="emit-add-custom"]').trigger('click')

    expect(wrapper.emitted('updateEmployeeSearch')?.[0]).toEqual(['vince'])
    expect(wrapper.emitted('addEmployee')?.[0]).toEqual([employee])
    expect(wrapper.emitted('updateCustomFirstName')?.[0]).toEqual(['Rocky'])
    expect(wrapper.emitted('updateCustomLastName')?.[0]).toEqual(['Rodriguez'])
    expect(wrapper.emitted('updateCustomEmployeeNumber')?.[0]).toEqual(['9411'])
    expect(wrapper.emitted('updateCustomOccupation')?.[0]).toEqual(['Painter'])
    expect(wrapper.emitted('updateCustomWageRate')?.[0]).toEqual(['42.50'])
    expect(wrapper.emitted('updateCustomIsContractor')?.[0]).toEqual([true])
    expect(wrapper.emitted('addCustomCard')).toHaveLength(1)
  })
})
