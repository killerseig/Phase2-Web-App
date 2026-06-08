import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __PHASE2_E2E__?: unknown
  }
}

type FixtureAuthKind = 'admin' | 'foreman'

const FIXTURE_NOW = '2026-06-04T09:00:00-06:00'
const JOB_ID = 'job-e2e'
const FOREMAN_ID = 'foreman-e2e'
const ADMIN_ID = 'admin-e2e'
const WEEK_START_DATE = '2026-05-31'
const WEEK_END_DATE = '2026-06-06'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createAuthState(kind: FixtureAuthKind, assignedJobIds = [JOB_ID]) {
  if (kind === 'admin') {
    return {
      user: {
        uid: ADMIN_ID,
        email: 'admin@example.com',
        displayName: 'Dan Admin',
      },
      profile: {
        id: ADMIN_ID,
        email: 'admin@example.com',
        firstName: 'Dan',
        lastName: 'Admin',
        role: 'admin',
        active: true,
        assignedJobIds: [],
      },
    }
  }

  return {
    user: {
      uid: FOREMAN_ID,
      email: 'cj@example.com',
      displayName: 'Chris (CJ) Larsen',
    },
    profile: {
      id: FOREMAN_ID,
      email: 'cj@example.com',
      firstName: 'Chris',
      lastName: '(CJ) Larsen',
      role: 'foreman',
      active: true,
      assignedJobIds,
    },
  }
}

function createJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    name: 'Phase 2 Company Acoustical remodel',
    code: '1A',
    gc: 'Phase 2',
    type: 'acoustics',
    active: true,
    assignedForemanIds: [FOREMAN_ID],
    notificationRecipients: {
      dailyLogs: [],
      timecards: [],
      shopOrders: [],
    },
    productionBurden: 0.33,
    ...overrides,
  }
}

function createDailyLogPayload(overrides: Record<string, unknown> = {}) {
  return {
    jobSiteNumbers: '1A',
    foremanOnSite: 'Chris (CJ) Larsen',
    siteForemanAssistant: 'Project Manager',
    projectName: 'Phase 2 Company Acoustical remodel',
    manpower: '',
    weeklySchedule: '',
    manpowerAssessment: '',
    indoorClimateReadings: [
      { area: 'Lobby', high: '72', low: '70', humidity: '35' },
    ],
    manpowerLines: [
      { trade: 'Acoustics', count: 2, areas: 'Lobby', addedByUserId: FOREMAN_ID },
    ],
    safetyConcerns: '',
    ahaReviewed: 'Reviewed',
    scheduleConcerns: '',
    budgetConcerns: '',
    deliveriesReceived: '',
    deliveriesNeeded: '',
    newWorkAuthorizations: '',
    qcInspection: '',
    qcAssignedTo: '',
    qcAreasInspected: '',
    qcIssuesIdentified: '',
    qcIssuesResolved: '',
    notesCorrespondence: '',
    actionItems: '',
    attachments: [],
    ...overrides,
  }
}

function createWeekDays(startDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    const day = String(current.getDate()).padStart(2, '0')
    return {
      date: `${year}-${month}-${day}`,
      dayOfWeek: index,
      hours: 0,
      production: 0,
      unitCost: 0,
      unitCostOverride: null,
      lineTotal: 0,
    }
  })
}

function createTimecardLines(startDate: string, jobNumber: string) {
  return Array.from({ length: 13 }, () => ({
    jobNumber,
    subsectionArea: '',
    account: '',
    difH: '',
    difP: '',
    difC: '',
    offHours: 0,
    offProduction: 0,
    offCost: 0,
    days: createWeekDays(startDate),
  }))
}

function createTimecardCard(
  jobNumber: string,
  overrides: Partial<ReturnType<typeof createTimecardCardBase>> = {},
) {
  return {
    ...createTimecardCardBase(jobNumber),
    ...overrides,
  }
}

