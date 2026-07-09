# Overall Refactor Plan

## Purpose

This is the living plan for the broad Phase 2 refactor.

The app is working, but it has grown through urgent workflow fixes, email/PDF fixes, permission fixes, and e2e hardening. The next phase should make the app feel like a well-structured Vue + Firebase product without losing the field workflows that users depend on.

Use this document as the high-level map. Use the other design docs for detailed rules.

## Refactor North Star

The refactor should move the app toward:

- an ideal Vue app structure
- clearer feature components
- focused shared components
- intentional reuse for similar UI and workflow patterns
- composables for repeated behavior
- services that hide Firebase implementation details
- Cloud Functions that own privileged backend work
- a cleaner, more professional, more modern GUI
- role dashboards that show the right modules for Admin, Payroll, Shop Foreman, Project Manager, and Foreman users
- shared job dashboards that expose job modules by capability
- interactions that feel immediate, even when Firebase or Functions are still working
- real-page e2e coverage that protects user workflows
- smoke/preview coverage for emails, PDFs, CSVs, and print artifacts

The refactor is not just cleanup. It is also product hardening.

## Current State

The current app has strong working behavior in these areas:

- jobs
- users
- employees
- timecards
- daily logs
- shop orders
- shop catalog
- email/PDF output
- e2e runtime testing

The current app also has predictable refactor pressure:

- large page files own too much markup, state, persistence coordination, and styling
- dense feature CSS is duplicated or one-off
- exact output rendering lives near broad email orchestration
- autosave behavior needs consistent patterns across modules
- create/add/save actions can feel clunky when the UI waits on remote writes
- permission rules need to stay centralized and testable
- current role handling must move from temporary role equivalence to explicit role capabilities
- visual design needs a stronger system instead of page-by-page patching

## Refactor Tracks

### Track 1: Safety Net

Goal:

- keep real behavior protected while code moves

Work:

- maintain real-page e2e tests
- add focused e2e before refactoring uncovered workflows
- keep function smoke tests for email/PDF/CSV output
- keep preview scripts for visually sensitive output
- preserve `data-testid` values unless intentionally changed

Primary docs:

- `testing-strategy.md`
- `refactor-playbook.md`

### Track 2: Architecture Boundaries

Goal:

- make ownership clear so code does not drift back into large smart views

Rules:

- pages orchestrate workflows
- feature components render feature sections and emit intent
- shared components stay props/events driven
- composables own reusable behavior
- frontend services own Firebase SDK and callable function calls
- Cloud Functions own privileged work, emails, PDFs, and generated artifacts

Primary docs:

- `frontend-architecture.md`
- `module-contracts.md`
- `firebase-architecture.md`

### Track 3: Shared UI System

Goal:

- stop every page from inventing its own controls, cards, badges, empty states, and pane layouts

Work:

- standardize tokens in `src/styles/main.css`
- extract shared layout primitives
- extract shared controls only where repetition already exists
- preserve dense operational workflows
- improve accessibility and focus states

Primary docs:

- `ui-modernization.md`
- `component-architecture.md`
- `css-architecture.md`

### Track 4: Feature Component Extraction

Goal:

- split oversized pages into understandable feature components without behavior changes

Initial feature targets:

- admin CRUD pages
- jobs and recipient management
- shop orders
- daily logs
- timecards
- shop catalog admin

Pattern:

- extract a composable or section component
- keep parent persistence behavior stable
- keep existing selectors
- run targeted tests

Primary docs:

- `component-architecture.md`
- `refactor-playbook.md`

### Track 5: Firebase And Permissions

Goal:

- make data access, role handling, and backend side effects predictable

Work:

