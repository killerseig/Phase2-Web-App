import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportCreateTray from '@/components/timecards/TimecardExportCreateTray.vue'
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

const TargetPanelStub = {
  name: 'TimecardExportTargetPanel',
  props: ['jobId', 'jobOptions', 'foremanId', 'foremanOptions', 'targetWeekExists'],
  emits: ['update-job-id', 'update-foreman-id'],
  template: `
    <section data-testid="target-panel">
      <button type="button" data-testid="emit-job" @click="$emit('update-job-id', 'job-2')" />
      <button type="button" data-testid="emit-foreman" @click="$emit('update-foreman-id', 'foreman-2')" />
    </section>
  `,
}

const EmployeePanelStub = {
  name: 'TimecardExportEmployeePanel',
  props: ['search', 'employees', 'loading', 'searchDisabled', 'employeeDisabled'],
  emits: ['update-search', 'add-employee', 'create-one-off-card'],
  template: `
    <section data-testid="employee-panel">
      <button type="button" data-testid="emit-search" @click="$emit('update-search', 'vince')" />
      <button type="button" data-testid="emit-employee" @click="$emit('add-employee', employees[0])" />
      <button type="button" data-testid="emit-one-off" @click="$emit('create-one-off-card')" />
    </section>
  `,
}

const CustomCardPanelStub = {
  name: 'TimecardExportCustomCardPanel',
  props: [
    'firstName',
    'lastName',
    'employeeNumber',
    'occupation',
    'wageRate',
    'isContractor',
    'disabled',
    'addDisabled',
  ],
  emits: [
    'update-first-name',
    'update-last-name',
    'update-employee-number',
    'update-occupation',
    'update-wage-rate',
    'update-is-contractor',
    'add-custom-card',
    'back-to-employee-search',
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
      <button type="button" data-testid="emit-back" @click="$emit('back-to-employee-search')" />
    </section>
  `,
}

function mountTray(overrides = {}) {
  return mount(TimecardExportCreateTray, {
    props: {
      message: '',
      jobId: 'job-1',
      jobOptions: [{ id: 'job-1', label: '736 - Shop' }],
      foremanId: '',
      foremanOptions: [{ id: 'foreman-1', label: 'CJ Blanchard' }],
      targetWeekExists: true,
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
        TimecardExportTargetPanel: TargetPanelStub,
        TimecardExportEmployeePanel: EmployeePanelStub,
        TimecardExportCustomCardPanel: CustomCardPanelStub,
      },
    },
  })
}

describe('TimecardExportCreateTray', () => {
  it('renders only the notice when a create-tray message is present', () => {
    const wrapper = mountTray({ message: 'Choose a week before creating cards.' })

    expect(wrapper.text()).toContain('Choose a week before creating cards.')
    expect(wrapper.find('[data-testid="target-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="employee-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="custom-panel"]').exists()).toBe(false)
  })

  it('shows target and employee selection first, then reveals the one-off form', async () => {
    const wrapper = mountTray()

    expect(wrapper.getComponent({ name: 'TimecardExportTargetPanel' }).props()).toMatchObject({
      jobId: 'job-1',
      jobOptions: [{ id: 'job-1', label: '736 - Shop' }],
      foremanId: '',
      foremanOptions: [{ id: 'foreman-1', label: 'CJ Blanchard' }],
      targetWeekExists: true,
    })
    expect(wrapper.getComponent({ name: 'TimecardExportEmployeePanel' }).props()).toMatchObject({
      search: 'chris',
      employees: [employee],
      loading: false,
      searchDisabled: false,
      employeeDisabled: false,
    })
    expect(wrapper.findComponent({ name: 'TimecardExportCustomCardPanel' }).exists()).toBe(false)

    await wrapper.get('[data-testid="emit-one-off"]').trigger('click')
    expect(wrapper.getComponent({ name: 'TimecardExportCustomCardPanel' }).props()).toMatchObject({
      firstName: 'Custom',
      lastName: 'Employee',
      employeeNumber: '0000',
      occupation: 'Helper',
      wageRate: '25.00',
      isContractor: false,
      disabled: false,
      addDisabled: false,
    })

    await wrapper.get('[data-testid="emit-back"]').trigger('click')
    expect(wrapper.findComponent({ name: 'TimecardExportEmployeePanel' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'TimecardExportCustomCardPanel' }).exists()).toBe(false)
  })

  it('requires a target job and either an existing week or selected foreman before card creation', async () => {
    const noTarget = mountTray({ jobId: '', targetWeekExists: true, foremanId: '' })
    const needsForeman = mountTray({ jobId: 'job-1', targetWeekExists: false, foremanId: '' })
    const hasForeman = mountTray({ jobId: 'job-1', targetWeekExists: false, foremanId: 'foreman-1' })

    expect(noTarget.getComponent({ name: 'TimecardExportEmployeePanel' }).props('employeeDisabled')).toBe(true)
    expect(needsForeman.getComponent({ name: 'TimecardExportEmployeePanel' }).props('employeeDisabled')).toBe(true)
    expect(hasForeman.getComponent({ name: 'TimecardExportEmployeePanel' }).props('employeeDisabled')).toBe(false)

    await noTarget.get('[data-testid="emit-one-off"]').trigger('click')
    await needsForeman.get('[data-testid="emit-one-off"]').trigger('click')
    await hasForeman.get('[data-testid="emit-one-off"]').trigger('click')
    expect(noTarget.getComponent({ name: 'TimecardExportCustomCardPanel' }).props('addDisabled')).toBe(true)
    expect(needsForeman.getComponent({ name: 'TimecardExportCustomCardPanel' }).props('addDisabled')).toBe(true)
    expect(hasForeman.getComponent({ name: 'TimecardExportCustomCardPanel' }).props('addDisabled')).toBe(false)
  })

  it('disables search, fields, and create actions while loading or read-only', async () => {
    const loadingWrapper = mountTray({ actionLoading: true })
    const readOnlyWrapper = mountTray({ canEditWeek: false })

    expect(loadingWrapper.getComponent({ name: 'TimecardExportEmployeePanel' }).props('searchDisabled')).toBe(true)
    expect(loadingWrapper.getComponent({ name: 'TimecardExportEmployeePanel' }).props('employeeDisabled')).toBe(true)
    expect(readOnlyWrapper.getComponent({ name: 'TimecardExportEmployeePanel' }).props('searchDisabled')).toBe(true)
    expect(readOnlyWrapper.getComponent({ name: 'TimecardExportEmployeePanel' }).props('employeeDisabled')).toBe(true)

    const oneOffWrapper = mountTray()
    await oneOffWrapper.get('[data-testid="emit-one-off"]').trigger('click')
    await oneOffWrapper.setProps({ actionLoading: true })
    expect(oneOffWrapper.getComponent({ name: 'TimecardExportCustomCardPanel' }).props('disabled')).toBe(true)
    expect(oneOffWrapper.getComponent({ name: 'TimecardExportCustomCardPanel' }).props('addDisabled')).toBe(true)
    await oneOffWrapper.setProps({ actionLoading: false, canEditWeek: false })
    expect(oneOffWrapper.getComponent({ name: 'TimecardExportCustomCardPanel' }).props('disabled')).toBe(true)
    expect(oneOffWrapper.getComponent({ name: 'TimecardExportCustomCardPanel' }).props('addDisabled')).toBe(true)
  })

  it('forwards child panel events to the parent contract', async () => {
    const wrapper = mountTray()

    await wrapper.get('[data-testid="emit-job"]').trigger('click')
    await wrapper.get('[data-testid="emit-foreman"]').trigger('click')
    await wrapper.get('[data-testid="emit-search"]').trigger('click')
    await wrapper.get('[data-testid="emit-employee"]').trigger('click')
    await wrapper.get('[data-testid="emit-one-off"]').trigger('click')
    await wrapper.get('[data-testid="emit-first-name"]').trigger('click')
    await wrapper.get('[data-testid="emit-last-name"]').trigger('click')
    await wrapper.get('[data-testid="emit-number"]').trigger('click')
    await wrapper.get('[data-testid="emit-occupation"]').trigger('click')
    await wrapper.get('[data-testid="emit-wage"]').trigger('click')
    await wrapper.get('[data-testid="emit-contractor"]').trigger('click')
    await wrapper.get('[data-testid="emit-add-custom"]').trigger('click')

    expect(wrapper.emitted('updateJobId')?.[0]).toEqual(['job-2'])
    expect(wrapper.emitted('updateForemanId')?.[0]).toEqual(['foreman-2'])
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
