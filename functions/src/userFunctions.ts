import { createHash, randomBytes } from 'crypto'
import { FieldValue, type DocumentData } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { COLLECTIONS, EMAIL, ERROR_MESSAGES, VALID_ROLES } from './constants'
import {
  buildPasswordResetEmail,
  buildWelcomeEmail,
  isEmailEnabled,
  sendEmail,
} from './emailService'
import { getAppBaseUrl, getGraphEmailSecrets } from './functionConfig'
import { removeEmailFromRecipientLists } from './recipientCleanup'
import {
  buildCurrentFunctionUser,
  canSendInviteForStoredRole,
  currentFunctionUserHasAnyRole,
  isValidStoredRole,
  normalizeStoredRole,
} from './roleAccess'
import { auth, db } from './runtime'
import { verifyAdminRole } from './firestoreService'
import { targetFunctionRoleCanBeAssignedJobs } from './targetRoleCapabilities'
import { consumePasswordResetAllowance } from './passwordResetRateLimit'

const SETUP_CREDENTIALS = 'userSetupCredentials'

export function hashSetupToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function setupCredentialIsValid(data: DocumentData, token: string, now = new Date()) {
  const expiry = parseTokenExpiry(data.setupTokenExpiry).getTime()
  return /^[a-f0-9]{64}$/.test(token) && data.setupTokenHash === hashSetupToken(token)
    && Number.isFinite(expiry) && expiry > now.getTime() && !data.consumedAt
}

function parseTokenExpiry(value: any): Date {
  if (value?.toDate && typeof value.toDate === 'function') {
    return value.toDate()
  }
  if (value instanceof Date) {
    return value
  }
  return new Date(value)
}

function assertSetupTokenPayload(uid: string, setupToken: string) {
  if (!uid || !setupToken) {
    throw new HttpsError('invalid-argument', 'Missing required parameters: uid and setupToken')
  }
}

function buildSetupLink(uid: string, setupToken: string): string {
  const baseUrl = getAppBaseUrl()
  return `${baseUrl}/set-password?setupToken=${setupToken}&uid=${uid}`
}

function createSetupTokenRecord() {
  return {
    setupToken: randomBytes(32).toString('hex'),
    setupTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }
}

const USER_INVITE_STATE_FIELDS = [
  'setupTokenHash',
  'setupTokenExpiry',
  'consumedAt',
  'inviteStatus',
  'inviteSentAt',
  'inviteSentByUid',
  'inviteAcceptedAt',
] as const

const INVITE_DELIVERY_LEASE_DURATION_MS = 2 * 60 * 1000
const INVITE_DELIVERY_IN_PROGRESS_MESSAGE =
  'An invite email is already being sent for this user. Wait a moment and try again.'
const INVITE_DELIVERY_OWNERSHIP_LOST_MESSAGE =
  'This invite email was superseded before it could be finalized. Send a new invite.'

type UserInviteStateField = (typeof USER_INVITE_STATE_FIELDS)[number]

interface StoredUserInviteField {
  exists: boolean
  value: unknown
}

type StoredUserInviteState = Record<UserInviteStateField, StoredUserInviteField>

interface UserInviteStateTransition<TResult> {
  update?: DocumentData
  result: TResult
}

interface UserInviteStateStore {
  transact: <TResult>(
    uid: string,
    transition: (current: DocumentData) => UserInviteStateTransition<TResult>,
  ) => Promise<TResult>
}

interface SendUserInviteDependencies {
  createDeliveryId: () => string
  createTokenRecord: () => ReturnType<typeof createSetupTokenRecord>
  deleteField: () => unknown
  deliverEmail: typeof sendEmail
  now: () => Date
  serverTimestamp: () => unknown
  stateStore: UserInviteStateStore
}

