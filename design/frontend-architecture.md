# Frontend Architecture

## Purpose

This document defines the target frontend architecture for the Phase 2 Vue application.

The goal is not to chase every fashionable Vue pattern. The goal is an app that is:

- easy to understand
- easy to test
- easy to refactor safely
- resilient for field users on imperfect networks
- structured around the actual Phase 2 workflows

The current stack is appropriate:

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia
- Firebase services
- Playwright e2e
- Vitest for focused unit/component tests

Firebase implementation details should follow `firebase-architecture.md`.

## Architecture Principles

### 1. Pages Orchestrate

Route views should be workflow containers.

They may:

- read route params
- call stores
- subscribe to services
- own page-level loading/error state
- decide whether the current user can edit
- compose feature components

They should avoid:

- large repeated markup
- reusable UI behavior
- low-level input parsing
- large autosave implementations
- complex tree building
- feature-specific sub-workflows that can live in child components

### 2. Components Render and Emit

Most components should be props/events driven.

They should:

- receive data through props
- emit user intent through events
- expose slots for flexible layout
- avoid importing services directly
- avoid knowing route names unless they are navigation components
- document their public props/events when they become shared components
- keep emitted events domain-readable instead of leaking implementation details

This makes components easier to stub and test.

### 3. Composables Own Reusable Behavior

Composables should hold behavior that is not naturally visual.

Good composable candidates:

- autosave queues
- confirmation workflows
- permission/capability checks
- tree construction
- search/filter helpers
- selected item state
- subscription lifecycle
- input parsing
- date logic
- print/export payload preparation

### 4. Services Own Persistence

Services should be the boundary between the app and Firebase/cloud functions.

Services should:

- normalize Firestore documents into domain types
- sanitize payloads before writes
- validate command payloads before remote writes or callable function calls
- hide Firebase implementation details from views/components
- branch to the e2e runtime when `isE2EActive()`
- keep read/subscription APIs side-effect free
- expose explicit command APIs for record creation instead of creating records during reads

Services should not:

- render UI
- show toast messages
- own page state
- know about component internals

### 5. Stores Own Cross-Page State

Pinia stores should be used for state that genuinely spans pages.

Current good examples:

- auth/session/profile state
- visible jobs/current job state

Avoid putting every form or local workflow into Pinia. Most draft forms should stay local to the page or feature container.

### 6. Types Are a Contract

`src/types/domain.ts` should stay as the shared app contract for core records.

Domain types should be:

- stable
- explicit
- independent of Firestore internals where possible

If a workflow needs a view-specific type, define it near that feature rather than bloating the global domain file.

Runtime contracts:

- TypeScript types describe expected app shapes, but runtime schemas should protect service/function boundaries.
- Domain services should convert unknown Firestore/function data into explicit domain types before views consume it.
- View-specific form state can stay local, but remote command payloads should be validated before sending.

## Target Folder Structure

The current folder structure is close, but the feature layer should become more consistent.

Recommended target:

```text
src/
  app/
    router/
    providers/
  assets/
  components/
    common/
    layout/
    feedback/
    forms/
    navigation/
  composables/
    app/
    autosave/
    confirmation/
    subscriptions/
  features/
    jobs/
      components/
      composables/
      types.ts
      utils.ts
    users/
      components/
      composables/
    employees/
      components/
      composables/
    timecards/
      components/
      composables/
      workbook.ts
      csv-export.ts
      pdf-export.ts
    dailyLogs/
      components/
      composables/
      schema.ts
    shopOrders/
      components/
      composables/
      utils.ts
    shopCatalog/
      components/
      composables/
  layouts/
  services/
  stores/
  styles/
    main.css
    tokens.css
    reset.css
    base.css
    utilities.css
    primevue.css
  testing/
  types/
  utils/
  views/
```

This does not need to happen in one move. Existing imports can be migrated gradually.

## Naming Rules

### Components

- Shared app components use `App*`.
  - `AppEmptyState`
  - `AppSplitWorkspace`
  - `AppPane`
- Feature components use the feature prefix.
  - `TimecardWeekToolbar`
  - `ShopOrderItemsList`
  - `DailyLogAttachmentSection`
- Avoid generic names like `Manager`, `Helper`, or `Thing`.

### Composables

- Use `use*`.
  - `useAutosaveQueue`
  - `useRecipientEditor`
  - `useShopOrderTree`
- A composable should have one clear job.

### Services

- Services are nouns by domain.
  - `jobs`
  - `users`
  - `timecards`
  - `shopOrders`
- Export function names should describe the operation.
  - `subscribeVisibleJobs`
  - `createShopOrderRecord`
  - `updateTimecardCard`
