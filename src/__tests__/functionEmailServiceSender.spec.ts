import { describe, expect, it } from 'vitest'

import { EMAIL } from '../../functions/src/constants'
import {
  buildDailyLogEmail,
  buildDailyLogEmailSubject,
  buildEmailSendLogSummary,
  buildGraphSenderRecipient,
  buildPasswordResetEmail,
  buildShopOrderEmail,
  buildShopOrderEmailSubject,
  buildTimecardEmailSubject,
  buildTimecardsEmail,
  buildWelcomeEmail,
} from '../../functions/src/emailService'

describe('function email service sender identity', () => {
  it('uses the Phase 2 display name for Microsoft Graph sender payloads', () => {
    expect(buildGraphSenderRecipient(' no-reply@phase2co.com ')).toEqual({
      emailAddress: {
        address: 'no-reply@phase2co.com',
        name: EMAIL.SENDER_DISPLAY_NAME,
      },
    })
    expect(EMAIL.SENDER_DISPLAY_NAME).toBe('Phase 2')
  })

  it('logs only message counts, never body links or attachment bytes', () => {
    const sensitiveLink = 'https://phase2.example/reset?token=private-token'
    const sensitiveBytes = 'private-base64-attachment-bytes'
    const summary = buildEmailSendLogSummary({
      to: ['first@example.com', 'second@example.com'],
      subject: 'Reset your password',
      html: `<a href="${sensitiveLink}">Reset</a>`,
      attachments: [{ name: 'photo.jpg', contentBytes: sensitiveBytes }],
    })

    expect(summary).toEqual({
      recipientCount: 2,
      attachmentCount: 1,
      hasHtmlBody: true,
    })
    expect(JSON.stringify(summary)).not.toContain(sensitiveLink)
    expect(JSON.stringify(summary)).not.toContain(sensitiveBytes)
    expect(JSON.stringify(summary)).not.toContain('first@example.com')
  })

  it('escapes user-controlled names in account emails without breaking secure links', () => {
    const setupLink = 'https://phase2.example/set-password?uid=user-1&setupToken=secret'
    const resetLink = 'https://identity.example/reset?mode=resetPassword&oobCode=secret'
    const welcomeHtml = buildWelcomeEmail('<img src=x onerror=alert(1)>', setupLink)
    const resetHtml = buildPasswordResetEmail('<script>alert(1)</script>', resetLink)

    expect(welcomeHtml).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(welcomeHtml).toContain(setupLink.replace('&', '&amp;'))
    expect(welcomeHtml).not.toContain('<img src=x onerror=alert(1)>')
    expect(resetHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(resetHtml).toContain(resetLink.replace('&', '&amp;'))
    expect(resetHtml).not.toContain('<script>alert(1)</script>')
  })
})

describe('function email inbox labels', () => {
  it('puts workflow type, foreman, job number, and job name early in subjects', () => {
    expect(
      buildDailyLogEmailSubject(
        { id: 'job-1', name: 'Lucky 3 Ranch', number: '5229' },
        '2026-06-17',
        { foremanName: 'Vince Hintz' },
      ),
    ).toBe('Daily Log Report | Vince Hintz | #5229 Lucky 3 Ranch | 6/17/2026')

    expect(
      buildShopOrderEmailSubject({
        id: 'order-1',
        foremanName: 'CJ Blanchard',
        jobCode: '736',
        jobName: 'Shop',
        orderDate: '2026-07-12',
      }),
    ).toBe('Shop Order | CJ Blanchard | #736 Shop | Order #20260712000000')

    expect(
      buildTimecardEmailSubject({
        submittedBy: 'Rocky Rodriguez',
        jobNumber: '7505',
        jobName: 'CSU Vet Hospital',
        weekStart: '2026-07-12',
      }),
    ).toBe('Timecard Report | Rocky Rodriguez | #7505 CSU Vet Hospital | Week 7/12/2026')
  })

  it('adds hidden preview text so inbox snippets repeat the searchable context', () => {
    expect(
      buildDailyLogEmail({ id: 'job-1', name: 'Lucky 3 Ranch', number: '5229' }, '2026-06-17', {
        foremanName: 'Vince Hintz',
      }),
    ).toContain('Daily Log Report | Vince Hintz | #5229 Lucky 3 Ranch | 6/17/2026')

    expect(
      buildShopOrderEmail({
        id: 'order-1',
        foremanName: 'CJ Blanchard',
        jobCode: '736',
        jobName: 'Shop',
        orderDate: '2026-07-12',
        items: [],
      }),
    ).toContain('Shop Order | CJ Blanchard | #736 Shop | Order #20260712000000')

    expect(
      buildTimecardsEmail({
        submittedBy: 'Rocky Rodriguez',
        jobNumber: '7505',
        jobName: 'CSU Vet Hospital',
        weekStart: '2026-07-12',
        timecards: [],
      }),
    ).toContain('Timecard Report | Rocky Rodriguez | #7505 CSU Vet Hospital | Week 7/12/2026')
  })

  it('keeps the shop order printed item table balanced like the field form', () => {
    const html = buildShopOrderEmail({
      id: 'order-1',
      foremanName: 'CJ Blanchard',
      jobCode: '736',
      jobName: 'Shop',
      orderDate: '2026-07-12',
      requestedDeliveryDate: '2026-07-16',
      items: [
        {
          id: 'item-1',
          description: 'Gang Box - Office',
          orderedQuantity: 1,
          note: 'Deliver to trailer',
        },
      ],
    })

    expect(html).toContain('>Pulled</th>')
    expect(html).toContain('>Verified</th>')
    expect(html).not.toContain('>Price</th>')
    expect(html).toContain('width: 68px')
    expect(html).toContain('width: 80px')
    expect(html).toContain('width: 160px')
    expect(html).toContain('width: 334px')
    expect(html).toContain('width: 130px')
  })

  it('preserves daily log textarea line breaks in the submitted email body', () => {
    const html = buildDailyLogEmail(
      { id: 'job-1', name: 'Lucky 3 Ranch', number: '5229' },
      '2026-06-17',
      {
        foremanName: 'Vince Hintz',
        weeklySchedule: [
          'We may have an issue.',
          'When Nile tried generating a daily log, the text lost the separate lines.',
          '',
          'The text saving feature does cause some issues.',
        ].join('\n'),
        manpowerAssessment: 'First crew note.\r\nSecond crew note.',
        notesCorrespondence: '<script>alert("bad")</script>\nSafe line',
      },
    )

    expect(html).toContain(
      'We may have an issue.<br>When Nile tried generating a daily log, the text lost the separate lines.<br><br>The text saving feature does cause some issues.',
    )
    expect(html).toContain(
      '<div style="font-weight: bold; margin-bottom: 4px;">Weekly Schedule:</div>',
    )
    expect(html).not.toContain('<strong>Weekly Schedule:</strong> We may have an issue.')
    expect(html).toContain('First crew note.<br>Second crew note.')
    expect(html).toContain('&lt;script&gt;alert(&quot;bad&quot;)&lt;/script&gt;<br>Safe line')
    expect(html).not.toContain('<script>alert("bad")</script>')
  })

  it('renders up to six true thumbnails in each matching daily log section', () => {
    const attachments = [
      ...Array.from({ length: 8 }, (_, index) => ({
        name: `photo-${index + 1}.jpg`,
        path: `daily-logs/log-1/photo-${index + 1}.jpg`,
        type: index === 7 ? 'other' : 'photo',
        url: `https://storage.example.com/originals/photo-${index + 1}.jpg`,
        thumbnailUrl: `https://storage.example.com/thumbnails/photo-${index + 1}.jpg`,
        description: index === 0 ? 'North wall progress' : '',
      })),
      ...Array.from({ length: 7 }, (_, index) => ({
        name: `ptp-${index + 1}.jpg`,
        path: `daily-logs/log-1/ptp-${index + 1}.jpg`,
        type: 'ptp',
        url: `https://storage.example.com/originals/ptp-${index + 1}.jpg`,
        thumbnailUrl: `https://storage.example.com/thumbnails/ptp-${index + 1}.jpg`,
        description: '',
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        name: `qc-${index + 1}.jpg`,
        path: `daily-logs/log-1/qc-${index + 1}.jpg`,
        type: 'qc',
        url: `https://storage.example.com/originals/qc-${index + 1}.jpg`,
        thumbnailUrl: `https://storage.example.com/thumbnails/qc-${index + 1}.jpg`,
        description: '',
      })),
    ]
    const dailyLogUrl = 'https://phase2-website.web.app/daily-log-gallery/preview-gallery-share'
    const inlinePhotoPreviews = [
      ...Array.from({ length: 6 }, (_, index) => ({
        section: 'photo' as const,
        position: index + 1,
        contentId: `daily-log-photo-${index + 1}@phase2.local`,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        section: 'ptp' as const,
        position: index + 1,
        contentId: `daily-log-ptp-${index + 1}@phase2.local`,
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        section: 'qc' as const,
        position: index + 1,
        contentId: `daily-log-qc-${index + 1}@phase2.local`,
      })),
    ]

    const html = buildDailyLogEmail(
      { id: 'job-1', name: 'Lucky 3 Ranch', number: '5229' },
      '2026-06-17',
      { attachments },
      { dailyLogUrl, inlinePhotoPreviews },
    )

    expect(html.match(/<img /g)).toHaveLength(14)
    expect(html).toContain('North wall progress')
    expect(html).toContain('View All 8 Photos')
    expect(html).toContain('View All 7 PTP Photos')
    expect(html).not.toContain('View All 2 QC Photos')
    expect(html).toContain(`${dailyLogUrl}#gallery-photo-1`)
    expect(html).toContain(`${dailyLogUrl}#gallery-ptp`)
    expect(html).toContain('src="cid:daily-log-photo-6@phase2.local"')
    expect(html).not.toContain('cid:daily-log-photo-7@phase2.local')
    expect(html).toContain('src="cid:daily-log-ptp-6@phase2.local"')
    expect(html).not.toContain('cid:daily-log-ptp-7@phase2.local')
    expect(html).toContain('src="cid:daily-log-qc-2@phase2.local"')
    expect(html).not.toContain('/thumbnails/')
    expect(html).not.toContain('/originals/')

    const safetyIndex = html.indexOf('Safety & Concerns')
    const photosIndex = html.indexOf('>Photos</h3>')
    const ptpIndex = html.indexOf('>PTP Photos</h3>')
    const deliveriesIndex = html.indexOf('Deliveries & Materials')
    const qualityControlIndex = html.indexOf('Quality Control')
    const qcPhotosIndex = html.indexOf('>QC Photos</h3>')
    const notesIndex = html.indexOf('Notes & Action Items')
    expect(safetyIndex).toBeLessThan(photosIndex)
    expect(photosIndex).toBeLessThan(ptpIndex)
    expect(ptpIndex).toBeLessThan(deliveriesIndex)
    expect(deliveriesIndex).toBeLessThan(qualityControlIndex)
    expect(qualityControlIndex).toBeLessThan(qcPhotosIndex)
    expect(qcPhotosIndex).toBeLessThan(notesIndex)
  })

  it('links legacy photos without loading their larger originals into the email', () => {
    const html = buildDailyLogEmail(
      { id: 'job-1', name: 'Legacy Job', number: '100' },
      '2026-06-17',
      {
        attachments: [
          {
            name: 'legacy-photo.jpg',
            path: 'daily-logs/log-1/legacy-photo.jpg',
            type: 'photo',
            url: 'https://storage.example.com/originals/legacy-photo.jpg',
            description: 'Existing daily log photo',
          },
        ],
      },
      { dailyLogUrl: 'https://phase2-website.web.app/daily-log-gallery/legacy-share' },
    )

    expect(html).toContain('Open photo in gallery')
    expect(html).toContain('legacy-photo.jpg')
    expect(html).toContain('Existing daily log photo')
    expect(html).toContain('#gallery-photo-1')
    expect(html).not.toContain('src="https://storage.example.com/originals/legacy-photo.jpg"')
  })
})
