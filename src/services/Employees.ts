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
  where,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore'
import { normalizeError } from './serviceUtils'

export type Employee = {
  id: string
  jobId?: string | null
  firstName: string
  lastName: string
  employeeNumber?: string
  occupation: string
  active: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

export type EmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>

type FirestoreLikeError = {
  code?: string
  message?: string
}

const asFirestoreLikeError = (error: unknown): FirestoreLikeError | null => {
  if (typeof error !== 'object' || error === null) return null
  return error as FirestoreLikeError
}

function normalize(id: string, data: DocumentData): Employee {
  return {
    id,
    jobId: data.jobId,
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    employeeNumber: data.employeeNumber,
    occupation: data.occupation ?? '',
    active: data.active ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function sortEmployeesByName(employees: Employee[]): Employee[] {
  return employees.slice().sort((a, b) => {
    const lastNameCmp = a.lastName.localeCompare(b.lastName)
    return lastNameCmp !== 0 ? lastNameCmp : a.firstName.localeCompare(b.firstName)
  })
}

export async function listAllEmployees(): Promise<Employee[]> {
  try {
    const q = query(collection(db, 'employees'))
    const snap = await getDocs(q)
    return sortEmployeesByName(snap.docs.map((d) => normalize(d.id, d.data())))
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load employees'))
  }
}

export function subscribeAllEmployees(
  onUpdate: (employees: Employee[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'employees'))
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(sortEmployeesByName(snap.docs.map((d) => normalize(d.id, d.data()))))
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function listEmployeesByJob(jobId: string): Promise<Employee[]> {
  try {
    const q = query(
      collection(db, 'employees'),
      where('jobId', '==', jobId),
      orderBy('lastName', 'asc'),
      orderBy('firstName', 'asc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => normalize(d.id, d.data()))
  } catch (e) {
    // If composite index is missing, fall back to client-side sorting
    const firestoreError = asFirestoreLikeError(e)
    if (
      firestoreError?.code === 'failed-precondition' ||
      firestoreError?.message?.includes('composite index')
    ) {
      const q = query(
        collection(db, 'employees'),
        where('jobId', '==', jobId)
      )
      const snap = await getDocs(q)
      const employees = snap.docs.map(d => normalize(d.id, d.data()))
      employees.sort((a, b) => {
        const lastNameCmp = a.lastName.localeCompare(b.lastName)
        return lastNameCmp !== 0 ? lastNameCmp : a.firstName.localeCompare(b.firstName)
      })
      return employees
    }
    throw new Error(normalizeError(e, 'Failed to load employees'))
  }
}

export function subscribeEmployeesByJob(
  jobId: string,
  onUpdate: (employees: Employee[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'employees'), where('jobId', '==', jobId))
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(sortEmployeesByName(snap.docs.map((d) => normalize(d.id, d.data()))))
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function createEmployee(jobId: string | null, input: Omit<EmployeeInput, 'jobId'>): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'employees'), {
      jobId: jobId ?? null,
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to create employee'))
  }
}

export async function updateEmployee(employeeId: string, updates: Partial<Omit<EmployeeInput, 'jobId'>>) {
  try {
    const ref = doc(db, 'employees', employeeId)
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update employee'))
  }
}

export async function deleteEmployee(employeeId: string) {
  try {
    const ref = doc(db, 'employees', employeeId)
    await deleteDoc(ref)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to delete employee'))
  }
}

