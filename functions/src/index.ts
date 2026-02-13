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
const storageBucket = admin.storage().bucket()

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const MAX_ATTACHMENT_TOTAL_BYTES = 15 * 1024 * 1024
const MAX_ATTACHMENT_COUNT = 10

async function loadDailyLogAttachments(log: any) {
  const attachments: Array<{ name: string; contentType?: string; contentBytes: string }> = []
  const files = Array.isArray(log?.attachments) ? log.attachments : []
  let totalBytes = 0

  for (const att of files) {
    if (!att?.path) continue
    if (attachments.length >= MAX_ATTACHMENT_COUNT) {
      console.warn('[sendDailyLogEmail] Skipping extra attachments beyond limit', { limit: MAX_ATTACHMENT_COUNT })
      break
    }

    try {
      const file = storageBucket.file(att.path)
      const [exists] = await file.exists()
      if (!exists) {
        console.warn('[sendDailyLogEmail] Attachment missing in storage', { path: att.path })
        continue
      }

      const [metadata] = await file.getMetadata()
      const size = Number(metadata?.size) || 0
      if (totalBytes + size > MAX_ATTACHMENT_TOTAL_BYTES) {
        console.warn('[sendDailyLogEmail] Skipping attachment to respect size budget', {
          path: att.path,
          size,
          totalBytes,
          max: MAX_ATTACHMENT_TOTAL_BYTES,
        })
        continue
      }

      const [buffer] = await file.download()
      totalBytes += buffer.length

      attachments.push({
        name: att?.name || file.name.split('/').pop() || 'attachment',
        contentType: metadata?.contentType || 'application/octet-stream',
        contentBytes: buffer.toString('base64'),
      })
    } catch (err) {
      console.warn('[sendDailyLogEmail] Failed to load attachment', { path: att?.path, err })
    }
  }

  return attachments
}