function inviteDeliveryLeaseIsActive(data: DocumentData, now: Date): boolean {
  const deliveryId = String(data.inviteDeliveryId || '').trim()
  if (!deliveryId) return false

  const expiresAt = parseTokenExpiry(data.inviteDeliveryLeaseExpiresAt).getTime()
  return Number.isFinite(expiresAt) && expiresAt > now.getTime()
}

function buildInviteDeliveryLeaseClearUpdate(deleteField: () => unknown): DocumentData {
  return {
    inviteDeliveryId: deleteField(),
    inviteDeliveryLeaseExpiresAt: deleteField(),
  }
}

function captureUserInviteState(data: DocumentData): StoredUserInviteState {
  return Object.fromEntries(
    USER_INVITE_STATE_FIELDS.map((field) => [
      field,
      {
        exists: Object.prototype.hasOwnProperty.call(data, field),
        value: data[field],
      },
    ]),
  ) as StoredUserInviteState
}

function buildUserInviteRestoreUpdate(
  previousState: StoredUserInviteState,
  deleteField: () => unknown,
): DocumentData {
  return Object.fromEntries(
    USER_INVITE_STATE_FIELDS.map((field) => [
      field,
      previousState[field].exists ? previousState[field].value : deleteField(),
    ]),
  )
}

const firestoreUserInviteStateStore: UserInviteStateStore = {
  async transact(uid, transition) {
    const userRef = db.collection(COLLECTIONS.USERS).doc(uid)
    const credentialRef = db.collection(SETUP_CREDENTIALS).doc(uid)
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userRef)
      const credentials = await transaction.get(credentialRef)
      if (!snapshot.exists) {
        throw new HttpsError('not-found', 'User not found.')
      }

      const { setupToken: _legacyToken, setupTokenExpiry: _legacyExpiry, ...profile } = snapshot.data() || {}
      const next = transition({ ...profile, ...credentials.data() })
      if (next.update) {
        const privateUpdate: DocumentData = {}
        const publicUpdate: DocumentData = {}
        for (const [key, value] of Object.entries(next.update)) {
          if (key === 'setupTokenHash' || key === 'setupTokenExpiry' || key === 'consumedAt') {
            privateUpdate[key] = value
          } else {
            publicUpdate[key] = value
          }
        }
        transaction.update(userRef, { ...publicUpdate, setupToken: FieldValue.delete(), setupTokenExpiry: FieldValue.delete() })
        if (Object.keys(privateUpdate).length) transaction.set(credentialRef, privateUpdate, { merge: true })
      }
      return next.result
    })
  },
}

const sendUserInviteDependencies: SendUserInviteDependencies = {
  createDeliveryId: () => randomBytes(16).toString('hex'),
  createTokenRecord: createSetupTokenRecord,
  deleteField: () => FieldValue.delete(),
  deliverEmail: sendEmail,
  now: () => new Date(),
  serverTimestamp: () => FieldValue.serverTimestamp(),
  stateStore: firestoreUserInviteStateStore,
}

function normalizeAssignedJobIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

function normalizeAssignableUser(id: string, data: DocumentData) {
  const role = normalizeStoredRole(data.role)
  if (!targetFunctionRoleCanBeAssignedJobs(role)) return null

  return {
    id,
    email: typeof data.email === 'string' ? data.email : null,
    firstName: typeof data.firstName === 'string' ? data.firstName : null,
    lastName: typeof data.lastName === 'string' ? data.lastName : null,
    role,
    active: data.active !== false,
    assignedJobIds: normalizeAssignedJobIds(data.assignedJobIds),
    inviteStatus: typeof data.inviteStatus === 'string' ? data.inviteStatus : null,
    inviteSentAt: data.inviteSentAt ?? null,
  }
}

async function getAuthorizedAssignableUserReader(uid: string) {
  const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get()
  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Your user profile was not found.')
  }

  const user = buildCurrentFunctionUser(uid, userSnap.data() || {})
  if (!user.active) {
    throw new HttpsError('permission-denied', 'Your account is inactive.')
  }

  if (!currentFunctionUserHasAnyRole(user, ['admin', 'payroll', 'project-manager'])) {
    throw new HttpsError('permission-denied', 'Your account cannot load assignable users.')
  }

  return user
}

