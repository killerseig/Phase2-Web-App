import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { pathToFileURL } from 'node:url'
import {
  e2eProjectId,
  seededCatalog,
  seededJobs,
  seededRecipients,
  seededRoster,
  seededUsers,
} from '../../e2e/fixtures/seed-data.mjs'

const app = getApps()[0] ?? initializeApp({
  projectId: e2eProjectId,
  storageBucket: `${e2eProjectId}.appspot.com`,
})

const auth = getAuth(app)
const db = getFirestore(app)

const asTimestamp = (value) => Timestamp.fromDate(new Date(value))

const buildWeek = () => {
  const today = new Date()
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const dayOfWeek = utcToday.getUTCDay()
  const weekEnding = new Date(utcToday)
  weekEnding.setUTCDate(utcToday.getUTCDate() + ((6 - dayOfWeek + 7) % 7))

  const weekStart = new Date(weekEnding)
  weekStart.setUTCDate(weekEnding.getUTCDate() - 6)

  const formatDate = (date) => [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')

  const days = Array.from({ length: 7 }, (_, index) => {
    const current = new Date(weekStart)
    current.setUTCDate(weekStart.getUTCDate() + index)
    const hours = index >= 1 && index <= 5 ? 8 : 0
    const production = index >= 1 && index <= 5 ? 10 : 0
    const unitCost = production > 0 ? 12.5 : 0
    return {
      date: formatDate(current),
      dayOfWeek: index,
      hours,
      production,
      unitCost,
      lineTotal: production * unitCost,
      notes: index === 1 ? 'Seeded production day' : '',
    }
  })

  return {
    weekStartDate: formatDate(weekStart),
    weekEndingDate: formatDate(weekEnding),
    days,
    totals: {
      hours: days.map((day) => day.hours),
      production: days.map((day) => day.production),
      hoursTotal: days.reduce((total, day) => total + day.hours, 0),
      productionTotal: days.reduce((total, day) => total + day.production, 0),
      lineTotal: days.reduce((total, day) => total + day.lineTotal, 0),
    },
  }
}

const currentWeek = buildWeek()
const seededCreatedAt = asTimestamp('2026-03-19T18:00:00.000Z')
const seededUpdatedAt = asTimestamp('2026-03-19T18:30:00.000Z')
const seededSubmittedAt = asTimestamp('2026-03-19T19:00:00.000Z')

async function upsertAuthUser(user) {
  const displayName = `${user.firstName} ${user.lastName}`.trim()

  try {
    await auth.getUser(user.uid)
    await auth.updateUser(user.uid, {
      email: user.email,
      password: user.password,
      displayName,
      disabled: false,
      emailVerified: true,
    })
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') {
      throw error
    }

    await auth.createUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName,
      disabled: false,
      emailVerified: true,
    })
  }
}

