# Phase 2 Firestore Schema And Routes

## Purpose

This document takes the `v1` blueprint and turns it into a recommended:

- Firestore collection structure
- document field shape
- route map
- page map
- index/security direction

This is the structure I would build against unless we discover a company rule that forces a change.

## Design choices

### Main choices

- Keep `Admin` and `Foreman` as the only built-in roles in `v1`.
- Use the same main pages for both roles.
- Keep `edit mode` as page state, not a separate page tree.
- Store `submitted` records in the same collections as `draft` records, using status fields and audit trails.
- Keep exact-print timecard data in Firestore in a way that can reproduce the Excel layout.

### Naming conventions

- Use top-level collections for primary business objects.
- Use subcollections only when a record has a natural child set:
  - timecard cards
  - timecard audit entries
- Use `createdAt`, `updatedAt`, `submittedAt` timestamps consistently.
- Use `createdByUserId` and `submittedByUserId` consistently.
- Use `archivedAt` instead of deleting records when history matters.

## Firestore collections

### `users/{userId}`

Purpose:
- app user profile
- role and activation data
- cached job assignments for fast startup and navigation guards

Recommended fields:

```ts
type UserDoc = {
  email: string
  displayName: string
  firstName: string
  lastName: string
  roleKey: 'admin' | 'foreman'
  customRoleId: string | null
  isActive: boolean
  assignedJobIds: string[]
  lastLoginAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Notes:
- `customRoleId` stays `null` in `v1`.
- `assignedJobIds` is a denormalized convenience field and should match job assignments.

### `jobs/{jobId}`

Purpose:
- core job record
- assignment container
- job dashboard source
- job-level calculation settings

Recommended fields:

```ts
type JobDoc = {
  jobNumber: string
  jobNumberNormalized: string
  jobName: string
  jobNameLower: string
  jobTypeId: string
  jobTypeLabel: string
  gcId: string | null
  gcLabel: string | null
  jobAddress: string | null
  startDate: string | null
  endDate: string | null
  burden: number | null
  taxExempt: boolean
  certified: boolean
  cip: string | null
  kjic: string | null
  assignedForemanIds: string[]
  assignedForemanNames: string[]
  isArchived: boolean
  archivedAt: Timestamp | null
  createdByUserId: string
  updatedByUserId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Rules:
- default `burden` to `0.33` when blank in the UI or during save
- only admins can archive/unarchive jobs
- archived jobs remain queryable by admins

### `employees/{employeeId}`

Purpose:
- global employee directory

Recommended fields:

```ts
type EmployeeDoc = {
  firstName: string
  lastName: string
  fullName: string
  fullNameLower: string
  employeeNumber: string
  employeeNumberNormalized: string
  wage: number
  occupationId: string
  occupationLabel: string
  isContractor: boolean
  isActive: boolean
  createdByUserId: string
  updatedByUserId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Notes:
- keep `isActive` instead of hard-deleting employees
- submitted timecards use employee snapshots, so submitted history stays stable

### `jobTypes/{jobTypeId}`

Purpose:
- admin-managed fixed list for job types

Recommended fields:

```ts
type JobTypeDoc = {
  label: string
  labelLower: string
  sortIndex: number
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `gcs/{gcId}`

Purpose:
- admin-managed fixed list for GCs

Recommended fields:

```ts
type GcDoc = {
  label: string
  labelLower: string
  sortIndex: number
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `occupations/{occupationId}`

Purpose:
- admin-managed fixed list for occupations

Recommended fields:

```ts
type OccupationDoc = {
  label: string
  labelLower: string
  sortIndex: number
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `moduleRecipients/{recipientId}`

Purpose:
- shared recipient system for daily logs and shop orders

Recommended fields:

```ts
type ModuleRecipientDoc = {
  moduleType: 'dailyLog' | 'shopOrder'
  scopeType: 'global' | 'job'
  ownerType: 'admin' | 'foreman'
  ownerUserId: string
  jobId: string | null
  email: string
  emailLower: string
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Rules:
- if `ownerType === 'admin'`, foremen cannot edit or delete it
- `jobId` is `null` for global recipients

### `timecardWeeks/{timecardWeekId}`

Purpose:
- one weekly timecard package for one job, one week, one submitting foreman
- parent record for cards and audit trail

Recommended fields:

```ts
type TimecardWeekDoc = {
  jobId: string
  jobNumber: string
  jobName: string
  ownerForemanUserId: string
  ownerForemanName: string
  weekStartDate: string
  weekEndDate: string
  status: 'draft' | 'submitted'
  employeeCardCount: number
  sortKey: string
  submittedAt: Timestamp | null
  createdByUserId: string
  submittedByUserId: string | null
  updatedByUserId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Notes:
- `sortKey` can be something like `2026-04-18__9999__userId`
- do not separate draft and submitted collections
- use `status` plus subcollection audit history

### `timecardWeeks/{timecardWeekId}/cards/{cardId}`

Purpose:
- one employee card inside a weekly timecard package

Recommended fields:

```ts
type TimecardCardDoc = {
  sourceType: 'globalEmployee' | 'customEmployee'
  employeeId: string | null
  firstName: string
  lastName: string
  fullName: string
  fullNameLower: string
  employeeNumber: string
  employeeNumberNormalized: string
  wage: number
  occupationId: string | null
  occupationLabel: string
  isContractor: boolean
  sortIndex: number
  hpcGroups: Array<{
    rowIndex: number
    jobNumber: string
    account: string
    dif: string
    mon: number | null
    tue: number | null
    wed: number | null
    thu: number | null
    fri: number | null
    sat: number | null
    total: number | null
    production: number | null
    off: string
  }>
  regularHours: number | null
  overtimeHours: number | null
  notes: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Notes:
- `hpcGroups` is the payload that needs to reproduce the Excel card
- submitted cards must stay snapshot-based
- draft cards linked to global employees can be refreshed from employee data

### `timecardWeeks/{timecardWeekId}/auditEntries/{auditId}`

Purpose:
- post-submit change history
- optional draft history if we decide to log more than just submitted edits

Recommended fields:

```ts
type TimecardAuditEntryDoc = {
  actorUserId: string
  actorDisplayName: string
  actionType: 'create' | 'submit' | 'editSubmitted' | 'reopenView'
  changedFields: string[]
  beforeSummary: Record<string, unknown> | null
  afterSummary: Record<string, unknown> | null
  createdAt: Timestamp
}
```

### `dailyLogs/{dailyLogId}`

Purpose:
- one daily log submission

Recommended fields:

```ts
type DailyLogDoc = {
  jobId: string
  jobNumber: string
  jobName: string
  logDate: string
  status: 'draft' | 'submitted'
  sequenceNumber: number
  foremanUserId: string
  foremanName: string
  payload: Record<string, unknown>
  submittedAt: Timestamp | null
  createdByUserId: string
  submittedByUserId: string | null
  updatedByUserId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Notes:
- `sequenceNumber` supports multiple logs on the same job/day
- validation should enforce same-day submission only

### `shopCatalogNodes/{nodeId}`

Purpose:
- shared folder/item tree for shop ordering

Recommended fields:

```ts
type ShopCatalogNodeDoc = {
  nodeType: 'folder' | 'item'
  parentId: string | null
  name: string
  nameLower: string
  description: string | null
  sortIndex: number
  isActive: boolean
  createdByUserId: string
  updatedByUserId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Notes:
- use root-level folders with `parentId: null`
- drag-and-drop just changes `parentId` and `sortIndex`

### `shopOrders/{shopOrderId}`

Purpose:
- one shop order record

Recommended fields:

```ts
type ShopOrderDoc = {
  jobId: string
  jobNumber: string
  jobName: string
  deliveryDate: string
  status: 'draft' | 'submitted'
  foremanUserId: string
  foremanName: string
  comments: string
  submittedAt: Timestamp | null
  createdByUserId: string
  submittedByUserId: string | null
  updatedByUserId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `shopOrders/{shopOrderId}/items/{itemId}`

Purpose:
- individual line items for one shop order

Recommended fields:

```ts
type ShopOrderItemDoc = {
  sourceType: 'catalog' | 'custom'
  catalogNodeId: string | null
  description: string
  quantity: number | null
  note: string
  sortIndex: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

## Derived rules

### Timecards

- current draft week should be discoverable by:
  - `jobId`
  - `ownerForemanUserId`
  - `weekEndDate`
- when a week is submitted:
  - keep the submitted record
  - start the next week from the carried-forward roster
  - do not clone the prior card bodies

### Daily logs

- `logDate` must equal the app's current local date for create/edit/submit
- no backdating
- no future dating

### Shop orders

- `deliveryDate` must be `today` or later

## Recommended route map

### Public routes

- `/login`
- `/set-password`

### Authenticated core routes

- `/jobs`
  - jobs list
  - active jobs for foremen
  - active plus archived sections for admins
- `/jobs/:jobId`
  - job dashboard

### Timecard routes

- `/jobs/:jobId/timecards`
  - default timecard workspace
  - current user's current week by default
- `/jobs/:jobId/timecards/:timecardWeekId`
  - explicit draft or submitted package view
- `/exports/timecards`
  - admin-only filtered export page

### Daily log routes

- `/jobs/:jobId/daily-logs`
  - current-day drafts and recent history
- `/jobs/:jobId/daily-logs/:dailyLogId`
  - specific log view/edit page

### Shop order routes

- `/jobs/:jobId/shop-orders`
  - draft list and history
- `/jobs/:jobId/shop-orders/:shopOrderId`
  - specific order view/edit page

### Admin/support routes

- `/employees`
  - admin-managed global employee list
- `/settings/lists/job-types`
  - admin-managed job types
- `/settings/lists/gcs`
  - admin-managed GC list
- `/settings/lists/occupations`
  - admin-managed occupation list
- `/settings/shop-catalog`
  - admin-managed shop tree

## Page map

### `JobsPage`

Responsibilities:
- show assigned jobs
- show archived section for admins
- create job in edit mode
- edit/archive/delete job in edit mode

### `JobDashboardPage`

Responsibilities:
- show job summary
- show module launcher cards
- show job metadata
- allow admin edits in edit mode

### `TimecardsPage`

Responsibilities:
- weekly workspace
- employee card grid
- add from global employee list
- add custom employee
- remove employee from roster
- submit weekly package
- view history

### `TimecardExportPage`

Responsibilities:
- admin-only filters
- result set preview
- export exact PDF
- export exact CSV

### `DailyLogsPage`

Responsibilities:
- create current-day drafts
- enforce required fields
- submit same-day logs only
- manage module recipients
- view history

### `ShopOrdersPage`

Responsibilities:
- browse catalog tree
- add catalog items
- add custom items
- manage module recipients
- submit orders
- view history

### `EmployeesPage`

Responsibilities:
- create/edit/archive employee records
- search by name or employee number

### `ReferenceListPage`

Shared pattern for:
- job types
- GCs
- occupations

### `ShopCatalogAdminPage`

Responsibilities:
- add folders
- add items
- drag/drop move nodes
- archive or deactivate nodes

## Edit mode recommendation

Do not create duplicate admin routes for the same workflows.

Recommended approach:

- keep edit mode in local page state or store state
- enable edit mode only for admins
- use drawers, inspectors, or modal surfaces for admin actions

Examples:

- job page edit mode
- dashboard metadata edit mode
- timecard help/edit mode

## Recommended indexes

These will likely be needed early.

### Jobs

- `isArchived ASC`, `jobNameLower ASC`
- `assignedForemanIds ARRAY`, `isArchived ASC`
- `jobNumberNormalized ASC`

### Employees

- `employeeNumberNormalized ASC`
- `fullNameLower ASC`

### Timecard weeks

- `jobId ASC`, `weekEndDate DESC`
- `ownerForemanUserId ASC`, `weekEndDate DESC`
- `status ASC`, `submittedAt DESC`
- `jobId ASC`, `status ASC`, `submittedAt DESC`

### Daily logs

- `jobId ASC`, `logDate DESC`
- `status ASC`, `logDate DESC`

### Shop orders

- `jobId ASC`, `deliveryDate DESC`
- `status ASC`, `deliveryDate DESC`

### Module recipients

- `moduleType ASC`, `scopeType ASC`
- `moduleType ASC`, `jobId ASC`

### Shop catalog

- `parentId ASC`, `sortIndex ASC`

## Security direction

### General

- do not trust client-side role checks
- enforce role and assignment rules in Firestore rules and Cloud Functions

### Admin-only operations

Require admin enforcement for:

- job archive/delete
- employee management
- fixed-list management
- shop catalog management
- timecard export page data access
- edits to submitted timecards

### Foreman restrictions

- foremen can only access jobs in their assignment set
- foremen cannot edit submitted records
- foremen cannot change admin-owned recipients
- foremen cannot create/edit daily logs for past/future dates

### Export generation

Use Cloud Functions for:

- exact weekly PDF generation
- filtered PDF bundles
- exact CSV export generation

Reason:
- safer permissions
- easier auditing
- more stable exact-output generation

## Known open items

- exact meaning of `CIP`
- exact meaning of `KJIC`
- whether future custom roles will need record-level restrictions beyond page access
