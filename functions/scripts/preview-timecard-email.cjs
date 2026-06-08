#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || JSON.stringify({
  storageBucket: 'phase2-web-app-test.appspot.com',
})

const { buildTimecardsEmail } = require('../emailService.js')
const { normalizeTimecardForEmail } = require('../operationsFunctions.js')

const defaultOutputPath = path.resolve(__dirname, '..', 'tmp', 'timecard-email-preview.html')

function buildSampleTimecard() {
  return normalizeTimecardForEmail({
    id: 'card-1',
    firstName: 'Preview',
    lastName: 'Sample',
    employeeNumber: '0000',
    occupation: 'Sample Occupation',
    wageRate: 42.5,
    weekStartDate: '2026-06-01',
    weekEndingDate: '2026-06-07',
    jobCode: '1A',
    employeeWage: 42.5,
    productionBurden: 0.33,
    status: 'submitted',
    footerJobOrGl: '9411',
    footerAccount: '133/513',
    footerOffice: 'Field',
    footerAmount: '$123.45',
    footerSecondJobOrGl: '',
    footerSecondAccount: '',
    footerSecondOffice: '',
    footerSecondAmount: '',
    notes: 'Preview notes line',
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
  })
}

function main() {
  const outputArg = process.argv[2]
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : defaultOutputPath

  const html = buildTimecardsEmail({
    jobName: 'Phase 2 Company Acoustical remodel',
    jobNumber: '1A',
    submittedBy: 'Chris (CJ) Larsen',
    weekStart: '2026-06-01',
    timecards: [buildSampleTimecard()],
  })

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, html, 'utf8')

  console.log(`Preview HTML: ${outputPath}`)
  console.log('Preview data source: local sample data from preview-timecard-email.cjs')
  console.log(`Contains "EMP. NAME:": ${html.includes('EMP. NAME:')}`)
  console.log(`Contains "WEEK ENDING": ${html.includes('WEEK ENDING')}`)
  console.log(`Contains "JOB or GL": ${html.includes('JOB or GL')}`)
  console.log(`Contains legacy "STATUS:": ${html.includes('STATUS:')}`)
}

main()
