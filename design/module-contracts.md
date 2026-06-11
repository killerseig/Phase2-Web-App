# Module Contracts

## Purpose

This document defines what each layer and module is allowed to own during the refactor.

The goal is to keep the app from drifting into large smart components, duplicated Firebase calls, or hidden workflow behavior.

## Layer Contracts

### Pages

Pages may:

- read route params
- connect stores and services
- own page-level loading/error state
- compose feature components
- decide which workflow actions are available
- handle submit/save orchestration

Pages should not:

- contain large repeated markup after a feature component exists
- know Firestore path details
- duplicate complex validation or autosave logic
- render exact PDF/email layouts directly

### Shared Components

Shared components may:

- render reusable UI
- accept props
- emit user intent
- own visual-only state

Shared components should not:

- import Firebase SDKs
- call app services directly
- know route names unless they are navigation components
- contain feature-specific business rules

### Feature Components

Feature components may:

- render one focused section of a workflow
- own local UI state for that section
- emit domain-specific events
- use feature utilities for formatting or derived display

Feature components should not:

- bypass parent workflow decisions
- duplicate service normalization
- perform privileged writes
- hide side effects from the parent page

### Composables

Composables may:

- own reusable non-visual behavior
- coordinate local state
- expose clear actions and computed values
- wrap repeated browser behavior like keyboard movement or dirty guards

Composables should not:

- become hidden stores for every page
- import Firebase unless they are explicitly service-facing and documented
- show toast messages directly unless they are a feedback composable

### Services

Services may:

- call Firestore, Storage, Auth, and callable functions
- normalize raw data into domain types
- sanitize write payloads
- branch to the e2e runtime
- hide Firebase implementation details

Services should not:

- render UI
- know component internals
- mutate component state directly
- show confirmation dialogs

### Stores

Stores may:

- own cross-page state
- cache session/profile/job context
- expose actions that multiple pages need

Stores should not:

- become dumping grounds for every form draft
- own exact-print output
- duplicate service data normalization

### Cloud Functions

Cloud Functions may:

- perform privileged writes
- validate privileged actions
- send email
- prepare/export PDFs and CSVs
- enforce server-side idempotency for submit actions

Cloud Functions should not:

- trust client role flags without server-side validation
- duplicate large frontend-only UI decisions
- keep old migration endpoints active after data is merged

### Security Rules

Security Rules must:

- enforce data access, not just mirror hidden buttons
- protect admin-only records
- protect assigned-job workflows
- prevent submitted records from being edited when they are read-only

Security Rules should not:

- depend on client-only state
- allow broad writes because the UI is expected to hide controls

## Module Contracts

### Auth And Users

Page owner:

- login/setup/password pages
- users admin page

Service owner:

- auth session
- user profile reads
- user creation/deletion callable functions
- e2e user runtime behavior

Component candidates:

- user list
- user detail form
- job assignment picker
- role selector
- invite/reset action block

Rules:

- built-in admin stays fixed
- user creation/deletion remains privileged
- components do not decide final access

### Jobs

Page owner:

- jobs list/detail/admin workflow
- global notification recipient workflow

Service owner:

- job reads/writes
- notification recipient persistence
- archive/restore/delete operations

Component candidates:

- job list
- job detail form
- module toggles
- recipient editor
- archive/delete action block

Rules:

- jobs are a good first refactor target
- keep autosave echo protection intact
- keep recipient cleanup separate from visual refactor

### Employees

Page owner:

- employee directory/admin workflow

Service owner:

- employee reads/writes
- archive/active status

Component candidates:

- employee list
- employee detail form
- employee status actions

Rules:

- employee information is sensitive
- payroll/admin access rules should stay explicit
- avoid mixing employee refactor with timecard workbook refactor

### Daily Logs

Page owner:

- draft/submitted daily log workflow
- validation and submit orchestration
- additional recipient workflow

Service owner:

- daily log records
- attachment Storage paths
- submit/email callable function

Component candidates:

- daily log header
- weather/manpower/schedule sections
- text sections
- attachment uploader
- recipient section
- submit/status panel

Rules:

- typing must not be disrupted by autosave
- submitted logs stay read-only
- attachment changes require Storage and e2e checks

### Timecards

Page owner:

- job timecard week workflow
- card creation/deletion
- submit orchestration

Service owner:

- timecard week/card reads and writes
- submit callable function
- e2e runtime behavior

Feature owner:

- workbook model
- keyboard navigation
- total/REG/OT calculations
- PDF/CSV export preparation

Component candidates:

- week toolbar
- employee card list
- workbook grid/canvas
- save status
- submitted state banner

Rules:

- preserve exact workbook behavior
- do not show lock controls on the job timecard page
- do not refactor PDF/email output in the same slice as input behavior
- email PDFs should use the same generation path as admin export

### Timecard Export

Page owner:

- export filters
- lock/edit workflow
- download/open print actions

Service owner:

- export package reads
- lock/edit callable or write behavior
- CSV/PDF request behavior

Component candidates:

- export filters
- package list
- card preview row
- lock status control

Rules:

- export page owns locking controls
- job timecard page does not
- print route must keep stored payload rendering stable

### Shop Orders

Page owner:

- catalog browser/workspace composition
- draft creation
- submit orchestration
- history selection

Service owner:

- shop order records
- catalog reads
- submit/email callable function

Component candidates:

- catalog tree
- catalog item row
- order header
- added items list
- order history list
- custom item form

Rules:

- draft delivery date defaults to next Thursday
- item names shown in added items should not include folder paths
- submitted orders are read-only
- email/print layout changes require preview/smoke checks
- printable table headers must repeat across pages when possible

### Shop Catalog Admin

Page owner:

- admin catalog tree and inspector

Service owner:

- catalog folder/item CRUD
- archive/delete behavior

Component candidates:

- admin catalog tree
- node row
- inspector
- folder form
- item form
- move/archive controls

Rules:

- keep separate from shop order catalog browser behavior
- do not mix catalog admin refactor with shop order email layout work

### Emails, PDFs, And Print Routes

Owner:

- functions own email orchestration
- functions or feature export modules own PDF/CSV generation
- print routes render stored/export payloads

Rules:

- no second HTML clone of timecard PDFs
- smoke test generated email output
- preview exact-print changes manually
- keep shop order and timecard output changes isolated
- generated files should have stable filenames and clear metadata

### Settings And Recipients

Page owner:

- settings or admin pages collect recipient intent

Service owner:

- canonical notification recipient shape
- global/job recipient persistence

Rules:

- canonical recipient shape should be explicit
- do not dual-write old recipient fields indefinitely
- recipient field cleanup is a dedicated compatibility slice
- notification changes require related e2e/smoke checks

## Refactor Contract Checklist

Before changing a module:

- identify the page owner
- identify the service owner
- confirm existing e2e coverage
- decide whether the change is visual, behavior, persistence, or output
- choose the smallest safe slice

After changing a module:

- run type-check
- run targeted e2e
- run function build/smoke if functions or output changed
- update this contract if ownership changed