export async function sendUserInvite(
  options: {
    uid: string
    email: string
    firstName: string
    sentByUid?: string | null
  },
  dependencies: SendUserInviteDependencies = sendUserInviteDependencies,
) {
  const deliveryId = dependencies.createDeliveryId()
  const deliveryStartedAt = dependencies.now()
  const deliveryLeaseExpiresAt = new Date(
    deliveryStartedAt.getTime() + INVITE_DELIVERY_LEASE_DURATION_MS,
  )
  const tokenRecord = dependencies.createTokenRecord()
  const previousState = await dependencies.stateStore.transact(options.uid, (current) => {
    if (inviteDeliveryLeaseIsActive(current, deliveryStartedAt)) {
      throw new HttpsError('failed-precondition', INVITE_DELIVERY_IN_PROGRESS_MESSAGE)
    }

    return {
      update: {
        setupTokenHash: hashSetupToken(tokenRecord.setupToken),
        setupTokenExpiry: tokenRecord.setupTokenExpiry,
        consumedAt: dependencies.deleteField(),
        inviteDeliveryId: deliveryId,
        inviteDeliveryLeaseExpiresAt: deliveryLeaseExpiresAt,
      },
      result: captureUserInviteState(current),
    }
  })

  try {
    await dependencies.deliverEmail({
      to: options.email,
      subject: EMAIL.SUBJECTS.WELCOME,
      html: buildWelcomeEmail(
        options.firstName || 'there',
        buildSetupLink(options.uid, tokenRecord.setupToken),
      ),
    })
  } catch (deliveryError) {
    try {
      await dependencies.stateStore.transact(options.uid, (current) => {
        if (
          current.inviteDeliveryId !== deliveryId ||
          current.setupTokenHash !== hashSetupToken(tokenRecord.setupToken)
        ) {
          return { result: false }
        }

        return {
          update: {
            ...buildUserInviteRestoreUpdate(previousState, dependencies.deleteField),
            ...buildInviteDeliveryLeaseClearUpdate(dependencies.deleteField),
          },
          result: true,
        }
      })
    } catch (rollbackError) {
      console.error(
        '[sendUserInvite] Failed to restore invite state after delivery failure:',
        rollbackError instanceof Error ? rollbackError.message : rollbackError,
      )
    }
    throw deliveryError
  }

  const finalized = await dependencies.stateStore.transact(options.uid, (current) => {
    if (current.inviteDeliveryId !== deliveryId || current.setupTokenHash !== hashSetupToken(tokenRecord.setupToken)) {
      return { result: false }
    }

    const preserveAcceptedStatus =
      previousState.inviteStatus.value === 'accepted' || current.inviteStatus === 'accepted'
    return {
      update: {
        inviteStatus: preserveAcceptedStatus ? 'accepted' : 'sent',
        inviteSentAt: dependencies.serverTimestamp(),
        inviteSentByUid: options.sentByUid ?? null,
        ...buildInviteDeliveryLeaseClearUpdate(dependencies.deleteField),
      },
      result: true,
    }
  })

  if (!finalized) {
    throw new HttpsError('aborted', INVITE_DELIVERY_OWNERSHIP_LOST_MESSAGE)
  }
}

interface AdminUserEmailActionRequest {
  auth?: { uid?: string } | null
  data?: { uid?: unknown } | null
}

interface AdminUserEmailTarget {
  email: string
  firstName: string
  displayName: string
}

interface AdminUserEmailActionDependencies {
  verifyAdminRole: (uid: string) => Promise<unknown>
  isEmailEnabled: () => boolean
  getUserProfile: (uid: string) => Promise<DocumentData | null>
  getAuthUser: (uid: string) => Promise<{ email?: string | null; displayName?: string | null }>
  sendInvite: (options: {
    uid: string
    email: string
    firstName: string
    sentByUid?: string | null
  }) => Promise<void>
  sendPasswordReset: (options: { email: string; displayName: string }) => Promise<void>
}

