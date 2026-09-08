#!/usr/bin/env node

const assert = require('node:assert/strict')

const { buildDailyLogEmail, normalizeDailyLogEmailPayload } = require('../emailService.js')

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
    manpowerLines: [{ trade: 'Acoustics', count: 4, areas: 'Level 1 corridors' }],
    indoorClimateReadings: [{ area: 'Level 1', high: '72', low: '68', humidity: '35' }],
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
        thumbnailUrl: 'https://example.com/thumbnails/level-1-photo.jpg',
        path: 'daily-logs/daily-log-1/level-1-photo.jpg',
        type: 'photo',
        description: 'Level 1 progress photo',
      },
      ...Array.from({ length: 6 }, (_, index) => ({
        name: `progress-${index + 2}.jpg`,
        url: `https://example.com/originals/progress-${index + 2}.jpg`,
        thumbnailUrl: `https://example.com/thumbnails/progress-${index + 2}.jpg`,
        path: `daily-logs/daily-log-1/progress-${index + 2}.jpg`,
        type: 'photo',
        description: `Progress view ${index + 2}`,
      })),
      {
        name: 'ptp-board.jpg',
        url: 'https://example.com/originals/ptp-board.jpg',
        thumbnailUrl: 'https://example.com/thumbnails/ptp-board.jpg',
        path: 'daily-logs/daily-log-1/ptp-board.jpg',
        type: 'ptp',
        description: 'Signed PTP board',
      },
      {
        name: 'qc-ceiling.jpg',
        url: 'https://example.com/originals/qc-ceiling.jpg',
        thumbnailUrl: 'https://example.com/thumbnails/qc-ceiling.jpg',
        path: 'daily-logs/daily-log-1/qc-ceiling.jpg',
        type: 'qc',
        description: 'Completed ceiling inspection',
      },
    ],
  },
}

const normalizedPayload = normalizeDailyLogEmailPayload(nestedDailyLogRecord)
const inlinePhotoPreviews = [
  ...Array.from({ length: 6 }, (_, index) => ({
    section: 'photo',
    position: index + 1,
    contentId: `daily-log-photo-${index + 1}@phase2.local`,
  })),
  { section: 'ptp', position: 1, contentId: 'daily-log-ptp-1@phase2.local' },
  { section: 'qc', position: 1, contentId: 'daily-log-qc-1@phase2.local' },
]

assert.equal(
  normalizedPayload.projectName,
  'Warehouse Retrofit',
  'nested payload project name should normalize',
)
assert.equal(
  normalizedPayload.foremanOnSite,
  'Chris (CJ) Larsen',
  'nested payload foreman should normalize',
)
assert.equal(normalizedPayload.attachments.length, 9, 'nested payload attachments should normalize')

const html = buildDailyLogEmail(
  { id: 'job-1', name: 'Warehouse Retrofit', number: '9411' },
  nestedDailyLogRecord.logDate,
  nestedDailyLogRecord,
  {
    dailyLogUrl: 'https://phase2-website.web.app/daily-log-gallery/daily-log-gallery-share',
    inlinePhotoPreviews,
  },
)

for (const expectedText of [
  'Daily Log Submitted',
  'Warehouse Retrofit',
  '9411',
  'Chris (CJ) Larsen',
  'Dan Project Manager',
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
  '7 photos',
  '1 photo',
  'View All 7 Photos',
  'Level 1 progress photo',
  'Signed PTP board',
  'Completed ceiling inspection',
]) {
  assert.equal(
    html.includes(expectedText),
    true,
    `daily log email should include "${expectedText}"`,
  )
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
assert.equal(
  html.includes('/daily-log-gallery/daily-log-gallery-share'),
  true,
  'photo gallery link should open the isolated public gallery for the exact daily log',
)
assert.equal(
  html.includes('Level 1 progress photo'),
  true,
  'photo descriptions should remain beside email thumbnails',
)
assert.equal(html.includes('<img '), true, 'email should include lightweight photo previews')
assert.equal(
  html.includes('src="cid:daily-log-photo-1@phase2.local"'),
  true,
  'email previews should use inline CID sources instead of remote URLs',
)
assert.equal(
  (html.match(/<img /g) || []).length,
  8,
  'email should cap Photos at six while independently previewing PTP and QC photos',
)
assert.equal(
  html.includes('https://example.com/level-1-photo.jpg'),
  false,
  'email should never load a larger gallery original',
)
assert.equal(
  html.includes('View All 1 PTP Photos'),
  false,
  'sections at or below six photos should not include an overflow button',
)
assert.equal(
  html.includes('What areas were inspected?:'),
  false,
  'question labels should not add a second punctuation mark',
)
assert.equal(
  html.includes('High (&deg;F)'),
  true,
  'temperature labels should use email-safe degree entities',
)
assert.equal(html.includes('&copy;'), true, 'footer should use an email-safe copyright entity')

console.log('Daily log email smoke test passed.')
