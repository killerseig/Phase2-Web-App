#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

process.env.FIREBASE_CONFIG =
  process.env.FIREBASE_CONFIG ||
  JSON.stringify({
    storageBucket: 'phase2-web-app-test.appspot.com',
  })

const { buildDailyLogEmail } = require('../emailService.js')

const defaultOutputPath = path.resolve(__dirname, '..', 'tmp', 'daily-log-email-preview.html')

function main() {
  const outputArg = process.argv[2]
  const outputPath = outputArg ? path.resolve(process.cwd(), outputArg) : defaultOutputPath
  const dailyLogUrl =
    'https://phase2-website.web.app/daily-log-gallery/daily-log-preview-gallery'
  const attachments = Array.from({ length: 12 }, (_, index) => ({
    name: `job-progress-${String(index + 1).padStart(2, '0')}.jpg`,
    url: '',
    path: `daily-logs/daily-log-preview/job-progress-${index + 1}.jpg`,
    type: index % 4 === 0 ? 'ptp' : 'photo',
    description: index === 0 ? 'Lobby ceiling grid progress.' : '',
  }))

  const html = buildDailyLogEmail(
    { id: 'job-preview', name: 'Phase 2 Company Acoustical Remodel', number: '1A' },
    '2026-08-20',
    {
      id: 'daily-log-preview',
      logDate: '2026-08-20',
      foremanName: 'Chris (CJ) Larsen',
      payload: {
        projectName: 'Phase 2 Company Acoustical Remodel',
        jobSiteNumbers: '1A',
        foremanOnSite: 'Chris (CJ) Larsen',
        siteForemanAssistant: 'Dan Project Manager',
        manpower: 'Four installers on site.',
        weeklySchedule: 'Continue ceiling grid in the lobby.',
        manpowerAssessment: 'Crew size is on track.',
        manpowerLines: [{ trade: 'Acoustics', count: 4, areas: 'Lobby' }],
        indoorClimateReadings: [{ area: 'Lobby', high: '72', low: '68', humidity: '35' }],
        safetyConcerns: 'No safety concerns reported.',
        ahaReviewed: 'Reviewed with the crew.',
        scheduleConcerns: 'None.',
        budgetConcerns: 'None.',
        deliveriesReceived: 'Ceiling grid material received.',
        deliveriesNeeded: 'Tile delivery Friday.',
        newWorkAuthorizations: 'None.',
        qcAssignedTo: 'CJ Larsen',
        qcAreasInspected: 'Lobby and east corridor.',
        qcIssuesIdentified: 'One damaged tile.',
        qcIssuesResolved: 'Tile replaced.',
        notesCorrespondence: 'GC requested an early start tomorrow.',
        actionItems: 'Confirm Friday delivery time.',
        attachments,
      },
    },
    { dailyLogUrl },
  )

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, html, 'utf8')

  console.log(`Preview HTML: ${outputPath}`)
  console.log(`Gallery link: ${dailyLogUrl}`)
  console.log(`Contains gallery CTA: ${html.includes('View Photo Gallery (12)')}`)
  console.log(`Contains hidden overflow count: ${html.includes('Plus 2 more photos')}`)
}

main()