const adminUserEmailActionDependencies: AdminUserEmailActionDependencies = {
  verifyAdminRole,
  isEmailEnabled,
  getUserProfile: async (uid) => {
    const snapshot = await db.collection(COLLECTIONS.USERS).doc(uid).get()
    return snapshot.exists ? snapshot.data() || null : null
  },
  getAuthUser: (uid) => auth.getUser(uid),
  sendInvite: sendUserInvite,
  sendPasswordReset: async ({ email, displayName }) => {
    const resetLink = await auth.generatePasswordResetLink(email)
    await sendEmail({
      to: email,
      subject: EMAIL.SUBJECTS.PASSWORD_RESET,
      html: buildPasswordResetEmail(displayName, resetLink),
    })
  },
}

function requireAdminUserEmailActionPayload(request: AdminUserEmailActionRequest) {
  const actorUid = String(request.auth?.uid || '').trim()
  if (!actorUid) {
    throw new HttpsError('unauthenticated', ERROR_MESSAGES.NOT_SIGNED_IN_CREATE)
  }

  const targetUid = String(request.data?.uid || '').trim()
  if (!targetUid) {
    throw new HttpsError('invalid-argument', ERROR_MESSAGES.UID_REQUIRED)
  }

  return { actorUid, targetUid }
}

async function getAdminUserEmailTarget(
  targetUid: string,
  dependencies: AdminUserEmailActionDependencies,
): Promise<AdminUserEmailTarget> {
  const [profile, authUser] = await Promise.all([
    dependencies.getUserProfile(targetUid),
    dependencies.getAuthUser(targetUid),
  ])

  if (!profile) {
    throw new HttpsError('not-found', 'User not found.')
  }

  const authEmail = String(authUser.email || '').trim()
  if (!authEmail) {
    throw new HttpsError(
      'failed-precondition',
      "This user's Authentication account does not have an email address.",
    )
  }

  const profileEmail = String(profile.email || '').trim()
  if (!profileEmail || profileEmail.toLowerCase() !== authEmail.toLowerCase()) {
    throw new HttpsError(
      'failed-precondition',
      "This user's profile email does not match their Authentication email. Update the account before sending email.",
    )
  }

  const firstName = String(profile.firstName || '').trim()
  const profileDisplayName = [firstName, String(profile.lastName || '').trim()]
    .filter(Boolean)
    .join(' ')

  return {
    email: authEmail,
    firstName,
    displayName: String(authUser.displayName || '').trim() || profileDisplayName,
  }
}

export async function handleResendUserInviteByAdmin(
  request: AdminUserEmailActionRequest,
  dependencies: AdminUserEmailActionDependencies = adminUserEmailActionDependencies,
) {
  const { actorUid, targetUid } = requireAdminUserEmailActionPayload(request)
  await dependencies.verifyAdminRole(actorUid)

  if (!dependencies.isEmailEnabled()) {
    throw new HttpsError('failed-precondition', 'Email sending is disabled.')
  }

  try {
    const target = await getAdminUserEmailTarget(targetUid, dependencies)
    await dependencies.sendInvite({
      uid: targetUid,
      email: target.email,
      firstName: target.firstName,
      sentByUid: actorUid,
    })

    return {
      success: true,
      email: target.email,
      message: `Invite email sent to ${target.email}.`,
    }
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error
    console.error(
      '[resendUserInviteByAdmin] Error:',
      error instanceof Error ? error.message : error,
    )
    throw new HttpsError('internal', 'Failed to resend invite email.')
  }
}