- Services should be the only normal frontend layer that knows Firebase collection names, callable function names, Storage paths, and e2e runtime branching.

## Data Flow

Preferred flow:

```text
Page
  -> Store or read-only Service subscription
  -> Local page state/composable state
  -> Feature components
  -> Shared components
  -> User event
  -> Emit event upward
  -> Page/composable calls explicit command service for writes
```

Avoid:

```text
Deep child component
  -> directly imports service
  -> writes remote data
  -> shows toast
  -> mutates global state
```

Some intentionally stateful feature containers may call services, but that should be explicit and uncommon.

Important workflow rule:

- Navigating, selecting a date/week, opening history, filtering, or subscribing must never create a Firestore record.
- Draft creation must come from explicit user intent such as `New Daily Log`, `Create Week`, `Create Card`, `New Order`, or `Add Item`.
- This keeps timecard, daily-log, and shop-order history from filling with accidental blank drafts.

## Navigation And Dashboard Architecture

The target navigation model is role-dashboard first, job-dashboard second.

Role dashboards are task-oriented:

- Admin dashboard shows admin-wide modules such as users, employees, jobs needing setup, submitted records, and system shortcuts.
- Payroll dashboard shows Employees, Timecard Export, job creation, and read-only job lookup after creation.
- Shop Foreman dashboard shows Shop Catalog management, `Shop` job workflow modules, and read-only all-job lookup.
- Project Manager dashboard shows assigned-job billing/reporting modules, assigned job edit entry points, submitted timecards, daily log activity, shop orders, and read-only job lookup.
- Foreman dashboard shows assigned jobs, current timecards, daily logs, shop orders, and field workflow shortcuts.

Job dashboards are context-oriented:

- one shared job home base per job
- visible modules are capability-driven
- timecards, daily logs, shop orders, job details, history, and reports should be entered from the same job context

Implementation direction:

- avoid creating three or five unrelated dashboard apps
- build reusable dashboard card/module primitives
- route guards should use capability helpers, not scattered role-name checks
- pages should still enforce the final permission through services/rules/functions
- job module routes should remain stable during the transition

Target capability examples:

- `canManageUsers`
- `canManageEmployees`
- `canUseTimecardExport`
- `canUseShopCatalog`
- `canViewAllJobs`
- `canCreateJobs`
- `canEditAssignedJobs`
- `canDeleteJobs`
- `canArchiveJobs`
- `canUseAssignedJobDashboard`
- `canUseShopJobDashboard`
- `canViewAssignedJobSubmittedTimecards`
- `canViewAssignedJobDailyLogHistory`

## Autosave Architecture

Autosave is one of the most important areas to standardize.

Target autosave rules:

- Users must be able to type normally without remote echo overwriting input.
- Text inputs should generally update local state immediately.
- Saves should happen on blur, debounce, or explicit workflow action depending on the field.
- In-flight saves should not block continued typing.
- If a save is in flight and the user changes the same record again, queue another save.
- Remote snapshots should not overwrite locally dirty fields.
- Save state should be visible but lightweight.

Needed composables:

- `useAutosaveQueue`
  - for record/card level queued saves
- `useCommitAutosave`
  - for simpler blur/change saves
- `useDirtySnapshotGuard`
  - for preventing stale subscription snapshots from replacing newer local input

## Responsiveness And Optimistic UI

The app should feel like it is running in real time, even when Firebase writes or callable functions take a moment.

Target interaction rules:

- Safe local edits should update the UI immediately.
- Remote writes should usually happen in the background.
- Normal create/add/edit actions should not gray out an entire page or pane.
- Disable only the specific control that could duplicate the same action.
- Use per-row, per-field, or per-record pending indicators instead of global blocking states.
- Subscription snapshots should reconcile with local optimistic state instead of replacing it abruptly.
- If a write fails, keep the user's local data visible and show a retry/error state near the affected control.
- Final workflow actions such as submit/delete can use stronger pending states because they intentionally lock or remove records.

Shop order examples:

- Opening a job's shop order workspace or history should only read existing orders.
- `New Order` can create a local pending draft immediately, then reconcile when Firestore returns the real id/order number.
- `Add item` can add a local pending item row immediately, then clear the pending state when the draft save succeeds.
- Item note/comment typing should remain local-first and never wait on a save.
- Submitting an order can block submit/delete controls, but should not make the rest of the page feel broken.

Needed composables:

- `usePendingAction`
  - for button-level or row-level pending state
- `useOptimisticList`
  - for local add/remove/update behavior before a remote confirmation
- `useDirtySnapshotGuard`
  - shared with autosave to prevent remote echo from clobbering local edits

