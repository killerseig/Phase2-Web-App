# Component Architecture

## Purpose

This document defines the component direction for the refactor.

The current application has solid domain services and e2e coverage, but many pages are still carrying too much responsibility. Large views currently mix:

- subscriptions and data loading
- local draft state
- autosave queues
- validation
- permission checks
- user feedback
- layout markup
- dense feature UI

The refactor should move the app toward a component system where pages orchestrate workflows and components handle focused, reusable UI tasks.

## Refactor Goals

- Make common tasks reusable instead of duplicated across pages.
- Make feature workflows easier to test and stub.
- Keep e2e tests pointed at real user pages.
- Preserve current behavior while moving code in small slices.
- Avoid turning the app into an abstract design-system project before the business workflows are stable.

## Component Rules

### Pages

Pages should:

- load route context
- connect stores and services
- decide whether the user can see or edit something
- compose feature components
- own top-level workflow state when it crosses multiple child components

Pages should not:

- contain large repeated UI patterns
- contain low-level reusable controls
- directly own every detail of large child workflows
- duplicate autosave, confirm, recipient, or list-management patterns

### Shared Components

Shared components should:

- accept data through props
- emit events for parent-owned actions
- avoid direct service calls
- avoid route assumptions
- be easy to stub in unit tests or story-style previews

Shared components can own small local UI state when that state is visual only, such as expanded/collapsed state, menu open state, or active tab state.

### Feature Components

Feature components should:

- live near the workflow they support
- know domain vocabulary
- still avoid direct Firebase/service calls unless they are intentionally container components
- expose clear events such as `save`, `submit`, `delete`, `select`, `change`, and `add`

### Composables

Composables should hold reusable behavior that is not naturally visual:

- autosave queueing
- confirmation workflows
- selection state
- subscription lifecycle helpers
- input parsing and validation
- scaling/measurement logic

## Current Component Inventory

### Existing shared/layout components

- `AppShell`
  - main navigation shell
  - top bar
  - status bar
- `PagePanel`
  - basic section panel
- `ModulePlaceholder`
  - placeholder for incomplete modules
- `ImageUploadPicker`
  - reusable upload picker currently used by daily logs

### Existing feature components

- `TimecardWorkbookCard`
  - interactive timecard card
  - critical exact-workbook behavior
- `TimecardPrintCard`
  - print/PDF timecard card
  - critical exact-print behavior

### New shared primitives already started

- `AppLoadingButton`
  - button with consistent loading and disabled behavior
- `AppEmptyState`
  - reusable empty/loading/error placeholder block
- `AppStatusMessage`
  - inline status/error/success message block

## Needed Shared Components

### App primitives

These are small, generic pieces used everywhere.

- `AppButton`
  - optional future replacement for raw `app-button` class usage
  - variants: default, primary, success, danger, ghost
  - supports loading state or delegates that to `AppLoadingButton`
- `AppLoadingButton`
  - already started
  - use anywhere a button label changes during loading
- `AppEmptyState`
  - already started
  - use for empty list, loading placeholder, and missing-data states
- `AppStatusMessage`
  - already started
  - use for inline success/error/warning/info messages
- `AppBadge`
  - statuses such as draft, submitted, active, archived, admin, foreman
- `AppField`
  - shared label/help/error wrapper for inputs
- `AppTextInput`
  - common input styling and attrs passthrough
- `AppSelect`
  - wrapper around native select or PrimeVue select where needed
- `AppSearchInput`
  - shared search field with label/placeholder/clear affordance
- `AppDateInput`
  - consistent date field behavior
- `AppInlineInput`
  - small inline editing field used in tables/lists

### Layout components

These define repeated page structures.

- `AppSplitWorkspace`
  - left browser/list pane plus right detail/workspace pane
  - used by jobs, users, employees, shop orders, shop catalog, timecard export
- `AppPane`
  - titled panel with optional eyebrow, title, actions, and scroll body
- `AppPaneHeader`
  - reusable header block for panes
- `AppToolbar`
  - dense row or grid of controls
- `AppToolbarGroup`
  - labeled control grouping
