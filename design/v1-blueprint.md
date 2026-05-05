# Phase 2 V1 Blueprint

## Purpose

This blueprint turns the discovery notes into a working build plan for `v1`.

The goal is to rebuild Phase 2 as a `Vue + Firebase` application that:

- feels like a real desktop-style application
- keeps the `timecard` workflow as close to Excel as possible
- modernizes `daily logs` and `shop orders` without losing familiarity
- uses shared patterns so future modules stay consistent

## Product Goals

### Main goals

- Replace the three current field tools:
  - `Timecards`
  - `Shop Orders`
  - `Daily Logs`
- Make the app comfortable and clear for real users.
- Keep the experience mobile-capable without turning it into a generic phone-first form app.
- Build the foundation so future custom roles and future modules can be added without redoing the core system.

### Core principles

- `Familiarity over novelty`
  - especially for timecards
- `Same page, different permissions`
  - admins use the same pages as foremen
  - admins get extra abilities through `edit mode`
- `Consistency over exceptions`
  - avoid special-case behavior when a shared rule will work
- `History and auditability from day one`
  - creation, submission, and post-submit changes need to be traceable

## Roles

### V1 built-in roles

- `Admin`
  - full access
  - can help with drafts
  - can edit submitted records where allowed
  - can manage jobs, employees, fixed lists, catalog structure, and export tools
- `Foreman`
  - works inside assigned jobs
  - creates and submits timecards, daily logs, and shop orders

### Role direction after v1

- The permission system should be data-driven from the start.
- Future custom non-admin roles should be possible.
- The old `Controller` workflow is handled by `Admin` in v1.
- The `Admin` role should stay fixed and always retain full access.

## Primary User Flow

### Foreman flow

1. Sign in.
2. Choose a job.
3. Open the job dashboard.
4. Choose a module:
   - `Timecards`
   - `Daily Logs`
   - `Shop Orders`

### Account creation rule

- `v1` should not include a normal public sign-up flow.
- New users should only enter the system through the admin-created email setup flow.
- The rebuild should keep using the same working email system from `v1` for that setup process.

### Admin flow

1. Sign in.
2. Use the same core pages a foreman sees.
3. Enter `edit mode` when admin-only actions are needed.
4. Access admin-only tools such as filtered timecard export, list management, and archived jobs.

## UX Direction

### Shell

Use the networking app as the shell reference:

- left navigation rail
- thin top context bar
- thin bottom status bar
- dense, organized spacing
- application-style layout instead of a generic SaaS dashboard

### Shared page pattern

- Normal runtime view first
- `Edit mode` layered onto the same page
- Context-aware panels and drawers instead of separate admin versions of the same workflow
- Prefer `auto-save` for routine edits instead of requiring manual `Save Changes` buttons
- Auto-save should run on simple commit-style events such as:
  - button clicks and toggle changes
  - selection changes
  - leaving or deselecting a text box or input field
- Pages should show lightweight save state feedback rather than depending on manual save actions

### Module styling

- `Timecards`
  - dark app shell outside
  - light sheet-style working surface inside
  - must preserve the Excel mental model
- `Daily Logs`
  - modern structured form
  - required fields throughout
- `Shop Orders`
  - worksheet-style request flow
  - explorer-like catalog tree

## V1 Page Map

### Core pages

- `Login`
- `Set Password / Account Setup`
- `Jobs`
- `Job Dashboard`
- `Timecards`
- `Timecard Export` (`Admin` only)
- `Daily Logs`
- `Shop Orders`

### Shared admin-management surfaces

These do not need to become totally separate admin apps. They can be pages, drawers, or edit-mode panels depending on the final UI.

- `Employees`
- `GC list`
- `Job Type list`
- `Occupation list`
- `Shop Catalog Tree`

## Jobs

### Purpose

Jobs are the main container for foreman work.

The `Job Dashboard` is the hub for job-level modules:

- `Timecards`
- `Daily Logs`
- `Shop Orders`

### Visibility

- Active jobs are available to assigned foremen.
- Archived jobs are visible only to admins.
- Archived jobs should live in their own section to keep the jobs page clean.

### Required job fields

- `Job Number`
- `Job Name`
- `Job Type`
- `Foremen assigned to job`

