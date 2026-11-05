import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import type { PersonalTimecardInput } from '../../functions/src/personalTimecardModel'
export type { PersonalTimecardInput }
export interface PersonalTimecardResult {
  state: 'ready' | 'week-not-open'
  employeeName: string
  card: PersonalTimecardInput | null
  version: string | null
  readOnly: boolean
  replayed?: boolean
}
export async function personalTimecardRequest(data: {
  personalAction: 'load' | 'save'
  jobId: string
  weekEndDate: string
  card?: PersonalTimecardInput
  requestId?: string
  expectedVersion?: string | null
}) {
  const { functions } = requireFirebaseServices()
  return (
    await httpsCallable<typeof data, PersonalTimecardResult>(
      functions,
      'ensureTimecardWeekRecord',
    )(data)
  ).data
}
export function subscribePersonalTimecardLink(
  uid: string,
  next: (employeeId: string) => void,
  error: (cause: unknown) => void,
) {
  return onSnapshot(
    doc(requireFirebaseServices().db, 'users', uid),
    (snapshot) => {
      const link = snapshot.data()?.myTimecard
      next(link?.confirmed === true && typeof link.employeeId === 'string' ? link.employeeId : '')
    },
    error,
  )
}
/** Admin-only rules protect both sides; the transaction prevents two users claiming one employee. */
export async function confirmPersonalTimecardLink(
  actorUid: string,
  uid: string,
  employeeId: string,
) {
  if (![actorUid, uid].every((id) => id && !id.includes('/')) || employeeId.includes('/'))
    throw new Error('Invalid account or employee selection.')
  const { db } = requireFirebaseServices()
  await runTransaction(db, async (tx) => {
    const actorRef = doc(db, 'users', actorUid),
      userRef = doc(db, 'users', uid)
    const [actor, user] = await Promise.all([tx.get(actorRef), tx.get(userRef)])
    if (!actor.exists() || actor.data().role !== 'admin' || actor.data().active === false)
      throw new Error('An active administrator must confirm this link.')
    if (!user.exists()) throw new Error('The selected account is unavailable.')
    const oldId = user.data().myTimecard?.employeeId
    const oldRef =
      typeof oldId === 'string' && oldId && !oldId.includes('/')
        ? doc(db, 'employees', oldId)
        : null
    const employeeRef = employeeId ? doc(db, 'employees', employeeId) : null
    const oldEmployee = oldRef ? await tx.get(oldRef) : null
    const employee = employeeRef ? await tx.get(employeeRef) : null
    if (employeeRef && (!employee?.exists() || employee.data().active === false))
      throw new Error('Select an active payroll employee.')
    if (
      employee?.exists() &&
      employee.data().myTimecardUserId &&
      employee.data().myTimecardUserId !== uid
    )
      throw new Error('That payroll employee is already linked to another account.')
    if (
      oldRef &&
      oldId !== employeeId &&
      oldEmployee?.exists() &&
      oldEmployee.data().myTimecardUserId === uid
    )
      tx.update(oldRef, { myTimecardUserId: null })
    if (employeeRef) tx.update(employeeRef, { myTimecardUserId: uid })
    tx.update(userRef, {
      myTimecard: employeeRef
        ? { employeeId, confirmed: true, confirmedBy: actorUid, confirmedAt: serverTimestamp() }
        : null,
    })
  })
}
