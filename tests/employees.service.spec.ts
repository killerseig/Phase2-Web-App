import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEmployee,
  updateEmployee,
} from '@/services/Employees'
import {
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { makeQuerySnapshot } from './helpers/firestoreMocks'

vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

vi.mock('@/services/serviceGuards', () => ({
  requireUser: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const addDocMock = addDoc as unknown as MockFn
const getDocsMock = getDocs as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn

describe('Employees service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an employee with trimmed fields and defaults', async () => {
    getDocsMock.mockResolvedValue(makeQuerySnapshot([]))
    addDocMock.mockResolvedValue({ id: 'employee-1' })

    const id = await createEmployee({
      employeeNumber: ' 12045 ',
      firstName: ' Nicanor ',
      lastName: ' Acevedo ',
      occupation: ' Framer Rocker ',
    })

    expect(id).toBe('employee-1')
    expect(query).toHaveBeenCalled()
    expect(orderBy).toHaveBeenCalledWith('lastName', 'asc')
    expect(orderBy).toHaveBeenCalledWith('firstName', 'asc')

    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload).toMatchObject({
      employeeNumber: '12045',
      firstName: 'Nicanor',
      lastName: 'Acevedo',
      occupation: 'Framer Rocker',
      active: true,
      jobId: null,
      wageRate: null,
    })
    expect(serverTimestamp).toHaveBeenCalled()
  })

  it('prevents duplicate employee numbers on create', async () => {
    getDocsMock.mockResolvedValue(
      makeQuerySnapshot([
        {
          id: 'existing',
          data: {
            employeeNumber: '12045',
            firstName: 'Nicanor',
            lastName: 'Acevedo',
            occupation: 'Framer Rocker',
            active: true,
          },
        },
      ]),
    )

    await expect(createEmployee({
      employeeNumber: '12045',
      firstName: 'Another',
      lastName: 'Person',
      occupation: 'Foreman',
    })).rejects.toThrow(/already exists/)

    expect(addDocMock).not.toHaveBeenCalled()
  })

  it('updates only provided employee fields and trims strings', async () => {
    getDocsMock.mockResolvedValue(makeQuerySnapshot([]))
    updateDocMock.mockResolvedValue(undefined)

    await updateEmployee('employee-1', {
      firstName: ' Jane ',
      occupation: ' Shop Mechanic ',
      wageRate: 27.5,
      active: false,
    })

    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload).toMatchObject({
      firstName: 'Jane',
      occupation: 'Shop Mechanic',
      wageRate: 27.5,
      active: false,
      updatedAt: 'ts',
    })
  })
})