export async function handleSendUserPasswordResetByAdmin(
  request: AdminUserEmailActionRequest,
  dependencies: AdminUserEmailActionDependencies = adminUserEmailActionDependencies,
) {
  const { actorUid, targetUid } = requireAdminUserEmailActionPayload(request)
  await dependencies.verifyAdminRole(actorUid)

  if (!dependencies.isEmailEnabled()) {
    throw new HttpsError('failed-precondition', 'Email sending is disabled.')
  }

  try {
    const target = await getAdminUserEmailTarget(targetUid, dependencies)
    await dependencies.sendPasswordReset({
      email: target.email,
      displayName: target.displayName,
    })

    return {
      success: true,
      email: target.email,
      message: `Password reset email sent to ${target.email}.`,
    }
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error
    console.error(
      '[sendUserPasswordResetByAdmin] Error:',
      error instanceof Error ? error.message : error,
    )
    throw new HttpsError('internal', 'Failed to send password reset email.')
  }
}

export const resendUserInviteByAdmin = onCall(
  { secrets: getGraphEmailSecrets() },
  async (request) => {
    return handleResendUserInviteByAdmin(request)
  },
)

export const sendUserPasswordResetByAdmin = onCall(
  { secrets: getGraphEmailSecrets() },
  async (request) => {
    return handleSendUserPasswordResetByAdmin(request)
  },
)

export const removeEmailFromAllRecipientLists = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  await verifyAdminRole(request.auth.uid)

  const rawEmail = String(request.data?.email || '').trim()
  if (!rawEmail) {
    throw new HttpsError('invalid-argument', ERROR_MESSAGES.EMAIL_REQUIRED)
  }

  const cleanup = await removeEmailFromRecipientLists(rawEmail)
  return {
    success: true,
    message: 'Recipient cleanup completed',
    removedFromRecipientLists: cleanup.settingsUpdated || cleanup.jobsUpdated > 0,
    updatedJobCount: cleanup.jobsUpdated,
  }
})

export const listAssignableFieldUsers = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  await getAuthorizedAssignableUserReader(request.auth.uid)

  const snapshot = await db.collection(COLLECTIONS.USERS).get()
  const users = snapshot.docs
    .map((entry) => normalizeAssignableUser(entry.id, entry.data()))
    .filter(
      (entry): entry is NonNullable<ReturnType<typeof normalizeAssignableUser>> => entry !== null,
    )
    .sort((left, right) => {
      const leftActive = left.active ? 0 : 1
      const rightActive = right.active ? 0 : 1
      if (leftActive !== rightActive) return leftActive - rightActive

      const leftName = `${left.firstName ?? ''} ${left.lastName ?? ''}`.trim()
      const rightName = `${right.firstName ?? ''} ${right.lastName ?? ''}`.trim()
      if (leftName && rightName && leftName !== rightName) return leftName.localeCompare(rightName)

      return (left.email ?? '').localeCompare(right.email ?? '')
    })

  return { users }
})

export const handleUserAccessRevocationCleanup = onDocumentUpdated('users/{uid}', async (event) => {
  const beforeData = event.data?.before?.data()
  const afterData = event.data?.after?.data()

  if (!afterData) return

  const beforeRole = String(beforeData?.role || '')
    .trim()
    .toLowerCase()
  const afterRole = String(afterData?.role || '')
    .trim()
    .toLowerCase()
  const beforeActive = typeof beforeData?.active === 'boolean' ? beforeData.active : true
  const afterActive = typeof afterData?.active === 'boolean' ? afterData.active : true

  const changedToNoneRole = beforeRole !== afterRole && afterRole === 'none'
  const changedToInactive = beforeActive !== afterActive && afterActive === false
  const roleChangedWhileInactive = beforeRole !== afterRole && afterActive === false

  if (!changedToNoneRole && !changedToInactive && !roleChangedWhileInactive) {
    return
  }

  const email = String(afterData?.email || beforeData?.email || '').trim()
  if (!email) return

  try {
    const cleanup = await removeEmailFromRecipientLists(email)
    console.log('[handleUserAccessRevocationCleanup] Recipient cleanup complete', {
      uid: event.params.uid,
      email,
      reason: {
        changedToNoneRole,
        changedToInactive,
        roleChangedWhileInactive,
      },
      settingsUpdated: cleanup.settingsUpdated,
      jobsUpdated: cleanup.jobsUpdated,
    })
  } catch (error) {
    console.error('[handleUserAccessRevocationCleanup] Recipient cleanup failed', {
      uid: event.params.uid,
      email,
      error,
    })
  }
})