- keep Firebase SDK usage inside services
- keep privileged writes and email/PDF generation in Functions
- keep security rules aligned with app roles
- implement role capabilities for Admin, Payroll, Shop Foreman, Project Manager, and Foreman
- enforce assigned-job access for Project Manager and Foreman workflow dashboards
- enforce `Shop` job workflow access for Shop Foreman unless additional workflow jobs are explicitly confirmed later
- support read-only all-job lookup for Payroll, Shop Foreman, and Project Manager
- support job creation for Payroll with no delete/archive access
- support assigned-job editing for Project Manager without delete/archive access
- support full timecard export for Admin and Payroll
- support assigned-job submitted timecard reporting for Project Manager
- include assigned Foremen, Shop Foremen, and Project Managers in Daily Log and Shop Order email recipient resolution
- centralize callable function wrappers
- make retry-sensitive functions idempotent where possible
- add runtime validation at service and function boundaries
- record support-friendly status for submit/email/export workflows
- keep Firestore queries scoped, indexed, and paginated instead of broad client-filtered reads
- document release/rollback order when rules, indexes, functions, and frontend code change together
- avoid stale migration paths

Primary docs:

- `firebase-architecture.md`
- `cleanup-and-deprecation.md`
- `auth-and-user-flow.md`

### Track 6: Output Rendering

Goal:

- keep exact documents reliable and separate from normal app UI

Rules:

- timecard email uses the real generated PDF, not an HTML clone
- shop order email body is useful for quick viewing
- shop order attached PDF is the reliable print artifact
- PDF pagination belongs in Functions/export code
- output rendering changes require preview/smoke checks

Primary docs:

- `frontend-architecture.md`
- `module-contracts.md`
- `testing-strategy.md`
- `decision-log.md`

### Track 7: Visual Modernization

Goal:

- make the app look more professional and intentional without slowing down field workflows

Current direction:

- keep the operational feel
- reduce heavy dark-on-dark sameness
- make hierarchy clearer
- use blue/cyan as an accent instead of the whole visual identity
- introduce warmer industrial neutrals and clearer status colors
- standardize panels, controls, badges, history rows, and action bars
- keep paper/PDF/email output visually separate from app styling

Primary docs:

- `ui-modernization.md`
- `component-architecture.md`

### Track 8: Responsiveness And Optimistic Workflows

Goal:

- make common actions feel instant and real-time instead of paused or blocked

Work:

- update local UI state immediately for safe create/add/edit actions
- save to Firebase in the background with visible but lightweight pending state
- disable only the specific action that could duplicate work, not the whole page
- avoid full-panel grey-outs during normal item adds or autosaves
- keep local dirty input from being overwritten by remote subscription echoes
- reconcile optimistic local records with the confirmed server record
- show retry/error state close to the affected item instead of resetting the workflow

Examples:

- creating a new shop order should show the new draft immediately
- adding a shop order item should place it in the list immediately
- typing comments or notes should never pause, drop characters, or revert
- submitting can show a stronger pending state because it is a final workflow action

Primary docs:

- `frontend-architecture.md`
- `testing-strategy.md`
- `component-architecture.md`

## Recommended Refactor Sequence

### Stage 0: Stabilize Bugs And Tests

Status:

- currently in progress

Purpose:

- fix known workflow bugs before moving code around
- add e2e/smoke coverage around every painful bug

Recent lessons to preserve:

- autosave must never fight user typing
- normal create/add/edit actions should not make the app feel frozen while a write is pending
- foremen must be able to create allowed timecards
- opening a daily-log date or timecard week must not create drafts by itself
- opening a shop order workspace or history must not create draft orders by itself
- submitted daily logs and submitted/card-containing timecard weeks should be shown by default before any accidental blank draft
- timecard rollover must copy from a meaningful prior week, not from an accidental blank draft
- timecard `Job #` cascade behavior must continue across blank rows
- shop order item tables need one normal/custom item table
- shop order PDF must repeat table headers at the top of continuation pages
- daily log emails must normalize current payload shape before rendering
- output emails/PDFs need preview/smoke tests before real-world email testing

### Stage 1: Shared Foundations

Purpose:

- create the pieces that make later refactors smaller

Targets:

- `AppPane`
- `AppSection`
- `AppToolbar`
- `AppBadge`
- `AppField`
- `AppInput`
- `AppSearchInput`
- `HistoryList`
- `SaveStatusIndicator`
- `ConfirmAction`

Avoid:

- timecard workbook internals
- exact PDF/email layouts

### Stage 2: Low-Risk Admin Pages

Purpose:

