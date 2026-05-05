import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import {
  DEFAULT_TIMECARD_BURDEN,
  buildCardDisplayName,
  buildEmployeeCard,
  getWeekStartFromSaturday,
  recalculateCardTotals,
  type TimecardEmployeeSeed,
} from '@/features/timecards/workbook'
import type {
  TimecardCardRecord,
  TimecardWeekRecord,
  TimecardWeekStatus,
} from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

export interface EnsureTimecardWeekInput {
  jobId: string
  jobCode: string | null
  jobName: string | null
  ownerForemanUserId: string | null
  ownerForemanName: string | null
  weekEndDate: string
}

export interface TimecardWeekActor {
  userId: string | null
  displayName: string | null
}

function toNullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

function toSafeStatus(value: unknown): TimecardWeekStatus {
  return value === 'submitted' ? 'submitted' : 'draft'
}

function toSafeNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return Math.max(0, parsed)
}

function normalizeWeek(id: string, data: DocumentData): TimecardWeekRecord {
  return {
    id,
    jobId: typeof data.jobId === 'string' ? data.jobId : '',
    jobCode: toNullableText(data.jobCode),
    jobName: toNullableText(data.jobName),
    ownerForemanUserId: toNullableText(data.ownerForemanUserId),
    ownerForemanName: toNullableText(data.ownerForemanName),
    weekStartDate: typeof data.weekStartDate === 'string' ? data.weekStartDate : '',
    weekEndDate: typeof data.weekEndDate === 'string' ? data.weekEndDate : '',
    status: toSafeStatus(data.status),
    employeeCardCount: toSafeNumber(data.employeeCardCount),
    submittedAt: data.submittedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export function normalizeTimecardCardData(
  id: string,
  data: DocumentData,
  weekStartDate: string,
  burden = DEFAULT_TIMECARD_BURDEN,
): TimecardCardRecord {
  const normalized: TimecardCardRecord = {
    id,
    sourceType: data.sourceType === 'custom' ? 'custom' : 'employee',
    employeeId: toNullableText(data.employeeId),
    firstName: typeof data.firstName === 'string' ? data.firstName : '',
    lastName: typeof data.lastName === 'string' ? data.lastName : '',
    fullName: typeof data.fullName === 'string' ? data.fullName : '',
    employeeNumber: typeof data.employeeNumber === 'string' ? data.employeeNumber : '',
    occupation: typeof data.occupation === 'string' ? data.occupation : '',
    wageRate: data.wageRate == null ? null : toSafeNumber(data.wageRate),
    isContractor: data.isContractor === true,
    sortIndex: toSafeNumber(data.sortIndex),
    lines: Array.isArray(data.lines) ? data.lines : [],
    footerJobOrGl: typeof data.footerJobOrGl === 'string' ? data.footerJobOrGl : '',
    footerAccount: typeof data.footerAccount === 'string' ? data.footerAccount : '',
    footerOffice: typeof data.footerOffice === 'string' ? data.footerOffice : '',
    footerAmount: typeof data.footerAmount === 'string' ? data.footerAmount : '',
    footerSecondJobOrGl: typeof data.footerSecondJobOrGl === 'string' ? data.footerSecondJobOrGl : '',
    footerSecondAccount: typeof data.footerSecondAccount === 'string' ? data.footerSecondAccount : '',
    footerSecondOffice: typeof data.footerSecondOffice === 'string' ? data.footerSecondOffice : '',
    footerSecondAmount: typeof data.footerSecondAmount === 'string' ? data.footerSecondAmount : '',
    notes: typeof data.notes === 'string' ? data.notes : '',
    regularHoursOverride: data.regularHoursOverride == null ? null : toSafeNumber(data.regularHoursOverride),
    overtimeHoursOverride: data.overtimeHoursOverride == null ? null : toSafeNumber(data.overtimeHoursOverride),
    totals: {
      hoursByDay: Array.isArray(data.totals?.hoursByDay) ? data.totals.hoursByDay.map((entry: unknown) => toSafeNumber(entry)) : Array(7).fill(0),
      productionByDay: Array.isArray(data.totals?.productionByDay) ? data.totals.productionByDay.map((entry: unknown) => toSafeNumber(entry)) : Array(7).fill(0),
      hoursTotal: toSafeNumber(data.totals?.hoursTotal),
      productionTotal: toSafeNumber(data.totals?.productionTotal),
      lineTotal: toSafeNumber(data.totals?.lineTotal),
    },
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }

  recalculateCardTotals(normalized, weekStartDate, burden)
  normalized.fullName = buildCardDisplayName(normalized)
  return normalized
}

function sortWeeks(weeks: TimecardWeekRecord[]) {
  return weeks.slice().sort((left, right) => (
    right.weekEndDate.localeCompare(left.weekEndDate)
    || right.id.localeCompare(left.id)
  ))
}

function sortCards(cards: TimecardCardRecord[]) {
  return cards.slice().sort((left, right) => (
    left.sortIndex - right.sortIndex
    || buildCardDisplayName(left).localeCompare(buildCardDisplayName(right))
    || left.id.localeCompare(right.id)
  ))
}

export function sanitizeTimecardCardPayload(
  card: Omit<TimecardCardRecord, 'id'> | TimecardCardRecord,
  weekStartDate: string,
  burden = DEFAULT_TIMECARD_BURDEN,
  options?: { includeUpdatedAt?: boolean },
) {
  const snapshot: TimecardCardRecord = {
    ...card,
    id: 'id' in card ? card.id : 'new',
    fullName: buildCardDisplayName(card as TimecardCardRecord),
    lines: Array.isArray(card.lines) ? card.lines : [],
    totals: card.totals,
  }

  recalculateCardTotals(snapshot, weekStartDate, burden)

  const payload: Record<string, unknown> = {
    sourceType: snapshot.sourceType === 'custom' ? 'custom' : 'employee',
    employeeId: toNullableText(snapshot.employeeId),
    firstName: snapshot.firstName.trim(),
    lastName: snapshot.lastName.trim(),
    fullName: buildCardDisplayName(snapshot),
    employeeNumber: snapshot.employeeNumber.trim(),
    occupation: snapshot.occupation.trim(),
    wageRate: snapshot.wageRate == null ? null : toSafeNumber(snapshot.wageRate),
    isContractor: !!snapshot.isContractor,
    sortIndex: toSafeNumber(snapshot.sortIndex),
    lines: snapshot.lines,
    footerJobOrGl: snapshot.footerJobOrGl.trim(),
    footerAccount: snapshot.footerAccount.trim(),
    footerOffice: snapshot.footerOffice.trim(),
    footerAmount: snapshot.footerAmount.trim(),
    footerSecondJobOrGl: snapshot.footerSecondJobOrGl.trim(),
    footerSecondAccount: snapshot.footerSecondAccount.trim(),
    footerSecondOffice: snapshot.footerSecondOffice.trim(),
    footerSecondAmount: snapshot.footerSecondAmount.trim(),
    notes: snapshot.notes.trim(),
    regularHoursOverride: snapshot.regularHoursOverride == null ? null : toSafeNumber(snapshot.regularHoursOverride),
    overtimeHoursOverride: snapshot.overtimeHoursOverride == null ? null : toSafeNumber(snapshot.overtimeHoursOverride),
    totals: snapshot.totals,
  }

  if (options?.includeUpdatedAt !== false) {
    payload.updatedAt = new Date()
  }

  return payload
}

export function subscribeTimecardWeeks(
  jobId: string,
  onUpdate: (weeks: TimecardWeekRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    query(collection(db, 'timecardWeeks'), where('jobId', '==', jobId)),
    (snapshot) => {
      onUpdate(sortWeeks(snapshot.docs.map((entry) => normalizeWeek(entry.id, entry.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export function subscribeAllTimecardWeeks(
  onUpdate: (weeks: TimecardWeekRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    collection(db, 'timecardWeeks'),
    (snapshot) => {
      onUpdate(sortWeeks(snapshot.docs.map((entry) => normalizeWeek(entry.id, entry.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export function subscribeTimecardCards(
  weekId: string,
  weekStartDate: string,
  burden: number,
  onUpdate: (cards: TimecardCardRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    collection(db, 'timecardWeeks', weekId, 'cards'),
    (snapshot) => {
      onUpdate(sortCards(snapshot.docs.map((entry) => normalizeTimecardCardData(entry.id, entry.data(), weekStartDate, burden))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function ensureTimecardWeek(input: EnsureTimecardWeekInput): Promise<string> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<EnsureTimecardWeekInput, { id: string }>(functions, 'ensureTimecardWeekRecord')
    const result = await callable(input)
    const id = String(result.data?.id || '').trim()
    if (!id) {
      throw new Error('Timecard week did not return an id.')
    }

    return id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to open the timecard week.'))
  }
}

export async function createTimecardCard(
  weekId: string,
  weekStartDate: string,
  employee: TimecardEmployeeSeed,
  sortIndex: number,
  linkedJobNumber?: string | null,
): Promise<string> {
  try {
    const { functions } = requireFirebaseServices()
    const card = buildEmployeeCard(employee, getWeekEndDateFromStart(weekStartDate), sortIndex, linkedJobNumber ?? '')
    const callable = httpsCallable<
      {
        weekId: string
        weekStartDate: string
        card: Record<string, unknown>
      },
      { id: string }
    >(functions, 'createTimecardCardRecord')

    const result = await callable({
      weekId,
      weekStartDate,
      card: sanitizeTimecardCardPayload(card, weekStartDate, DEFAULT_TIMECARD_BURDEN, { includeUpdatedAt: false }),
    })

    const id = String(result.data?.id || '').trim()
    if (!id) {
      throw new Error('Timecard card did not return an id.')
    }

    return id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to add the employee card.'))
  }
}

function getWeekEndDateFromStart(weekStartDate: string) {
  const start = new Date(`${weekStartDate}T00:00:00`)
  start.setDate(start.getDate() + 6)
  const year = start.getFullYear()
  const month = String(start.getMonth() + 1).padStart(2, '0')
  const day = String(start.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function updateTimecardCard(
  weekId: string,
  cardId: string,
  weekStartDate: string,
  card: TimecardCardRecord,
  burden = DEFAULT_TIMECARD_BURDEN,
): Promise<void> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<
      {
        weekId: string
        cardId: string
        weekStartDate: string
        card: Record<string, unknown>
      },
      { success: boolean }
    >(functions, 'updateTimecardCardRecord')

    await callable({
      weekId,
      cardId,
      weekStartDate,
      card: sanitizeTimecardCardPayload(card, weekStartDate, burden, { includeUpdatedAt: false }),
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to save the timecard card.'))
  }
}

export async function deleteTimecardCard(weekId: string, cardId: string): Promise<void> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<{ weekId: string; cardId: string }, { success: boolean }>(
      functions,
      'deleteTimecardCardRecord',
    )
    await callable({ weekId, cardId })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to remove the timecard card.'))
  }
}

export async function submitTimecardWeek(
  weekId: string,
  actor?: TimecardWeekActor,
): Promise<void> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<
      { weekId: string; actor?: TimecardWeekActor },
      { success: boolean }
    >(functions, 'submitTimecardWeekRecord')

    await callable({
      weekId,
      actor,
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to submit the timecard week.'))
  }
}
