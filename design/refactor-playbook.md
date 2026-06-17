# Refactor Playbook

## Purpose

This playbook defines how to refactor the app without breaking the working workflows.

The app now has enough e2e coverage to protect major behavior. The next risk is moving too much code too quickly. This document keeps the refactor incremental.

Use alongside:

- `overall-refactor-plan.md` for the broad refactor map and documentation protocol
- `testing-strategy.md` for test gates and workflow coverage
- `module-contracts.md` for ownership boundaries
- `cleanup-and-deprecation.md` for removing old code, fields, and functions
- `ui-modernization.md` for visual direction and UI consistency
- `firebase-architecture.md` when touching Firebase data, rules, functions, indexes, or storage

## North Star

Make the app feel like an ideal Vue application:

- pages are small workflow containers
- components are focused and reusable
- composables own repeated behavior
- services isolate Firebase and cloud functions
- the visual system becomes cleaner, more professional, and more consistent
- tests cover real user behavior and focused logic
- exact print/email/PDF outputs stay protected
- Firebase data, rules, functions, indexes, and storage paths follow `firebase-architecture.md`

## Refactor Rules

### Rule 1: No Big Bang Rewrite

Do not rewrite a full page at once.

A safe slice usually touches:

- one shared component
- one composable
- one feature subcomponent
- one section of one page

### Rule 2: Separate Structure From Behavior

If a change moves code, avoid changing behavior at the same time.

If behavior must change, document it and add or update tests first.

### Rule 3: Preserve Test Selectors

Keep existing `data-testid` values unless there is a clear reason to change them.

E2E tests are our refactor seatbelt. Don't casually cut the seatbelt.

### Rule 4: Keep Services Stable First

The current frontend services are already useful boundaries.

Do not begin by redesigning Firestore access. Start with views/components/composables.

If a slice must touch Firebase data access, check `firebase-architecture.md` first and keep SDK details inside services or functions.

### Rule 5: Treat Timecard Output As Sacred

Timecard print/PDF/email behavior has been painful and important.

Do not refactor:

- timecard PDF rendering
- timecard email attachment behavior
- `TimecardPrintCard`
- `TimecardWorkbookCard`

at the same time as broad frontend structure.

### Rule 6: Use Stubbable Boundaries

Prefer props/events and composables over service imports inside deeply nested components.

A component should usually be testable with plain fixture data and emitted events.

## Standard Refactor Loop

For every slice:

1. Identify the repeated pattern or oversized section.
2. Confirm existing e2e coverage or add coverage if missing.
3. Extract a component or composable without changing behavior.
4. Run type-check.
5. Run targeted e2e for the touched workflow.
6. Run wider e2e/pre-refactor tests after meaningful workflow moves.
7. Only then continue to the next slice.

## Test Gates

### Tiny component-only slice

Run:

```sh
npm run type-check
```

If the component is used on a real route, also run the route-specific e2e.

### Workflow slice

Run:

```sh
npm run type-check
npx playwright test <related-spec> --project=chromium
```

### Meaningful refactor milestone

Run:

```sh
npm run test:pre-refactor
```

### Firebase rules or functions slice

Run the relevant emulator-backed tests once they exist, plus:

```sh
npm run type-check
```

If the change affects a user workflow, also run the matching Playwright spec.

### Browser-sensitive layout or interaction

Run:

```sh
npm run test:e2e:all-browsers
```

Use this for:

- timecard workbook layout/input
- shop order print/email/PDF table behavior
- responsive shell/layout changes
- anything involving drag, resize, print, or browser-specific form behavior

## Recommended Refactor Phases

## Phase 1: Shared Primitives

Goal: create the base pieces we keep reusing.

Components:

- `AppLoadingButton`
- `AppEmptyState`
- `AppStatusMessage`
- `AppBadge`
- `AppField`
- `AppSearchInput`
- `AppPane`
- `AppListRow`

Good target pages:

- login
- forgot password
- set password
- job dashboard
- not found
- reference list scaffold

Avoid:

- timecard workbook internals
- shop order workspace internals

## Phase 2: Workflow Components

Goal: extract repeated workflow tasks.

Components/composables:

- `RecipientEditor`
- `SaveStatusIndicator`
- `ConfirmAction` or `useConfirmAction`
- `AppSplitWorkspace`
- `HistoryList`
- `ReadonlyField`

Good target pages:

- jobs
- daily logs recipients
- users/employees split views

## Phase 3: Admin CRUD Pages

Goal: reduce users, employees, and jobs pages.

Targets:

- `UsersView`
- `EmployeesView`
- `JobsView`

Extraction direction:

- browser/list component
- detail/editor panel
- danger zone/actions
- assignment picker
- recipient settings

