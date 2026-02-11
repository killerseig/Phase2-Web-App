import { db } from '../firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

export type Employee = {
  id: string
  jobId?: string | null
  firstName: string
  lastName: string
  employeeNumber?: string
  occupation: string
  active: boolean
  createdAt?: any
  updatedAt?: any
}

export type EmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>

function normalize(id: string, data: any): Employee {
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

export async function listAllEmployees(): Promise<Employee[]> {
  const q = query(collection(db, 'employees'))
  const snap = await getDocs(q)
  const employees = snap.docs.map(d => normalize(d.id, d.data()))
  employees.sort((a, b) => {
    const lastNameCmp = a.lastName.localeCompare(b.lastName)
    return lastNameCmp !== 0 ? lastNameCmp : a.firstName.localeCompare(b.firstName)
  })
  return employees
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
  } catch (e: any) {
    // If composite index is missing, fall back to client-side sorting
    if (e.code === 'failed-precondition' || e.message?.includes('composite index')) {
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
    throw e
  }
}

export async function createEmployee(jobId: string | null, input: Omit<EmployeeInput, 'jobId'>): Promise<string> {
  const ref = await addDoc(collection(db, 'employees'), {
    jobId: jobId ?? null,
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateEmployee(employeeId: string, updates: Partial<Omit<EmployeeInput, 'jobId'>>) {
  const ref = doc(db, 'employees', employeeId)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteEmployee(employeeId: string) {
  const ref = doc(db, 'employees', employeeId)
  await deleteDoc(ref)
}
