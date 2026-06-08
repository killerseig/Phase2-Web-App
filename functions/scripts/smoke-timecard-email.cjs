#!/usr/bin/env node

const assert = require('node:assert/strict')

process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || JSON.stringify({
  storageBucket: 'phase2-web-app-test.appspot.com',
})

const { buildTimecardsEmail } = require('../emailService.js')
const {
  normalizeTimecardForEmail,
  buildTimecardCsv,
  buildTimecardPdfBuffer,
} = require('../operationsFunctions.js')

async function main() {
  const workbookCard = {
    id: 'card-1',
    firstName: 'Chris',
    lastName: 'Larsen',
    employeeNumber: '5133',
    occupation: 'Foreman',
    wageRate: 42.5,
    weekStartDate: '2026-06-01',
    weekEndingDate: '2026-06-07',
    jobCode: '1A',
    employeeWage: 42.5,
    productionBurden: 0.33,
    status: 'submitted',
    lines: [
      {
        jobNumber: '9411',
        subsectionArea: 'Level 1',
        account: '133/513',
        difH: '',
        difP: '',
        difC: '',
        offHours: 0,
        offProduction: 0,
        offCost: 0,
        days: [
          { dayOfWeek: 0, date: '2026-06-01', hours: 0, production: 0, unitCost: 0 },
          { dayOfWeek: 1, date: '2026-06-02', hours: 8, production: 16, unitCost: 21.25 },
          { dayOfWeek: 2, date: '2026-06-03', hours: 8, production: 12, unitCost: 28.2777777778 },
          { dayOfWeek: 3, date: '2026-06-04', hours: 8, production: 8, unitCost: 42.4166666667 },
          { dayOfWeek: 4, date: '2026-06-05', hours: 8, production: 10, unitCost: 33.9333333333 },
          { dayOfWeek: 5, date: '2026-06-06', hours: 4, production: 4, unitCost: 42.4166666667 },
          { dayOfWeek: 6, date: '2026-06-07', hours: 0, production: 0, unitCost: 0 },
        ],
      },
    ],
  }

  const normalized = normalizeTimecardForEmail(workbookCard)

  assert.equal(normalized.lines.length, 1, 'normalized workbook card should keep its line count')
  assert.equal(normalized.lines[0].jobNumber, '9411', 'job number should be preserved')
  assert.equal(normalized.lines[0].account, '133/513', 'account code should be preserved')
  assert.equal(normalized.totals.hoursTotal > 0, true, 'normalized workbook card should have total hours')

  const html = buildTimecardsEmail({
    jobName: 'Phase 2 Company Acoustical remodel',
    jobNumber: '1A',
    submittedBy: 'Chris (CJ) Larsen',
    weekStart: '2026-06-01',
    timecards: [normalized],
  })

  assert.equal(html.includes('Timecards Submitted'), true, 'email should include the submitted heading')
  assert.equal(html.includes('Chris (CJ) Larsen'), true, 'email should include the submitter name')
  assert.equal(html.includes('9411'), true, 'email should include the job number from the workbook row')
  assert.equal(html.includes('EMP. NAME:'), true, 'email should include the print-style employee label')
  assert.equal(html.includes('Larsen, Chris'), true, 'email should render the print-style employee name')
  assert.equal(html.includes('WEEK ENDING'), true, 'email should include the print-style week ending field')
  assert.equal(html.includes('JOB or GL'), true, 'email should include the print-style footer fields')
  assert.equal(html.includes('MON'), true, 'email should use the Mon-Sat print header')
  assert.equal(html.includes('STATUS:'), false, 'email should not include the legacy status field')

  const csv = buildTimecardCsv([normalized], '2026-06-01', '1A')
  assert.equal(csv.includes('9411'), true, 'csv export should include the workbook job number')
  assert.equal(csv.includes('Chris'), true, 'csv export should include the employee name')

  const pdfBuffer = await buildTimecardPdfBuffer({
    jobName: 'Phase 2 Company Acoustical remodel',
    jobNumber: '1A',
    submittedBy: 'Chris (CJ) Larsen',
    weekStart: '2026-06-01',
    timecards: [normalized],
  })

  assert.equal(Buffer.isBuffer(pdfBuffer), true, 'pdf export should return a buffer')
  assert.equal(pdfBuffer.length > 0, true, 'pdf export should not be empty')

  console.log('Timecard email smoke test passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
