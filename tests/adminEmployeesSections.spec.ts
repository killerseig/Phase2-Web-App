import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminEmployeesTableCard from '@/components/admin/AdminEmployeesTableCard.vue'
import type { EmployeeDirectoryEmployee } from '@/types/models'

const occupationOptions = [
  { value: 'Framer Rocker', label: 'Framer Rocker' },
  { value: 'Shop Mechanic', label: 'Shop Mechanic' },
] as const

const baseEmployee: EmployeeDirectoryEmployee = {
  id: 'employee-1',
  employeeNumber: '12045',
  firstName: 'Nicanor U',
  lastName: 'Acevedo',
  occupation: 'Framer Rocker',
  active: true,
  wageRate: null,
}

describe('admin employee section components', () => {
  it('emits merged create-form updates from the inline create row', async () => {
    const wrapper = mount(AdminEmployeesTableCard, {
      props: {
        employees: [],
        loading: false,
        error: '',
        editingEmployeeId: null,
        editForm: {
          employeeNumber: '',
          firstName: '',
          lastName: '',
          occupation: '',
          wageRate: '',
          active: true,
        },
        savingEmployeeEdit: false,
        activeEmployeeActionsId: '',
        sortKey: 'lastName',
        sortDir: 'asc',
        occupationOptions,
        createForm: {
          employeeNumber: '',
          firstName: '',
          lastName: '',
          occupation: '',
          wageRate: '',
          active: true,
        },
        showInlineCreate: true,
        creatingEmployee: false,
      },
    })

    await wrapper.get('input[placeholder="1234"]').setValue('12345')
    await wrapper.get('button[title="Cancel new employee"]').trigger('click')

    expect(wrapper.emitted('update:createForm')?.[0]?.[0]).toMatchObject({
      employeeNumber: '12345',
      active: true,
    })
    expect(wrapper.emitted('cancel-create')).toBeTruthy()
  })

  it('emits edit and delete actions for an active row editor', async () => {
    const wrapper = mount(AdminEmployeesTableCard, {
      props: {
        employees: [baseEmployee],
        loading: false,
        error: '',
        editingEmployeeId: 'employee-1',
        editForm: {
          employeeNumber: baseEmployee.employeeNumber,
          firstName: baseEmployee.firstName,
          lastName: baseEmployee.lastName,
          occupation: baseEmployee.occupation,
          wageRate: '',
          active: true,
        },
        savingEmployeeEdit: false,
        activeEmployeeActionsId: 'employee-1',
        sortKey: 'lastName',
        sortDir: 'asc',
        occupationOptions,
        createForm: {
          employeeNumber: '',
          firstName: '',
          lastName: '',
          occupation: '',
          wageRate: '',
          active: true,
        },
        showInlineCreate: false,
        creatingEmployee: false,
      },
    })

    await wrapper.get('input[placeholder="Last name"]').setValue('Avila')
    await wrapper.get('button[title="Delete employee"]').trigger('click')

    expect(wrapper.emitted('update:editForm')?.[0]?.[0]).toMatchObject({ lastName: 'Avila' })
    expect(wrapper.emitted('delete-employee')?.[0]?.[0]).toMatchObject({ id: 'employee-1' })
  })
})