### Optional job fields

- `GC`
- `Start Date`
- `End Date`
- `Burden`
- `Tax Exempt`
- `Certified`
- `CIP`
- `KJIC`
- `Job Address`

### Job rules

- `Job Type` comes from an admin-managed fixed list.
- `GC` comes from an admin-managed fixed list.
- `Burden` is optional.
- If `Burden` is blank, default it to `0.33`.
- `Tax Exempt` defaults to `false`.
- `Certified` defaults to `false`.
- `CIP` and `KJIC` are still undefined and need company clarification.

## Employees

### Employee strategy

V1 should support both:

- a `global employee list`
- `custom one-off employees` created directly from timecards

This handles the company's split opinion about whether everything should come from one global list.

### Global employee fields

- `First Name` - required
- `Last Name` - required
- `Employee Number` - required
- `Wage` - required
- `Occupation`
- `Contractor`

### Employee field rules

- `Occupation` should come from an admin-managed fixed list.
- `Contractors` still require an `Employee Number`.

### Custom employee rules

Custom timecard employees should require:

- `First Name`
- `Last Name`
- `Employee Number`
- `Wage`
- `Occupation`
- `Contractor`

### Employee linking behavior

If a timecard card is created from a global employee:

- employee fields should auto-fill
- linked fields should not be directly editable on the timecard
- draft/current records may reflect later employee changes
- submitted records must not auto-change from later employee edits
- admins must intentionally edit a submitted timecard if they want it updated

### Out of scope for v1

- converting a custom employee into a global employee directly from the timecard flow

## Timecards

### Priority

`Timecards` are the highest-priority module in v1.

### Time period

- weekly
- `Sunday to Saturday`

### Critical requirement

The timecard experience must stay `as close to the Excel file as possible`.

This includes:

- overall card layout
- card density
- multi-card workspace
- alphabetical card ordering
- weekly PDF output
- two-cards-per-page print layout

### Timecard workspace behavior

- Foremen work inside a weekly job workspace.
- The same crew should carry forward week to week.
- Starting a new week should:
  - keep employee/header information
  - clear weekly entry cells
- Removing an employee this week removes them from the carried-forward roster next week.
- Adding a custom employee this week carries that employee into next week's roster.

### Draft and submit behavior

- `draft`
  - foremen can edit
  - foremen can delete
  - admins can help edit
- `submitted`
  - foremen can view from history
  - foremen cannot edit the submitted record
  - admins can edit the submitted record
  - all post-submit changes must be logged

### Timecard history

- submitted timecards remain viewable later
- foremen can see all submitted timecard records for assigned jobs for now
- access rules should be built so this can be tightened later

### Row meanings

- `H` = Hours
- `P` = Production
- `C` = Cost

### Overtime rule

- `REG`
  - cap at `40`
- `OT`
  - anything over `40`

### PDF and CSV output

#### PDF

- one combined PDF for the week
- must match the provided example output exactly
- must keep the Excel print layout exactly

#### CSV

- must match the provided example output exactly
- current required columns:
  - `Employee Name`
  - `Employee Code`
  - `Job Code`
  - `DETAIL_DATE`
  - `Sub-Section`
  - `Activity Code`
  - `Cost Code`
  - `H_Hours`
  - `P_HOURS`

### Admin export workspace

V1 needs an `Admin`-only filtered timecard export workspace.

It should support filters like:

- date range
- employee name
- foreman
- job
- related timecard fields

It should generate exports based on active filters:

- PDF sets
- CSV exports

The main use case is submitted timecards, but admins should be able to include drafts when needed.

### Working data assumption

Working assumption for v1:

- a submitted weekly timecard package belongs to:
  - one `job`
  - one `week`
  - one submitting `foreman`

This assumption matches the requested export filters and should work unless the company later says one shared package must exist per job/week.

## Daily Logs

### Direction

This module should be rebuilt as a proper web form.

The old tool's `content structure` matters more than its exact UI.

### Record rules

- tied to a specific day
- multiple logs are allowed for the same job and date
- submission is only allowed for the `current day`
- no one can create or edit daily logs for past or future dates

### Statuses

- `draft`
- `submitted`

### Submit rules