export const deleteUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', ERROR_MESSAGES.NOT_SIGNED_IN_DELETE)
  }

  const uid = String(request.data?.uid || '').trim()
  if (!uid) {
    throw new HttpsError('invalid-argument', ERROR_MESSAGES.UID_REQUIRED)
  }

  try {
    await verifyAdminRole(request.auth.uid)

    const userDocRef = db.collection(COLLECTIONS.USERS).doc(uid)
    const userDocSnap = await userDocRef.get()

    let authEmail = ''
    try {
      const authUser = await auth.getUser(uid)
      authEmail = String(authUser.email || '').trim()
    } catch (lookupError) {
      console.warn('[deleteUser] Unable to load auth user before delete', { uid, lookupError })
    }

    const firestoreEmail = String(userDocSnap.data()?.email || '').trim()
    const candidateEmails = Array.from(new Set([authEmail, firestoreEmail].filter(Boolean)))

    let settingsUpdated = false
    let jobsUpdated = 0
    for (const candidateEmail of candidateEmails) {
      const cleanup = await removeEmailFromRecipientLists(candidateEmail)
      settingsUpdated = settingsUpdated || cleanup.settingsUpdated
      jobsUpdated += cleanup.jobsUpdated
    }

    await auth.deleteUser(uid)
    await userDocRef.delete()

    console.log('[deleteUser] Offboarding cleanup complete', {
      uid,
      candidateEmails,
      settingsUpdated,
      jobsUpdated,
    })

    return {
      success: true,
      message: 'User deleted successfully',
      removedFromRecipientLists: settingsUpdated || jobsUpdated > 0,
      updatedJobCount: jobsUpdated,
    }
  } catch (error: any) {
    throw new HttpsError('internal', error?.message || ERROR_MESSAGES.FAILED_TO_DELETE_USER)
  }
})

export const createUserByAdmin = onCall({ secrets: getGraphEmailSecrets() }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', ERROR_MESSAGES.NOT_SIGNED_IN_CREATE)
  }

  const email = String(request.data?.email || '').trim()
  const firstName = String(request.data?.firstName || '').trim()
  const lastName = String(request.data?.lastName || '').trim()
  const userRole = String(request.data?.role || 'none')
    .trim()
    .toLowerCase()
  const sendInvite = request.data?.sendInvite === true

  if (!email) {
    throw new HttpsError('invalid-argument', ERROR_MESSAGES.EMAIL_REQUIRED)
  }
  if (!firstName) {
    throw new HttpsError('invalid-argument', ERROR_MESSAGES.FIRST_NAME_REQUIRED)
  }
  if (!lastName) {
    throw new HttpsError('invalid-argument', ERROR_MESSAGES.LAST_NAME_REQUIRED)
  }
  if (!isValidStoredRole(userRole)) {
    throw new HttpsError(
      'invalid-argument',
      ERROR_MESSAGES.INVALID_ROLE(VALID_ROLES as unknown as string[]),
    )
  }

  try {
    await verifyAdminRole(request.auth.uid)

    try {
      await auth.getUserByEmail(email)
      throw new HttpsError('already-exists', ERROR_MESSAGES.USER_ALREADY_EXISTS)
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error
      }
      if (error?.code !== 'auth/user-not-found') {
        throw error
      }
    }

    const userRecord = await auth.createUser({
      email,
      emailVerified: false,
    })

    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set({
      email: userRecord.email,
      firstName,
      lastName,
      role: userRole,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      setupToken: null,
      setupTokenExpiry: null,
      inviteStatus: 'pending',
      inviteSentAt: null,
      inviteAcceptedAt: null,
    })

    if (!sendInvite) {
      return {
        success: true,
        message: `User created successfully. Invite queued for ${userRecord.email}.`,
        uid: userRecord.uid,
      }
    }

    if (!isEmailEnabled()) {
      return {
        success: true,
        message: `User created successfully. Email sending is disabled, so the invite was left queued for ${userRecord.email}.`,
        uid: userRecord.uid,
      }
    }

    try {
      await sendUserInvite({
        uid: userRecord.uid,
        email: userRecord.email || email,
        firstName,
        sentByUid: request.auth.uid,
      })

      return {
        success: true,
        message: `User created successfully. Invite sent to ${userRecord.email}.`,
        uid: userRecord.uid,
      }
    } catch (inviteError: any) {
      console.error(
        '[createUserByAdmin] Invite send failed after create:',
        inviteError?.message || inviteError,
      )
      return {
        success: true,
        message: `User created successfully, but the invite could not be sent. The user was left in the pending invite queue.`,
        uid: userRecord.uid,
      }
    }
  } catch (error: any) {
    if (error instanceof HttpsError) throw error
    console.error('[createUserByAdmin] Error:', error?.message || error)
    throw new HttpsError('internal', error?.message || ERROR_MESSAGES.FAILED_TO_CREATE_USER)
  }
})

