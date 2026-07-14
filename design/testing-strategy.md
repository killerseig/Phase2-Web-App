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
- accessibility spot check for labels, focus, and keyboard behavior when the component is interactive
- CSS ownership check if styles move between global CSS, shared components, and scoped feature styles

### Workflow Slice

Use for changes to jobs, daily logs, shop orders, users, employees, or timecards.

Required:

- `npm run type-check`
- targeted e2e for the touched workflow
- related function smoke test if email/export behavior is touched
- view-first regression coverage if the workflow opens dates, weeks, history, or catalogs
- typing/focus regression coverage if the workflow touches form input behavior

### Firebase Rules Or Functions Slice

Use for Firestore reads/writes, callable functions, Storage behavior, email orchestration, PDF generation, or CSV generation.

Required:

- `npm --prefix functions run build`
- `npm run type-check`
- relevant e2e workflow
- relevant smoke test
- manual preview for exact-print/email output when visual layout matters
- runtime validation coverage for changed callable/function payloads
- release-order note when rules, indexes, functions, and frontend behavior must deploy together
- support/status verification when the slice touches submit/email/export workflows

Future required gate:

- Security Rules emulator tests after the first rules test suite exists

### Meaningful Refactor Milestone

Use after a group of related extractions.

Required:

- `npm run test:pre-refactor`

Use `npm run test:e2e:all-browsers` before merging broad layout, routing, print, or browser-sensitive changes.

Before merging a meaningful milestone, also verify:

- no new broad collection reads or client-only filtering for large lists
- no new component imports Firebase/services directly
- shared components have documented props/events where practical
- user-facing workflows still have accessible labels and keyboard/focus behavior
- `src/styles/main.css` is moving toward tokens/base/utilities/vendor overrides, not accumulating more page-specific CSS

## Current Coverage Matrix

### Access And Routing

Specs:

- `e2e/access-control.spec.ts`
- `e2e/public-routes.spec.ts`
- `e2e/job-dashboard.spec.ts`

Protected behavior:

- foreman/admin route restrictions
- payroll route restrictions, job creation access, and read-only job lookup after creation
- shop foreman catalog access, read-only all-job lookup, and `Shop` job workflow access
- project manager assigned-job edit/reporting access
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
- opening a date with submitted logs shows submitted logs by default
- opening a date does not create a draft by itself
- creating another daily log requires an explicit user action
- starting another draft

### Shop Orders

Specs:

- `e2e/shop-order-workspace.spec.ts`
- `e2e/admin-pages.spec.ts` for catalog admin

Protected behavior:

- next Thursday delivery default
- opening the shop order workspace/history does not create a draft order by itself
- `New Order` is the explicit draft creation action
- catalog tree controls
- catalog browsing/searching does not write order items by itself
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
- opening a week does not create draft cards by itself
- submitted/card-containing weeks display before accidental blank drafts
- rollover copies from the most recent meaningful prior week, prioritizing submitted/card-containing weeks
- rollover clears hour, production, and `ACCT` entry fields
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
- payroll employee/timecard export access, job creation access, and job delete/archive denial
- shop foreman shop catalog management access, `Shop` job workflow access, read-only all-job lookup, and job delete/archive denial
- project manager assigned-job edit access and unassigned-job denial
- project manager submitted-timecard reporting for assigned jobs only
- assigned Foremen, Shop Foremen, and Project Managers included in Daily Log and Shop Order email recipient resolution
- submitted/read-only records
- timecard export/lock permissions
- daily log attachment Storage paths

### Component Tests

Current coverage:

- `src/__tests__/RecipientEditor.spec.ts` covers the shared recipient editor public contract: editable input updates, add/remove events, disabled behavior, read-only/default recipient rendering, empty labels, hints, counts, and placeholders.
- `src/__tests__/JobDashboardComponents.spec.ts` covers the extracted Job Dashboard presentation contract: module card links/test ids, module grid route construction, selected-job metadata, and missing-job empty state.
- `src/__tests__/AppMobilePanelTabs.spec.ts` covers the shared responsive panel-tab primitive contract: tablist labeling, active tab state, and emitted panel keys.
- `src/__tests__/AppStatusMessage.spec.ts` covers the shared status-message primitive contract: default status rendering, error alert rendering, and empty-state non-rendering.

Good next component tests:

- `SaveStatusIndicator`
- `AppSplitWorkspace`
- `ConfirmAction`
- extracted daily log text sections
- extracted shop order items list

Coverage expectations:

- assert public props/events/slots instead of private implementation details
- cover disabled/loading/error states for shared controls
- cover keyboard/focus behavior for interactive shared controls where practical

### Unit Tests

Current coverage:

- `src/__tests__/capabilities.spec.ts` locks in the current frontend capability behavior, including `project-manager` mapping to field-workflow access for now, admin-only area access, assigned-job route access, visible-job fallback access, and the temporary unassigned-timecard route exception.
- `src/__tests__/authService.spec.ts` covers auth profile normalization for complete records, missing/unknown fields, invalid assigned-job IDs, unknown roles, and inactive users.
- `src/__tests__/recipientEmails.spec.ts` covers shared recipient email normalization, validation, filtering, and duplicate removal used by Jobs and Daily Logs.
- `src/__tests__/routerQuery.spec.ts` covers shared route query-string normalization used by public auth routes.
- `src/__tests__/directoryFilters.spec.ts` covers shared directory active/inactive/both filtering.
- `src/__tests__/timecardCardSelection.spec.ts` and `src/__tests__/timecardSaveQueue.spec.ts` cover timecard UI state and save queue behavior.

Near-term additions:

- role/capability matrix cases when Payroll and Shop Foreman are added
- shared component event contracts as `RecipientEditor`, confirmation, and split workspace primitives stabilize

### Composable Tests

Good first composable tests:

- autosave queue behavior
- dirty snapshot guard
- optimistic list behavior
- pending action state that only disables the affected control
- recipient normalization
- shop order tree construction
- timecard keyboard navigation helpers
- runtime schema/normalization helpers
- pagination/query helper behavior where added

### Responsiveness Regression Tests

Add focused tests when optimistic workflow helpers exist:

- slow save still leaves text inputs editable
- adding an item shows the item locally before remote confirmation
- a pending item/action disables only the matching button or row
- failed save keeps the user's entered data visible
- remote subscription echo does not overwrite locally dirty text
- submit/delete workflows can block final action controls without freezing unrelated browsing/history controls

### Release And Observability Tests

Add focused tests/checks when the supporting infrastructure exists:

- submit/email/export functions write status metadata with operation IDs
- duplicate submit retries do not duplicate emails or artifacts
- function failures return useful user-safe errors
- generated artifact functions clean up temporary files
- deployment notes identify rules/index/function/frontend order for Firebase-sensitive slices

## Stop Conditions

Stop and reassess if:

- a workflow refactor has no e2e coverage
- an e2e test needs a fake page to pass
- a visual output change cannot be previewed locally
- a failing test is unclear and the refactor would hide the failure
- a component extraction requires changing Firestore writes at the same time
- a workflow refactor makes normal create/add/edit actions feel slower or more blocking
- a Firebase-sensitive slice cannot be rolled back safely
- a new query requires broad reads plus client-side filtering on expected large data
- a visual/CSS refactor changes unrelated pages through global selectors
