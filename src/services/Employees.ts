import { db } from '@/firebase'
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
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