- prove the shared component approach on pages with lower workflow risk

Targets:

- users
- employees
- jobs
- recipient sections

Expected benefit:

- shared directory/detail patterns
- shared status/action patterns
- safer destructive-action handling

### Stage 2.5: Role Dashboards And Permission Shell

Purpose:

- introduce the target navigation model before deeper workflow extraction
- make role access visible through capability checks instead of scattered role-name checks

Targets:

- role dashboard landing page
- shared dashboard card/module primitives
- Admin dashboard modules
- Payroll dashboard modules
- Shop Foreman dashboard modules
- Project Manager dashboard modules
- Foreman dashboard modules
- permission/capability helper layer

Guardrails:

- keep job dashboard routes as the shared job workspace
- role dashboards should link users into the shared job dashboard instead of duplicating job modules per role
- Payroll job creation is part of the latest target role model, but exact post-create edit rights still need company confirmation
- Shop Foreman should have read-only all-job lookup plus editable workflow access for the `Shop` job unless the company assigns more workflow access later
- do not grant UI access without matching Firestore Rules and Cloud Function enforcement
- preserve existing `/jobs/:jobId/...` workflow routes during transition
- add e2e coverage for each role before replacing the old landing flow

### Stage 3: Shop Orders

Purpose:

- split the large shop order workspace while preserving the fast order-entry workflow

Targets:

- catalog pane
- catalog tree
- custom item form
- selected order header
- metadata controls
- added item list
- order history
- workflow composables

Guardrails:

- do not mix GUI extraction with email/PDF output changes
- preserve order number visibility
- preserve next Thursday defaults
- preserve view-first behavior: workspace/history/catalog browsing should read existing data without creating orders or items
- keep `New Order`, catalog item add, and custom item add as explicit write actions
- preserve one-table order output
- preserve compact no-horizontal-scroll workspace behavior
- preserve instant-feeling add/create behavior with localized pending states

### Stage 4: Daily Logs

Purpose:

- split the long daily log form into field-report sections

Targets:

- site conditions
- work performed
- manpower
- climate
- attachments
- recipients
- history
- validation

Guardrails:

- preserve required field behavior
- preserve attachment upload/remove behavior
- preserve submitted read-only behavior
- opening a date is read-only and must not create a draft
- submitted logs for the selected date should be visible by default with a clear action to create another log
- submitted history counts should stay easy for foremen and project managers to browse

### Stage 5: Timecards

Purpose:

- isolate timecard behavior without risking the approved card output

Targets:

- save queue
- keyboard navigation
- create card tray
- week toolbar
- scaling wrapper
- export filters

Guardrails:

- do not casually touch `TimecardWorkbookCard`
- do not casually touch `TimecardPrintCard`
- do not mix UI refactor with PDF/email output changes
- opening a week is read-only and must not create draft cards
- submitted/card-containing weeks should display before accidental blank drafts
- rollover should copy from the most recent meaningful prior week
- rollover should clear hour, production, and `ACCT` entry fields
- `Job #` cascade across blank rows must keep working

### Stage 6: Shop Catalog Admin

Purpose:

- clean up catalog management after the shop order tree behavior is stable

Targets:

- admin tree
- inspector
- folder form
- item form
- move/archive controls

Guardrails:

- do not assume shop order tree component can be reused blindly
- catalog admin permissions/actions are different from ordering behavior

### Stage 7: Functions And Cleanup

Purpose:

- split backend output/orchestration code after frontend workflows are stable

Targets:

- email orchestration
- PDF rendering modules
- CSV rendering modules
- callable function handlers
- permission helpers
- old migrations and unused compatibility paths

Guardrails:

- deploy deleted functions intentionally
- use smoke tests before and after function cleanup
- avoid mixing cleanup with output redesign

### Stage 8: GUI Polish

Purpose:

- make the app visually cohesive after the component seams exist

Targets:

- color palette
- typography tokens
- spacing/radius/depth tokens
- row/card/pane variants
- button hierarchy
- CSS ownership split between global tokens/base, shared component styles, and feature scoped styles
- mobile/tablet behavior
- accessibility pass

Guardrails:

