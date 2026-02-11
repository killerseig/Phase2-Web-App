/**
 * Job Roster Service
 * Manages job-scoped employee rosters (replaces global employees)
 * Location: jobs/{jobId}/roster/{employeeId}
 */

import { auth, db } from '../firebase'
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
  Timestamp,
} from 'firebase/firestore'
import type { JobRosterEmployee, JobRosterEmployeeInput } from '@/types/models'

/**
 * Normalize Firestore document to JobRosterEmployee type
 */
function normalize(id: string, data: any): JobRosterEmployee {
  return {
    id,
    jobId: data.jobId,
    
    // Identity
    employeeNumber: data.employeeNumber ?? '',
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    
    // Job info
    occupation: data.occupation ?? '',
    contractor: data.contractor
      ? {
          name: data.contractor.name,
          category: data.contractor.category,
        }
      : undefined,
    
    // Compensation
    wageRate: data.wageRate,
    unitCost: data.unitCost,
    
    // Status
    active: data.active ?? true,
    
    // Metadata
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    addedByUid: data.addedByUid,
  }
}

/**
 * Helper to require authenticated user
 */
function requireUser() {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u
}

/**
 * List all employees in a job roster, sorted by lastName, firstName
 */
export async function listRosterEmployees(jobId: string): Promise<JobRosterEmployee[]> {
  try {
    // Try with composite index first
    const q = query(
      collection(db, `jobs/${jobId}/roster`),
      orderBy('lastName', 'asc'),
      orderBy('firstName', 'asc')
    )
    const snap = await getDocs(q)
    return snap.docs.map(d => normalize(d.id, d.data()))
  } catch (e: any) {
    // Fallback to client-side sorting if composite index missing
    if (e.code === 'failed-precondition' || e.message?.includes('composite index')) {
      const q = query(collection(db, `jobs/${jobId}/roster`))
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

/**
 * List active employees only (for timecard assignment)
 */
export async function listActiveRosterEmployees(jobId: string): Promise<JobRosterEmployee[]> {
  const all = await listRosterEmployees(jobId)
  return all.filter(e => e.active)
}

/**
 * Add an employee to a job roster
 * Validates that employee number is unique within the job
 */
export async function addRosterEmployee(
  jobId: string,
  employee: JobRosterEmployeeInput
): Promise<string> {
  const u = requireUser()
  
  // Validate employee number is unique within this job
  const existing = await listRosterEmployees(jobId)
  const isDuplicate = existing.some(e => e.employeeNumber === employee.employeeNumber)
  if (isDuplicate) {
    throw new Error(`Employee number ${employee.employeeNumber} already exists in this job`)
  }
  
  // Create the document
  const ref = await addDoc(collection(db, `jobs/${jobId}/roster`), {
    jobId,
    
    // Identity
    employeeNumber: employee.employeeNumber.trim(),
    firstName: employee.firstName.trim(),
    lastName: employee.lastName.trim(),
    
    // Job info
    occupation: employee.occupation.trim(),
    contractor: employee.contractor,
    
    // Compensation
    wageRate: employee.wageRate ?? null,
    unitCost: employee.unitCost ?? null,
    
    // Status
    active: employee.active ?? true,
    
    // Metadata
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    addedByUid: u.uid,
  })
  
  return ref.id
}

/**
 * Update an employee in the job roster
 */
export async function updateRosterEmployee(
  jobId: string,
  employeeId: string,
  updates: Partial<JobRosterEmployeeInput>
): Promise<void> {
  // Validate if employee number is being changed to unique value
  if (updates.employeeNumber) {
    const existing = await listRosterEmployees(jobId)
    const isDuplicate = existing.some(
      e => e.employeeNumber === updates.employeeNumber && e.id !== employeeId
    )
    if (isDuplicate) {
      throw new Error(`Employee number ${updates.employeeNumber} already exists in this job`)
    }
  }
  
  const ref = doc(db, `jobs/${jobId}/roster`, employeeId)
  const payload: any = {}
  
  if ('employeeNumber' in updates) payload.employeeNumber = updates.employeeNumber?.trim()
  if ('firstName' in updates) payload.firstName = updates.firstName?.trim()
  if ('lastName' in updates) payload.lastName = updates.lastName?.trim()
  if ('occupation' in updates) payload.occupation = updates.occupation?.trim()
  if ('contractor' in updates) payload.contractor = updates.contractor
  if ('wageRate' in updates) payload.wageRate = updates.wageRate ?? null
  if ('unitCost' in updates) payload.unitCost = updates.unitCost ?? null
  if ('active' in updates) payload.active = updates.active
  
  payload.updatedAt = serverTimestamp()
  
  await updateDoc(ref, payload)
}

/**
 * Remove an employee from the job roster
 */
export async function removeRosterEmployee(jobId: string, employeeId: string): Promise<void> {
  const ref = doc(db, `jobs/${jobId}/roster`, employeeId)
  await deleteDoc(ref)
}

/**
 * Get a single roster employee by ID
 */
export async function getRosterEmployee(jobId: string, employeeId: string): Promise<JobRosterEmployee | null> {
  const ref = doc(db, `jobs/${jobId}/roster`, employeeId)
  // Note: Using getDoc when available from firestore
  const { getDoc } = await import('firebase/firestore')
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return normalize(snap.id, snap.data())
}

/**
 * Search roster employees by name
 */
export async function searchRosterEmployees(jobId: string, searchTerm: string): Promise<JobRosterEmployee[]> {
  const all = await listRosterEmployees(jobId)
  const term = searchTerm.toLowerCase()
  
  return all.filter(
    e =>
      e.firstName.toLowerCase().includes(term) ||
      e.lastName.toLowerCase().includes(term) ||
      e.employeeNumber.includes(term) ||
      e.occupation.toLowerCase().includes(term)
  )
}

/**
 * Get roster statistics for a job
 */
export async function getRosterStats(jobId: string): Promise<{
  total: number
  active: number
  inactive: number
  withContractors: number
}> {
  const all = await listRosterEmployees(jobId)
  
  return {
    total: all.length,
    active: all.filter(e => e.active).length,
    inactive: all.filter(e => !e.active).length,
    withContractors: all.filter(e => e.contractor).length,
  }
}

/**
 * Export roster to CSV format
 * Used for reports or external systems
 */
export async function exportRosterToCsv(jobId: string): Promise<string> {
  const employees = await listRosterEmployees(jobId)
  
  // CSV header
  const headers = [
    'Employee #',
    'First Name',
    'Last Name',
    'Occupation',
    'Contractor',
    'Contractor Category',
    'Wage Rate',
    'Unit Cost',
    'Status',
  ]
  
  // CSV rows
  const rows = employees.map(e => [
    e.employeeNumber,
    e.firstName,
    e.lastName,
    e.occupation,
    e.contractor?.name || '',
    e.contractor?.category || '',
    e.wageRate?.toString() || '',
    e.unitCost?.toString() || '',
    e.active ? 'Active' : 'Inactive',
  ])
  
  // Combine with proper escaping
  const csv = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(r => r.map(v => `"${v}"`).join(',')),
  ].join('\n')
  
  return csv
}
