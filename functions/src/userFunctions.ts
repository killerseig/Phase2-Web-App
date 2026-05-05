import { randomBytes } from 'crypto'
import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import {
  COLLECTIONS,
  EMAIL,
  ERROR_MESSAGES,
  VALID_ROLES,
} from './constants'
import { buildPasswordResetEmail, buildWelcomeEmail, isEmailEnabled, sendEmail } from './emailService'
import { getAppBaseUrl, getGraphEmailSecrets } from './functionConfig'
import { removeEmailFromRecipientLists } from './recipientCleanup'
import { auth, db } from './runtime'
import { verifyAdminRole } from './firestoreService'

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

async function sendUserInvite(options: {
  uid: string
  email: string
  firstName: string
  sentByUid?: string | null
}) {
  const userRef = db.collection(COLLECTIONS.USERS).doc(options.uid)
  const tokenRecord = createSetupTokenRecord()

  await userRef.update(tokenRecord)

  await sendEmail({
    to: options.email,
    subject: EMAIL.SUBJECTS.WELCOME,
    html: buildWelcomeEmail(options.firstName || 'there', buildSetupLink(options.uid, tokenRecord.setupToken)),
  })

  await userRef.update({
    inviteStatus: 'sent',
    inviteSentAt: admin.firestore.FieldValue.serverTimestamp(),
    inviteSentByUid: options.sentByUid ?? null,
  })
}

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

export const handleUserAccessRevocationCleanup = onDocumentUpdated('users/{uid}', async (event) => {
  const beforeData = event.data?.before?.data()
  const afterData = event.data?.after?.data()

  if (!afterData) return

  const beforeRole = String(beforeData?.role || '').trim().toLowerCase()
  const afterRole = String(afterData?.role || '').trim().toLowerCase()
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
  const userRole = String(request.data?.role || 'none').trim().toLowerCase()
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
  if (!VALID_ROLES.includes(userRole as typeof VALID_ROLES[number])) {
    throw new HttpsError('invalid-argument', ERROR_MESSAGES.INVALID_ROLE(VALID_ROLES as unknown as string[]))
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
      console.error('[createUserByAdmin] Invite send failed after create:', inviteError?.message || inviteError)
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

export const sendPendingUserInvites = onCall({ secrets: getGraphEmailSecrets() }, async (request) => {
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
      const role = String(userData.role || '').trim().toLowerCase()
      const active = userData.active !== false

      if (!email || !active || role === 'none' || !VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
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
})

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
    if (!userData?.setupToken || userData.setupToken !== setupToken) {
      throw new HttpsError('permission-denied', 'Invalid token')
    }

    if (new Date() > parseTokenExpiry(userData.setupTokenExpiry)) {
      throw new HttpsError('deadline-exceeded', 'Token expired')
    }

    return {
      success: true,
      email: userData.email,
      message: 'Token verified',
    }
  } catch (error: any) {
    if (error instanceof HttpsError) throw error
    console.error('[verifySetupToken] Error:', error?.message || error)
    throw new HttpsError('internal', error?.message || 'Failed to verify token')
  }
})

export const requestPasswordResetEmail = onCall({ secrets: getGraphEmailSecrets() }, async (request) => {
  const email = String(request.data?.email || '').trim().toLowerCase()
  if (!email) {
    throw new HttpsError('invalid-argument', 'Enter your email address first.')
  }

  const successMessage = 'If an account exists for that email, a password reset email has been sent.'

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
})

export const setUserPassword = onCall(async (request) => {
  const uid = String(request.data?.uid || '').trim()
  const password = String(request.data?.password || '')
  const setupToken = String(request.data?.setupToken || '').trim()

  if (!uid || !password || !setupToken) {
    throw new HttpsError('invalid-argument', 'Missing required parameters: uid, password, and setupToken')
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters')
  }

  try {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get()
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found')
    }

    const userData = userDoc.data()
    if (userData?.setupToken !== setupToken) {
      throw new HttpsError('permission-denied', 'Invalid setup token')
    }
    if (new Date() > parseTokenExpiry(userData?.setupTokenExpiry)) {
      throw new HttpsError('deadline-exceeded', 'Setup token has expired')
    }

    await auth.updateUser(uid, { password })
    await db.collection(COLLECTIONS.USERS).doc(uid).update({
      setupToken: null,
      setupTokenExpiry: null,
      inviteStatus: 'accepted',
      inviteAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
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
