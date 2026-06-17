# Testing Strategy

## Purpose

This document defines the test safety net for refactoring the Phase 2 app.

The goal is not to make every test type do everything. The goal is to use the right test at the right layer:

- e2e tests protect real user workflows
- smoke tests protect generated emails and PDFs
- type-check/build protect refactor correctness
- future component tests protect extracted reusable pieces
- future emulator tests protect Firestore and Storage rules

## Ground Rules

- E2E tests must use real app pages.
- Do not add fake e2e-only routes or fake e2e-only pages.
- Prefer seeded e2e runtime data over hard-coded UI state.
- Preserve existing `data-testid` values during refactors unless the test change is intentional.
- Add or update e2e coverage before refactoring a workflow that is not already covered.
- Keep output formats protected with smoke/manual preview checks when touching email, print, PDF, or CSV generation.

## Test Commands

Use these commands as the common refactor gates.

```bash
npm run type-check
npm --prefix functions run build
npm run test:e2e
npm run test:functions-smoke
npm run test:pre-refactor
npm run test:e2e:all-browsers
```

Targeted e2e examples:

```bash
npx playwright test e2e/jobs.spec.ts --project=chromium
npx playwright test e2e/daily-log-submit.spec.ts --project=chromium
npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium
npx playwright test e2e/timecard-workbook.spec.ts --project=chromium
npx playwright test e2e/admin-pages.spec.ts --project=chromium
```

Function preview and smoke examples:

```bash
npm --prefix functions run preview:shop-order-email
npm --prefix functions run preview:timecard-email
npm --prefix functions run smoke:shop-order-email
npm --prefix functions run smoke:timecard-email
```

## Refactor Gates

### Tiny Component-Only Slice

Use for extracting presentational components without changing persistence.

Required:

- `npm run type-check`
- targeted component/unit test if one exists
- targeted e2e if the component is visible on a real route

### Workflow Slice

Use for changes to jobs, daily logs, shop orders, users, employees, or timecards.

Required:

- `npm run type-check`
- targeted e2e for the touched workflow
- related function smoke test if email/export behavior is touched

### Firebase Rules Or Functions Slice

Use for Firestore reads/writes, callable functions, Storage behavior, email orchestration, PDF generation, or CSV generation.

Required:

- `npm --prefix functions run build`
- `npm run type-check`
- relevant e2e workflow
- relevant smoke test
- manual preview for exact-print/email output when visual layout matters

Future required gate:

- Security Rules emulator tests after the first rules test suite exists

### Meaningful Refactor Milestone

Use after a group of related extractions.

Required:

- `npm run test:pre-refactor`

Use `npm run test:e2e:all-browsers` before merging broad layout, routing, print, or browser-sensitive changes.

## Current Coverage Matrix

### Access And Routing

Specs:

- `e2e/access-control.spec.ts`
- `e2e/public-routes.spec.ts`
- `e2e/job-dashboard.spec.ts`

Protected behavior:

- foreman/admin route restrictions
- assigned-job restrictions
- signed-out public routes
- authenticated redirect behavior
- job dashboard module launches

### Admin Users And Employees

Specs:

- `e2e/admin-management.spec.ts`
- `e2e/admin-pages.spec.ts`

Protected behavior:

- user creation and pending invite flow
- user role edits
- assigned job removal
- employee create/edit/delete
- admin directory filtering

### Jobs And Notification Recipients

Specs:

- `e2e/jobs.spec.ts`
- `e2e/daily-log-recipients.spec.ts`

Protected behavior:

- job search
- job creation
- autosave echo safety while typing
- module-specific job recipients
- global notification recipients
- archive/restore/delete
- daily log additional recipients

### Daily Logs

Specs:

- `e2e/daily-log-draft.spec.ts`
- `e2e/daily-log-typing.spec.ts`
- `e2e/daily-log-submit.spec.ts`
- `e2e/daily-log-recipients.spec.ts`

Protected behavior:

- autosave typing behavior
- validation before submit
- submit and email success reporting
- submitted email values match the submitted form values and do not fall back to `N/A` unless the user entered `N/A`
- photo upload/description/remove
- submitted read-only state
- starting another draft

### Shop Orders

Specs:

- `e2e/shop-order-workspace.spec.ts`
- `e2e/admin-pages.spec.ts` for catalog admin

Protected behavior:

- next Thursday delivery default
- catalog tree controls
- added item names
- custom items
- normal and custom items render in one continuous print/PDF table
- fixed paper-width email/PDF layout does not collapse item text into vertical columns on mobile
- quantity and notes
- autosave echo safety
- add/create interactions stay usable while saves are pending
- normal item adds do not globally disable the whole workspace
- submitted read-only state
- order number visibility in header/history
- catalog admin create/edit/archive/delete

Manual/smoke protection:

- `npm --prefix functions run preview:shop-order-email`
- `npm --prefix functions run smoke:shop-order-email`
- preview/smoke checks should cover both the email body and attached PDF
- long-order PDF smoke should prove the PDF spans multiple pages so continuation table headers are exercised
- manual print check when table headers, page breaks, paper width, or row density are changed

### Timecards

Specs:

- `e2e/timecard-workbook.spec.ts`
- `e2e/admin-pages.spec.ts` for export and print routes

Protected behavior:

- no lock controls on job timecard page
- foremen can create current-week draft timecards for assigned jobs
- job number cascade behavior
- click-to-select input replacement
- arrow key navigation
- immediate total/REG/OT updates
- multiple card pages for the same employee
- submitted read-only state
- wage formatting
- H/P/C row structure
- admin export CSV/PDF/print payload
- lock/edit toggle in export workflow

Manual/smoke protection:

- `npm --prefix functions run preview:timecard-email`
- `npm --prefix functions run smoke:timecard-email`
- verify email attaches the same PDF path used by admin export

## Future Test Additions

### Security Rules Emulator Tests

Add first tests around:

- admin-only collections and routes
- foreman assigned-job access
- submitted/read-only records
- timecard export/lock permissions
- daily log attachment Storage paths

### Component Tests

Good first component tests:

- `RecipientEditor`
- `SaveStatusIndicator`
- `AppSplitWorkspace`
- `ConfirmAction`
- extracted daily log text sections
- extracted shop order items list

### Composable Tests

Good first composable tests:

- autosave queue behavior
- dirty snapshot guard
- optimistic list behavior
- pending action state that only disables the affected control
- recipient normalization
- shop order tree construction
- timecard keyboard navigation helpers

### Responsiveness Regression Tests

Add focused tests when optimistic workflow helpers exist:

- slow save still leaves text inputs editable
- adding an item shows the item locally before remote confirmation
- a pending item/action disables only the matching button or row
- failed save keeps the user's entered data visible
- remote subscription echo does not overwrite locally dirty text
- submit/delete workflows can block final action controls without freezing unrelated browsing/history controls

## Stop Conditions

Stop and reassess if:

- a workflow refactor has no e2e coverage
- an e2e test needs a fake page to pass
- a visual output change cannot be previewed locally
- a failing test is unclear and the refactor would hide the failure
- a component extraction requires changing Firestore writes at the same time
- a workflow refactor makes normal create/add/edit actions feel slower or more blocking
