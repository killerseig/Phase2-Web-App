import * as admin from 'firebase-admin'
import { onCall } from 'firebase-functions/v2/https'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import {
  getJobDetails,
  getUserProfile,
  getUserDisplayName,
  verifyAdminRole,
  getDailyLog,
  getTimecard,
  getShopOrder,
  getEmailSettings,
} from './firestoreService'
import {
  sendEmail,
  buildDailyLogEmail,
  buildDailyLogAutoSubmitEmail,
  buildTimecardEmail,
  buildShopOrderEmail,
  buildSecretExpirationEmail,
  buildWelcomeEmail,
  isEmailEnabled,
  getSenderEmail,
  sendDailyLogEmailNotification,
  sendTimecardEmailNotification,
  sendShopOrderEmailNotification,
  sendSecretExpirationWarning,
} from './emailService'

const graphClientId = defineSecret('GRAPH_CLIENT_ID')
const graphTenantId = defineSecret('GRAPH_TENANT_ID')
const graphClientSecret = defineSecret('GRAPH_CLIENT_SECRET')
const outlookSenderEmail = defineSecret('OUTLOOK_SENDER_EMAIL')
import {
  VALID_ROLES,
  ERROR_MESSAGES,
  EMAIL,
  COLLECTIONS,
  EMAIL_STYLES,
} from './constants'

admin.initializeApp()

const db = admin.firestore()
const auth = admin.auth()

/**
 * Send password reset email using Firebase Admin SDK
 * Works without authentication via HTTP callable
 */
export const sendPasswordResetEmail = onRequest(
  async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type')

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { email } = req.body

    if (!email || !email.trim()) {
      res.status(400).json({ error: 'Email is required' })
      return
    }

    try {
      console.log(`[sendPasswordResetEmail] Sending reset email to: ${email}`)

      // Generate password reset link (this sends the email automatically)
      await auth.generatePasswordResetLink(email)
      console.log(`[sendPasswordResetEmail] Email sent successfully to: ${email}`)

      res.json({
        success: true,
        message: `Password reset email sent to ${email}`,
      })
    } catch (error: any) {
      console.error(`[sendPasswordResetEmail] Error:`, error.message)
      res.status(500).json({
        error: error?.message || 'Failed to send password reset email',
      })
    }
  }
)

/**
 * Send Daily Log via email
 */
export const sendDailyLogEmail = onCall({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  const { jobId, dailyLogId, recipients } = request.data

  if (!jobId) {
    throw new Error(ERROR_MESSAGES.JOB_ID_REQUIRED)
  }

  if (!dailyLogId) {
    throw new Error(ERROR_MESSAGES.DAILY_LOG_ID_REQUIRED)
  }

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    throw new Error(ERROR_MESSAGES.RECIPIENTS_REQUIRED)
  }

  try {
    if (!isEmailEnabled()) {
      console.log('[sendDailyLogEmail] Email sending disabled. Skipping send.')
      return { success: true, message: 'Email sending disabled. Skipped.' }
    }

    const log = await getDailyLog(jobId, dailyLogId)
    if (!log) {
      throw new Error(ERROR_MESSAGES.DAILY_LOG_NOT_FOUND)
    }

    const job = await getJobDetails(log?.jobId || '')

    const emailHtml = buildDailyLogEmail(job || { id: '', name: 'Unknown Job', number: '' }, log?.logDate || new Date().toISOString(), log)

    await sendEmail({
      to: recipients,
      subject: `${EMAIL.SUBJECTS.DAILY_LOG} - ${job?.name || 'Job'} - ${log?.logDate || 'N/A'}`,
      html: emailHtml,
    })

    console.log(`Daily log ${dailyLogId} emailed to ${recipients.join(', ')}`)
    return { success: true, message: 'Email sent successfully' }
  } catch (error: any) {
    console.error('Error sending daily log email:', error)
    throw new Error(error.message)
  }
})

/**
 * Send Timecard via email
 */