- do not make dense workflows slower
- do not let visual cleanup alter email/PDF/print output
- do not overfit one module at the expense of shared consistency
- do not let `main.css` keep accumulating page-specific selectors as components are extracted

## Things Not To Mix

Avoid combining these in one refactor slice:

- visual redesign and data model changes
- component extraction and permission changes
- Firebase rules changes and page layout changes
- timecard UI changes and timecard PDF/email changes
- shop order GUI extraction and shop order PDF/email changes
- cleanup/deletion and behavior changes
- app shell responsive changes and workflow-specific changes

If a slice feels like it must mix these, pause and split it.

## Reuse Review

Before creating a new component, composable, service helper, or style pattern, check whether the app already has something similar.

Reuse options:

- use the existing piece as-is
- extend the existing piece with a small, clear prop/event
- extract the shared behavior into a composable
- extract shared visual structure into a shared component
- keep separate feature components but share a lower-level primitive
- intentionally keep them separate and document why

Good reuse candidates:

- pane/card layouts
- split workspaces
- list rows and history rows
- badges/status pills
- form fields and readonly fields
- search inputs and filters
- recipient editors
- confirmation and destructive actions
- save/pending/error indicators
- autosave queues and dirty snapshot guards
- tree node rendering where behavior truly matches

Do not force reuse when:

- the shared component needs many feature-specific props
- the workflows only look similar but have different permission rules
- reuse would hide important business behavior
- exact print/email/PDF output would become coupled to normal app UI

If two things are similar but not identical, prefer sharing the smaller stable piece first.

## Future Dashboard Backlog

These ideas are outside the current refactor scope, but the refactor should avoid architectural choices that would block them later:

- file storage for job and personal dashboards
- dashboard customization with draggable widgets
- announcements pushed to jobs or all users
- alerts, calendar, notes, todos, checklists, document tree, pinned documents, photo/PDF viewer, job map, contacts, analytics, spreadsheet integration, and optional two-factor authentication

The detailed future widget backlog lives in `future-dashboard-widgets.md`.

## Documentation Protocol

Before a refactor slice:

- update this document if the slice changes the overall plan
- check `refactor-playbook.md` for gates
- check module-specific docs for ownership rules

During a refactor slice:

- write down any new decision that future-us would otherwise rediscover painfully
- update `questions-for-company.md` if a product answer is missing
- update `testing-strategy.md` if a new behavior needs protection
- update release notes/checklists if the slice changes rules, indexes, functions, or deployed data shape

After a refactor slice:

- update `decision-log.md` for meaningful architecture/product decisions
- update `current-understanding.md` if behavior expectations changed
- update component/module docs if ownership changed
- keep docs short enough to stay useful

## Current Open Refactor Themes

- How far should the visual redesign move away from the current dark shell?
- Which shared controls are worth building first versus wrapping later?
- Should shop order email eventually become mostly a cover note plus PDF attachment?
- How much of the role/capability model should be data-driven in the first refactor pass versus hardcoded built-in role capabilities?
- What exact Timecard Export actions should Project Managers get for assigned-job billing: view only, PDF, CSV, or both exports?
- Which component tests should be introduced before larger page extractions?
- Which migration/compatibility fields are now safe to remove?
- Which workflows should be optimistic immediately, and which should wait for server confirmation?
- What responsiveness budget should we expect for create/add/edit interactions?
- Which runtime validation library/pattern should be standardized across app and functions?
- What support/status dashboard or log view is needed for failed emails, PDFs, and exports?

## Stop Conditions

Pause and reassess if:

- a refactor breaks e2e in a way that is hard to understand
- a shared component starts needing too many feature-specific props
- a component imports Firebase or Cloud Functions directly
- output rendering changes unintentionally
- a visual update makes dense workflows less usable
- global CSS changes start affecting unrelated pages
- normal workflow actions start blocking entire panels or dropping user input
- a Firebase-sensitive slice has no clear deployment order or rollback path
- a new query depends on broad reads and client-side filtering for large data
- a slice becomes larger than one clear workflow section

The goal is not speedrun demolition. The goal is steady, boringly safe improvement.
