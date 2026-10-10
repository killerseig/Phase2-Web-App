/** Form visibility never grants visibility of completed entries or photos. */
export interface FormAccessPolicy {
  respondents: 'signed-in' | 'public'
  identity: 'identified' | 'anonymous' | 'form-fields'
  respondentUserIds: string[]
  respondentRoles: string[]
  entryUserIds: string[]
  entryRoles: string[]
}
const roles = ['admin', 'project-manager', 'foreman', 'shop-foreman']
export function validateFormAccess(value: unknown): FormAccessPolicy {
  const input = (value || {}) as Partial<FormAccessPolicy>
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid access policy.')
  const list = (items: unknown, allowed?: string[]) => {
    if (items === undefined) return []
    if (
      !Array.isArray(items) ||
      items.length > 100 ||
      items.some(
        (item) =>
          typeof item !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,128}$/.test(item) ||
          (allowed && !allowed.includes(item)),
      )
    )
      throw new Error('Invalid form audience.')
    return [...new Set(items)] as string[]
  }
  if (input.respondents !== undefined && !['signed-in', 'public'].includes(input.respondents))
    throw new Error('Invalid respondent access.')
  if (input.identity !== undefined && !['identified', 'anonymous', 'form-fields'].includes(input.identity))
    throw new Error('Invalid identity policy.')
  const policy: FormAccessPolicy = {
    respondents: input.respondents || 'signed-in',
    identity: input.identity || 'identified',
    respondentUserIds: list(input.respondentUserIds),
    respondentRoles:
      input.respondentRoles === undefined ? roles : list(input.respondentRoles, roles),
    entryUserIds: list(input.entryUserIds),
    entryRoles: list(input.entryRoles, roles),
  }
  if (policy.identity === 'anonymous' && policy.respondents !== 'public')
    throw new Error(
      'Anonymous account identity requires Everyone (no login). Signed-in anonymous sessions are not supported yet.',
    )
  if (policy.respondents === 'public') {
    policy.respondentRoles = []
    policy.respondentUserIds = []
  }
  return policy
}
export function canSubmitForm(
  policy: unknown,
  user?: { uid: string; role: string; active: boolean },
): boolean {
  const access = validateFormAccess(policy)
  return (
    access.respondents === 'public' ||
    !!(
      user?.active &&
      (user.role === 'admin' ||
        access.respondentUserIds.includes(user.uid) ||
        access.respondentRoles.includes(user.role))
    )
  )
}
export function canReadFormEntry(
  policy: unknown,
  ownerUid: string,
  user: { uid: string; role: string; active: boolean },
): boolean {
  const access = validateFormAccess(policy)
  return (
    user.active &&
    (user.role === 'admin' ||
      user.uid === ownerUid ||
      access.entryUserIds.includes(user.uid) ||
      access.entryRoles.includes(user.role))
  )
}
