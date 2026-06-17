#!/usr/bin/env node

const assert = require('node:assert/strict')

const {
  buildDailyLogEmail,
  normalizeDailyLogEmailPayload,
} = require('../emailService.js')

const nestedDailyLogRecord = {
  id: 'daily-log-1',
  jobId: 'job-1',
  jobCode: '9411',
  jobName: 'Warehouse Retrofit',
  logDate: '2026-06-12',
  status: 'submitted',
  foremanUserId: 'foreman-1',
  foremanName: 'Chris (CJ) Larsen',
  additionalRecipients: [],
  payload: {
    projectName: 'Warehouse Retrofit',
    jobSiteNumbers: '9411',
    foremanOnSite: 'Chris (CJ) Larsen',
    siteForemanAssistant: 'Dan Project Manager',
    manpower: 'Four installers on site',
    weeklySchedule: 'Finish layout and hang grid',
    manpowerAssessment: 'Crew size is on track',
    manpowerLines: [
      { trade: 'Acoustics', count: 4, areas: 'Level 1 corridors' },
    ],
    indoorClimateReadings: [
      { area: 'Level 1', high: '72', low: '68', humidity: '35' },
    ],
    safetyConcerns: 'No safety concerns reported',
    ahaReviewed: 'Reviewed with crew',
    scheduleConcerns: 'No schedule concerns',
    budgetConcerns: 'No budget concerns',
    deliveriesReceived: 'Grid material received',
    deliveriesNeeded: 'Ceiling tile delivery Friday',
    newWorkAuthorizations: 'None',
    qcAssignedTo: 'CJ Larsen',
    qcAreasInspected: 'Level 1 corridors',
    qcIssuesIdentified: 'One damaged tile found',
    qcIssuesResolved: 'Tile replaced before closeout',
    notesCorrespondence: 'GC requested early start tomorrow',
    actionItems: 'Confirm delivery time with shop',
    attachments: [
      {
        name: 'level-1-photo.jpg',
        url: 'https://example.com/level-1-photo.jpg',
        path: 'daily-logs/daily-log-1/level-1-photo.jpg',
        type: 'photo',
        description: 'Level 1 progress photo',
      },
    ],
  },
}

const normalizedPayload = normalizeDailyLogEmailPayload(nestedDailyLogRecord)

assert.equal(normalizedPayload.projectName, 'Warehouse Retrofit', 'nested payload project name should normalize')
assert.equal(normalizedPayload.foremanOnSite, 'Chris (CJ) Larsen', 'nested payload foreman should normalize')
assert.equal(normalizedPayload.attachments.length, 1, 'nested payload attachments should normalize')

const html = buildDailyLogEmail(
  { id: 'job-1', name: 'Warehouse Retrofit', number: '9411' },
  nestedDailyLogRecord.logDate,
  nestedDailyLogRecord,
)

for (const expectedText of [
  'Daily Log Submitted',
  'Warehouse Retrofit',
  '9411',
  'Chris (CJ) Larsen',
  'Dan Project Manager',
  'Four installers on site',
  'Finish layout and hang grid',
  'Crew size is on track',
  'Acoustics',
  'Level 1 corridors',
  '72',
  'No safety concerns reported',
  'Reviewed with crew',
  'Grid material received',
  'Ceiling tile delivery Friday',
  'CJ Larsen',
  'One damaged tile found',
  'Tile replaced before closeout',
  'GC requested early start tomorrow',
  'Confirm delivery time with shop',
  'Level 1 progress photo',
]) {
  assert.equal(html.includes(expectedText), true, `daily log email should include "${expectedText}"`)
}

assert.equal(
  html.includes('<strong>Project Name:</strong> N/A'),
  false,
  'nested payload project name should not render as N/A',
)
assert.equal(
  html.includes('<strong>Foreman:</strong> N/A'),
  false,
  'nested payload foreman should not render as N/A',
)
assert.equal(
  html.includes('<strong>Manpower Summary:</strong> N/A'),
  false,
  'nested payload manpower should not render as N/A',
)
assert.equal(
  html.includes('<p>N/A</p>'),
  false,
  'nested payload attachments should not render as an empty N/A block',
)

console.log('Daily log email smoke test passed.')