- `AppDrawer`
  - mobile-friendly detail/create/edit panel
- `AppCardList`
  - generic list wrapper with loading/empty states
- `AppListRow`
  - reusable selectable list row
- `AppActionBar`
  - bottom or header action row
- `AppContextMenu`
  - reusable right-click/action menu pattern

### Feedback and workflow components

These are common workflow helpers.

- `SaveStatusIndicator`
  - displays saving, saved, pending, or error state
  - should support the timecard save queue and admin detail autosave pages
- `ConfirmAction`
  - replaces direct `window.confirm` calls over time
  - should support message, confirm label, destructive styling, and test-friendly behavior
- `PermissionNotice`
  - explains why a user can view but not edit
- `ReadonlyField`
  - consistent rendering for submitted/locked records
- `EntityHeader`
  - shared title/meta/status header for selected records
- `HistoryList`
  - base history pattern for submitted timecards, daily logs, shop orders

### Recipient components

Recipient editing is duplicated enough to justify its own shared feature component.

- `RecipientEditor`
  - input + add button + list + remove buttons
  - emits `add` and `remove`
  - supports loading/disabled/read-only state
  - supports duplicate messaging by parent or slot
- `RecipientGroup`
  - title, hint, count, read-only/default markers
- `ModuleRecipientSettings`
  - repeats groups for `dailyLogs`, `timecards`, and `shopOrders`
  - useful on job settings and all-jobs/default settings

## Needed Feature Components

## Jobs

Current page: `JobsView.vue`

Needed components:

- `JobsBrowser`
  - search, active/archived toggle, job list
- `JobCard`
  - one job row/card
- `JobEditorPanel`
  - create/edit form for job metadata
- `JobForemanPicker`
  - assigned foreman selection and filtering
- `JobNotificationSettings`
  - per-job module recipients
- `GlobalNotificationSettings`
  - all-jobs/default module recipients
- `JobArchiveActions`
  - archive, restore, delete action block

Recommended extraction order:

1. `JobCard`
2. `JobForemanPicker`
3. `JobNotificationSettings`
4. `JobsBrowser`
5. `JobEditorPanel`

## Job Dashboard

Current page: `JobDashboardView.vue`

Needed components:

- `JobDashboardHeader`
- `ModuleLauncherGrid`
- `ModuleLauncherCard`

This page is already small, so it is a good low-risk place to establish shared shell patterns.

## Users

Current page: `UsersView.vue`

Needed components:

- `UsersBrowser`
- `UserListRow`
- `UserEditorPanel`
- `UserRoleBadge`
- `AssignedJobsPicker`
- `PendingInviteActions`
- `UserDangerZone`

Recommended extraction order:

1. `UserRoleBadge`
2. `AssignedJobsPicker`
3. `UserListRow`
4. `PendingInviteActions`
5. `UserEditorPanel`

## Employees

Current page: `EmployeesView.vue`

Needed components:

- `EmployeesBrowser`
- `EmployeeListRow`
- `EmployeeEditorPanel`
- `EmployeeStatusBadge`
- `EmployeeDangerZone`

This area should share a lot of structure with users once `AppSplitWorkspace`, `AppListRow`, and `AppPane` exist.

## Timecards

Current pages/components:

- `TimecardsView.vue`
- `TimecardExportView.vue`
- `TimecardWorkbookCard.vue`
- `TimecardPrintCard.vue`

Timecards are high risk because exact layout and input behavior are core requirements.

Needed components:

- `TimecardWeekToolbar`
  - week ending, week history controls, sort, submit/create actions
- `TimecardSaveStatus`
  - queue/pending/saving/error summary
- `TimecardCreateCardTray`
  - employee search/add and custom card form
- `TimecardEmployeePicker`
  - reusable employee list for card creation
- `TimecardCustomCardForm`
  - custom one-off employee card entry
- `TimecardCardCanvas`
  - renders cards, scaling shells, selected card state
- `TimecardCanvasItem`
  - one card wrapper with collapse/remove/edit controls
- `TimecardHistoryList`
  - submitted/draft week history list
