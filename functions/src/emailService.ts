/**
 * Email Service
 * Handles email sending via Microsoft Graph API
 */

import axios from 'axios'
import { defineSecret, defineBoolean } from 'firebase-functions/params'
import { EMAIL, DEFAULTS, EMAIL_STYLES } from './constants'
import { JobDetails } from './firestoreService'

// Define secrets for Graph API credentials
const graphClientId = defineSecret('GRAPH_CLIENT_ID')
const graphTenantId = defineSecret('GRAPH_TENANT_ID')
const graphClientSecret = defineSecret('GRAPH_CLIENT_SECRET')
const outlookSenderEmail = defineSecret('OUTLOOK_SENDER_EMAIL')
const emailEnabled = defineBoolean('EMAIL_ENABLED', { default: true })

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Get Azure AD access token for Graph API
 */
async function getGraphAuthToken(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    console.log('[getGraphAuthToken] Using cached token')
    return cachedToken.token
  }

  try {
    const clientId = graphClientId.value()
    const tenantId = graphTenantId.value()
    const clientSecret = graphClientSecret.value()

    console.log('[getGraphAuthToken] Requesting new token from Azure AD')

    const response = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const token = response.data.access_token
    const expiresIn = response.data.expires_in || 3600

    // Cache the token
    cachedToken = {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
    }

    console.log('[getGraphAuthToken] Token obtained successfully, expires in', expiresIn, 'seconds')
    return token
  } catch (error: any) {
    console.error('[getGraphAuthToken] Error getting token')
    console.error('[getGraphAuthToken] Error status:', error.response?.status)
    console.error('[getGraphAuthToken] Error details:', error.response?.data)
    throw new Error(`Failed to get Graph API token: ${error.message}`)
  }
}

/**
 * Check if email sending is enabled
 */
export function isEmailEnabled(): boolean {
  return emailEnabled.value()
}

/**
 * Get sender email address
 */