export const sendPendingUserInvites = onCall(
  { secrets: getGraphEmailSecrets() },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', ERROR_MESSAGES.NOT_SIGNED_IN_CREATE)
    }

    await verifyAdminRole(request.auth.uid)

    if (!isEmailEnabled()) {
      return {
        success: true,
        sentCount: 0,
        skippedCount: 0,
        message: 'Email sending is disabled. Pending invites were not sent.',
      }
    }

    try {
      const pendingSnapshot = await db
        .collection(COLLECTIONS.USERS)
        .where('inviteStatus', '==', 'pending')
        .get()

      if (pendingSnapshot.empty) {
        return {
          success: true,
          sentCount: 0,
          skippedCount: 0,
          message: 'There are no pending invites to send.',
        }
      }

      let sentCount = 0
      let skippedCount = 0

      for (const userDoc of pendingSnapshot.docs) {
        const userData = userDoc.data()
        const email = String(userData.email || '').trim()
        const firstName = String(userData.firstName || '').trim()
        const role = String(userData.role || '')
          .trim()
          .toLowerCase()
        const active = userData.active !== false

        if (!email || !active || !canSendInviteForStoredRole(role)) {
          skippedCount += 1
          continue
        }

        await sendUserInvite({
          uid: userDoc.id,
          email,
          firstName,
          sentByUid: request.auth.uid,
        })

        sentCount += 1
      }

      return {
        success: true,
        sentCount,
        skippedCount,
        message:
          sentCount > 0
            ? `Sent ${sentCount} invite${sentCount === 1 ? '' : 's'}${skippedCount ? ` and skipped ${skippedCount}.` : '.'}`
            : skippedCount > 0
              ? `No invites were sent. Skipped ${skippedCount} pending user${skippedCount === 1 ? '' : 's'}.`
              : 'There are no pending invites to send.',
      }
    } catch (error: any) {
      console.error('[sendPendingUserInvites] Error:', error?.message || error)
      throw new HttpsError('internal', error?.message || 'Failed to send pending invites.')
    }
  },
)

