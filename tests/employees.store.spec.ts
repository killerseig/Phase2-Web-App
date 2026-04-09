import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEmployeesStore } from '@/stores/employees'

vi.mock('@/services', () => ({
  createEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  listEmployees: vi.fn(),
  subscribeEmployees: vi.fn(),
  updateEmployee: vi.fn(),
}))

vi.mock('@/utils', () => ({
  logError: vi.fn(),
}))

import {
  createEmployee as createEmployeeService,
  listEmployees as listEmployeesService,
} from '@/services'

const createEmployeeMock = createEmployeeService as unknown as ReturnType<typeof vi.fn>
const listEmployeesMock = listEmployeesService as unknown as ReturnType<typeof vi.fn>

describe('employees store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates an employee and refreshes the directory list', async () => {
    const store = useEmployeesStore()
    createEmployeeMock.mockResolvedValue('employee-1')
    listEmployeesMock.mockResolvedValue([
      {
        id: 'employee-1',
        employeeNumber: '12045',
        firstName: 'Nicanor',
        lastName: 'Acevedo',
        occupation: 'Framer Rocker',
        active: true,
        wageRate: null,
      },
    ])

    const id = await store.createEmployeeRecord({
      employeeNumber: '12045',
      firstName: 'Nicanor',
      lastName: 'Acevedo',
      occupation: 'Framer Rocker',
      active: true,
      wageRate: null,
    })

    expect(id).toBe('employee-1')
    expect(createEmployeeMock).toHaveBeenCalledWith(expect.objectContaining({
      employeeNumber: '12045',
      firstName: 'Nicanor',
      lastName: 'Acevedo',
    }))
    expect(listEmployeesMock).toHaveBeenCalled()
    expect(store.employees).toHaveLength(1)
    expect(store.employees[0]).toMatchObject({ employeeNumber: '12045' })
    expect(store.error).toBeNull()
  })

  it('stores an error and rethrows when employee creation fails', async () => {
    const store = useEmployeesStore()
    createEmployeeMock.mockRejectedValue(new Error('duplicate employee number'))

    await expect(store.createEmployeeRecord({
      employeeNumber: '12045',
      firstName: 'Nicanor',
      lastName: 'Acevedo',
      occupation: 'Framer Rocker',
    })).rejects.toThrow('duplicate employee number')

    expect(store.error).toBe('duplicate employee number')
    expect(listEmployeesMock).not.toHaveBeenCalled()
  })
})