export const sendTimecardEmail = onCall({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  const { jobId, timecardIds, weekStart, recipients: requestRecipients } = request.data

  if (!jobId) {
    throw new Error(ERROR_MESSAGES.JOB_ID_REQUIRED)
  }
  if (!timecardIds || !Array.isArray(timecardIds) || timecardIds.length === 0) {
    throw new Error('timecardIds array is required')
  }
  if (!weekStart) {
    throw new Error(ERROR_MESSAGES.WEEK_START_REQUIRED)
  }
  const settings = await getEmailSettings()
  const recipients = Array.isArray(settings.timecardSubmitRecipients) && settings.timecardSubmitRecipients.length
    ? settings.timecardSubmitRecipients
    : Array.isArray(requestRecipients)
      ? requestRecipients
      : []

  if (!recipients || recipients.length === 0) {
    throw new Error(ERROR_MESSAGES.RECIPIENTS_REQUIRED)
  }

  try {
    if (!isEmailEnabled()) {
      console.log('[sendTimecardEmail] Email sending disabled. Skipping send.')
      return { success: true, message: 'Email sending disabled. Skipped.' }
    }

    // Fetch all timecards
    const timecards = []
    for (const tcId of timecardIds) {
      const tc = await getTimecard(jobId, weekStart, tcId)
      if (tc) timecards.push(tc)
    }

    if (timecards.length === 0) {
      throw new Error(ERROR_MESSAGES.TIMECARD_NOT_FOUND)
    }

    const job = await getJobDetails(jobId)
    const userName = await getUserDisplayName(request.auth.uid, request.auth.token.email)

    // Build single combined email for all timecards
    let emailHtml = `
      <h2>Timecards Submitted</h2>
      <p><strong>Job:</strong> ${job?.name || 'N/A'} ${job?.number ? `(#${job.number})` : ''}</p>
      <p><strong>Week:</strong> ${weekStart}</p>
      <p><strong>Submitted by:</strong> ${userName}</p>
      <hr>
      <table style="border-collapse: collapse; width: 100%; border: 1px solid #ccc;">
        <thead>
          <tr style="background-color: #f0f0f0; border-bottom: 2px solid #333;">
            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Employee</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Job #</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Area</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Account</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Mon</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Tue</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Wed</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Thu</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Fri</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Sat</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Sun</th>
            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Total</th>
          </tr>
        </thead>
        <tbody>
    `

    for (const tc of timecards) {
      const lines = tc?.lines || []
      if (lines.length === 0) {
        emailHtml += `<tr><td colspan="12" style="border: 1px solid #ccc; padding: 8px;"><em>No entries</em></td></tr>`
        continue
      }
      
      for (const line of lines) {
        const total = (line.mon || 0) + (line.tue || 0) + (line.wed || 0) + 
                     (line.thu || 0) + (line.fri || 0) + (line.sat || 0) + (line.sun || 0)
        emailHtml += `
          <tr style="border-bottom: 1px solid #ccc;">
            <td style="border: 1px solid #ccc; padding: 8px;">${tc?.employeeName || 'N/A'}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">${line.jobNumber || ''}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">${line.area || ''}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">${line.account || ''}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${line.mon || 0}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${line.tue || 0}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${line.wed || 0}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${line.thu || 0}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${line.fri || 0}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${line.sat || 0}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${line.sun || 0}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;"><strong>${total}</strong></td>
          </tr>
        `
      }
    }

    emailHtml += `
        </tbody>
      </table>
    `

      // Build CSV attachment for accounting upload
      const csvAttachment = buildTimecardCsv(timecards, weekStart)

      await sendEmail({
        to: recipients,
        subject: `${EMAIL.SUBJECTS.TIMECARD} - ${timecards.length} timecard(s) - Week of ${weekStart}`,
        html: emailHtml,
        attachments: csvAttachment
          ? [
              {
                name: `timecards-${weekStart}.csv`,
                contentType: 'text/csv',
                contentBytes: Buffer.from(csvAttachment, 'utf-8').toString('base64'),
              },
            ]
          : undefined,
      })

    console.log(`Timecards ${timecardIds.join(', ')} emailed to ${recipients.join(', ')}`)
    return { success: true, message: 'Email sent successfully' }
  } catch (error: any) {
    console.error('Error sending timecard email:', error)
    throw new Error(error.message)
  }
})

function buildTimecardCsv(timecards: any[], weekStart: string): string {
  const headers = ['Employee Name', 'Employee Code', 'Job Code', 'DETAIL_DATE', 'Sub-Section', 'Activity Code', 'Cost Code', 'H_Hours', 'P_HOURS', '', '']
  const rows: string[][] = [headers]

  if (!timecards || timecards.length === 0) {
    return rows.map(r => r.join(',')).join('\n')
  }

  const start = new Date(weekStart)
  if (isNaN(start.getTime())) {
    console.warn('[buildTimecardCsv] Invalid weekStart; using raw value for dates')
  }

  const dayOffsets: Array<{ key: keyof any; label: string; index: number }> = [
    { key: 'sun', label: 'Sun', index: 0 },
    { key: 'mon', label: 'Mon', index: 1 },
    { key: 'tue', label: 'Tue', index: 2 },
    { key: 'wed', label: 'Wed', index: 3 },
    { key: 'thu', label: 'Thu', index: 4 },
    { key: 'fri', label: 'Fri', index: 5 },
    { key: 'sat', label: 'Sat', index: 6 },
  ]

  const formatDate = (offset: number) => {
    if (isNaN(start.getTime())) return weekStart
    const d = new Date(start)
    d.setDate(d.getDate() + offset)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const year = d.getFullYear()
    return \`\${month}/\${day}/\${year}\`
  }

  for (const tc of timecards) {
    const lines = Array.isArray(tc?.lines) ? tc.lines : []
    for (const line of lines) {
      for (const offset of dayOffsets) {
        const hoursVal = Number(line?.[offset.key]) || 0
        const productionVal = Number(line?.production?.[offset.key]) || 0
        if (hoursVal === 0 && productionVal === 0) continue

        rows.push([
          tc?.employeeName || '',
          tc?.employeeId || tc?.employeeNumber || '',
          line?.jobNumber || '',
          formatDate(offset.index),
          line?.area || '',
          line?.account || '',
          line?.costCode || '',
          hoursVal ? String(hoursVal) : '',
          productionVal ? String(productionVal) : '',
          '',
          '',
        ])
      }
    }
  }

  return rows.map(r => r.join(',')).join('\n')
}

/**
 * Send Shop Order via email
 */
export const sendShopOrderEmail = onCall({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  const { shopOrderId, recipients: requestRecipients } = request.data

  if (!shopOrderId) {
    throw new Error(ERROR_MESSAGES.SHOP_ORDER_ID_REQUIRED)
  }
  const settings = await getEmailSettings()
  const recipients = Array.isArray(settings.shopOrderSubmitRecipients) && settings.shopOrderSubmitRecipients.length
    ? settings.shopOrderSubmitRecipients
    : Array.isArray(requestRecipients)
      ? requestRecipients
      : []

  if (!recipients || recipients.length === 0) {
    throw new Error(ERROR_MESSAGES.RECIPIENTS_REQUIRED)
  }

  try {
    if (!isEmailEnabled()) {
      console.log('[sendShopOrderEmail] Email sending disabled. Skipping send.')
      return { success: true, message: 'Email sending disabled. Skipped.' }
    }

    const order = await getShopOrder(shopOrderId)
    if (!order) {
      throw new Error(ERROR_MESSAGES.SHOP_ORDER_NOT_FOUND)
    }

    const job = await getJobDetails(order?.jobId || '')

    const emailHtml = buildShopOrderEmail(order)

    await sendEmail({
      to: recipients,
      subject: `${EMAIL.SUBJECTS.SHOP_ORDER} - ${job?.name || 'Job'} - ${order?.orderDate?.toDate?.()?.toLocaleDateString() || 'N/A'}`,
      html: emailHtml,
    })

    console.log(`Shop order ${shopOrderId} emailed to ${recipients.join(', ')}`)
    return { success: true, message: 'Email sent successfully' }
  } catch (error: any) {
    console.error('Error sending shop order email:', error)
    throw new Error(error.message)
  }
})



/**
 * Internal helper to send daily log email (used by scheduled function)
 */
async function sendDailyLogEmailInternal(jobId: string, dailyLogId: string, recipients: string[]) {
  if (!isEmailEnabled()) {
    console.log('[sendDailyLogEmailInternal] Email sending disabled. Skipping send.')
    return
  }

  const log = await getDailyLog(jobId, dailyLogId)
  if (!log) {
    throw new Error(ERROR_MESSAGES.DAILY_LOG_NOT_FOUND)
  }

  const job = await getJobDetails(log?.jobId || '')
  const emailHtml = buildDailyLogAutoSubmitEmail(job || { id: '', name: 'Unknown Job', number: '' }, log?.logDate || new Date().toISOString())

  await sendEmail({
    to: recipients,
    subject: `${EMAIL.SUBJECTS.DAILY_LOG_AUTO} - ${job?.name || 'Job'} - ${log?.logDate || 'N/A'}`,
    html: emailHtml,
  })
}

/**
 * Delete a user from both Firestore and Firebase Authentication
 * Only callable by authenticated admin users
 */
export const deleteUser = onCall(async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN_DELETE)
  }

  const { uid } = request.data

  if (!uid) {
    throw new Error(ERROR_MESSAGES.UID_REQUIRED)
  }

  try {
    await verifyAdminRole(request.auth.uid)

    // Delete from Firebase Auth
    await auth.deleteUser(uid)

    // Delete from Firestore
    await db.collection(COLLECTIONS.USERS).doc(uid).delete()

    return { success: true, message: 'User deleted successfully' }
  } catch (error: any) {
    throw new Error(error.message || ERROR_MESSAGES.FAILED_TO_DELETE_USER)
  }
})

/**
 * Create a new user account (admin-only)
 * Generates password reset link and sends welcome email
 */
export const createUserByAdmin = onCall({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN_CREATE)
  }

  const { email, firstName, lastName, role } = request.data

  // Validate inputs
  if (!email || !email.trim()) {
    throw new Error(ERROR_MESSAGES.EMAIL_REQUIRED)
  }
  if (!firstName || !firstName.trim()) {
    throw new Error(ERROR_MESSAGES.FIRST_NAME_REQUIRED)
  }
  if (!lastName || !lastName.trim()) {
    throw new Error(ERROR_MESSAGES.LAST_NAME_REQUIRED)
  }

  const userRole = role || 'none'
  if (!VALID_ROLES.includes(userRole)) {
    throw new Error(ERROR_MESSAGES.INVALID_ROLE(VALID_ROLES as any))
  }

  try {
    // Verify caller is admin
    await verifyAdminRole(request.auth.uid)

    // Check if user already exists
    try {
      await auth.getUserByEmail(email)
      throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS)
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') {
        throw err
      }
      // User doesn't exist, continue
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email.trim(),
      emailVerified: false,
    })

    console.log(`[createUserByAdmin] Created auth user: ${userRecord.uid}`)

    // Create a custom setup token for password creation
    const crypto = require('crypto')
    const setupToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    console.log(`[createUserByAdmin] Generated setup token: ${setupToken.substring(0, 10)}...`)

    // Create Firestore profile with setup token
    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set({
      email: userRecord.email,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: userRole,
      active: true,
      createdAt: new Date(),
      setupToken: setupToken,
      setupTokenExpiry: tokenExpiry,
    })

    console.log(`[createUserByAdmin] Created Firestore profile with setup token: ${userRecord.uid}`)
    
    // Verify the token was stored
    const verifyDoc = await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).get()
    const verifyData = verifyDoc.data()
    console.log(`[createUserByAdmin] Verified token stored: ${verifyData?.setupToken?.substring(0, 10)}...`)

    // Build custom setup link with token
    const setupLink = `https://phase2-website.web.app/set-password?setupToken=${setupToken}&uid=${userRecord.uid}`

    // Send welcome email with custom setup link
    if (isEmailEnabled()) {
      const emailHtml = buildWelcomeEmail(firstName, setupLink)

      await sendEmail({
        to: userRecord.email!,
        subject: EMAIL.SUBJECTS.WELCOME,
        html: emailHtml,
      })

      console.log(`[createUserByAdmin] Sent welcome email to ${userRecord.email}`)
    }

    return {
      success: true,
      message: `User created successfully. Welcome email sent to ${userRecord.email}`,
      uid: userRecord.uid,
    }
  } catch (error: any) {
    console.error('[createUserByAdmin] Error:', error.message)
    throw new Error(error.message || ERROR_MESSAGES.FAILED_TO_CREATE_USER)
  }
})

/**
 * Verify setup token for new user account
 * Called from the SetPassword page to validate the token before password creation
 * No authentication required - uses token for validation
 */
export const verifySetupToken = onCall(async (request) => {
  const { uid, setupToken } = request.data

  // Validate inputs
  if (!uid || !setupToken) {
    throw new Error('Missing required parameters: uid and setupToken')
  }

  try {
    // Get the user document with admin privileges
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get()
    
    if (!userDoc.exists) {
      console.log(`[verifySetupToken] User not found: ${uid}`)
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    
    console.log(`[verifySetupToken] Verifying token for user ${uid}`)
    
    // Verify token matches
    if (!userData?.setupToken || userData.setupToken !== setupToken) {
      console.log(`[verifySetupToken] Token mismatch for user ${uid}`)
      throw new Error('Invalid token')
    }

    // Check if token has expired
    const expiryTime = userData.setupTokenExpiry?.toDate?.() || new Date(userData.setupTokenExpiry)
    if (new Date() > expiryTime) {
      console.log(`[verifySetupToken] Token expired for user ${uid}`)
      throw new Error('Token expired')
    }

    console.log(`[verifySetupToken] Token verified successfully for user ${uid}`)
    
    return {
      success: true,
      email: userData.email,
      message: 'Token verified',
    }
  } catch (error: any) {
    console.error(`[verifySetupToken] Error:`, error.message)
    throw new Error(error.message || 'Failed to verify token')
  }
})

/**
 * Set password for new user account using custom setup token
 * Called from the SetPassword page
 */
export const setUserPassword = onCall(async (request) => {
  const { uid, password, setupToken } = request.data

  // Validate inputs
  if (!uid || !password || !setupToken) {
    throw new Error('Missing required parameters: uid, password, and setupToken')
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  try {
    // Verify the user exists and token is valid
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get()
    
    if (!userDoc || !userDoc.exists) {
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    
    // Verify token matches
    if (userData?.setupToken !== setupToken) {
      throw new Error('Invalid setup token')
    }

    // Check if token has expired
    const expiryTime = userData?.setupTokenExpiry?.toDate?.() || new Date(userData?.setupTokenExpiry)
    if (new Date() > expiryTime) {
      throw new Error('Setup token has expired')
    }

    // Update user password in Firebase Auth
    await auth.updateUser(uid, { password })
    console.log(`[setUserPassword] Password set for user: ${uid}`)

    // Clear the setup token from Firestore
    await db.collection(COLLECTIONS.USERS).doc(uid).update({
      setupToken: null,
      setupTokenExpiry: null,
    })

    return {
      success: true,
      message: 'Password set successfully',
    }
  } catch (error: any) {
    console.error('[setUserPassword] Error:', error.message)
    throw new Error(error.message || 'Failed to set password')
  }
})

/**
 * Scheduled function to notify admins of upcoming secret expiration
 * Runs daily at 9:00 AM UTC
 * Sends notification 30 days before secret expiration (Jan 10, 2027)
 */
export const notifySecretExpiration = onSchedule(
  { schedule: 'every day 09:00', secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] },
  async (context) => {
    try {
      const today = new Date()
      const currentDateStr = today.toISOString().split('T')[0] // YYYY-MM-DD format

      // Parse expiration date and notification trigger date
      const expirationDate = new Date(EMAIL.SECRET_EXPIRATION_DATE)
      const notificationTriggerDate = new Date(expirationDate)
      notificationTriggerDate.setDate(notificationTriggerDate.getDate() - EMAIL.SECRET_NOTIFICATION_DAYS)
      const notificationTriggerDateStr = notificationTriggerDate.toISOString().split('T')[0]

      console.log(`[notifySecretExpiration] Today: ${currentDateStr}`)
      console.log(`[notifySecretExpiration] Notification trigger date: ${notificationTriggerDateStr}`)
      console.log(`[notifySecretExpiration] Secret expiration date: ${EMAIL.SECRET_EXPIRATION_DATE}`)

      // Check if today is on or after the notification trigger date
      if (currentDateStr < notificationTriggerDateStr) {
        console.log('[notifySecretExpiration] Not yet time to notify. Exiting.')
        return
      }

      // Check if secret has already expired
      if (currentDateStr > EMAIL.SECRET_EXPIRATION_DATE) {
        console.error('[notifySecretExpiration] Secret has already expired!')
        // Still send warning but with different urgency
      }

      // Get all admin users
      const adminSnapshot = await db
        .collection(COLLECTIONS.USERS)
        .where('role', '==', 'admin')
        .where('active', '==', true)
        .get()

      if (adminSnapshot.empty) {
        console.log('[notifySecretExpiration] No active admin users found')
        return
      }

      const adminEmails = adminSnapshot.docs
        .map(doc => doc.data().email)
        .filter((email: any) => email && email.trim().length > 0)

      console.log(`[notifySecretExpiration] Found ${adminEmails.length} admin(s): ${adminEmails.join(', ')}`)

      if (adminEmails.length === 0) {
        console.log('[notifySecretExpiration] No admin emails found')
        return
      }

      // Send notification email to each admin
      const emailHtml = buildSecretExpirationEmail()

      await sendEmail({
        to: adminEmails,
        subject: EMAIL.SUBJECTS.SECRET_EXPIRATION,
        html: emailHtml,
      })

      console.log(`[notifySecretExpiration] Notification sent to ${adminEmails.length} admin(s)`)
    } catch (error: any) {
      console.error('[notifySecretExpiration] Error:', error.message)
      // Don't throw - we want the function to complete even if there's an issue
      // so the scheduler doesn't mark it as failed
    }
  }
)