function normalizeTimecardForEmail(tc: any) {
  if (Array.isArray(tc?.lines) && tc.lines.length) return tc
  const jobs = Array.isArray(tc?.jobs) ? tc.jobs : []

  const lines = jobs.map((job: any) => {
    const hoursByDay: Record<typeof DAY_KEYS[number], number> = {
      sun: 0,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
    }
    const productionByDay: Record<typeof DAY_KEYS[number], number> = {
      sun: 0,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
    }
    const unitCostByDay: Record<typeof DAY_KEYS[number], number> = {
      sun: 0,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
    }

    const days = Array.isArray(job?.days) ? job.days : []
    for (const day of days) {
      const idx = typeof day?.dayOfWeek === 'number' && day.dayOfWeek >= 0 && day.dayOfWeek < DAY_KEYS.length
        ? day.dayOfWeek
        : days.indexOf(day)
      const key = DAY_KEYS[idx]
      if (key === undefined) continue
      hoursByDay[key] = Number(day?.hours) || 0
      productionByDay[key] = Number(day?.production) || 0
      unitCostByDay[key] = Number(day?.unitCost) || 0
    }

    const line: any = {
      jobNumber: job?.jobNumber || '',
      area: job?.area || '',
      account: job?.acct || job?.account || '',
      costCode: job?.costCode || job?.difC || '',
      difH: job?.difH || '',
      difP: job?.difP || '',
      difC: job?.difC || '',
      production: productionByDay,
      unitCost: unitCostByDay,
    }

    DAY_KEYS.forEach(k => {
      line[k] = hoursByDay[k]
    })

    const totalHours = Object.values(hoursByDay).reduce((s, v) => s + v, 0)
    const totalProduction = Object.values(productionByDay).reduce((s, v) => s + v, 0)
    let totalLine = 0
    DAY_KEYS.forEach(k => {
      totalLine += (productionByDay[k] || 0) * (unitCostByDay[k] || 0)
    })

    line.totals = {
      hours: totalHours,
      production: totalProduction,
      lineTotal: totalLine,
    }

    return line
  })

  const totals = lines.reduce(
    (agg: any, line: any) => {
      agg.hoursTotal += Number(line?.totals?.hours) || 0
      agg.productionTotal += Number(line?.totals?.production) || 0
      agg.lineTotal += Number(line?.totals?.lineTotal) || 0
      return agg
    },
    { hoursTotal: 0, productionTotal: 0, lineTotal: 0 }
  )

  return {
    ...tc,
    lines,
    totals: tc?.totals || totals,
  }
}

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

  const { jobId, dailyLogId, recipients: requestRecipients } = request.data

  if (!jobId) {
    throw new Error(ERROR_MESSAGES.JOB_ID_REQUIRED)
  }

  if (!dailyLogId) {
    throw new Error(ERROR_MESSAGES.DAILY_LOG_ID_REQUIRED)
  }

  const settings = await getEmailSettings()
  const recipients = Array.isArray(settings.dailyLogSubmitRecipients) && settings.dailyLogSubmitRecipients.length
    ? settings.dailyLogSubmitRecipients
    : Array.isArray(requestRecipients)
      ? requestRecipients
      : []

  if (!recipients || recipients.length === 0) {
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
    const attachments = await loadDailyLogAttachments(log)

    await sendEmail({
      to: recipients,
      subject: `${EMAIL.SUBJECTS.DAILY_LOG} - ${job?.name || 'Job'} - ${log?.logDate || 'N/A'}`,
      html: emailHtml,
      ...(attachments.length ? { attachments } : {}),
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
    const missingIds: string[] = []
    for (const tcId of timecardIds) {
      console.log('[sendTimecardEmail] Fetching timecard', { jobId, weekStart, tcId })
      const tc = await getTimecard(jobId, weekStart, tcId)
      if (tc) {
        timecards.push(tc)
      } else {
        missingIds.push(tcId)
        console.warn('[sendTimecardEmail] Timecard not found', { jobId, weekStart, tcId })
      }
    }

    if (timecards.length === 0) {
      const availableSnap = await db.collection(COLLECTIONS.JOBS).doc(jobId).collection('timecards').get()
      const availableIds = availableSnap.docs.map(d => d.id)
      console.error('[sendTimecardEmail] No timecards found for requested IDs', {
        jobId,
        weekStart,
        requested: timecardIds,
        missing: missingIds,
        availableCount: availableIds.length,
        availableSample: availableIds.slice(0, 25),
      })
      throw new Error(`${ERROR_MESSAGES.TIMECARD_NOT_FOUND}: ${missingIds.join(', ') || 'none found'}`)
    }

    const normalizedTimecards = timecards.map(normalizeTimecardForEmail)

    const job = await getJobDetails(jobId)
    const userName = await getUserDisplayName(request.auth.uid, request.auth.token.email)

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const fmtNum = (val: any, digits = 2) => (Number(val) || 0).toFixed(digits)
    const fmtMoney = (val: any) => `$${(Number(val) || 0).toFixed(2)}`
    const fmtCell = (val: any) => {
      const n = Number(val) || 0
      return Number.isInteger(n) ? String(n) : n.toFixed(2)
    }

    const emailStyles = `
      <style>
        .tc-wrapper { font-family: 'Segoe UI', Arial, sans-serif; color: #e7ecff; background: #0d111f; padding: 12px; }
        .tc-card { border: 1px solid #1f2638; border-radius: 8px; margin-bottom: 16px; background: #0f1424; box-shadow: 0 8px 18px rgba(0,0,0,0.35); }
        .tc-card-header { padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; background: linear-gradient(90deg, #0f1424, #182442); border-bottom: 1px solid #1f2638; }
        .tc-emp-name { font-weight: 700; font-size: 16px; color: #f1f4ff; }
        .tc-emp-meta { color: #9aa6c6; font-size: 13px; }
        .tc-status { padding: 4px 10px; border-radius: 14px; font-size: 12px; font-weight: 700; text-transform: lowercase; background: #d1f4e8; color: #0f5132; }
        .tc-status.draft { background: #fff3cd; color: #664d03; }
        .tc-meta { font-size: 13px; color: #c7cee5; }
        .tc-table { width: 100%; border-collapse: collapse; background: #0f1424; }
        .tc-table th { font-size: 12px; font-weight: 700; text-align: center; padding: 8px 6px; background: #10182d; border-bottom: 1px solid #1f2638; color: #e7ecff; }
        .tc-table td { padding: 8px 6px; text-align: center; font-size: 13px; color: #e7ecff; border-bottom: 1px solid #1f2638; }
        .tc-row-soft td { background: #131b30; }
        .tc-left { font-weight: 600; color: #f1f4ff; border-right: 1px solid #1f2638; }
        .tc-label { font-weight: 700; width: 50px; border-right: 1px solid #1f2638; }
        .tc-dif { border-right: 1px solid #1f2638; }
        .tc-total { font-weight: 700; color: #f1f4ff; }
        .col-job { width: 80px; }
        .col-acct { width: 70px; }
        .col-blank { width: 50px; }
        .col-div { width: 70px; }
        .col-day { width: 90px; }
        .col-total { width: 80px; }
        .tc-footer { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #1f2638; background: #0f1424; }
        .tc-notes { padding: 12px 14px; border-top: 1px solid #1f2638; background: #0f1424; font-size: 13px; color: #c7cee5; }
        .pill { display: inline-block; padding: 6px 10px; background: #111933; border: 1px solid #1f2638; border-radius: 8px; font-weight: 700; color: #e7ecff; }
      </style>
    `

    const renderJobRows = (line: any, totals: any) => {
      const hoursRow = dayLabels.map((_, idx) => `<td class="col-day">${fmtCell(line[DAY_KEYS[idx]])}</td>`).join('')
      const prodRow = dayLabels.map((_, idx) => `<td class="col-day">${fmtCell(line.production?.[DAY_KEYS[idx]])}</td>`).join('')
      const costRow = dayLabels.map((_, idx) => `<td class="col-day">${fmtMoney(line.unitCost?.[DAY_KEYS[idx]])}</td>`).join('')

      return `
        <tr>
          <td rowspan="3" class="tc-left">${line.jobNumber || ''}</td>
          <td rowspan="3" class="tc-left">${line.account || ''}</td>
          <td class="tc-label">H</td>
          <td class="tc-dif">${line.difH || ''}</td>
          ${hoursRow}
          <td class="tc-total">${fmtNum(line?.totals?.hours)}</td>
        </tr>
        <tr class="tc-row-soft">
          <td class="tc-label">P</td>
          <td class="tc-dif">${line.difP || ''}</td>
          ${prodRow}
          <td class="tc-total">${fmtNum(line?.totals?.production)}</td>
        </tr>
        <tr>
          <td class="tc-label">C</td>
          <td class="tc-dif">${line.difC || ''}</td>
          ${costRow}
          <td class="tc-total">${fmtMoney(line?.totals?.lineTotal)}</td>
        </tr>
      `
    }

    const weekStartDate = new Date(weekStart)
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6)
    const fmtDate = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`

      let emailHtml = `
      ${emailStyles}
      <div class="tc-wrapper">
        <div style="margin-bottom:14px;">
          <h2 style="margin:0 0 6px 0; color:#f1f4ff;">Timecards Submitted</h2>
          <div class="tc-meta">Job: ${job?.name || 'N/A'} ${job?.number ? `(#${job.number})` : ''}</div>
          <div class="tc-meta">Week: ${fmtDate(weekStartDate)} – ${fmtDate(weekEndDate)}</div>
          <div class="tc-meta">Submitted by: ${userName}</div>
        </div>
    `

    normalizedTimecards.forEach(tc => {
      const lines = Array.isArray(tc?.lines) ? tc.lines : []
      const hasLines = lines.length > 0
      const statusClass = tc.status === 'submitted' ? 'submitted' : 'draft'
      const hoursTotal = Number(tc?.totals?.hoursTotal) || 0
      const regularHours = Math.min(hoursTotal, 40)
      const overtimeHours = Math.max(hoursTotal - 40, 0)
      emailHtml += `
        <div class="tc-card">
          <div class="tc-card-header">
            <div>
              <div class="tc-emp-name">${tc.employeeName || 'Employee'}</div>
              <div class="tc-emp-meta">#${tc.employeeNumber || ''}${tc.occupation ? ` · ${tc.occupation}` : ''}</div>
            </div>
            <div style="text-align:right;">
              <div class="tc-meta">Totals: ${fmtNum(tc?.totals?.hoursTotal)} hrs · ${fmtNum(tc?.totals?.productionTotal)} prod · ${fmtMoney(tc?.totals?.lineTotal)}</div>
              <div class="tc-status ${statusClass}">${tc.status || 'submitted'}</div>
            </div>
          </div>

          <div style="padding:12px 14px;">
            <table class="tc-table">
              <thead>
                <tr>
                  <th class="col-job">Job #</th>
                  <th class="col-acct">Acct</th>
                  <th class="col-blank"></th>
                  <th class="col-div">Dif</th>
                  ${dayLabels.map(d => `<th class="col-day">${d}</th>`).join('')}
                  <th class="col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                ${hasLines ? lines.map((line: any) => renderJobRows(line, tc.totals)).join('') : '<tr><td colspan="12" style="padding:10px; text-align:center;">No entries</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="tc-footer">
            <div class="pill">Overtime: ${fmtNum(overtimeHours)}</div>
            <div class="pill">Regular: ${fmtNum(regularHours)}</div>
          </div>
          ${tc.notes ? `<div class="tc-notes"><strong>Notes:</strong> ${tc.notes}</div>` : ''}
        </div>
      `
    })

    emailHtml += '</div>'

      // Build CSV attachment for accounting upload
      const csvAttachment = buildTimecardCsv(normalizedTimecards, weekStart)

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
    return `${month}/${day}/${year}`
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

  const { jobId, shopOrderId, recipients: requestRecipients } = request.data

  if (!jobId) {
    throw new Error(ERROR_MESSAGES.JOB_ID_REQUIRED)
  }
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

    let order: any = null

    // Primary: job-scoped collection (jobs/{jobId}/shop_orders/{shopOrderId})
    const jobOrderSnap = await db.collection(COLLECTIONS.JOBS).doc(jobId).collection('shop_orders').doc(shopOrderId).get()
    if (jobOrderSnap.exists) {
      order = { id: jobOrderSnap.id, ...jobOrderSnap.data(), jobId }
    } else {
      // Fallback to legacy root collection (shopOrders)
      order = await getShopOrder(shopOrderId)
    }

    if (!order) {
      throw new Error(ERROR_MESSAGES.SHOP_ORDER_NOT_FOUND)
    }

    const job = await getJobDetails(order?.jobId || jobId)

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
  const attachments = await loadDailyLogAttachments(log)

  await sendEmail({
    to: recipients,
    subject: `${EMAIL.SUBJECTS.DAILY_LOG_AUTO} - ${job?.name || 'Job'} - ${log?.logDate || 'N/A'}`,
    html: emailHtml,
    ...(attachments.length ? { attachments } : {}),
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