export const verifySetupToken = onCall(async (request) => {
  const uid = String(request.data?.uid || '').trim()
  const setupToken = String(request.data?.setupToken || '').trim()
  assertSetupTokenPayload(uid, setupToken)

  try {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get()
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    const credentials = await db.collection(SETUP_CREDENTIALS).doc(uid).get()
    if (userData?.active === false || !setupCredentialIsValid(credentials.data() || {}, setupToken)) {
      throw new HttpsError('permission-denied', 'Invalid token')
    }

    return {
      success: true,
      email: userData?.email,
      message: 'Token verified',
    }
  } catch (error: any) {
    if (error instanceof HttpsError) throw error
    console.error('[verifySetupToken] Error:', error?.message || error)
    throw new HttpsError('internal', error?.message || 'Failed to verify token')
  }
})

export const requestPasswordResetEmail = onCall(
  { secrets: getGraphEmailSecrets() },
  async (request) => {
    const email = String(request.data?.email || '')
      .trim()
      .toLowerCase()
    if (!email) {
      throw new HttpsError('invalid-argument', 'Enter your email address first.')
    }

    const successMessage =
      'If an account exists for that email, a password reset email has been sent.'

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError('invalid-argument', 'Enter a valid email address.')
    }
    if (!await consumePasswordResetAllowance(email, request.rawRequest.ip || 'unknown')) {
      return { success: true, message: successMessage }
    }

    try {
      const userRecord = await auth.getUserByEmail(email).catch((error: any) => {
        if (error?.code === 'auth/user-not-found') {
          return null
        }
        throw error
      })

      if (!userRecord?.email) {
        return {
          success: true,
          message: successMessage,
        }
      }

      const resetLink = await auth.generatePasswordResetLink(userRecord.email)

      if (isEmailEnabled()) {
        const displayName = [userRecord.displayName].filter(Boolean).join(' ').trim()
        await sendEmail({
          to: userRecord.email,
          subject: EMAIL.SUBJECTS.PASSWORD_RESET,
          html: buildPasswordResetEmail(displayName, resetLink),
        })
      }

      return {
        success: true,
        message: successMessage,
      }
    } catch (error: any) {
      if (error instanceof HttpsError) throw error
      console.error('[requestPasswordResetEmail] Error:', error?.message || error)
      throw new HttpsError('internal', 'Failed to send reset email.')
    }
  },
)

export const setUserPassword = onCall(async (request) => {
  const uid = String(request.data?.uid || '').trim()
  const password = String(request.data?.password || '')
  const setupToken = String(request.data?.setupToken || '').trim()

  if (!uid || !password || !setupToken) {
    throw new HttpsError(
      'invalid-argument',
      'Missing required parameters: uid, password, and setupToken',
    )
  }
  if (password.length < 12 || password.length > 128) {
    throw new HttpsError('invalid-argument', 'Password must be between 12 and 128 characters')
  }

  try {
    const credentialRef = db.collection(SETUP_CREDENTIALS).doc(uid)
    // Claim before changing Auth: concurrent/replayed requests cannot reuse the token.
    // If Auth fails, an administrator must issue a fresh invitation.
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(db.collection(COLLECTIONS.USERS).doc(uid))
      const credentials = await transaction.get(credentialRef)
      if (!userDoc.exists || userDoc.data()?.active === false
        || !setupCredentialIsValid(credentials.data() || {}, setupToken)) {
        throw new HttpsError('permission-denied', 'This setup link is invalid or expired. Request a new invitation.')
      }
      transaction.update(credentialRef, { consumedAt: FieldValue.serverTimestamp(), setupTokenHash: FieldValue.delete() })
    })

    await auth.updateUser(uid, { password })
    await db.collection(COLLECTIONS.USERS).doc(uid).update({
      setupToken: null,
      setupTokenExpiry: null,
      inviteStatus: 'accepted',
      inviteAcceptedAt: FieldValue.serverTimestamp(),
    })

    return {
      success: true,
      message: 'Password set successfully',
    }
  } catch (error: any) {
    if (error instanceof HttpsError) throw error
    console.error('[setUserPassword] Error:', error?.message || error)
    throw new HttpsError('internal', error?.message || 'Failed to set password')
  }
})