## Confirmation Architecture

Direct `window.confirm` calls are easy, but they are not ideal long-term. App views now use the shared `ConfirmDialog` instead.

Target:

- `ConfirmDialog` for destructive and final workflow confirmations
- page-owned pending action state when the action is page-specific
- optional `useConfirmAction` composable later if repeated pending-action state becomes noisy
- tests click the real confirmation dialog instead of stubbing browser confirms

This keeps destructive flows accessible, visible, and testable without relying on browser-native prompts.

## Recipient Architecture

Recipient management appears in multiple modules.

Target:

- `RecipientEditor`
  - handles input, display, remove affordance
  - no persistence
- `useRecipientEditor`
  - normalization and duplicate checks
- feature/page owns the actual save call

Used by:

- job notification settings
- all-jobs notification defaults
- daily log additional recipients
- future shop order recipient settings

## Timecard Architecture

Timecards deserve special treatment.

Do not make the workbook generic just because it is large. The timecard card is a specialized business artifact that must match Excel/PDF expectations.

Target split:

- `TimecardWorkbookCard`
  - exact interactive workbook grid
- `TimecardPrintCard`
  - exact print/PDF card
- `TimecardCardCanvas`
  - scaling, selection, card wrapper layout
- `TimecardCreateCardTray`
  - employee/custom card creation
- `TimecardWeekToolbar`
  - week selection and submit actions
- `useTimecardSaveQueue`
  - shared job/export save behavior
- `useTimecardCardScaling`
  - shared measurement/scale behavior

The workbook and print card should remain highly protected by e2e and visual/manual checks.

## Email and PDF Boundary

Email/PDF rendering should be treated as output rendering, not normal UI.

Rules:

- PDF rendering belongs in functions/export logic.
- Timecard email should attach the real generated PDF rather than reimplement a fragile HTML clone.
- Shop order email HTML can remain useful for quick viewing, but the attached PDF is the reliable print surface.
- Shop order PDF pagination should be owned by the PDF renderer, including repeated table headers on continuation pages.
- Email templates should have smoke tests and preview scripts.
- Avoid duplicating timecard layout logic in multiple places.

## Styling Direction

Current styling is mostly global CSS with scoped component styles.

Target:

- keep `src/styles/main.css` as the CSS entry point imported by `src/main.ts`
- split global CSS into token/base/reset/utility/vendor files over time
- move reusable component styles with shared components when practical
- keep feature-specific dense layout styles near feature components
- avoid copy-pasted empty/message/list/pane classes
- use CSS variables for shared density, colors, radius, and borders
- avoid page-specific selectors in global CSS once the owning view/component has been extracted
- follow `css-architecture.md` for token naming, scoped style ownership, PrimeVue overrides, and CSS migration order

PrimeVue is configured as unstyled, which is good for this app because we want Phase 2's own app visual language.

## Accessibility Direction

Accessibility should be part of the refactor, not a later cleanup pass.

Shared components should provide:

- visible focus states
- keyboard access for buttons, menus, tabs, tree controls, dialogs, and table-like workflows
- real labels or accessible names for inputs and action buttons
- clear error text connected to the relevant field or section
- semantic button/link behavior instead of clickable divs
- predictable focus movement for modal/confirm flows

Workflow pages should preserve:

- keyboard navigation in timecards
- readable form labels in dense daily log and shop order screens
- print/email/PDF output readability separately from interactive accessibility

## Testing Architecture

### E2E

Use e2e for user workflows:

- real routes
- real components
- seeded e2e runtime data
- no fake e2e-only pages

### Component tests

Use component tests for reusable components:

- recipient editor
- split workspace
- confirm action
- empty/status/loading components
- feature subcomponents after extraction
- accessibility-facing behavior such as labels, focusable actions, and keyboard events where practical

### Unit tests

Use unit tests for pure logic:

- date logic
- workbook calculations
- recipient normalization
- shop order tree building
- autosave queue behavior

## Migration Rules

- One refactor slice at a time.
- Keep behavior changes separate from structural moves whenever possible.
- Keep Firebase access behind services and follow `firebase-architecture.md` when touching data, rules, functions, indexes, or storage paths.
- Keep public APIs for components small.
- Document props/events for shared components as they are extracted.
- Preserve labels, keyboard behavior, and focus states during visual polish.
- Keep CSS ownership aligned with `css-architecture.md`.
- Preserve `data-testid` values during extraction.
- Run targeted tests after each slice.
- Run `npm run test:pre-refactor` after meaningful workflow refactors.
- Do not refactor timecard PDF/email output while also refactoring frontend timecard UI.
