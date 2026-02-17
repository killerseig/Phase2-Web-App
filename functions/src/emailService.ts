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

function displayValue(value: any): string {
  if (value === null || value === undefined) return 'N/A'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : 'N/A'
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return 'N/A'
}

function formatAnyDate(value: any): string {
  try {
    if (!value) return 'N/A'
    const asDate = typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value)
    if (Number.isNaN(asDate.getTime())) return 'N/A'
    return asDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return 'N/A'
  }
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
        <p style="color: #999; font-size: 12px;"><strong>Note:</strong> This link expires in 7 days.</p>
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
  const formattedDate = formatAnyDate(logDate)

  const manpowerLines = (Array.isArray(dailyLog?.manpowerLines) && dailyLog.manpowerLines.length
    ? dailyLog.manpowerLines
    : [{ trade: '', count: 0, areas: '' }])
    .map((line: any) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(line.trade)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(line.count)}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(line.areas)}</td>
    </tr>
  `).join('')

  const indoorClimateRows = (Array.isArray(dailyLog?.indoorClimateReadings) && dailyLog.indoorClimateReadings.length
    ? dailyLog.indoorClimateReadings
    : [{ area: '', high: '', low: '', humidity: '' }])
    .map((reading: any) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${displayValue(reading.area)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.high)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.low)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${displayValue(reading.humidity)}</td>
    </tr>
  `).join('')

  const attachments = (dailyLog?.attachments || [])
    .map((att: any) => {
      const label = att?.type === 'ptp' ? 'PTP Photo' : att?.type === 'photo' ? 'Photo' : 'Attachment'
      const name = att?.name || att?.path || 'Attachment'
      const url = att?.url || '#'
      const hasImagePreview = typeof url === 'string' && /^https?:\/\//i.test(url)
      return `
        <li style="margin-bottom: 12px;">
          <div style="margin-bottom: 4px;"><strong>${label}:</strong> <a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></div>
          ${hasImagePreview
            ? `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${name}" style="max-width: 180px; max-height: 120px; border: 1px solid #ddd; border-radius: 4px; display: block;" /></a>`
            : ''}
        </li>
      `
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
        <p><strong>Project Name:</strong> ${displayValue(dailyLog?.projectName)}</p>
        <p><strong>Job Site Numbers / Notes:</strong> ${displayValue(dailyLog?.jobSiteNumbers)}</p>
        <p><strong>Foreman on Site:</strong> ${displayValue(dailyLog?.foremanOnSite)}</p>
        <p><strong>Site Foreman Assistant:</strong> ${displayValue(dailyLog?.siteForemanAssistant)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Manpower</h3>
        <p><strong>Manpower Summary:</strong> ${displayValue(dailyLog?.manpower)}</p>
        <p><strong>Weekly Schedule:</strong> ${displayValue(dailyLog?.weeklySchedule)}</p>
        <p><strong>Manpower Assessment:</strong> ${displayValue(dailyLog?.manpowerAssessment)}</p>

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

        <h3 style="color: #555; font-size: 16px; margin: 20px 0 10px 0;">Indoor Climate</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Floor / Area</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">High (°F)</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Low (°F)</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Humidity (%)</th>
            </tr>
          </thead>
          <tbody>
            ${indoorClimateRows}
          </tbody>
        </table>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Safety & Concerns</h3>
        <p><strong>Safety Concerns:</strong> ${displayValue(dailyLog?.safetyConcerns)}</p>
        <p><strong>AHA Reviewed:</strong> ${displayValue(dailyLog?.ahaReviewed)}</p>
        <p><strong>Schedule Concerns:</strong> ${displayValue(dailyLog?.scheduleConcerns)}</p>
        <p><strong>Budget Concerns:</strong> ${displayValue(dailyLog?.budgetConcerns)}</p>
        <p><strong>Comments About Ship:</strong> ${displayValue(dailyLog?.commentsAboutShip)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Deliveries & Materials</h3>
        <p><strong>Deliveries Received:</strong> ${displayValue(dailyLog?.deliveriesReceived)}</p>
        <p><strong>Deliveries Needed:</strong> ${displayValue(dailyLog?.deliveriesNeeded)}</p>
        <p><strong>New Work Authorizations:</strong> ${displayValue(dailyLog?.newWorkAuthorizations)}</p>
        <p><strong>QC Inspection:</strong> ${displayValue(dailyLog?.qcInspection)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />

        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Notes & Action Items</h3>
        <p><strong>Notes & Correspondence:</strong> ${displayValue(dailyLog?.notesCorrespondence)}</p>
        <p><strong>Action Items:</strong> ${displayValue(dailyLog?.actionItems)}</p>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
        <h3 style="color: #555; font-size: 16px; margin: 15px 0 10px 0;">Attachments</h3>
        ${attachments
          ? `<ul style="padding-left: 18px; margin: 0; list-style: disc;">${attachments}</ul>`
          : '<p>N/A</p>'}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
    </div>
  `
}