- `TimecardAccountsSummary`
  - summary table below the workspace
- `TimecardExportFilters`
  - admin export filters
- `TimecardExportWeekList`
  - saved/exportable week packages
- `TimecardExportActions`
  - CSV/PDF actions

Needed composables:

- `useTimecardSaveQueue`
  - shared by job timecards and admin export
- `useTimecardCardScaling`
  - shared measurement/scale behavior
- `useTimecardCardSelection`
  - selected card and scroll behavior
- `useTimecardCreation`
  - shared employee/custom card creation validation

Recommended extraction order:

1. `useTimecardSaveQueue`
2. `useTimecardCardScaling`
3. `TimecardCardCanvas`
4. `TimecardCreateCardTray`
5. `TimecardWeekToolbar`
6. `TimecardExportFilters`

Keep `TimecardWorkbookCard` and `TimecardPrintCard` isolated and exact. Do not genericize the inner workbook grid unless we have a very specific reason.

## Daily Logs

Current page: `DailyLogsView.vue`

Needed components:

- `DailyLogHeader`
  - job/date/status/site info
- `DailyLogHistoryList`
  - submitted/draft logs for selected date
- `DailyLogForm`
  - top-level form composition
- `DailyLogTextSection`
  - reusable required text section
- `DailyLogManpowerTable`
  - manpower lines
- `DailyLogClimateTable`
  - indoor climate readings
- `DailyLogAttachmentSection`
  - wraps `ImageUploadPicker`, descriptions, and delete actions
- `DailyLogSubmitPanel`
  - submit/delete/saved field guidance
- `DailyLogRecipientPanel`
  - admin defaults plus additional recipients

Needed composables:

- `useDailyLogDraftAutosave`
- `useDailyLogValidation`
- `useDailyLogAttachments`
- `useRecipientEditor`

Recommended extraction order:

1. `DailyLogTextSection`
2. `DailyLogAttachmentSection`
3. `DailyLogRecipientPanel`
4. `DailyLogHistoryList`
5. `DailyLogForm`

## Shop Orders

Current page: `ShopOrdersView.vue`

Needed components:

- `ShopOrderCatalogPane`
  - search, root row, catalog tree, custom item area
- `ShopOrderCatalogTree`
  - category/item tree
- `ShopOrderCatalogNode`
  - one category or item row
- `ShopOrderContextMenu`
  - expand/collapse/catalog actions
- `ShopOrderWorkspaceHeader`
  - job/order/status/order number summary
- `ShopOrderMetaForm`
  - delivery date, shortcut, comments
- `ShopOrderItemsList`
  - current order items
- `ShopOrderItemRow`
  - quantity, note, remove, read-only display
- `ShopOrderCustomItemForm`
  - custom item add flow
- `ShopOrderHistoryList`
  - draft/submitted history
- `ShopOrderSubmitActions`
  - submit/delete/new order actions

Needed composables:

- `useShopOrderTree`
  - category/item tree building, search, expand/collapse
- `useShopOrderDraftAutosave`
  - order meta save behavior
- `useShopOrderItemNotes`
  - note drafts and queued saves
- `useShopOrderWorkflow`
  - create draft, add item, submit, delete

Recommended extraction order:

1. `useShopOrderTree`
2. `ShopOrderCatalogTree`
3. `ShopOrderItemsList`
4. `ShopOrderHistoryList`
5. `ShopOrderMetaForm`
6. `ShopOrderCatalogPane`

## Shop Catalog Admin

Current page: `ShopCatalogAdminView.vue`

Needed components:

- `ShopCatalogAdminTree`
- `ShopCatalogAdminNode`
- `ShopCatalogInspector`
- `ShopCatalogFolderForm`
- `ShopCatalogItemForm`
- `ShopCatalogMoveControls`
- `ShopCatalogInlineEditor`
- `ShopCatalogDangerZone`

Potential shared overlap:

- tree rendering with shop orders
- context menu
- split workspace
- empty states
- inline editing

Recommended extraction order:

1. shared tree node primitives only if they do not make shop order behavior harder
2. `ShopCatalogInspector`
3. `ShopCatalogFolderForm`
4. `ShopCatalogItemForm`
5. `ShopCatalogAdminTree`

## Reference Lists

Current page: `ReferenceListView.vue`

The route exists, but real CRUD behavior is still scaffold-level.

Needed components when implemented:

- `ReferenceListEditor`
- `ReferenceListItemRow`
- `ReferenceListCreateForm`

Do not create fake component complexity before the feature exists.

## Shared Composables Needed

### `useAutosaveQueue`

For field-heavy pages that save after typing or commit events.

Use cases:

- timecard card saves
- job detail autosave
- user detail autosave
- shop order notes
- daily log draft autosave

Responsibilities:

- debounce saves
- track pending ids
- avoid remote echo overwriting local edits
- queue a second save if a save is already in flight
- expose `pendingCount`, `savingCount`, `error`, and `lastSavedAt`

### `useCommitAutosave`

For simpler edit forms that save on blur/change.

Use cases:

- users
- employees
- job metadata
- catalog detail forms

### `useConfirmAction`

Replaces direct `window.confirm` calls.

Responsibilities:

- expose one consistent confirmation API
- allow future custom modal UI
- be easy to stub during tests

### `useRecipientEditor`

Shared recipient add/remove normalization and duplicate behavior.

Responsibilities:

- normalize email casing and whitespace
- validate empty input
- prevent duplicates
- emit or call parent save handlers

### `useSubscriptionState`

Standardizes subscription lifecycle state.

Responsibilities:

- loading state
- error normalization
- cleanup on unmount

### `useSplitWorkspaceSelection`

Common selected item behavior for browser/detail pages.

Use cases:

- jobs
- users
- employees
- shop catalog
- shop orders

Responsibilities:

- selected id
- select first item when needed
- clear invalid selection
- keep local draft state from being overwritten while dirty

## Stubbing Boundaries

The app should be easy to test at three levels.

### E2E tests

- continue using real app pages
- do not add fake test-only pages
- use seeded e2e runtime data

### Component tests

Good candidates:

- `RecipientEditor`
- `AppSplitWorkspace`
- `TimecardCardCanvas`
- `DailyLogTextSection`
- `ShopOrderCatalogTree`
- `ShopOrderItemsList`
- `SaveStatusIndicator`

### Composable tests

Good candidates:

- `useAutosaveQueue`
- `useRecipientEditor`
- `useShopOrderTree`
- `useDailyLogValidation`
- `useTimecardSaveQueue`

## Recommended Refactor Order

### Stage 1: Shared primitives

- finish basic common components
- migrate low-risk pages first
- keep CSS class compatibility where possible

Targets:

- auth pages
- print route empty/error states
- job dashboard module tiles

### Stage 2: Shared workflow components

- `RecipientEditor`
- `SaveStatusIndicator`
- `ConfirmAction`
- `AppSplitWorkspace`
- `AppPane`
- `AppListRow`

Targets:

- jobs recipients
- daily log recipients
- user/employee browser/detail pages

### Stage 3: Feature extraction

Extract one workflow at a time from large views.

Suggested order:

1. Jobs
2. Users and employees
3. Shop orders
4. Daily logs
5. Timecards
6. Timecard export
7. Shop catalog admin

Timecards and shop catalog admin are later because they have dense interactions and more layout risk.

### Stage 4: Composable consolidation

After components expose consistent events, move repeated behavior into composables.

Targets:

- autosave
- confirmation
- selection
- tree building
- subscription state

### Stage 5: Backend/functions structure

Only after frontend behavior remains green.

Targets:

- split `operationsFunctions.ts`
- split `emailService.ts`
- isolate PDF rendering and email template rendering

## Guardrails

- Do not rewrite a large view and change behavior in the same step.
- Keep e2e tests green after each meaningful extraction.
- Preserve existing `data-testid` values unless intentionally updating tests.
- Prefer props/events over child components importing services.
- Keep exact print/email/PDF rendering isolated and regression-tested.
- Do not genericize the timecard workbook grid just because it is large.