- all fields are required
- users must actively enter something in every field
- `N/A` is acceptable, but the field still has to be touched and filled

### Submitted behavior

- foremen can view submitted records
- foremen cannot edit submitted records
- history should remain visible

## Shop Orders

### Direction

Shop orders should keep the fast Excel request flow while improving catalog navigation.

### Catalog model

- shared across all jobs
- tree-based
- folders can contain folders
- folders can contain items
- admin-controlled structure
- drag-and-drop reorganization for admins

### Foreman ordering behavior

- select standard catalog items
- add custom one-off items without admin approval
- cannot edit the catalog structure itself

### Delivery rules

- one delivery date per order
- delivery date can only be `today` or in the future
- preserve a quick `Thursday delivery` shortcut

### Statuses

- `draft`
- `submitted`

### Submitted behavior

- foremen can view submitted records
- foremen cannot edit submitted records
- history should remain visible

### Fulfillment scope

V1 does not need a separate shop fulfillment view.

The current shop workflow remains email-driven:

- the shop receives the order email
- the shop calls if changes are needed
- the shop fulfills from the email

## Shared Recipient System

Use one reusable recipient-management pattern for:

- `Daily Logs`
- `Shop Orders`

### Rules

- admin-managed recipients can be:
  - `global`
  - `per job`
- foreman-managed recipients can be:
  - `per job`
- foremen cannot edit or remove admin-managed entries
- no separate `To` and `Cc` groups are needed in v1

## Data Model Direction

This is not the final schema, but it is the recommended v1 structure.

### `users`

- profile
- built-in role
- future custom role reference
- auth-related metadata

### `jobs`

- job metadata
- assignment data
- archive state
- burden and other job-level settings

### `employees`

- global employee records

### `referenceData`

Admin-managed fixed lists such as:

- `jobTypes`
- `gcs`
- `occupations`

### `timecardWeeks`

- job reference
- foreman reference
- week start/end
- status
- created by
- submitted by
- timestamps
- printable/exportable metadata

### `timecardWeeks/{weekId}/cards`

- linked employee ref or custom employee marker
- employee snapshot fields
- row data required to recreate the Excel card exactly
- sort fields

### `timecardWeeks/{weekId}/audit`

- actor
- action
- timestamp
- before/after or changed fields

### `dailyLogs`

- job reference
- log date
- status
- field payload
- created by
- submitted by

### `shopCatalogNodes`

- `folder` or `item`
- parent reference
- sort index
- active state

### `shopOrders`

- job reference
- delivery date
- status
- order items
- custom items
- comments
- created by
- submitted by

### `moduleRecipients`

Shared records for:

- module type
- scope type
- owner type
- owner user
- job reference when applicable
- email

## Build Order

### Phase 1: Foundation

- auth
- shared shell
- user profile loading
- role gating
- edit mode framework

### Phase 2: Job Foundation

- jobs page
- active vs archived sections
- job create/edit/archive/delete
- job assignments
- fixed list management:
  - job types
  - GCs
  - occupations

### Phase 3: Employees

- global employee list
- employee CRUD
- employee linking behavior for timecards

### Phase 4: Job Dashboard

- job dashboard layout
- module entry points
- job-level settings editing

### Phase 5: Timecards

- weekly workspace
- carried-forward crew behavior
- global employee selection
- custom employee creation
- exact-print card layout
- submission/history/audit
- weekly PDF
- exact CSV
- admin export workspace

### Phase 6: Daily Logs

- structured form
- validation
- recipient management
- draft/submitted history

### Phase 7: Shop Orders

- shared recipient system reuse
- catalog tree
- item selection
- custom item flow
- history

## Out of Scope For V1

- separate shop fulfillment dashboard
- custom role builder UI
- direct custom-employee-to-global conversion
- extra timecard statuses beyond `draft` and `submitted`
- PDF generation for daily logs or shop orders

## Open Items

These are still real questions and should stay open until confirmed.

- What exactly do `CIP` and `KJIC` mean?
- Who should review the first visual prototype:
  - admin users
  - foremen
  - both
- Which pain point should get the very first polish pass:
  - timecard familiarity
  - visual comfort
  - mobile usability
  - reporting/export
