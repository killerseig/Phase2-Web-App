# Phase 2 Firestore Schema And Routes

## Purpose

This document takes the `v1` blueprint and turns it into a recommended:

- Firestore collection structure
- document field shape
- route map
- page map
- index/security direction

This is the structure I would build against unless we discover a company rule that forces a change.

Firebase implementation details, including Security Rules, indexes, Storage, Cloud Functions, and emulator testing, should follow `firebase-architecture.md`.

## Design choices

### Main choices

- Keep `Admin`, `Payroll`, `Shop Foreman`, `Project Manager`, and `Foreman` as target built-in stored roles.
- Use explicit role capabilities rather than treating `Project Manager` as foreman-equivalent.
- Use role dashboards for each user's command center and shared job dashboards for job-specific work.
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
  roleKey: 'admin' | 'payroll' | 'shop-foreman' | 'project-manager' | 'foreman' | 'none'
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
- `assignedJobIds` is a denormalized convenience field and should match job assignments for Foreman, Shop Foreman, and Project Manager users.
- Payroll users can view jobs as lookup context without being assigned to each job.

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
  assignedProjectManagerIds: string[]
  assignedProjectManagerNames: string[]
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
- admins can create/edit/archive/unarchive/delete jobs
- project managers can edit assigned jobs only
- payroll users can create jobs and view all active jobs as read-only lookup context after creation
- shop foreman users can view all active jobs as read-only lookup context
- regular foremen can view assigned jobs only
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
  scopeType: 'global' | 'job' | 'assignment'
  ownerType: 'admin' | 'field-user' | 'system-assignment'
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
- assignment recipients should be derived from assigned Foremen, Shop Foremen, and Project Managers rather than manually maintained when possible
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
- week lookup/subscription must be read-only and must not create draft weeks or cards
- explicit create actions should create draft weeks/cards when permissions allow it
- submitted/card-containing weeks should be preferred over accidental blank drafts for default display and rollover source selection
- when a week is submitted:
  - keep the submitted record
  - start the next week from the carried-forward roster
  - do not clone the prior card bodies
  - clear editable entry fields such as hours, production, and `ACCT`
  - preserve `Job #` cascade behavior for blank rows when users edit the new draft

### Daily logs

- `logDate` must equal the app's current local date for create/edit/submit
- no backdating
- no future dating
- date lookup/subscription must be read-only and must not create draft logs
- if submitted logs exist for a selected date, show them by default and require an explicit create action for another log

### Shop orders

- `deliveryDate` must be `today` or later
- order lookup/subscription must be read-only and must not create draft orders
- catalog lookup/search must be read-only and must not create order items
- draft orders should be created only by explicit `New Order` intent
- order items should be created only by explicit catalog/custom item add intent

## Recommended route map

### Public routes

- `/login`
- `/set-password`

### Authenticated core routes

- `/dashboard`
  - role-specific landing dashboard
  - modules depend on role/capabilities
- `/jobs`
  - jobs list
  - assigned jobs for foremen
  - read-only active job lookup for payroll, shop foreman, and project manager
  - active plus archived sections for admins
- `/jobs/:jobId`
  - job dashboard
  - shared job workspace with modules gated by capability

### Timecard routes

- `/jobs/:jobId/timecards`
  - default timecard workspace
  - current user's current week by default
- `/jobs/:jobId/timecards/:timecardWeekId`
  - explicit draft or submitted package view
- `/exports/timecards`
  - admin/payroll filtered export page
  - project manager assigned-job submitted-timecard reporting may reuse this view in read-only scoped mode or use a separate dashboard module

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
  - admin/payroll-managed global employee list
- `/settings/lists/job-types`
  - admin-managed job types
- `/settings/lists/gcs`
  - admin-managed GC list
- `/settings/lists/occupations`
  - admin-managed occupation list
- `/settings/shop-catalog`
  - admin/shop-foreman shop tree management, enforced by role capability

## Page map

### `JobsPage`

Responsibilities:
- show assigned jobs or read-only job lookup depending on role
- show archived section for admins
- create job in edit mode for admin and payroll where allowed
- edit/archive/delete job in edit mode
- allow project managers to edit assigned jobs only
- prevent payroll from delete/archive and keep post-create edit scope behind final company confirmation

### `JobDashboardPage`

Responsibilities:
- show job summary
- show module launcher cards
- show job metadata
- allow admin edits in edit mode
- allow project manager edits for assigned jobs only
- gate module cards by capability and assignment

### `RoleDashboardPage`

Responsibilities:
- show modules for the current user's role
- provide direct action cards for role-specific work
- provide job drill-down into shared job dashboards
- keep dashboard cards reusable instead of building separate unrelated dashboards per role

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
- admin/payroll filters
- project manager assigned-job submitted-timecard reporting if this view is reused in scoped read-only mode
- result set preview
- export exact PDF
- export exact CSV

### `DailyLogsPage`

Responsibilities:
- show current-day/submitted history without creating drafts on page load or date selection
- create current-day drafts only from explicit user action
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
- allow Admin and Shop Foreman catalog management according to capability checks

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
- user management
- fixed-list management
- edits to submitted timecards

Require admin or payroll enforcement for:

- employee management
- full timecard export page data access

Require final role capability enforcement for:

- shop catalog management

### Foreman restrictions

- foremen can only access jobs in their assignment set
- foremen cannot edit submitted records
- foremen cannot change admin-owned recipients
- foremen cannot create/edit daily logs for past/future dates

### Project Manager restrictions

- project managers can view all active jobs as lookup context
- project managers can edit assigned jobs only
- project managers cannot delete or archive jobs
- project managers can open job dashboard workflows for assigned jobs only
- project managers can see submitted timecards and daily log history for assigned jobs for billing/oversight

### Payroll restrictions

- payroll can view all active jobs as lookup context
- payroll can manage employees and use timecard export
- payroll can create jobs
- payroll cannot delete/archive jobs
- exact payroll edit rights after creation still need company confirmation
- payroll should not access daily log, shop order, or job timecard workflow editing unless later requested

### Shop Foreman restrictions

- shop foreman can view all active jobs as lookup context
- shop foreman can access shop catalog
- shop foreman can open job dashboard workflows for the `Shop` job
- non-Shop job workflow access should stay read-only unless explicitly assigned/confirmed later
- shop foreman cannot edit/delete/archive jobs

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
