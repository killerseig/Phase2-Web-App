import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { requireFirebaseServices } from '@/firebase'
import { getTodayIsoDate, getWeekStartFromSaturday, snapToSaturday } from '@/features/timecards/workbook'
import { normalizeTimecardCardData, sanitizeTimecardCardPayload } from '@/services/timecards'
import type { EmployeeRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

export interface EmployeeInput {
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  wageRate: number | null
  active: boolean
  isContractor: boolean
}

function normalizeWageRate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeEmployee(id: string, data: DocumentData): EmployeeRecord {
  return {
    id,
    employeeNumber: typeof data.employeeNumber === 'string' ? data.employeeNumber : '',
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    occupation: typeof data.occupation === 'string' ? data.occupation : '',
    wageRate: normalizeWageRate(data.wageRate),
    active: data.active !== false,
    isContractor: data.isContractor === true,
    jobId: typeof data.jobId === 'string' && data.jobId.trim().length ? data.jobId : null,
  }
}

function sortEmployees(employees: EmployeeRecord[]): EmployeeRecord[] {
  return employees.slice().sort((left, right) => {
    const leftLast = left.lastName.toLowerCase()
    const rightLast = right.lastName.toLowerCase()
    if (leftLast !== rightLast) return leftLast.localeCompare(rightLast)

    const leftFirst = left.firstName.toLowerCase()
    const rightFirst = right.firstName.toLowerCase()
    if (leftFirst !== rightFirst) return leftFirst.localeCompare(rightFirst)

    return left.employeeNumber.localeCompare(right.employeeNumber)
  })
}

async function syncCurrentWeekDraftEmployeeCards(employeeId: string, input: EmployeeInput) {
  const { db } = requireFirebaseServices()
  const currentWeekEndDate = snapToSaturday(getTodayIsoDate())
  const trimmedFirstName = input.firstName.trim()
  const trimmedLastName = input.lastName.trim()
  const trimmedEmployeeNumber = input.employeeNumber.trim()
  const trimmedOccupation = input.occupation.trim()

  const weeksSnapshot = await getDocs(
    query(collection(db, 'timecardWeeks'), where('weekEndDate', '==', currentWeekEndDate)),
  )

  for (const weekEntry of weeksSnapshot.docs) {
    const weekData = weekEntry.data()
    if (weekData.status === 'submitted') continue

    const weekStartDate = typeof weekData.weekStartDate === 'string' && weekData.weekStartDate.trim().length
      ? weekData.weekStartDate
      : getWeekStartFromSaturday(currentWeekEndDate)

    const cardsSnapshot = await getDocs(
      query(
        collection(db, 'timecardWeeks', weekEntry.id, 'cards'),
        where('employeeId', '==', employeeId),
      ),
    )

    if (!cardsSnapshot.docs.length) continue

    const batch = writeBatch(db)
    let hasCardUpdates = false

    for (const cardEntry of cardsSnapshot.docs) {
      const card = normalizeTimecardCardData(cardEntry.id, cardEntry.data(), weekStartDate)
      if (card.sourceType === 'custom') continue

      const hasChanges = (
        card.firstName !== trimmedFirstName
        || card.lastName !== trimmedLastName
        || card.employeeNumber !== trimmedEmployeeNumber
        || card.occupation !== trimmedOccupation
        || !Object.is(card.wageRate, input.wageRate)
        || card.isContractor !== input.isContractor
      )

      if (!hasChanges) continue

      card.firstName = trimmedFirstName
      card.lastName = trimmedLastName
      card.employeeNumber = trimmedEmployeeNumber
      card.occupation = trimmedOccupation
      card.wageRate = input.wageRate
      card.isContractor = input.isContractor

      batch.update(
        doc(db, 'timecardWeeks', weekEntry.id, 'cards', card.id),
        sanitizeTimecardCardPayload(card, weekStartDate),
      )
      hasCardUpdates = true
    }

    if (!hasCardUpdates) continue

    batch.update(doc(db, 'timecardWeeks', weekEntry.id), {
      updatedAt: serverTimestamp(),
    })

    await batch.commit()
  }
}

async function listEmployees(): Promise<EmployeeRecord[]> {
  const { db } = requireFirebaseServices()
  const snapshot = await getDocs(query(collection(db, 'employees')))
  return sortEmployees(snapshot.docs.map((item) => normalizeEmployee(item.id, item.data())))
}

async function assertUniqueEmployeeNumber(employeeNumber: string, excludeId?: string) {
  const normalizedNumber = employeeNumber.trim()
  const existingEmployees = await listEmployees()
  const duplicate = existingEmployees.find(
    (employee) => employee.employeeNumber.trim() === normalizedNumber && employee.id !== excludeId,
  )

  if (duplicate) {
    throw new Error(`Employee number ${normalizedNumber} already exists.`)
  }
}

export function subscribeEmployees(
  onUpdate: (employees: EmployeeRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    query(collection(db, 'employees')),
    (snapshot) => {
      onUpdate(sortEmployees(snapshot.docs.map((item) => normalizeEmployee(item.id, item.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createEmployeeRecord(input: EmployeeInput): Promise<string> {
  try {
    const { db } = requireFirebaseServices()
    await assertUniqueEmployeeNumber(input.employeeNumber)

    const reference = await addDoc(collection(db, 'employees'), {
      employeeNumber: input.employeeNumber.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      occupation: input.occupation.trim(),
      wageRate: input.wageRate,
      active: input.active,
      isContractor: input.isContractor,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })

    return reference.id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to create employee.'))
  }
}

export async function updateEmployeeRecord(employeeId: string, input: EmployeeInput): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await assertUniqueEmployeeNumber(input.employeeNumber, employeeId)

    await updateDoc(doc(db, 'employees', employeeId), {
      employeeNumber: input.employeeNumber.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      occupation: input.occupation.trim(),
      wageRate: input.wageRate,
      active: input.active,
      isContractor: input.isContractor,
      updatedAt: serverTimestamp(),
    })

    await syncCurrentWeekDraftEmployeeCards(employeeId, input)
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update employee.'))
  }
}

export async function deleteEmployeeRecord(employeeId: string): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await deleteDoc(doc(db, 'employees', employeeId))
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete employee.'))
  }
}