export function buildTimecardsEmail(payload: {
  jobName?: string
  jobNumber?: string
  submittedBy?: string
  weekStart?: string
  timecards: any[]
}): string {
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const fmtNum = (val: any, digits = 2) => (Number(val) || 0).toFixed(digits)
  const fmtCell = (val: any) => {
    const n = Number(val) || 0
    return Number.isInteger(n) ? String(n) : n.toFixed(2)
  }
  const fmtMoney = (val: any) => `$${(Number(val) || 0).toFixed(2)}`
  const start = payload.weekStart ? new Date(payload.weekStart) : null
  const end = start && !Number.isNaN(start.getTime()) ? new Date(start) : null
  if (end) end.setUTCDate(end.getUTCDate() + 6)
  const weekLabel = start && end
    ? `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
    : 'N/A'

  const cardMarkupList = (Array.isArray(payload.timecards) ? payload.timecards : []).map((tc) => {
    const lines = Array.isArray(tc?.lines) ? tc.lines : []

    const totalHoursByDay: Record<string, number> = {}
    dayKeys.forEach((key) => {
      totalHoursByDay[key] = lines.reduce((sum: number, line: any) => sum + (Number(line?.[key]) || 0), 0)
    })

    const accountSummaryMap = new Map<string, { job: string; acct: string; office: string; amt: number }>()
    lines.forEach((line: any) => {
      const job = displayValue(line?.jobNumber)
      const acct = displayValue(line?.account)
      const office = displayValue(line?.area)
      const amt = Number(line?.totals?.lineTotal) || 0
      const key = `${job}|${acct}|${office}`
      const existing = accountSummaryMap.get(key)
      if (existing) {
        existing.amt += amt
      } else {
        accountSummaryMap.set(key, { job, acct, office, amt })
      }
    })

    const accountRows = Array.from(accountSummaryMap.values())
      .map((row) => `
        <tr>
          <td style="padding: 4px 6px; border: 1px solid #222;">${row.job}</td>
          <td style="padding: 4px 6px; border: 1px solid #222;">${row.acct}</td>
          <td style="padding: 4px 6px; border: 1px solid #222;">${row.office}</td>
          <td style="padding: 4px 6px; border: 1px solid #222; text-align: right;">${fmtMoney(row.amt)}</td>
        </tr>
      `)
      .join('')

    const hoursTotal = Number(tc?.totals?.hoursTotal) || 0
    const regularHours = Math.min(hoursTotal, 40)
    const overtimeHours = Math.max(hoursTotal - 40, 0)

    const lineRows = lines.length
      ? lines.map((line: any) => {
          const hoursRow = dayKeys.map((key) => `<td>${fmtCell(line?.[key])}</td>`).join('')
          const prodRow = dayKeys.map((key) => `<td>${fmtCell(line?.production?.[key])}</td>`).join('')
          const costRow = dayKeys.map((key) => `<td>${fmtMoney(line?.unitCost?.[key])}</td>`).join('')
          return `
            <tr>
              <td rowspan="3">${displayValue(line?.jobNumber)}</td>
              <td rowspan="3">${displayValue(line?.account)}</td>
              <td rowspan="3">${displayValue(line?.difH || line?.difP || line?.difC || line?.costCode)}</td>
              <td>H</td>
              ${hoursRow}
              <td>${fmtNum(line?.totals?.hours)}</td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td style="border-top: 1px dashed #777;">P</td>
              ${prodRow}
              <td></td>
              <td>${fmtNum(line?.totals?.production)}</td>
              <td></td>
            </tr>
            <tr>
              <td style="border-top: 1px dashed #777;">C</td>
              ${costRow}
              <td>${fmtMoney(line?.totals?.lineTotal)}</td>
              <td></td>
              <td></td>
            </tr>
          `
        }).join('')
      : '<tr><td colspan="14" style="text-align:center;">No entries</td></tr>'

    return `
      <div class="tc-card-wrap" style="border: 2px solid #111; padding: 8px; margin: 4px 0; background:#fff; font-size:11px;">
      <div style="text-align:center; font-weight:700; font-size:16px; margin-bottom:6px;">PHASE 2 COMPANY</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
        <tr>
          <td style="width:55%; padding:4px 6px; border-bottom:1px solid #222;"><strong>EMP. NAME:</strong> ${displayValue(tc?.employeeName)}</td>
          <td style="width:20%; padding:4px 6px; border-bottom:1px solid #222;"><strong>EMPLOYEE #:</strong> ${displayValue(tc?.employeeNumber || tc?.employeeId)}</td>
          <td style="width:25%; padding:4px 6px; border-bottom:1px solid #222;"><strong>WEEK ENDING:</strong> ${displayValue(end ? end.toLocaleDateString() : '')}</td>
        </tr>
        <tr>
          <td style="padding:4px 6px;"><strong>OCCUPATION:</strong> ${displayValue(tc?.occupation)}</td>
          <td style="padding:4px 6px;"><strong>WAGE:</strong> ${displayValue(tc?.wage)}</td>
          <td style="padding:4px 6px;"><strong>STATUS:</strong> ${displayValue(tc?.status)}</td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size:11px; table-layout: fixed;">
        <thead>
          <tr>
            <th style="border:1px solid #222;">JOB #</th>
            <th style="border:1px solid #222;">ACCT</th>
            <th style="border:1px solid #222;">DIF</th>
            <th style="border:1px solid #222;">TYPE</th>
            ${dayLabels.map((day) => `<th>${day}</th>`).join('')}
            <th style="border:1px solid #222;">TOTAL</th>
            <th style="border:1px solid #222;">PROD</th>
            <th style="border:1px solid #222;">OFF</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows}
        </tbody>
        <tfoot>
          <tr style="font-weight:700;">
            <td colspan="4" style="border:1px solid #222; padding:4px 6px;">TOTAL HOURS</td>
            ${dayKeys.map((key) => `<td style="border:1px solid #222; text-align:center;">${fmtCell(totalHoursByDay[key])}</td>`).join('')}
            <td style="border:1px solid #222; text-align:center;">${fmtNum(hoursTotal)}</td>
            <td style="border:1px solid #222; text-align:center;">${fmtNum(tc?.totals?.productionTotal)}</td>
            <td style="border:1px solid #222;"></td>
          </tr>
        </tfoot>
      </table>

      <table style="width:100%; border-collapse:collapse; margin-top:6px;">
        <tr>
        <td style="width:68%; vertical-align:top; padding-right:8px;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead>
            <tr>
              <th style="border:1px solid #222; padding:4px 6px; text-align:left;">JOB or GL</th>
              <th style="border:1px solid #222; padding:4px 6px; text-align:left;">ACCT</th>
              <th style="border:1px solid #222; padding:4px 6px; text-align:left;">OFFICE</th>
              <th style="border:1px solid #222; padding:4px 6px; text-align:right;">AMT</th>
            </tr>
          </thead>
          <tbody>
            ${accountRows || '<tr><td colspan="4" style="border:1px solid #222; padding:4px 6px; text-align:center;">N/A</td></tr>'}
          </tbody>
        </table>
        </td>
        <td style="width:32%; vertical-align:top;">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <tbody>
            <tr>
              <td style="padding:4px 6px;"><strong>OT</strong></td>
              <td style="padding:4px 6px; text-align:right;">${fmtNum(overtimeHours)}</td>
            </tr>
            <tr>
              <td style="padding:4px 6px;"><strong>REG</strong></td>
              <td style="padding:4px 6px; text-align:right;">${fmtNum(regularHours)}</td>
            </tr>
            <tr>
              <td style="padding:4px 6px;"><strong>SUBCONTRACTED</strong></td>
              <td style="padding:4px 6px; text-align:right;">${tc?.subcontracted ? 'YES' : 'NO'}</td>
            </tr>
          </tbody>
        </table>
        </td>
        </tr>
      </table>

      <p style="margin-top:8px;"><strong>NOTES:</strong> ${displayValue(tc?.notes)}</p>
      </div>
    `
  })

  const cardsHtml = cardMarkupList.length
    ? `
      <table role="presentation" class="tc-pair-table" style="width:100%; border-collapse:collapse; table-layout:fixed;">
        ${Array.from({ length: Math.ceil(cardMarkupList.length / 2) }, (_, pairIndex) => {
          const left = cardMarkupList[pairIndex * 2] || ''
          const right = cardMarkupList[pairIndex * 2 + 1] || ''
          return `
            <tr class="tc-card-pair">
              <td class="tc-card-cell" style="width:50%; vertical-align:top; padding-right:6px;">${left}</td>
              <td class="tc-card-cell" style="width:50%; vertical-align:top; padding-left:6px;">${right || '&nbsp;'}</td>
            </tr>
          `
        }).join('')}
      </table>
    `
    : '<p>No timecards found.</p>'

  return `
    ${EMAIL_STYLES}
    <style>
      .tc-print .email-container {
        background: #ffffff !important;
        padding: 8px !important;
        color: #111111 !important;
      }
      .tc-print .header {
        background: #ffffff !important;
        color: #111111 !important;
        border: 1px solid #111111 !important;
        border-bottom: 0 !important;
        padding: 10px !important;
      }
      .tc-print .content {
        background: #ffffff !important;
        border: 1px solid #111111 !important;
        border-top: 0 !important;
        padding: 10px !important;
      }
      .tc-print .footer {
        background: #ffffff !important;
        color: #333333 !important;
        border: 1px solid #111111 !important;
        border-top: 0 !important;
        padding: 8px !important;
      }
      .tc-print table,
      .tc-print th,
      .tc-print td {
        color: #111111 !important;
        background: #ffffff !important;
        border-color: #111111 !important;
      }
      .tc-print tr {
        background: #ffffff !important;
      }
      .tc-print .tc-card-wrap,
      .tc-print .tc-card-cell,
      .tc-print .tc-card-pair {
        page-break-inside: avoid !important;
        break-inside: avoid-page !important;
      }
      .tc-print .tc-card-pair {
        page-break-before: auto !important;
        page-break-after: auto !important;
      }
      @media print {
        .tc-print {
          margin: 0 !important;
          padding: 0 !important;
        }
        .tc-print .email-container,
        .tc-print .content {
          padding: 6px !important;
        }
        .tc-print .tc-card-wrap {
          margin: 2px 0 !important;
        }
      }
    </style>
    <div class="tc-print">
    <div class="email-container">
      <div class="header">
        <h1>Timecards Submitted</h1>
      </div>
      <div class="content">
        <p><strong>Job:</strong> ${displayValue(payload.jobName)} ${payload.jobNumber ? `(#${payload.jobNumber})` : ''}</p>
        <p><strong>Week:</strong> ${weekLabel}</p>
        <p><strong>Submitted by:</strong> ${displayValue(payload.submittedBy)}</p>
        ${cardsHtml}
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} Phase 2. All rights reserved.</p>
      </div>
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

