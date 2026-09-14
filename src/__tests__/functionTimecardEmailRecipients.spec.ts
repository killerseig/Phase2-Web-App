import { describe, expect, it, vi } from 'vitest'
import { sendSubmittedWeekEmail } from '../../functions/src/timecardWeekFunctions'
import { sendEmail } from '../../functions/src/emailService'

vi.mock('../../functions/src/runtime', () => ({
  db: { collection: () => ({ doc: () => ({ collection: () => ({
    get: async () => ({ docs: [{ id: 'card-1', data: () => ({ sortIndex: 0 }) }] }),
  }) }) }) },
}))
vi.mock('../../functions/src/firestoreService', () => ({
  getEmailSettings: async () => ({ globalNotificationRecipients: { timecards: ['payroll@example.com'] } }),
  getJobDetails: async () => ({ name: 'Job', number: '123' }),
}))
vi.mock('../../functions/src/operationsFunctions', () => ({
  prepareTimecardsForPdfCsvExport: async (cards: unknown[]) => cards,
  buildTimecardCsv: () => 'csv',
  buildTimecardCsvFilename: () => 'timecards.csv',
  buildTimecardPdfBuffer: async () => Buffer.from('pdf'),
  buildTimecardPdfFilename: () => 'timecards.pdf',
}))
vi.mock('../../functions/src/emailService', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../functions/src/emailService')>(),
  isEmailEnabled: () => true,
  buildTimecardsEmail: () => '<p>Timecards</p>',
  sendEmail: vi.fn(async () => undefined),
}))

describe('submitted timecard email recipients', () => {
  it('copies the submitting person, routes replies, and keeps payroll attachments', async () => {
    const result = await sendSubmittedWeekEmail('week-1', {
      weekStartDate: '2026-09-06', weekEndDate: '2026-09-12',
      ownerForemanUserId: 'someone-else',
    }, 'job-1', 'Submitting Admin', 'submitter@example.com')
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: ['payroll@example.com', 'submitter@example.com'],
      replyTo: 'submitter@example.com',
      attachments: [
        expect.objectContaining({ name: 'timecards.csv' }),
        expect.objectContaining({ name: 'timecards.pdf' }),
      ],
    }))
    expect(result.emailMessage).toContain('2 recipients')
  })
})