export function getSenderEmail(): string {
  return outlookSenderEmail.value()
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Build HTML template for welcome email
 */
export function buildWelcomeEmail(firstName: string, resetLink: string): string {
  return `
    ${EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Welcome to Phase 2</h1>
      </div>
      <div class="content">
        <p>Welcome, ${firstName || 'User'}!</p>
        <p>Your account has been created in the Phase 2 application. To get started, please follow these steps:</p>
        
        <h2 style="color: #333; margin-top: 20px; font-size: 18px;">Getting Started:</h2>
        <ol style="margin-top: 10px; line-height: 1.8;">
          <li>Click the button below to set your password</li>
          <li>You'll be taken directly to the application login page after setting your password</li>
          <li>Use your email and new password to log in</li>
        </ol>
        
        <div style="margin: 25px 0; text-align: center;">
          <p style="margin-bottom: 15px;"><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Set Your Password</a></p>
        </div>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #666;"><strong>Or visit us directly:</strong> <a href="https://phase2-website.web.app" style="color: #007bff; text-decoration: none;">https://phase2-website.web.app</a></p>
        </div>
        
        <p style="margin-top: 20px; color: #666; font-size: 14px;">If you did not create this account, please ignore this email.</p>
        <p style="color: #999; font-size: 12px;"><strong>Note:</strong> This link expires in 24 hours.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `
}

/**
 * Build HTML template for daily log auto-submit email
 */
export function buildDailyLogAutoSubmitEmail(jobDetails: JobDetails, logDate: string): string {
  const formattedDate = new Date(logDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
    ${EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Daily Log Auto-Submitted</h1>
      </div>
      <div class="content">
        <p><strong>Job:</strong> ${jobDetails.name || 'Unnamed Job'}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p>A daily log has been auto-submitted for this job. Please review the Phase 2 application for full details.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `
}

/**
 * Build HTML template for daily log email
 */
export function buildDailyLogEmail(jobDetails: JobDetails, logDate: string, dailyLog: any): string {
  const formattedDate = new Date(logDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const manpowerLines = dailyLog?.manpowerLines?.map((line: any) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${line.trade || ''}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${line.count || 0}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${line.areas || ''}</td>
    </tr>
  `).join('') || ''

  const attachments = (dailyLog?.attachments || [])
    .map((att: any) => {
      const label = att?.type === 'ptp' ? 'PTP Photo' : att?.type === 'photo' ? 'Photo' : 'Attachment'
      const name = att?.name || att?.path || 'Attachment'
      const url = att?.url || '#'
      return `<li style="margin-bottom: 6px;"><strong>${label}:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></li>`
    })
    .join('')

  return `
    ${EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Daily Log Submitted</h1>
      </div>
      <div class="content">
        <h2 style="color: #333; font-size: 18px; margin: 20px 0 10px 0;">${jobDetails.name || 'Unnamed Job'} ${jobDetails.number ? `(#${jobDetails.number})` : ''}</h2>
        <p><strong>Date:</strong> ${formattedDate}</p>

        <h3 style="color: #555; font-size: 16px; margin: 20px 0 10px 0;">Site Information</h3>
        ${dailyLog?.projectName ? `<p><strong>Project Name:</strong> ${dailyLog.projectName}</p>` : ''}
        ${dailyLog?.jobSiteNumbers ? `<p><strong>Job Site Numbers / Notes:</strong> ${dailyLog.jobSiteNumbers}</p>` : ''}
        ${dailyLog?.foremanOnSite ? `<p><strong>Foreman on Site:</strong> ${dailyLog.foremanOnSite}</p>` : ''}
        ${dailyLog?.siteForemanAssistant ? `<p><strong>Site Foreman Assistant:</strong> ${dailyLog.siteForemanAssistant}</p>` : ''}

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Manpower</h3>
        ${dailyLog?.manpower ? `<p><strong>Manpower Summary:</strong> ${dailyLog.manpower}</p>` : ''}
        ${dailyLog?.weeklySchedule ? `<p><strong>Weekly Schedule:</strong> ${dailyLog.weeklySchedule}</p>` : ''}
        ${dailyLog?.manpowerAssessment ? `<p><strong>Manpower Assessment:</strong> ${dailyLog.manpowerAssessment}</p>` : ''}

        ${manpowerLines ? `
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Trade</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Count</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Areas</th>
            </tr>
          </thead>
          <tbody>
            ${manpowerLines}
          </tbody>
        </table>
        ` : ''}

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Safety & Concerns</h3>
        ${dailyLog?.safetyConcerns ? `<p><strong>Safety Concerns:</strong> ${dailyLog.safetyConcerns}</p>` : ''}
        ${dailyLog?.ahaReviewed ? `<p><strong>AHA Reviewed:</strong> ${dailyLog.ahaReviewed}</p>` : ''}
        ${dailyLog?.scheduleConcerns ? `<p><strong>Schedule Concerns:</strong> ${dailyLog.scheduleConcerns}</p>` : ''}
        ${dailyLog?.budgetConcerns ? `<p><strong>Budget Concerns:</strong> ${dailyLog.budgetConcerns}</p>` : ''}
        ${dailyLog?.commentsAboutShip ? `<p><strong>Comments About Ship:</strong> ${dailyLog.commentsAboutShip}</p>` : ''}

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Deliveries & Materials</h3>
        ${dailyLog?.deliveriesReceived ? `<p><strong>Deliveries Received:</strong> ${dailyLog.deliveriesReceived}</p>` : ''}
        ${dailyLog?.deliveriesNeeded ? `<p><strong>Deliveries Needed:</strong> ${dailyLog.deliveriesNeeded}</p>` : ''}
        ${dailyLog?.newWorkAuthorizations ? `<p><strong>New Work Authorizations:</strong> ${dailyLog.newWorkAuthorizations}</p>` : ''}
        ${dailyLog?.qcInspection ? `<p><strong>QC Inspection:</strong> ${dailyLog.qcInspection}</p>` : ''}

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Notes & Action Items</h3>
        ${dailyLog?.notesCorrespondence ? `<p><strong>Notes & Correspondence:</strong> ${dailyLog.notesCorrespondence}</p>` : ''}
        ${dailyLog?.actionItems ? `<p><strong>Action Items:</strong> ${dailyLog.actionItems}</p>` : ''}

        ${attachments ? `
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Attachments</h3>
        <ul style="padding-left: 18px; margin: 0; list-style: disc;">
          ${attachments}
        </ul>
        ` : ''}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `
}

/**
 * Build HTML template for timecard email
 */
export function buildTimecardEmail(employeeName: string, weekEnding: string): string {
  const formattedDate = new Date(weekEnding).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
    ${EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Timecard Submitted</h1>
      </div>
      <div class="content">
        <p><strong>Employee:</strong> ${employeeName}</p>
        <p><strong>Week Ending:</strong> ${formattedDate}</p>
        <p>A timecard has been submitted. Please review the Phase 2 application for full details.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `
}

/**
 * Build HTML template for shop order email
 */
export function buildShopOrderEmail(order: any): string {
  const items = order?.items || []
  const itemsHtml = items.length > 0 ? `
    <h3>Order Items:</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f0f0f0; border-bottom: 2px solid #333;">
          <th style="text-align: left; padding: 8px; border-right: 1px solid #ddd;">Item Description</th>
          <th style="text-align: center; padding: 8px;">Quantity</th>
          <th style="text-align: left; padding: 8px;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item: any) => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px; border-right: 1px solid #ddd;">${item.description || 'N/A'}</td>
            <td style="text-align: center; padding: 8px;">${item.quantity || 0}</td>
            <td style="padding: 8px;">${item.note || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<p><em>No items in this order</em></p>'

  return `
    ${EMAIL_STYLES}
    <div class="email-container">
      <div class="header">
        <h1>Shop Order Submitted</h1>
      </div>
      <div class="content">
        <p><strong>Order Number:</strong> ${order?.orderNumber || 'N/A'}</p>
        <p><strong>Total Amount:</strong> $${(order?.totalAmount || 0).toFixed(2)}</p>
        <p><strong>Status:</strong> ${order?.status || 'draft'}</p>
        ${itemsHtml}
        <p>A shop order has been submitted. Please review the Phase 2 application for full details.</p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `
}

/**
 * Build HTML template for client secret expiration notification
 */
export function buildSecretExpirationEmail(): string {
  return `
    ${EMAIL_STYLES}
    <div class="email-container">
      <div class="header" style="background-color: #dc3545;">
        <h1>⚠️ Action Required: Client Secret Expiring Soon</h1>
      </div>
      <div class="content">
        <p style="color: #d32f2f; font-weight: bold;">Your Azure AD client secret is expiring in 30 days.</p>
        <p><strong>Expiration Date:</strong> ${EMAIL.SECRET_EXPIRATION_DATE}</p>
        <p>To avoid service disruption, please renew your client secret before the expiration date.</p>
        
        <h3>Steps to Renew:</h3>
        <p><strong>What to do:</strong></p>
        <ol>
          <li>Sign in to Azure Portal</li>
          <li>Navigate to App registrations → Phase 2 Email Service</li>
          <li>Go to Certificates & secrets</li>
          <li>Create a new client secret</li>
          <li>Update Firebase function secrets with the new value</li>
          <li>Redeploy Cloud Functions</li>
        </ol>
        
        <p><strong>What to do:</strong></p>
        <ol>
          <li>Contact your Microsoft 365 administrator</li>
          <li>Request a new client secret for AppID: f31ac0ab-6b28-44a7-ad73-afb71c64898f</li>
          <li>Provide the new secret to your Phase 2 technical team for deployment</li>
        </ol>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated notification. Time remaining: ${EMAIL.SECRET_NOTIFICATION_DAYS} days from notification.
        </p>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

/**
 * Send email via Microsoft Graph API
 */
export async function sendEmail(options: {
  to: string | string[]
  subject: string
  html: string
  attachments?: Array<{
    name: string
    contentType?: string
    contentBytes: string
  }>
}): Promise<void> {
  if (!isEmailEnabled()) {
    console.log('[sendEmail] Email sending disabled. Skipping send.')
    return
  }

  try {
    // Get access token
    const token = await getGraphAuthToken()

    // Ensure to is an array
    const recipients = Array.isArray(options.to) ? options.to : [options.to]

    if (recipients.length === 0) {
      throw new Error('No recipients provided')
    }

    // Validate email addresses
    const invalidEmails = recipients.filter(email => !isValidEmailFormat(email.trim()))
    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`)
    }

    const senderEmail = outlookSenderEmail.value()

    console.log(`[sendEmail] Sending email to ${recipients.join(', ')} from ${senderEmail}`)
    console.log(`[sendEmail] Subject: ${options.subject}`)

    // Build Graph API request payload
    const payload = {
      message: {
        subject: options.subject,
        body: {
          contentType: 'HTML',
          content: options.html,
        },
        toRecipients: recipients.map(email => ({
          emailAddress: {
            address: email.trim(),
          },
        })),
        ...(options.attachments && options.attachments.length
          ? {
              attachments: options.attachments.map(att => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: att.name,
                contentType: att.contentType || 'application/octet-stream',
                contentBytes: att.contentBytes,
              })),
            }
          : {}),
      },
      saveToSentItems: true,
    }

    console.log('[sendEmail] Payload:', JSON.stringify(payload, null, 2))

    const graphEndpoint = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`

    console.log('[sendEmail] Using endpoint:', graphEndpoint)

    // Send via Graph API
    const response = await axios.post(graphEndpoint, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    console.log(`[sendEmail] Email sent successfully. Status: ${response.status}`)
  } catch (error: any) {
    console.error('[sendEmail] Error sending email')
    console.error('[sendEmail] Error status:', error.response?.status)
    console.error('[sendEmail] Error headers:', error.response?.headers)
    console.error('[sendEmail] Error data:', JSON.stringify(error.response?.data, null, 2))
    console.error('[sendEmail] Full error message:', error.message)

    throw new Error(`Failed to send email: ${error.message}`)
  }
}

/**
 * Validate email format
 */
function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Send daily log email notification
 */
export async function sendDailyLogEmailNotification(
  recipients: string[],
  jobDetails: JobDetails,
  logDate: string,
  dailyLog?: any
): Promise<void> {
  const html = buildDailyLogEmail(jobDetails, logDate, dailyLog || {})
  await sendEmail({
    to: recipients,
    subject: `${EMAIL.SUBJECTS.DAILY_LOG} - ${jobDetails.name || 'Job'} - ${logDate}`,
    html,
  })
}

/**
 * Send timecard email notification
 */
export async function sendTimecardEmailNotification(
  recipients: string[],
  employeeName: string,
  weekEnding: string
): Promise<void> {
  const html = buildTimecardEmail(employeeName, weekEnding)
  await sendEmail({
    to: recipients,
    subject: `${EMAIL.SUBJECTS.TIMECARD} - ${employeeName}`,
    html,
  })
}

/**
 * Send shop order email notification
 */
export async function sendShopOrderEmailNotification(
  recipients: string[],
  order: any
): Promise<void> {
  const html = buildShopOrderEmail(order)
  await sendEmail({
    to: recipients,
    subject: `${EMAIL.SUBJECTS.SHOP_ORDER} - Order #${order?.orderNumber || 'N/A'}`,
    html,
  })
}

/**
 * Send secret expiration warning email
 */
export async function sendSecretExpirationWarning(adminEmails: string[]): Promise<void> {
  const html = buildSecretExpirationEmail()
  await sendEmail({
    to: adminEmails,
    subject: '⚠️ Client Secret Expiring Soon - Action Required',
    html,
  })
}
