import { db } from '@/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import type { EmployeeDirectoryEmployee } from '@/types/models'
import { requireUser } from './serviceGuards'
import { normalizeError } from './serviceUtils'

type FirestoreLikeError = {
  code?: string
  message?: string
}

const asFirestoreLikeError = (error: unknown): FirestoreLikeError | null => {
  if (typeof error !== 'object' || error === null) return null
  return error as FirestoreLikeError
}

function normalize(id: string, data: DocumentData): EmployeeDirectoryEmployee {
  return {
    id,
    employeeNumber: data.employeeNumber ?? '',
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    occupation: data.occupation ?? '',
    active: data.active ?? true,
    jobId: data.jobId ?? null,
    wageRate: data.wageRate ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function sortEmployeesByName(employees: EmployeeDirectoryEmployee[]): EmployeeDirectoryEmployee[] {
  return employees.slice().sort((a, b) => {
    const lastNameCmp = a.lastName.localeCompare(b.lastName)
    if (lastNameCmp !== 0) return lastNameCmp
    const firstNameCmp = a.firstName.localeCompare(b.firstName)
    if (firstNameCmp !== 0) return firstNameCmp
    return a.employeeNumber.localeCompare(b.employeeNumber)
  })
}

async function assertUniqueEmployeeNumber(employeeNumber: string, excludeId?: string) {
  const existingEmployees = await listEmployees()
  const normalizedEmployeeNumber = employeeNumber.trim()
  const duplicate = existingEmployees.find(
    (employee) => employee.employeeNumber === normalizedEmployeeNumber && employee.id !== excludeId,
  )

  if (duplicate) {
    throw new Error(`Employee number ${normalizedEmployeeNumber} already exists`)
  }
}

export async function listEmployees(): Promise<EmployeeDirectoryEmployee[]> {
  requireUser()
  try {
    const q = query(
      collection(db, 'employees'),
      orderBy('lastName', 'asc'),
      orderBy('firstName', 'asc'),
    )
    const snap = await getDocs(q)
    return snap.docs.map((docSnap) => normalize(docSnap.id, docSnap.data()))
  } catch (error) {
    const firestoreError = asFirestoreLikeError(error)
    if (
      firestoreError?.code === 'failed-precondition'
      || firestoreError?.message?.includes('composite index')
    ) {
      const snap = await getDocs(query(collection(db, 'employees')))
      return sortEmployeesByName(snap.docs.map((docSnap) => normalize(docSnap.id, docSnap.data())))
    }
    throw new Error(normalizeError(error, 'Failed to load employees'))
  }
}

export function subscribeEmployees(
  onUpdate: (employees: EmployeeDirectoryEmployee[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  requireUser()
  return onSnapshot(
    query(collection(db, 'employees')),
    (snap) => {
      onUpdate(sortEmployeesByName(snap.docs.map((docSnap) => normalize(docSnap.id, docSnap.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createEmployee(input: {
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  active?: boolean
  jobId?: string | null
  wageRate?: number | null
}): Promise<string> {
  requireUser()
  try {
    await assertUniqueEmployeeNumber(input.employeeNumber)

    const ref = await addDoc(collection(db, 'employees'), {
      employeeNumber: input.employeeNumber.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      occupation: input.occupation.trim(),
      active: input.active ?? true,
      jobId: input.jobId?.trim() || null,
      wageRate: input.wageRate ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return ref.id
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error
    }
    throw new Error(normalizeError(error, 'Failed to create employee'))
  }
}

export async function updateEmployee(
  employeeId: string,
  updates: Partial<{
    employeeNumber: string
    firstName: string
    lastName: string
    occupation: string
    active: boolean
    jobId: string | null
    wageRate: number | null
  }>,
): Promise<void> {
  requireUser()
  try {
    if (updates.employeeNumber !== undefined) {
      await assertUniqueEmployeeNumber(updates.employeeNumber, employeeId)
    }

    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    }

    if (updates.employeeNumber !== undefined) payload.employeeNumber = updates.employeeNumber.trim()
    if (updates.firstName !== undefined) payload.firstName = updates.firstName.trim()
    if (updates.lastName !== undefined) payload.lastName = updates.lastName.trim()
    if (updates.occupation !== undefined) payload.occupation = updates.occupation.trim()
    if (updates.active !== undefined) payload.active = updates.active
    if (updates.jobId !== undefined) payload.jobId = updates.jobId?.trim() || null
    if (updates.wageRate !== undefined) payload.wageRate = updates.wageRate ?? null

    await updateDoc(doc(db, 'employees', employeeId), payload)
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error
    }
    throw new Error(normalizeError(error, 'Failed to update employee'))
  }
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  requireUser()
  try {
    await deleteDoc(doc(db, 'employees', employeeId))
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete employee'))
  }
}