export async function seedE2eData() {
  await Promise.all(Object.values(seededUsers).map((user) => upsertAuthUser(user)))

  const batch = db.batch()

  const users = {
    [seededUsers.admin.uid]: {
      email: seededUsers.admin.email,
      displayName: `${seededUsers.admin.firstName} ${seededUsers.admin.lastName}`,
      firstName: seededUsers.admin.firstName,
      lastName: seededUsers.admin.lastName,
      role: seededUsers.admin.role,
      active: true,
      assignedJobIds: [],
      createdAt: seededCreatedAt,
      lastLoginAt: seededUpdatedAt,
    },
    [seededUsers.controller.uid]: {
      email: seededUsers.controller.email,
      displayName: `${seededUsers.controller.firstName} ${seededUsers.controller.lastName}`,
      firstName: seededUsers.controller.firstName,
      lastName: seededUsers.controller.lastName,
      role: seededUsers.controller.role,
      active: true,
      assignedJobIds: [],
      createdAt: seededCreatedAt,
      lastLoginAt: seededUpdatedAt,
    },
    [seededUsers.foreman.uid]: {
      email: seededUsers.foreman.email,
      displayName: `${seededUsers.foreman.firstName} ${seededUsers.foreman.lastName}`,
      firstName: seededUsers.foreman.firstName,
      lastName: seededUsers.foreman.lastName,
      role: seededUsers.foreman.role,
      active: true,
      assignedJobIds: [seededJobs.active.id],
      createdAt: seededCreatedAt,
      lastLoginAt: seededUpdatedAt,
    },
  }

  for (const [uid, data] of Object.entries(users)) {
    batch.set(db.doc(`users/${uid}`), data)
  }

  batch.set(db.doc(`jobs/${seededJobs.active.id}`), {
    header: 'E2E',
    name: seededJobs.active.name,
    code: seededJobs.active.code,
    projectManager: 'Pat Project',
    foreman: `${seededUsers.foreman.firstName} ${seededUsers.foreman.lastName}`,
    gc: 'E2E GC',
    jobAddress: '123 Emulator Way',
    startDate: currentWeek.weekStartDate,
    finishDate: null,
    taxExempt: 'No',
    certified: 'No',
    cip: '2445',
    kjic: 'Yes',
    accountNumber: '4001',
    type: 'general',
    active: true,
    assignedForemanIds: [seededUsers.foreman.uid],
    timecardStatus: 'submitted',
    timecardSubmittedAt: seededSubmittedAt,
    timecardPeriodEndDate: currentWeek.weekEndingDate,
    timecardLastSentWeekEnding: currentWeek.weekEndingDate,
    dailyLogRecipients: [seededRecipients.dailyLogs, seededRecipients.office],
    createdAt: seededCreatedAt,
    archivedAt: null,
  })

  batch.set(db.doc(`jobs/${seededJobs.archived.id}`), {
    header: 'E2E',
    name: seededJobs.archived.name,
    code: seededJobs.archived.code,
    projectManager: 'Pat Project',
    foreman: `${seededUsers.foreman.firstName} ${seededUsers.foreman.lastName}`,
    gc: 'E2E GC',
    jobAddress: '999 Archive Ln',
    startDate: '2025-01-01',
    finishDate: '2025-12-31',
    taxExempt: 'No',
    certified: 'No',
    cip: '2445',
    kjic: 'No',
    accountNumber: '4999',
    type: 'general',
    active: false,
    assignedForemanIds: [seededUsers.foreman.uid],
    timecardStatus: 'archived',
    timecardSubmittedAt: seededSubmittedAt,
    timecardPeriodEndDate: currentWeek.weekEndingDate,
    timecardLastSentWeekEnding: currentWeek.weekEndingDate,
    dailyLogRecipients: [seededRecipients.dailyLogs],
    createdAt: seededCreatedAt,
    archivedAt: seededSubmittedAt,
  })

  batch.set(db.doc(`jobs/${seededJobs.active.id}/roster/${seededRoster.primary.id}`), {
    jobId: seededJobs.active.id,
    employeeNumber: seededRoster.primary.employeeNumber,
    firstName: seededRoster.primary.firstName,
    lastName: seededRoster.primary.lastName,
    occupation: seededRoster.primary.occupation,
    contractor: null,
    wageRate: 35,
    unitCost: 12.5,
    active: true,
    isPrimaryForeman: false,
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
    addedByUid: seededUsers.admin.uid,
  })

  batch.set(db.doc(`jobs/${seededJobs.active.id}/roster/${seededRoster.subcontractor.id}`), {
    jobId: seededJobs.active.id,
    employeeNumber: seededRoster.subcontractor.employeeNumber,
    firstName: seededRoster.subcontractor.firstName,
    lastName: seededRoster.subcontractor.lastName,
    occupation: seededRoster.subcontractor.occupation,
    contractor: {
      name: 'Acme Labor',
      category: 'Welding',
    },
    wageRate: 42,
    unitCost: 18.75,
    active: true,
    isPrimaryForeman: false,
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
    addedByUid: seededUsers.admin.uid,
  })

  batch.set(db.doc(`jobs/${seededJobs.active.id}/timecards/timecard-e2e-submitted`), {
    jobId: seededJobs.active.id,
    weekStartDate: currentWeek.weekStartDate,
    weekEndingDate: currentWeek.weekEndingDate,
    status: 'submitted',
    uid: seededUsers.foreman.uid,
    createdByUid: seededUsers.foreman.uid,
    submittedAt: seededSubmittedAt,
    employeeRosterId: seededRoster.primary.id,
    employeeNumber: seededRoster.primary.employeeNumber,
    employeeName: `${seededRoster.primary.firstName} ${seededRoster.primary.lastName}`,
    firstName: seededRoster.primary.firstName,
    lastName: seededRoster.primary.lastName,
    occupation: seededRoster.primary.occupation,
    employeeWage: 35,
    subcontractedEmployee: false,
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    mileage: 12,
    jobs: [
      {
        jobNumber: seededJobs.active.code,
        subsectionArea: 'Area A',
        area: 'Area A',
        account: '4001',
        acct: '4001',
        div: '010',
        days: currentWeek.days,
      },
    ],
    days: currentWeek.days,
    totals: currentWeek.totals,
    notes: 'Seeded submitted timecard',
    archived: false,
    archivedAt: null,
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
  })

  batch.set(db.doc(`jobs/${seededJobs.active.id}/dailyLogs/dailylog-e2e-submitted`), {
    jobId: seededJobs.active.id,
    uid: seededUsers.foreman.uid,
    status: 'submitted',
    logDate: currentWeek.weekStartDate,
    jobSiteNumbers: seededJobs.active.code,
    foremanOnSite: `${seededUsers.foreman.firstName} ${seededUsers.foreman.lastName}`,
    siteForemanAssistant: 'Alex Assistant',
    projectName: seededJobs.active.name,
    manpower: '5',
    weeklySchedule: 'On track',
    manpowerAssessment: 'Adequate',
    indoorClimateReadings: [],
    manpowerLines: [
      {
        trade: 'Ironworkers',
        count: 5,
        areas: 'North elevation',
        addedByUserId: seededUsers.foreman.uid,
      },
    ],
    safetyConcerns: 'None',
    ahaReviewed: 'Yes',
    scheduleConcerns: 'None',
    budgetConcerns: 'None',
    deliveriesReceived: 'Structural steel',
    deliveriesNeeded: 'Anchor bolts',
    newWorkAuthorizations: 'None',
    qcInspection: '',
    qcAssignedTo: '',
    qcAreasInspected: '',
    qcIssuesIdentified: '',
    qcIssuesResolved: '',
    notesCorrespondence: 'Seeded daily log for E2E',
    actionItems: 'Continue install',
    commentsAboutShip: '',
    attachments: [],
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
    submittedAt: seededSubmittedAt,
  })

  batch.set(db.doc(`jobs/${seededJobs.active.id}/shop_orders/shoporder-e2e-draft`), {
    jobId: seededJobs.active.id,
    uid: 'scope:employee',
    ownerUid: seededUsers.foreman.uid,
    status: 'draft',
    orderDate: seededCreatedAt,
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
    items: [
      {
        description: seededCatalog.hammer.description,
        quantity: 2,
        note: `SKU: ${seededCatalog.hammer.sku} - $${seededCatalog.hammer.price}`,
        catalogItemId: seededCatalog.hammer.id,
      },
    ],
  })

  batch.set(db.doc('settings/email'), {
    timecardSubmitRecipients: [seededRecipients.timecards, seededRecipients.office],
    shopOrderSubmitRecipients: [seededRecipients.shopOrders, seededRecipients.office],
    dailyLogSubmitRecipients: [seededRecipients.dailyLogs, seededRecipients.office],
  })

  batch.set(db.doc(`shopCategories/${seededCatalog.rootCategory.id}`), {
    name: seededCatalog.rootCategory.name,
    parentId: null,
    active: true,
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
  })

  batch.set(db.doc(`shopCategories/${seededCatalog.childCategory.id}`), {
    name: seededCatalog.childCategory.name,
    parentId: seededCatalog.childCategory.parentId,
    active: true,
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
  })

  batch.set(db.doc(`shopCatalog/${seededCatalog.hammer.id}`), {
    description: seededCatalog.hammer.description,
    categoryId: seededCatalog.hammer.categoryId,
    sku: seededCatalog.hammer.sku,
    price: seededCatalog.hammer.price,
    active: true,
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
  })

  batch.set(db.doc(`shopCatalog/${seededCatalog.bolts.id}`), {
    description: seededCatalog.bolts.description,
    categoryId: seededCatalog.bolts.categoryId,
    sku: seededCatalog.bolts.sku,
    price: seededCatalog.bolts.price,
    active: true,
    createdAt: seededCreatedAt,
    updatedAt: seededUpdatedAt,
  })

  await batch.commit()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedE2eData().catch((error) => {
    console.error('[seed-e2e-data] Failed to seed emulator data')
    console.error(error)
    process.exit(1)
  })
}