function formatOrderEmailDate(value: any): string {
  try {
    if (!value) return 'N/A'
    const dateValue = typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value)
    if (Number.isNaN(dateValue.getTime())) return 'N/A'
    return dateValue.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return 'N/A'
  }
}

/**
 * Build HTML template for shop order email
 */
export function buildShopOrderEmail(order: any): string {
  const items = order?.items || []
  const totalAmount = Number(order?.totalAmount)
  const hasTotalAmount = Number.isFinite(totalAmount)
  const orderIdentifier = order?.orderNumber || order?.id || 'N/A'
  const orderDate = formatOrderEmailDate(order?.orderDate || order?.createdAt || order?.updatedAt)

  const itemsHtml = items.length > 0 ? `
    <h3>Order Items:</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f0f0f0; border-bottom: 2px solid #333;">
          <th style="text-align: center; padding: 8px; border-right: 1px solid #ddd;">#</th>
          <th style="text-align: left; padding: 8px; border-right: 1px solid #ddd;">Item Description</th>
          <th style="text-align: center; padding: 8px;">Quantity</th>
          <th style="text-align: left; padding: 8px; border-left: 1px solid #ddd;">Catalog Item ID</th>
          <th style="text-align: left; padding: 8px;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item: any, index: number) => `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="text-align: center; padding: 8px; border-right: 1px solid #ddd;">${index + 1}</td>
            <td style="padding: 8px; border-right: 1px solid #ddd;">${item.description || 'N/A'}</td>
            <td style="text-align: center; padding: 8px;">${item.quantity || 0}</td>
            <td style="padding: 8px; border-left: 1px solid #ddd;">${item.catalogItemId || '-'}</td>
            <td style="padding: 8px;">${item.note || item.notes || '-'}</td>
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
        <p><strong>Order Number:</strong> ${orderIdentifier}</p>
        <p><strong>Order Date:</strong> ${orderDate}</p>
        ${hasTotalAmount ? `<p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>` : ''}
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
