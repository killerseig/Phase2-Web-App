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

This makes components easier to stub and test.

### 3. Composables Own Reusable Behavior

Composables should hold behavior that is not naturally visual.

Good composable candidates:

- autosave queues
- confirmation workflows
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
- hide Firebase implementation details from views/components
- branch to the e2e runtime when `isE2EActive()`

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
  -> Store or Service
  -> Local page state/composable state
  -> Feature components
  -> Shared components
  -> User event
  -> Emit event upward
  -> Page/composable calls service
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

Direct `window.confirm` calls are easy, but they are not ideal long-term.

Target:

- one `useConfirmAction` composable
- one optional `ConfirmDialog` component later
- current implementation may still delegate to `window.confirm`
- tests can stub the confirmation function

This lets us migrate safely without changing every destructive flow at once.

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

- keep global theme variables in `src/styles/main.css`
- move reusable component styles with shared components when practical
- keep feature-specific dense layout styles near feature components
- avoid copy-pasted empty/message/list/pane classes
- use CSS variables for shared density, colors, radius, and borders

PrimeVue is configured as unstyled, which is good for this app because we want Phase 2's own app visual language.

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
- Preserve `data-testid` values during extraction.
- Run targeted tests after each slice.
- Run `npm run test:pre-refactor` after meaningful workflow refactors.
- Do not refactor timecard PDF/email output while also refactoring frontend timecard UI.
