import { describe, expect, it } from 'vitest'

import { EMAIL } from '../../functions/src/constants'
import {
  buildDailyLogEmail,
  buildDailyLogEmailSubject,
  buildGraphSenderRecipient,
  buildShopOrderEmail,
  buildShopOrderEmailSubject,
  buildTimecardEmailSubject,
  buildTimecardsEmail,
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
})

describe('function email inbox labels', () => {
  it('puts workflow type, foreman, job number, and job name early in subjects', () => {
    expect(buildDailyLogEmailSubject(
      { id: 'job-1', name: 'Lucky 3 Ranch', number: '5229' },
      '2026-06-17',
      { foremanName: 'Vince Hintz' },
    )).toBe('Daily Log Report | Vince Hintz | #5229 Lucky 3 Ranch | 6/17/2026')

    expect(buildShopOrderEmailSubject({
      id: 'order-1',
      foremanName: 'CJ Blanchard',
      jobCode: '736',
      jobName: 'Shop',
      orderDate: '2026-07-12',
    })).toBe('Shop Order | CJ Blanchard | #736 Shop | Order #20260712000000')

    expect(buildTimecardEmailSubject({
      submittedBy: 'Rocky Rodriguez',
      jobNumber: '7505',
      jobName: 'CSU Vet Hospital',
      weekStart: '2026-07-12',
    })).toBe('Timecard Report | Rocky Rodriguez | #7505 CSU Vet Hospital | Week 7/12/2026')
  })

  it('adds hidden preview text so inbox snippets repeat the searchable context', () => {
    expect(buildDailyLogEmail(
      { id: 'job-1', name: 'Lucky 3 Ranch', number: '5229' },
      '2026-06-17',
      { foremanName: 'Vince Hintz' },
    )).toContain('Daily Log Report | Vince Hintz | #5229 Lucky 3 Ranch | 6/17/2026')

    expect(buildShopOrderEmail({
      id: 'order-1',
      foremanName: 'CJ Blanchard',
      jobCode: '736',
      jobName: 'Shop',
      orderDate: '2026-07-12',
      items: [],
    })).toContain('Shop Order | CJ Blanchard | #736 Shop | Order #20260712000000')

    expect(buildTimecardsEmail({
      submittedBy: 'Rocky Rodriguez',
      jobNumber: '7505',
      jobName: 'CSU Vet Hospital',
      weekStart: '2026-07-12',
      timecards: [],
    })).toContain('Timecard Report | Rocky Rodriguez | #7505 CSU Vet Hospital | Week 7/12/2026')
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
    expect(html).toContain('<div style="font-weight: bold; margin-bottom: 4px;">Weekly Schedule:</div>')
    expect(html).not.toContain('<strong>Weekly Schedule:</strong> We may have an issue.')
    expect(html).toContain('First crew note.<br>Second crew note.')
    expect(html).toContain('&lt;script&gt;alert(&quot;bad&quot;)&lt;/script&gt;<br>Safe line')
    expect(html).not.toContain('<script>alert("bad")</script>')
  })

  it('keeps photo-heavy daily log emails small and links to the full gallery', () => {
    const attachments = Array.from({ length: 101 }, (_, index) => ({
      name: `photo-${index + 1}.jpg`,
      path: `daily-logs/log-1/photo-${index + 1}.jpg`,
      type: 'photo',
      url: `https://storage.example.com/photo-${index + 1}.jpg`,
    }))
    const dailyLogUrl =
      'https://phase2-website.web.app/daily-log-gallery/preview-gallery-share'

    const html = buildDailyLogEmail(
      { id: 'job-1', name: 'Lucky 3 Ranch', number: '5229' },
      '2026-06-17',
      { attachments },
      { dailyLogUrl },
    )

    expect(html).toContain('101 photos saved with this daily log.')
    expect(html).toContain('View Photo Gallery (101)')
    expect(html).toContain(dailyLogUrl.replace(/&/g, '&amp;'))
    expect(html).not.toContain('<img ')
    expect(html).not.toContain('photo-1.jpg')
    expect(html).not.toContain('Plus 91 more photos in the daily log.')
  })
})
