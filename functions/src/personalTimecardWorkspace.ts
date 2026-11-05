import { FieldValue, Filter, type DocumentData, type Firestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { buildCurrentFunctionUser, normalizeStoredRole } from './roleAccess'
import {
  PERSONAL_TIMECARD_ROLES,
  mergePersonalTimecard,
  parsePersonalTimecard,
  personalCardId,
  personalSaveHash,
  type PersonalPayrollCard,
  type PersonalPayrollLine,
  type PersonalPayrollDay,
} from './personalTimecardModel'

import { personalTimecardIdentity } from './personalTimecardIdentity'

// Paused pending the employee-period / multi-job workflow design. Retain all stored records.
export const PERSONAL_TIMECARD_AVAILABLE = false

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const version = (value: { seconds: number; nanoseconds: number } | undefined) =>
  value ? `${value.seconds}:${value.nanoseconds}` : null
/** Payroll roster primary job plus explicit account assignments; no admin/shop bypass. */
export function personalAssignedJobIds(employee: DocumentData, assigned: readonly string[]) {
  return [...new Set([text(employee.jobId), ...assigned].filter(id => id && !id.includes('/')))]
}
export function personalCurrentWeekEnd(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  const date = new Date(part('year') + '-' + part('month') + '-' + part('day') + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + (6 - date.getUTCDay() + 7) % 7)
  return date.toISOString().slice(0, 10)
}
function dto(card: PersonalPayrollCard | undefined) {
  if (!card) return null
  return {
    lines: (card.lines || []).map((line: PersonalPayrollLine) => ({
      jobNumber: line.jobNumber || '',
      subsectionArea: line.subsectionArea || '',
      account: line.account || '',
      hours: (line.days || []).map((day: PersonalPayrollDay) => Number(day.hours) || 0),
    })),
    notes: card.notes || '',
    display: {
      lines: (card.lines || []).map(line => ({
        difH: text(line.difH), difP: text(line.difP), offHours: Number(line.offHours) || 0,
        offProduction: Number(line.offProduction) || 0,
        production: line.days.map(day => Number(day.production) || 0),
      })),
      regularHoursOverride: card.regularHoursOverride ?? null,
      overtimeHoursOverride: card.overtimeHoursOverride ?? null,
    },
  }
}
/** Opt-in personal branch of an existing callable; never opens/submits a crew week. */
export async function handlePersonalTimecard(
  request: { auth?: { uid: string } | null; data?: Record<string, unknown> },
  database: Firestore,
  makeCard: (employee: DocumentData, employeeId: string, weekStart: string) => PersonalPayrollCard,
  now = new Date(),
) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.')
  if (!PERSONAL_TIMECARD_AVAILABLE)
    throw new HttpsError('failed-precondition', 'My Timecard is unavailable while its workflow is being redesigned. Use the existing job timecard process.')
  const uid = request.auth.uid,
    input = request.data || {},
    action = text(input.personalAction)
  if (['auto-link', 'link-status'].includes(action)) return personalTimecardIdentity(uid, input, database)
  if (!['context', 'load', 'save'].includes(action))
    throw new HttpsError('invalid-argument', 'Unknown personal timecard action.')
  const jobId = text(input.jobId),
    weekEndDate = text(input.weekEndDate)
  const date = new Date(weekEndDate + 'T12:00:00Z')
  if (action !== 'context' && (
    !jobId ||
    jobId.includes('/') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekEndDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== weekEndDate ||
    date.getUTCDay() !== 6
  ))
    throw new HttpsError('invalid-argument', 'Choose a job and a valid Saturday week ending.')
  const saved = action === 'save' ? parsePersonalTimecard(input.card) : null
  const requestId = text(input.requestId)
  if (saved && !/^[\w-]{8,100}$/.test(requestId))
    throw new HttpsError('invalid-argument', 'A save request identifier is required.')
  const result = await database.runTransaction(async (tx) => {
    const profileRef = database.doc('users/' + uid)
    const profileSnap = await tx.get(profileRef)
    const profile = profileSnap.data() || {},
      user = { ...buildCurrentFunctionUser(uid, profile), role: normalizeStoredRole(profile.role) }
    if (
      !profileSnap.exists ||
      !user.active ||
      !(PERSONAL_TIMECARD_ROLES as readonly string[]).includes(user.role)
    )
      throw new HttpsError(
        'permission-denied',
        'Your account cannot use personal timecards.',
      )
    const link = profile.myTimecard || {},
      employeeId = text(link.employeeId)
    if (
      link.confirmed !== true ||
      !text(link.confirmedBy) ||
      !employeeId ||
      employeeId.includes('/')
    )
      throw new HttpsError(
        'failed-precondition',
        'Your account has not been matched to payroll. Ask an administrator to save your account with the payroll first and last name.',
      )
    const employeeSnap = await tx.get(database.doc('employees/' + employeeId)),
      employee = employeeSnap.data() || {}
    if (!employeeSnap.exists || employee.active === false || employee.myTimecardUserId !== uid)
      throw new HttpsError(
        'permission-denied',
        'Your payroll employee link is unavailable or has changed.',
      )
    const assignedIds = personalAssignedJobIds(employee, user.assignedJobIds)
    const assignedSnaps = await Promise.all(assignedIds.map(id => tx.get(database.doc('jobs/' + id))))
    const assignedJobs = assignedSnaps.filter(snap => snap.exists && snap.data()?.active !== false)
      .map(snap => ({ id: snap.id, name: text(snap.data()?.name), code: text(snap.data()?.number || snap.data()?.code) }))
      .sort((a, b) => (a.code + ' ' + a.name).localeCompare(b.code + ' ' + b.name))
    const currentWeekEndDate = personalCurrentWeekEnd(now)
    if (action === 'context') return {
      state: 'context' as const, employeeName: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
      jobs: assignedJobs, defaultJobId: assignedJobs.some(job => job.id === employee.jobId)
        ? employee.jobId as string : assignedJobs.length === 1 ? assignedJobs[0]!.id : '',
      currentWeekEndDate, card: null, version: null, readOnly: true,
    }
    const jobSnap = assignedSnaps.find(snap => snap.id === jobId)
    const job = jobSnap?.data() || {}
    if (!jobSnap?.exists || job.active === false)
      throw new HttpsError('permission-denied', 'You are not assigned to this job.')
    const weeks = await tx.get(
      database
        .collection('timecardWeeks')
        .where('jobId', '==', jobId)
        .where('weekEndDate', '==', weekEndDate)
        .limit(2),
    )
    if (weeks.size > 1)
      throw new HttpsError(
        'failed-precondition',
        'Payroll must resolve duplicate job weeks before personal entry.',
      )
    const weekSnap = weeks.docs[0],
      week = weekSnap?.data()
    if (!weekSnap || !week)
      return {
        state: 'week-not-open' as const,
        employeeName: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
        card: null,
        version: null,
        readOnly: true,
      }
    const expectedStart = new Date(date)
    expectedStart.setUTCDate(expectedStart.getUTCDate() - 6)
    if (week.weekStartDate !== expectedStart.toISOString().slice(0, 10))
      throw new HttpsError(
        'failed-precondition',
        'Payroll must review the dates on this legacy week before personal entry.',
      )
    const cards = await tx.get(
      weekSnap.ref.collection('cards').where('employeeId', '==', employeeId).limit(2),
    )
    if (cards.size > 1)
      throw new HttpsError(
        'failed-precondition',
        'Payroll must resolve duplicate employee cards before personal entry.',
      )
    const cardSnap = cards.docs[0],
      source = (cardSnap?.data() ||
        makeCard(employee, employeeId, text(week.weekStartDate))) as PersonalPayrollCard
    if (
      !Array.isArray(source.lines) ||
      source.lines.length !== 13 ||
      source.lines.some(
        (line: PersonalPayrollLine) => !Array.isArray(line.days) || line.days.length !== 7,
      )
    )
      throw new HttpsError(
        'failed-precondition',
        'This legacy card needs payroll review before personal entry.',
      )
    if (!cardSnap) source.lines.forEach(line => { line.jobNumber = text(job.number || job.code) })
    const response = {
      state: 'ready' as const,
      employeeName:
        [source.firstName, source.lastName].filter(Boolean).join(' ') ||
        [employee.firstName, employee.lastName].filter(Boolean).join(' '),
      card: dto(source),
      identity: {
        firstName: text(source.firstName || employee.firstName), lastName: text(source.lastName || employee.lastName),
        employeeNumber: text(employee.employeeNumber), occupation: text(employee.occupation),
      },
      version: version(cardSnap?.updateTime),
      readOnly: week.status !== 'draft' || weekEndDate !== currentWeekEndDate,
      weekId: weekSnap.id,
    }
    if (!saved) return response
    if (response.readOnly)
      throw new HttpsError(
        'failed-precondition',
        'This week is locked. Ask payroll to review any correction.',
      )
    const hash = personalSaveHash(saved),
      prior = source.lastPersonalSave
    if (prior?.uid === uid && prior?.requestId === requestId) {
      if (prior.hash !== hash)
        throw new HttpsError(
          'invalid-argument',
          'Use a new request identifier for changed answers.',
        )
      return { ...response, replayed: true }
    }
    if (input.expectedVersion !== response.version)
      throw new HttpsError(
        'aborted',
        'This card changed elsewhere. Reload the saved card before saving again.',
      )
    // Only known, currently accessible job numbers may receive entered hours.
    for (const code of new Set(
      saved.lines.filter((line) => line.hours.some((h) => h > 0)).map((line) => line.jobNumber),
    )) {
      const jobs = await tx.get(
        database
          .collection('jobs')
          .where(Filter.or(Filter.where('number', '==', code), Filter.where('code', '==', code)))
          .limit(2),
      )
      if (jobs.size !== 1 || !assignedJobs.some(job => job.id === jobs.docs[0]!.id))
        throw new HttpsError(
          'permission-denied',
          'One of the entered job numbers is unavailable or not assigned to you.',
        )
    }
    const merged = mergePersonalTimecard(
        source,
        saved,
        typeof job.productionBurden === 'number' ? job.productionBurden : 0.33,
      ),
      patch = {
        lines: merged.lines,
        notes: merged.notes,
        totals: merged.totals,
        updatedAt: FieldValue.serverTimestamp(),
        lastPersonalSave: { uid, requestId, hash },
      }
    const cardRef =
      cardSnap?.ref || weekSnap.ref.collection('cards').doc(personalCardId(employeeId))
    if (cardSnap) tx.update(cardRef, patch)
    else tx.create(cardRef, { ...source, ...patch, createdAt: FieldValue.serverTimestamp() })
    tx.update(weekSnap.ref, {
      ...(cardSnap ? {} : { employeeCardCount: FieldValue.increment(1) }),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUserId: uid,
    })
    return { ...response, card: dto(merged), savedCardId: cardRef.id, replayed: false }
  })
  if ('savedCardId' in result && result.savedCardId) {
    const current = await database
      .doc(`timecardWeeks/${result.weekId}/cards/${result.savedCardId}`)
      .get()
    return {
      ...result,
      card: dto(current.data() as PersonalPayrollCard | undefined),
      version: version(current.updateTime),
    }
  }
  return result
}
