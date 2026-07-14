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

### Reuse Before Rebuild

Before creating a new component or composable, compare it against existing patterns.

Ask:

- Is this the same visual pattern with different data?
- Is this the same workflow behavior with different labels?
- Can a shared primitive solve the common part while feature components own the domain-specific part?
- Would sharing this require too many feature-specific props?
- Would sharing this hide permission, validation, or workflow differences?

Prefer:

- shared components for stable visual patterns
- shared composables for repeated behavior
- feature components for domain-specific workflow sections
- small primitives over one overly flexible mega-component

Intentionally keeping similar-looking components separate is acceptable when the workflows are meaningfully different. Document that choice if future-us might wonder why.

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
- have a small documented public API once reused in more than one place
- preserve labels, focus behavior, keyboard access, and error messaging

Shared components can own small local UI state when that state is visual only, such as expanded/collapsed state, menu open state, or active tab state.

### Feature Components

Feature components should:

- live near the workflow they support
- know domain vocabulary
- still avoid direct Firebase/service calls unless they are intentionally container components
- expose clear events such as `save`, `submit`, `delete`, `select`, `change`, and `add`
- emit business intent rather than raw persistence details
- keep accessibility behavior visible in the component API when relevant, such as labels, disabled reasons, and described-by text

### Public Component API Standard

For any shared component, define:

- required props
- optional props and defaults
- emitted events and payload shape
- slots, if any
- keyboard/focus behavior
- loading/disabled/error behavior

Tests should cover the component's public behavior, not private implementation details.

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
- `TimecardButton`
  - feature-level action button for green-sheet timecard toolbars and trays
  - keeps timecard action styling out of individual toolbar components
- `TimecardToolbarTabs`
  - feature-level mobile tablist for job timecards and timecard export
  - preserves each toolbar's ARIA id/control prefixes while sharing the responsive tab styling
- `TimecardSortModePicker`
  - feature-level Employee#/Name radio picker shared by job timecards and timecard export
  - emits only the selected sort mode so each parent still owns sorting behavior
- `JobDashboardHeader`
  - feature-level job dashboard header built around `PagePanel`
  - keeps job title/meta rendering out of the route shell
- `ModuleLauncherGrid`
  - feature-level module launcher list for job dashboards
  - preserves real route links and e2e `data-testid` contracts
- `ModuleLauncherCard`
  - one linked dashboard module tile
  - owns hover styling and module card presentation

### New shared primitives already started

- `AppButton`
  - thin wrapper over existing global `.app-button` styles
  - used by directory create actions, notification recipient actions, upload picker actions, and shop catalog/shop order/daily-log actions
- `AppButtonLink`
  - semantic `RouterLink` wrapper for links that intentionally use button styling
  - keeps button-looking links separate from real button actions
- `AppLoadingButton`
  - button with consistent loading and disabled behavior
- `AppListButton`
  - selectable card-like button shell for directory/list rows
  - shared by Users, Employees, and Jobs while each feature keeps its own row content
- `AppIconButton`
  - compact circular icon-only action button with an explicit accessible label
  - used for repeated add/remove controls in daily-log repeater tables and recipient rows
- `AppEmptyState`
  - reusable empty/loading/error placeholder block
- `AppStatusMessage`
  - inline status/error/success message block
- `AppMobilePanelTabs`
  - reusable mobile switcher for two-pane management screens
- `AppPaneHeader`
  - reusable pane eyebrow/title/action header
  - supports heading-level selection for nested panels
  - exposes CSS variables for compact panel-specific heading sizing
- `AppSearchInput`
  - reusable search input styling and `update:modelValue` behavior
  - exposes CSS variables for compact search fields
- `AppSelect`
  - reusable native select wrapper with attrs passthrough and `update:modelValue` behavior
  - all app-owned native selects should render through this wrapper
- `AppTextInput`
  - reusable text/date/number input styling and `update:modelValue` behavior
  - can re-emit native input events for formatting workflows that need the raw event
  - exposes sizing/background/border/box-shadow CSS variables for compact feature forms
- `AppTextarea`
  - reusable textarea styling and `update:modelValue` behavior
  - can re-emit native input events for workflows that need the raw event
  - exposes sizing/background/border/box-shadow/resize CSS variables for feature-specific text areas
- `AppCheckbox`
  - reusable checkbox wrapper with native semantics and `update:modelValue` behavior
  - can re-emit native change events for workflows that still need the raw event
- `AppField`
  - reusable label/help/field wrapper layout
  - used by job, user, employee, shop catalog, shop order, daily-log, recipient, and auth forms
  - exposes label color/weight/letter-spacing/text-transform CSS variables for compact feature forms
- `AppBadge`
  - reusable status/role pill styling

## Needed Shared Components

### App primitives

These are small, generic pieces used everywhere.

- `AppButton`
  - already started
  - replacement for raw `app-button` class usage
  - current variants: default, primary, success, danger, ghost
  - supports loading state or delegates that to `AppLoadingButton`
- `AppButtonLink`
  - already started
  - use for router links that need the same visual treatment as buttons
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
  - already started
  - statuses such as draft, submitted, active, archived, admin, foreman
- `AppField`
  - already started
  - shared label/help/error wrapper for inputs
- `AppTextInput`
  - already started
  - common input styling and attrs passthrough
- `AppTextarea`
  - already started
  - common textarea styling and attrs passthrough
- `AppCheckbox`
  - already started
  - common checkbox behavior and attrs passthrough
- `AppSelect`
  - already started
  - wrapper around native select or PrimeVue select where needed
  - all app-owned native selects currently render through this wrapper
- `AppSearchInput`
  - already started
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
  - already started
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
- `PendingActionButton`
  - button-level pending state without disabling an entire pane
  - useful for add item, create draft, submit, delete, archive, and send actions
- `ConfirmAction`
  - app-native confirmation pattern now backed by `ConfirmDialog`
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

Current components:

- `JobDashboardHeader`
- `ModuleLauncherGrid`
- `ModuleLauncherCard`

This page is now a small route shell that owns route context/lifecycle and composes the dashboard components. It remains a good place to evolve future dashboard widget shell patterns because the navigation behavior is protected by e2e.

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

- `useJobTimecardRecords`
  - already started
  - owns job timecard employee/week/card subscriptions while keeping save/workbook behavior in focused composables
- `useJobTimecardSaveQueue`
  - already started
  - wraps the generic save queue with job-week `updateTimecardCard` persistence
- `useTimecardExportSaveQueue`
  - already started
  - wraps the generic save queue with archive/export card persistence
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
- `useShopOrderOptimisticDraft`
  - local pending draft/items so create/add interactions feel immediate

Output boundary:

- Shop order email and PDF rendering should stay out of Vue components.
- Component extraction should preserve the dense workspace layout, forced no-horizontal-overflow behavior, order number visibility, and submitted read-only states.
- Component extraction should preserve localized pending states instead of greying out the whole workspace during normal adds/saves.
- PDF pagination, repeated table headers, and attached PDF generation belong in Cloud Functions/export code with preview/smoke coverage.

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

Optional helper for pages that have enough repeated confirmation state to justify a composable.

Responsibilities:

- expose one consistent confirmation API
- compose cleanly with the existing `ConfirmDialog`
- keep action-specific labels, messages, and busy state testable through real dialog UI

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
- Keep shared component public APIs small, documented, and accessible.
- Keep exact print/email/PDF rendering isolated and regression-tested.
- Do not genericize the timecard workbook grid just because it is large.