Why these first:

- high value
- lower layout risk than timecards
- repeated split-pane patterns

## Phase 4: Shop Orders

Goal: split the large shop order workspace.

Targets:

- catalog tree
- custom item form
- order metadata form
- order item list
- history list
- order workflow composables
- shop order email/PDF output boundary

Important tests:

- next Thursday default
- autosave typing
- item notes
- order number display
- submitted read-only behavior
- catalog and custom items stay in one submitted order
- long shop order PDF spans pages with a table header at the top of continuation pages
- email body keeps the forced paper width and single item table
- print/email smoke where relevant

Refactor notes:

- Keep `ShopOrdersView.vue` workflow extraction separate from shop order email/PDF renderer changes.
- Extract the GUI into components before changing shop order persistence or Cloud Function behavior.
- Do not move PDF table pagination into a frontend component; PDF rendering belongs in functions/export code.
- Preserve the item-list density and no-horizontal-scroll behavior from the pre-refactor GUI cleanup.

## Phase 5: Daily Logs

Goal: split the daily log form into meaningful sections.

Targets:

- text sections
- manpower table
- climate table
- attachment sections
- recipient panel
- history list
- validation composable

Important tests:

- typing/autosave
- submit validation
- attachment upload/delete
- submitted read-only
- another draft after submit

## Phase 6: Timecard Views

Goal: reduce duplication between job timecards and admin export without touching exact card internals too early.

Targets:

- save queue composable
- scaling composable
- card canvas wrapper
- create card tray
- week toolbar
- export filters

Important tests:

- typing and totals
- arrow navigation
- select-all-on-click
- duplicate employee cards
- submitted read-only
- export print route
- all-browser e2e after meaningful layout changes

## Phase 7: Shop Catalog Admin

Goal: split the admin catalog tree and inspector.

Targets:

- admin tree
- node row
- inspector
- folder form
- item form
- inline edit
- move controls

Why later:

- large and interaction-heavy
- overlaps with shop order tree but has different permissions/actions
- drag/drop or move behavior can get brittle

## Phase 8: Functions Refactor

Goal: split cloud functions once frontend behavior is stable.

Targets:

- permissions helpers
- timecard export preparation
- PDF rendering
- CSV rendering
- daily log email orchestration
- shop order email orchestration
- timecard email orchestration

Important rule:

- Do not modify timecard PDF output and email orchestration in the same slice unless the slice is specifically about that output and has smoke/manual preview coverage.

## Component Extraction Checklist

Before extracting:

- Is the current behavior covered by e2e?
- Is there an existing component with the same visual pattern?
- Is there an existing composable/service helper with the same behavior?
- Does the new component need to call services?
- Can it be props/events only?
- Are there existing `data-testid` values to preserve?
- Is this component shared app-level or feature-specific?
- Are we sharing the smallest stable piece instead of building a too-flexible component?
- Does it need a component test?

After extracting:

- Did imports stay clean?
- Did the parent page get smaller?
- Did the extracted component avoid route/service coupling?
- Did type-check pass?
- Did targeted e2e pass?

## Composable Extraction Checklist

Before extracting:

- Is the behavior repeated?
- Does an existing composable already solve part of this?
- Is it independent of DOM markup?
- Does it have clear inputs/outputs?
- Can it be tested without rendering a full page?

Good candidates:

- autosave queue
- recipient normalization
- search filtering
- tree building
- date range handling
- selected item sync
- dirty snapshot guard

## Suggested First Real Refactor Slice

Build and migrate `RecipientEditor`.

Why:

- repeated in jobs and daily logs
- easy to test
- low visual risk
- gives us a real reusable workflow component
- helps future shop order recipient work

Initial scope:

- component accepts:
  - `recipients`
  - `inputValue`
  - `disabled`
  - `readOnly`
  - `emptyMessage`
  - `addLabel`
- component emits:
  - `update:inputValue`
  - `add`
  - `remove`
- parent owns persistence.

Good first migration:

1. Use it in `JobsView` create/detail/global recipient sections.
2. Run `npx playwright test e2e/jobs.spec.ts --project=chromium`.
3. Use it in `DailyLogsView` additional recipients.
4. Run `npx playwright test e2e/daily-log-recipients.spec.ts --project=chromium`.

## Stop Conditions

Pause and reassess if:

- a refactor requires changing multiple workflows at once
- e2e failures are unclear
- a component starts importing services unexpectedly
- a supposedly shared component needs too many feature-specific props
- duplicated components/composables are being created without a reuse review
- timecard layout or email/PDF output changes unintentionally

That is not failure. That is the app telling us the seam is wrong.
