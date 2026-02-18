import * as admin from 'firebase-admin'
import PDFDocument from 'pdfkit'
import { onCall } from 'firebase-functions/v2/https'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
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
  buildTimecardsEmail,
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

function normalizeRecipients(...groups: any[]): string[] {
  const merged = groups.flatMap(group => (Array.isArray(group) ? group : []))
  const cleaned = merged
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

function formatEmailDate(value: any): string {
  try {
    if (!value) return 'N/A'
    const asDate = typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value)
    if (Number.isNaN(asDate.getTime())) return 'N/A'
    return asDate.toLocaleDateString()
  } catch {
    return 'N/A'
  }
}

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
  const recipients = normalizeRecipients(settings.dailyLogSubmitRecipients, requestRecipients)

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
  const recipients = normalizeRecipients(settings.timecardSubmitRecipients, requestRecipients)

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

    const emailHtml = buildTimecardsEmail({
      jobName: job?.name,
      jobNumber: job?.number,
      submittedBy: userName,
      weekStart,
      timecards: normalizedTimecards,
    })

      const csvAttachment = buildTimecardCsv(normalizedTimecards, weekStart)
      const csvFileName = buildTimecardCsvFilename(weekStart, job?.number)
      const pdfFileName = buildTimecardPdfFilename(weekStart, job?.number)
      const pdfBuffer = await buildTimecardPdfBuffer({
        jobName: job?.name,
        jobNumber: job?.number,
        submittedBy: userName,
        weekStart,
        timecards: normalizedTimecards,
      })

      const attachments: Array<{ name: string; contentType?: string; contentBytes: string }> = []
      if (csvAttachment) {
        attachments.push({
          name: csvFileName,
          contentType: 'text/csv',
          contentBytes: Buffer.from(csvAttachment, 'utf-8').toString('base64'),
        })
      }
      attachments.push({
        name: pdfFileName,
        contentType: 'application/pdf',
        contentBytes: pdfBuffer.toString('base64'),
      })

      await sendEmail({
        to: recipients,
        subject: `${EMAIL.SUBJECTS.TIMECARD} - ${timecards.length} timecard(s) - Week of ${weekStart}`,
        html: emailHtml,
        attachments,
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
  const rows: string[][] = [headers, Array(headers.length).fill('')]

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

  const escapeCsv = (value: any): string => {
    const str = String(value ?? '')
    if (!str.length) return ''
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  for (const tc of timecards) {
    const lines = Array.isArray(tc?.lines) ? tc.lines : []
    for (const line of lines) {
      for (const offset of dayOffsets) {
        const hoursVal = Number(line?.[offset.key]) || 0
        const productionVal = Number(line?.production?.[offset.key]) || 0
        if (hoursVal === 0 && productionVal === 0) continue

        rows.push([
          escapeCsv(tc?.employeeName || ''),
          escapeCsv(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || ''),
          escapeCsv(line?.jobNumber || ''),
          escapeCsv(formatDate(offset.index)),
          escapeCsv(line?.area || line?.subsectionArea || ''),
          escapeCsv(line?.account || line?.acct || ''),
          escapeCsv(line?.costCode || line?.difC || ''),
          escapeCsv(hoursVal ? String(hoursVal) : ''),
          escapeCsv(productionVal ? String(productionVal) : ''),
          '',
          '',
        ])
      }
    }
  }

  return rows.map(r => r.join(',')).join('\n')
}

function buildTimecardCsvFilename(weekStart: string, jobCode?: string): string {
  const weekDate = new Date(weekStart)
  if (!Number.isNaN(weekDate.getTime())) {
    weekDate.setDate(weekDate.getDate() + 6)
    const yyyy = weekDate.getFullYear()
    const mm = String(weekDate.getMonth() + 1).padStart(2, '0')
    const dd = String(weekDate.getDate()).padStart(2, '0')
    const normalizedJobCode = String(jobCode || '').trim()
    return normalizedJobCode ? `${yyyy}-${mm}-${dd} ${normalizedJobCode}.csv` : `${yyyy}-${mm}-${dd}.csv`
  }

  const normalizedWeekStart = String(weekStart || '').trim() || 'timecards'
  const normalizedJobCode = String(jobCode || '').trim()
  return normalizedJobCode ? `${normalizedWeekStart} ${normalizedJobCode}.csv` : `${normalizedWeekStart}.csv`
}

function buildTimecardPdfFilename(weekStart: string, jobCode?: string): string {
  const weekDate = new Date(weekStart)
  if (!Number.isNaN(weekDate.getTime())) {
    weekDate.setDate(weekDate.getDate() + 6)
    const yyyy = weekDate.getFullYear()
    const mm = String(weekDate.getMonth() + 1).padStart(2, '0')
    const dd = String(weekDate.getDate()).padStart(2, '0')
    const normalizedJobCode = String(jobCode || '').trim()
    return normalizedJobCode ? `${yyyy}-${mm}-${dd} ${normalizedJobCode}.pdf` : `${yyyy}-${mm}-${dd}.pdf`
  }

  const normalizedWeekStart = String(weekStart || '').trim() || 'timecards'
  const normalizedJobCode = String(jobCode || '').trim()
  return normalizedJobCode ? `${normalizedWeekStart} ${normalizedJobCode}.pdf` : `${normalizedWeekStart}.pdf`
}

async function buildTimecardPdfBuffer(payload: {
  jobName?: string
  jobNumber?: string
  submittedBy?: string
  weekStart?: string
  timecards: any[]
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 36, size: 'LETTER' })
  const chunks: Buffer[] = []

  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const safeText = (value: any) => String(value ?? '').trim() || '-'
  const fmt = (value: any) => {
    const n = Number(value) || 0
    return Number.isInteger(n) ? String(n) : n.toFixed(2)
  }

  const weekStartDate = payload.weekStart ? new Date(payload.weekStart) : null
  const weekEndDate = weekStartDate && !Number.isNaN(weekStartDate.getTime()) ? new Date(weekStartDate) : null
  if (weekEndDate) weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekLabel = weekStartDate && weekEndDate
    ? `${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}`
    : safeText(payload.weekStart)

  const ensureSpace = (y: number, needed = 24): number => {
    const bottomLimit = doc.page.height - doc.page.margins.bottom
    if (y + needed > bottomLimit) {
      doc.addPage()
      return doc.page.margins.top
    }
    return y
  }

  await new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on('end', () => resolve())
    doc.on('error', (err) => reject(err))

    let y = doc.page.margins.top
    doc.font('Helvetica-Bold').fontSize(14).text('Timecards This Week', doc.page.margins.left, y)
    y += 20
    doc.font('Helvetica').fontSize(10)
    doc.text(`Job: ${safeText(payload.jobName)}${payload.jobNumber ? ` (#${payload.jobNumber})` : ''}`, doc.page.margins.left, y)
    y += 14
    doc.text(`Week: ${weekLabel}`, doc.page.margins.left, y)
    y += 14
    doc.text(`Submitted By: ${safeText(payload.submittedBy)}`, doc.page.margins.left, y)
    y += 18

    const timecards = Array.isArray(payload.timecards) ? payload.timecards : []
    if (!timecards.length) {
      doc.font('Helvetica').fontSize(10).text('No submitted timecards found.', doc.page.margins.left, y)
      doc.end()
      return
    }

    for (const tc of timecards) {
      y = ensureSpace(y, 48)
      doc.font('Helvetica-Bold').fontSize(11).text(`Employee: ${safeText(tc?.employeeName)}`, doc.page.margins.left, y)
      y += 14
      doc.font('Helvetica').fontSize(9)
      doc.text(`Employee Code: ${safeText(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber)}`, doc.page.margins.left, y)
      y += 12

      const header = ['Job', 'Area', 'Acct', 'Cost', ...dayLabels, 'Tot Hrs', 'Tot Prod', 'Line $'].join(' | ')
      y = ensureSpace(y, 24)
      doc.font('Helvetica-Bold').fontSize(8).text(header, doc.page.margins.left, y, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      })
      y += 12
      doc.font('Helvetica').fontSize(8)

      const lines = Array.isArray(tc?.lines) ? tc.lines : []
      for (const line of lines) {
        y = ensureSpace(y, 14)
        const dayHours = dayKeys.map((k) => fmt(line?.[k]))
        const row = [
          safeText(line?.jobNumber),
          safeText(line?.area || line?.subsectionArea),
          safeText(line?.account || line?.acct),
          safeText(line?.costCode || line?.difC),
          ...dayHours,
          fmt(line?.totals?.hours),
          fmt(line?.totals?.production),
          fmt(line?.totals?.lineTotal),
        ].join(' | ')

        doc.text(row, doc.page.margins.left, y, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          ellipsis: true,
        })
        y += 11
      }

      y = ensureSpace(y, 18)
      doc.font('Helvetica-Bold').fontSize(9)
      doc.text(
        `Totals - Hours: ${fmt(tc?.totals?.hoursTotal)} | Production: ${fmt(tc?.totals?.productionTotal)} | Line Total: ${fmt(tc?.totals?.lineTotal)}`,
        doc.page.margins.left,
        y,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
      )
      y += 18
      doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#AAAAAA').stroke()
      y += 12
      doc.font('Helvetica').fillColor('black')
    }

    doc.end()
  })

  return Buffer.concat(chunks)
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
  const recipients = normalizeRecipients(settings.shopOrderSubmitRecipients, requestRecipients)

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

    const orderDateLabel = formatEmailDate(order?.orderDate || order?.createdAt || order?.updatedAt)

    await sendEmail({
      to: recipients,
      subject: `${EMAIL.SUBJECTS.SHOP_ORDER} - ${job?.name || 'Job'} - ${orderDateLabel}`,
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

async function removeEmailFromRecipientLists(email: string): Promise<{ settingsUpdated: boolean; jobsUpdated: number }> {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return { settingsUpdated: false, jobsUpdated: 0 }
  }

  let settingsUpdated = false
  let jobsUpdated = 0

  const settingsRef = db.collection('settings').doc('email')
  const settingsSnap = await settingsRef.get()
  if (settingsSnap.exists) {
    const data = settingsSnap.data() || {}
    const filterRecipientList = (values: any): string[] => {
      const list = Array.isArray(values) ? values : []
      return list.filter((value: any) => String(value || '').trim().toLowerCase() !== normalizedEmail)
    }

    const nextTimecard = filterRecipientList(data.timecardSubmitRecipients)
    const nextShopOrder = filterRecipientList(data.shopOrderSubmitRecipients)
    const nextDailyLog = filterRecipientList(data.dailyLogSubmitRecipients)

    const changed =
      nextTimecard.length !== (Array.isArray(data.timecardSubmitRecipients) ? data.timecardSubmitRecipients.length : 0) ||
      nextShopOrder.length !== (Array.isArray(data.shopOrderSubmitRecipients) ? data.shopOrderSubmitRecipients.length : 0) ||
      nextDailyLog.length !== (Array.isArray(data.dailyLogSubmitRecipients) ? data.dailyLogSubmitRecipients.length : 0)

    if (changed) {
      await settingsRef.set(
        {
          timecardSubmitRecipients: nextTimecard,
          shopOrderSubmitRecipients: nextShopOrder,
          dailyLogSubmitRecipients: nextDailyLog,
        },
        { merge: true }
      )
      settingsUpdated = true
    }
  }

  const jobsSnap = await db.collection(COLLECTIONS.JOBS).get()
  const batch = db.batch()
  jobsSnap.docs.forEach((jobDoc) => {
    const currentRecipients = Array.isArray(jobDoc.data()?.dailyLogRecipients)
      ? jobDoc.data().dailyLogRecipients
      : []
    if (!currentRecipients.length) return

    const nextRecipients = currentRecipients.filter(
      (value: any) => String(value || '').trim().toLowerCase() !== normalizedEmail
    )

    if (nextRecipients.length !== currentRecipients.length) {
      batch.update(jobDoc.ref, { dailyLogRecipients: nextRecipients })
      jobsUpdated += 1
    }
  })

  if (jobsUpdated > 0) {
    await batch.commit()
  }

  return { settingsUpdated, jobsUpdated }
}

export const removeEmailFromAllRecipientLists = onCall(async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  await verifyAdminRole(request.auth.uid)

  const rawEmail = String(request.data?.email || '').trim()
  if (!rawEmail) {
    throw new Error(ERROR_MESSAGES.EMAIL_REQUIRED)
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

    // Delete from Firebase Auth
    await auth.deleteUser(uid)

    // Delete from Firestore
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
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

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
    let expiryTime: Date
    if (userData.setupTokenExpiry?.toDate) {
      // It's a Firestore Timestamp
      expiryTime = userData.setupTokenExpiry.toDate()
    } else if (userData.setupTokenExpiry instanceof Date) {
      expiryTime = userData.setupTokenExpiry
    } else {
      expiryTime = new Date(userData.setupTokenExpiry)
    }
    
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
    let expiryTime: Date
    if (userData?.setupTokenExpiry?.toDate) {
      // It's a Firestore Timestamp
      expiryTime = userData.setupTokenExpiry.toDate()
    } else if (userData?.setupTokenExpiry instanceof Date) {
      expiryTime = userData.setupTokenExpiry
    } else {
      expiryTime = new Date(userData?.setupTokenExpiry)
    }
    
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

