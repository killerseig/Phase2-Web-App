import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminJobForemenCard from '@/components/admin/AdminJobForemenCard.vue'
import AdminJobManagementPanel from '@/components/admin/AdminJobManagementPanel.vue'
import AdminJobRosterCard from '@/components/admin/AdminJobRosterCard.vue'
import { createJobRosterForm } from '@/types/adminJobTeam'
import type { EmployeeDirectoryEmployee, Job, JobRosterEmployee } from '@/types/models'

const baseJob: Job = {
  id: 'job-1',
  name: 'Project One',
  code: '4197',
  projectManager: 'Jordan',
  foreman: 'Pat Foreman',
  gc: 'Turner',
  jobAddress: '123 Main St',
  startDate: '2026-04-01',
  finishDate: '2026-04-30',
  taxExempt: 'No',
  certified: 'No',
  cip: '2445',
  kjic: 'Yes',
  accountNumber: null,
  type: 'drywall',
  active: true,
  assignedForemanIds: ['foreman-1'],
  timecardStatus: 'pending',
  timecardPeriodEndDate: '2026-04-04',
}

const baseEmployee: JobRosterEmployee = {
  id: 'emp-1',
  jobId: 'job-1',
  employeeNumber: '1234',
  firstName: 'Taylor',
  lastName: 'Stone',
  occupation: 'Laborer',
  wageRate: 25,
  active: true,
}

const directoryEmployee: EmployeeDirectoryEmployee = {
  id: 'directory-1',
  employeeNumber: '9876',
  firstName: 'Avery',
  lastName: 'Lopez',
  occupation: 'Finisher',
  active: true,
  jobId: null,
}

describe('admin job management section components', () => {
  it('emits foreman assignment and row actions', async () => {
    const wrapper = mount(AdminJobForemenCard, {
      props: {
        assignedForemen: [
          {
            id: 'foreman-1',
            label: 'Pat Foreman',
            email: 'pat@example.com',
            active: true,
            isDisplayForeman: false,
            missing: false,
          },
        ],
        availableForemanOptions: [
          { id: 'foreman-2', label: 'Casey Foreman' },
        ],
        selectedForemanId: 'foreman-2',
        assigningForemanId: '',
        removingForemanId: '',
        settingDisplayForemanId: '',
        displayForeman: 'Pat Foreman',
      },
      global: {
        stubs: {
          SearchSelectField: {
            props: ['modelValue'],
            template: '<input class="foreman-select-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
        },
      },
    })

    await wrapper.get('.foreman-select-stub').setValue('foreman-3')
    await wrapper.get('button.btn-outline-primary').trigger('click')
    await wrapper.get('button.btn-outline-secondary').trigger('click')
    await wrapper.get('button.btn-outline-danger').trigger('click')

    expect(wrapper.emitted('update:selectedForemanId')).toEqual([['foreman-3']])
    expect(wrapper.emitted('assign')).toEqual([[]])
    expect(wrapper.emitted('set-display')).toEqual([['foreman-1']])
    expect(wrapper.emitted('remove')).toEqual([['foreman-1']])
  })

  it('emits roster form updates and employee row actions', async () => {
    const wrapper = mount(AdminJobRosterCard, {
      props: {
        employees: [baseEmployee],
        totalEmployeeCount: 1,
        searchTerm: '',
        availableEmployeeOptions: [
          { id: 'directory-1', label: 'Avery Lopez | #9876 | Finisher' },
        ],
        employeeDirectoryLoading: false,
        employeeDirectoryError: '',
        form: createJobRosterForm(),
        selectedEmployee: directoryEmployee,
        savingEmployee: false,
        togglingEmployeeId: '',
        removingEmployeeId: '',
      },
      global: {
        stubs: {
          SearchSelectField: {
            props: ['modelValue'],
            template: '<input class="employee-select-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
        },
      },
    })

    await wrapper.get('.employee-select-stub').setValue('directory-1')
    await wrapper.setProps({
      form: {
        ...createJobRosterForm(),
        selectedEmployeeId: 'directory-1',
      },
    })
    await wrapper.get('button.btn-outline-primary').trigger('click')
    await wrapper.get('button.btn-outline-secondary').trigger('click')
    await wrapper.get('button.btn-outline-danger').trigger('click')

    expect(wrapper.emitted('update:selectedEmployeeId')).toEqual([['directory-1']])
    expect(wrapper.emitted('submit')).toEqual([[]])
    expect(wrapper.emitted('toggle-employee')).toEqual([['emp-1']])
    expect(wrapper.emitted('remove-employee')).toEqual([['emp-1']])
  })

  it('emits foreman selection from the crew workspace', async () => {
    const wrapper = mount(AdminJobManagementPanel, {
      props: {
        job: baseJob,
        assignedForemen: [
          {
            id: 'foreman-1',
            label: 'Pat Foreman',
            email: 'pat@example.com',
            active: true,
            isDisplayForeman: true,
            missing: false,
          },
          {
            id: 'foreman-2',
            label: 'Casey Foreman',
            email: 'casey@example.com',
            active: true,
            isDisplayForeman: false,
            missing: false,
          },
        ],
        availableForemanOptions: [],
        selectedForemanId: 'foreman-1',
        assigningForemanId: '',
        removingForemanId: '',
        settingDisplayForemanId: '',
        rosterEmployees: [baseEmployee],
        totalRosterEmployees: 1,
        rosterSearchTerm: '',
        availableEmployeeOptions: [],
        employeeDirectoryLoading: false,
        employeeDirectoryError: '',
        rosterForm: createJobRosterForm(),
        selectedEmployee: null,
        savingRosterEmployee: false,
        togglingRosterEmployeeId: '',
        removingRosterEmployeeId: '',
      },
      global: {
        stubs: {
          SearchSelectField: {
            props: ['modelValue'],
            template: '<input class="foreman-picker-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
        },
      },
    })

    await wrapper.get('.foreman-picker-stub').setValue('foreman-2')
    await wrapper.setProps({ selectedForemanId: 'foreman-2' })
    await wrapper.get('button.btn-outline-primary').trigger('click')

    expect(wrapper.emitted('update:selectedForemanId')).toEqual([['foreman-2']])
    expect(wrapper.emitted('set-display-foreman')).toEqual([['foreman-2']])
  })

  it('shows the empty guidance state when no job is selected', () => {
    const wrapper = mount(AdminJobManagementPanel, {
      props: {
        job: null,
        assignedForemen: [],
        availableForemanOptions: [],
        selectedForemanId: '',
        assigningForemanId: '',
        removingForemanId: '',
        settingDisplayForemanId: '',
        rosterEmployees: [],
        totalRosterEmployees: 0,
        rosterSearchTerm: '',
        availableEmployeeOptions: [],
        employeeDirectoryLoading: false,
        employeeDirectoryError: '',
        rosterForm: createJobRosterForm(),
        selectedEmployee: null,
        savingRosterEmployee: false,
        togglingRosterEmployeeId: '',
        removingRosterEmployeeId: '',
      },
    })

    expect(wrapper.text()).toContain('Select a job from the browser to manage its crew.')
  })
})
