import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { PERSONAL_TIMECARD_ROLES } from './personalTimecardModel'
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
export const payrollIdentityName = (value: unknown) => text(value).normalize('NFKC').toLocaleLowerCase('en-US').replace(/\s+/g, ' ')
export function samePayrollIdentity(account: DocumentData, employee: DocumentData) {
  if (text(account.employeeNumber)) return text(account.employeeNumber) === text(employee.employeeNumber)
  return !!payrollIdentityName(account.firstName) && !!payrollIdentityName(account.lastName) &&
    payrollIdentityName(account.firstName) === payrollIdentityName(employee.firstName) &&
    payrollIdentityName(account.lastName) === payrollIdentityName(employee.lastName)
}
/** Matching is admin-only: account names are otherwise self-editable. Never infer access on employee reads. */
export async function personalTimecardIdentity(
  uid: string, input: Record<string, unknown>, database: Firestore,
) {
  const targetUid = text(input.accountUid)
  if (!targetUid || targetUid.includes('/')) throw new HttpsError('invalid-argument', 'Select a valid account.')
  return database.runTransaction(async tx => {
    const actor = await tx.get(database.doc('users/' + uid))
    if (!actor.exists || actor.data()?.role !== 'admin' || actor.data()?.active === false)
      throw new HttpsError('permission-denied', 'Only an active administrator can match payroll accounts.')
    const targetRef = database.doc('users/' + targetUid), target = await tx.get(targetRef), account = target.data() || {}
    if (!target.exists) throw new HttpsError('not-found', 'Account unavailable.')
    const response = (status: string, employee?: DocumentData) => ({
      state: 'link-status' as const, status,
      employeeName: employee ? [employee.firstName, employee.lastName].filter(Boolean).join(' ') : '',
      employeeNumber: employee ? text(employee.employeeNumber) : '', card: null, version: null, readOnly: true,
    })
    if (account.active === false || !(PERSONAL_TIMECARD_ROLES as readonly string[]).includes(account.role)) return response('not-enabled')
    const oldId = text(account.myTimecard?.employeeId)
    if (oldId && !oldId.includes('/') && account.myTimecard?.confirmed === true) {
      const old = await tx.get(database.doc('employees/' + oldId))
      if (old.exists && old.data()?.active !== false && old.data()?.myTimecardUserId === targetUid)
        return response('linked', old.data())
      return response('conflict')
    }
    const employees = await tx.get(database.collection('employees'))
    const matches = employees.docs.filter(row => row.data().active !== false && samePayrollIdentity(account, row.data()))
    if (matches.length !== 1) return response(matches.length ? 'ambiguous' : 'unmatched')
    const employee = matches[0]!, data = employee.data()
    if (data.myTimecardUserId && data.myTimecardUserId !== targetUid) return response('conflict')
    const users = await tx.get(database.collection('users'))
    if (users.docs.some(row => row.id !== targetUid && row.data().active !== false && samePayrollIdentity(row.data(), data))) return response('ambiguous')
    if (input.personalAction === 'auto-link') {
      // The administrator's saved identity must still match; concurrent self-edits cannot claim payroll.
      if (text(input.expectedFirstName) !== text(account.firstName) || text(input.expectedLastName) !== text(account.lastName))
        throw new HttpsError('aborted', 'Account details changed. Save the account again to match payroll safely.')
      tx.update(employee.ref, { myTimecardUserId: targetUid })
      tx.update(targetRef, { myTimecard: { employeeId: employee.id, confirmed: true, confirmedBy: uid, confirmedAt: FieldValue.serverTimestamp(), matchMethod: 'automatic-exact' } })
      return response('linked', data)
    }
    return response('matched', data)
  })
}