function createTimecardCardBase(jobNumber: string) {
  return {
    weekId: 'week-e2e',
    id: 'card-e2e',
    sourceType: 'employee',
    employeeId: 'employee-1',
    firstName: 'Casey',
    lastName: 'Brown',
    fullName: 'Casey Brown',
    employeeNumber: '1001',
    occupation: 'Mechanic',
    wageRate: 20,
    isContractor: false,
    sortIndex: 0,
    lines: createTimecardLines(WEEK_START_DATE, jobNumber),
    footerJobOrGl: '',
    footerAccount: '',
    footerOffice: '',
    footerAmount: '',
    footerSecondJobOrGl: '',
    footerSecondAccount: '',
    footerSecondOffice: '',
    footerSecondAmount: '',
    notes: '',
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    totals: {
      hoursByDay: [0, 0, 0, 0, 0, 0, 0],
      productionByDay: [0, 0, 0, 0, 0, 0, 0],
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
  }
}

function createBaseFixture(authKind: FixtureAuthKind, assignedJobIds = [JOB_ID]) {
  return {
    delays: {},
    now: FIXTURE_NOW,
    auth: createAuthState(authKind, assignedJobIds),
    users: [
      {
        id: FOREMAN_ID,
        email: 'cj@example.com',
        firstName: 'Chris',
        lastName: '(CJ) Larsen',
        role: 'foreman',
        active: true,
        assignedJobIds,
      },
    ],
    jobs: [createJob()],
    employees: [],
    shopCategories: [],
    shopCatalogItems: [],
    shopOrders: [],
    dailyLogs: [],
    timecardWeeks: [],
    timecardCards: [],
    globalNotificationRecipients: {
      dailyLogs: [],
      timecards: [],
      shopOrders: [],
    },
  }
}

export function createJobsFixture() {
  const fixture = createBaseFixture('admin')
  fixture.users = [
    {
      id: FOREMAN_ID,
      email: 'cj@example.com',
      firstName: 'Chris',
      lastName: '(CJ) Larsen',
      role: 'foreman',
      active: true,
      assignedJobIds: ['job-1', 'job-2', 'job-3'],
    },
  ]
  fixture.jobs = [
    createJob({ id: 'job-1', code: '1A', name: 'Acoustical Remodel', type: 'acoustics', gc: 'Phase 2' }),
    createJob({ id: 'job-2', code: '2B', name: 'Drywall Buildout', type: 'drywall', gc: 'Summit' }),
    createJob({ id: 'job-3', code: '3C', name: 'Paint Finish', type: 'paint', gc: 'Lark' }),
  ]
  return clone(fixture)
}

export function createJobDashboardFixture() {
  return clone(createBaseFixture('foreman'))
}

export function createDailyLogsFixture() {
  const fixture = createBaseFixture('foreman')
  fixture.dailyLogs = [
    {
      id: 'daily-log-1',
      jobId: JOB_ID,
      jobCode: '1A',
      jobName: 'Phase 2 Company Acoustical remodel',
      logDate: '2026-06-04',
      sequenceNumber: 1,
      status: 'draft',
      foremanUserId: FOREMAN_ID,
      foremanName: 'Chris (CJ) Larsen',
      additionalRecipients: [],
      payload: createDailyLogPayload(),
      createdAt: '2026-06-04T09:00:00.000Z',
      updatedAt: '2026-06-04T09:00:00.000Z',
      submittedAt: null,
    },
  ]
  return clone(fixture)
}

export function createTimecardsFixture(options?: { seededCard?: boolean; jobCode?: string }) {
  const jobCode = options?.jobCode ?? '9411'
  const fixture = createBaseFixture('foreman')
  fixture.jobs = [
    createJob({
      code: jobCode,
      name: 'Warehouse Retrofit',
      gc: 'Phase 2',
      type: 'general',
    }),
  ]
  fixture.employees = [
    {
      id: 'employee-1',
      employeeNumber: '1001',
      firstName: 'Casey',
      lastName: 'Brown',
      occupation: 'Mechanic',
      active: true,
      isContractor: false,
      jobId: null,
    },
    {
      id: 'employee-2',
      employeeNumber: '1002',
      firstName: 'Jamie',
      lastName: 'Lopez',
      occupation: 'Installer',
      active: true,
      isContractor: false,
      jobId: null,
    },
  ]
  fixture.timecardWeeks = [
    {
      id: 'week-e2e',
      jobId: JOB_ID,
      jobCode,
      jobName: 'Warehouse Retrofit',
      ownerForemanUserId: FOREMAN_ID,
      ownerForemanName: 'Chris (CJ) Larsen',
      weekStartDate: WEEK_START_DATE,
      weekEndDate: WEEK_END_DATE,
      status: 'draft',
      employeeCardCount: options?.seededCard ? 1 : 0,
      createdAt: '2026-06-04T09:00:00.000Z',
      updatedAt: '2026-06-04T09:00:00.000Z',
      submittedAt: null,
    },
  ]
  fixture.timecardCards = options?.seededCard ? [createTimecardCard(jobCode)] : []
  return clone(fixture)
}

export function createShopOrdersFixture() {
  const fixture = createBaseFixture('foreman')
  fixture.shopCategories = [
    { id: 'cat-drywall', name: 'Drywall Mud', parentId: null, active: true },
    { id: 'cat-all-purpose', name: 'All Purpose Mud', parentId: 'cat-drywall', active: true },
    { id: 'cat-anchors', name: 'Anchors', parentId: null, active: true },
    { id: 'cat-concrete-wedge', name: 'Concrete Wedge Anchors', parentId: 'cat-anchors', active: true },
  ]
  fixture.shopCatalogItems = [
    { id: 'item-box', description: 'Box', categoryId: 'cat-all-purpose', sku: null, price: null, active: true },
    { id: 'item-bucket', description: 'Bucket', categoryId: 'cat-all-purpose', sku: null, price: null, active: true },
    { id: 'item-half-inch', description: '1/2"', categoryId: 'cat-concrete-wedge', sku: null, price: null, active: true },
  ]
  fixture.shopOrders = [
    {
      id: 'order-draft',
      jobId: JOB_ID,
      jobCode: '1A',
      jobName: 'Phase 2 Company Acoustical remodel',
      orderNumber: '20260604163341',
      orderDate: '2026-06-04T16:33:41.000Z',
      deliveryDate: '2026-06-11',
      status: 'draft',
      comments: '',
      foremanUserId: FOREMAN_ID,
      foremanName: 'Chris (CJ) Larsen',
      items: [],
      createdAt: '2026-06-04T16:33:41.000Z',
      updatedAt: '2026-06-04T16:33:41.000Z',
      submittedAt: null,
    },
    {
      id: 'order-submitted-1',
      jobId: JOB_ID,
      jobCode: '1A',
      jobName: 'Phase 2 Company Acoustical remodel',
      orderNumber: '20260604145900',
      orderDate: '2026-06-04T14:59:00.000Z',
      deliveryDate: '2026-06-11',
      status: 'submitted',
      comments: 'Previous order',
      foremanUserId: FOREMAN_ID,
      foremanName: 'Chris (CJ) Larsen',
      items: [
        {
          id: 'submitted-item-1',
          sourceType: 'catalog',
          catalogItemId: 'item-box',
          description: 'Drywall Mud / All Purpose Mud / Box',
          quantity: 2,
          note: '',
          categoryId: 'cat-all-purpose',
          sku: null,
        },
      ],
      createdAt: '2026-06-04T14:45:00.000Z',
      updatedAt: '2026-06-04T14:59:00.000Z',
      submittedAt: '2026-06-04T14:59:00.000Z',
    },
    {
      id: 'order-submitted-2',
      jobId: JOB_ID,
      jobCode: '1A',
      jobName: 'Phase 2 Company Acoustical remodel',
      orderNumber: '20260604141400',
      orderDate: '2026-06-04T14:14:00.000Z',
      deliveryDate: '2026-06-11',
      status: 'submitted',
      comments: '',
      foremanUserId: FOREMAN_ID,
      foremanName: 'Chris (CJ) Larsen',
      items: [
        {
          id: 'submitted-item-2',
          sourceType: 'catalog',
          catalogItemId: 'item-bucket',
          description: 'Drywall Mud / All Purpose Mud / Bucket',
          quantity: 1,
          note: '',
          categoryId: 'cat-all-purpose',
          sku: null,
        },
      ],
      createdAt: '2026-06-04T14:00:00.000Z',
      updatedAt: '2026-06-04T14:14:00.000Z',
      submittedAt: '2026-06-04T14:14:00.000Z',
    },
  ]
  return clone(fixture)
}

export function createAdminWorkspaceFixture() {
  const fixture = createBaseFixture('admin')
  fixture.users = [
    {
      id: FOREMAN_ID,
      email: 'cj@example.com',
      firstName: 'Chris',
      lastName: '(CJ) Larsen',
      role: 'foreman',
      active: true,
      assignedJobIds: [JOB_ID],
    },
    {
      id: 'foreman-2',
      email: 'sam@example.com',
      firstName: 'Sam',
      lastName: 'Foreman',
      role: 'foreman',
      active: true,
      assignedJobIds: ['job-2'],
    },
    {
      id: 'user-pending',
      email: 'pat@example.com',
      firstName: 'Pat',
      lastName: 'Pending',
      role: 'foreman',
      active: true,
      assignedJobIds: [JOB_ID],
      inviteStatus: 'pending',
      inviteSentAt: null,
    },
  ]
  fixture.jobs = [
    createJob(),
    createJob({
      id: 'job-2',
      code: '2B',
      name: 'Drywall Buildout',
      gc: 'Summit',
      type: 'drywall',
      assignedForemanIds: ['foreman-2'],
    }),
  ]
  fixture.employees = [
    {
      id: 'employee-1',
      employeeNumber: '1001',
      firstName: 'Casey',
      lastName: 'Brown',
      occupation: 'Mechanic',
      active: true,
      isContractor: false,
      jobId: null,
    },
    {
      id: 'employee-2',
      employeeNumber: '1002',
      firstName: 'Jamie',
      lastName: 'Lopez',
      occupation: 'Installer',
      active: true,
      isContractor: false,
      jobId: null,
    },
    {
      id: 'employee-3',
      employeeNumber: '2001',
      firstName: 'Taylor',
      lastName: 'Reed',
      occupation: 'Contractor',
      active: false,
      isContractor: true,
      jobId: null,
    },
  ]
  fixture.shopCategories = [
    { id: 'cat-fasteners', name: 'Fasteners', parentId: null, active: true },
    { id: 'cat-anchor', name: 'Anchors', parentId: 'cat-fasteners', active: true },
  ]
  fixture.shopCatalogItems = [
    { id: 'catalog-1', description: 'Wedge Anchor 1/2"', categoryId: 'cat-anchor', sku: 'WA-12', price: 4.5, active: true },
    { id: 'catalog-2', description: 'Self Tap Screws', categoryId: 'cat-fasteners', sku: 'STS-01', price: 12, active: true },
  ]
  fixture.timecardWeeks = [
    {
      id: 'week-e2e',
      jobId: JOB_ID,
      jobCode: '1A',
      jobName: 'Phase 2 Company Acoustical remodel',
      ownerForemanUserId: FOREMAN_ID,
      ownerForemanName: 'Chris (CJ) Larsen',
      weekStartDate: WEEK_START_DATE,
      weekEndDate: WEEK_END_DATE,
      status: 'draft',
      employeeCardCount: 1,
      createdAt: '2026-06-04T09:00:00.000Z',
      updatedAt: '2026-06-04T09:00:00.000Z',
      submittedAt: null,
    },
    {
      id: 'week-admin-2',
      jobId: 'job-2',
      jobCode: '2B',
      jobName: 'Drywall Buildout',
      ownerForemanUserId: 'foreman-2',
      ownerForemanName: 'Sam Foreman',
      weekStartDate: WEEK_START_DATE,
      weekEndDate: WEEK_END_DATE,
      status: 'submitted',
      employeeCardCount: 1,
      createdAt: '2026-06-03T09:00:00.000Z',
      updatedAt: '2026-06-04T12:30:00.000Z',
      submittedAt: '2026-06-04T12:30:00.000Z',
    },
  ]
  fixture.timecardCards = [
    createTimecardCard('1A', {
      weekId: 'week-e2e',
      id: 'card-admin-1',
      firstName: 'Casey',
      lastName: 'Brown',
      fullName: 'Casey Brown',
      employeeNumber: '1001',
      occupation: 'Mechanic',
    }),
    createTimecardCard('2B', {
      weekId: 'week-admin-2',
      id: 'card-admin-2',
      employeeId: 'employee-2',
      firstName: 'Jamie',
      lastName: 'Lopez',
      fullName: 'Jamie Lopez',
      employeeNumber: '1002',
      occupation: 'Installer',
      sortIndex: 1,
    }),
  ]
  return clone(fixture)
}

export async function gotoPhase2App(page: Page, route: string, fixture: Record<string, unknown>) {
  await page.addInitScript((state) => {
    window.__PHASE2_E2E__ = structuredClone(state)
    window.confirm = () => true
  }, fixture)

  await page.goto(route)
}

export {
  JOB_ID,
  WEEK_END_DATE,
}
