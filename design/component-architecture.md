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
  - consumes `appShellNavigation` for sidebar item policy and role-label copy so future role-dashboard navigation can evolve without burying policy in the layout template
- `AuthCard`
  - shared auth-page card shell for sign-in and password-reset flows
  - owns auth page centering, accessible heading wiring, eyebrow/title/copy rendering, and auth form slot chrome
- `AuthFirebaseConfigWarning`
  - shared auth-page warning for missing Firebase environment configuration
  - keeps public auth routes from duplicating Firebase setup copy while routes own when the warning appears
- `AuthStatusMessage`
  - shared auth-page status-message wrapper around `AppStatusMessage`
  - owns the auth-card status chrome while auth routes keep the specific loading, warning, or verification copy
- `AuthSubmitButton`
  - shared auth-page submit/loading button wrapper around `AppLoadingButton`
  - owns auth-card button chrome and default primary submit behavior while routes keep action labels and pending state
- `AuthTextLink`
  - shared auth-page text-link wrapper around `RouterLink`
  - owns auth-card link chrome while routes keep target destinations and link copy
- `PagePanel`
  - basic section panel
  - header now renders through `AppPaneHeader`
- `ModulePlaceholder`
  - placeholder for incomplete modules
  - owns future-module hero/highlight card presentation while routes own feature availability and copy
- `ImageUploadPicker`
  - reusable upload picker currently used by daily logs
  - owns PrimeVue upload wiring, local upload error display, saved attachment cards, description/remove events, and preview lightbox behavior while parents own upload persistence

### Existing feature components

- `TimecardWorkbookCard`
  - interactive timecard card
  - critical exact-workbook behavior
- `TimecardWorkbookHeader`
  - exact-workbook employee/company header used by interactive timecards
  - keeps editable employee identity/wage fields isolated from the card grid
- `TimecardWorkbookFooter`
  - exact-workbook job/account/notes footer used by interactive timecards
  - keeps footer field events and OT/REG display isolated from the card grid
- `TimecardPrintCard`
  - print/PDF timecard card
  - critical exact-print behavior
  - owns the printable employee header, workbook grid, footer account rows, notes, and regular/overtime display used by print/PDF routes
- `TimecardButton`
  - feature-level action button for green-sheet timecard toolbars and trays
  - keeps timecard action styling out of individual toolbar components
- `TimecardToolbarTabs`
  - feature-level mobile tablist for job timecards and timecard export
  - preserves each toolbar's ARIA id/control prefixes while sharing the responsive tab styling
- `TimecardToolbarShell`
  - feature-level toolbar root shell shared by job timecards and Timecard Export
  - owns the common toolbar border/background/padding/base grid and input/search CSS-variable contract while parents keep route-specific grid-template areas
- `timecard-toolbar-content.css`
  - feature-level shared stylesheet for job timecards, Timecard Export toolbar/create-tray content utilities, and custom-card field label/search layout
  - owns repeated lead-spacer, label/search, stack/control, matrix, sort-stack, status grid-placement, and common child-panel mobile matrix/spacer utility classes while extracted panels keep workflow-specific internal responsive tweaks and parent toolbars keep route-level grid placement
- `timecard-primevue-select.css`
  - feature-level shared stylesheet for Timecard Export PrimeVue `Select` controls and overlays
  - owns the repeated select surface, label, dropdown, focus, and option-state styling used by the export week/archive filters panels and create tray while leaving `MultiSelect` styling local to the archive filters panel
- `timecard-create-tray.css`
  - feature-level shared stylesheet for job Timecards and Timecard Export create-card tray shells
  - owns repeated tray input/search CSS variables, tray surface layout, panel shell styling, child-panel fieldset/legend support, heading/eyebrow/notice styling, export fieldset/legend reset, custom-card grid spacing, custom-card action spacing, and mobile one-column behavior while each tray keeps workflow-specific fields and copy local
- `TimecardToolbarPanel`
  - feature-level toolbar fieldset/legend/mobile panel wrapper shared by job timecards and Timecard Export
  - preserves each toolbar's ARIA tabpanel ids/labels, responsive collapse breakpoint, grid-area modifier classes, status-panel always-visible behavior, and custom root class passthrough for specialized panel internals
- `TimecardToolbarSignal`
  - feature-level status pill shared by job timecards and Timecard Export toolbar status areas
  - owns default/success/error signal styling while preserving the legacy `.timecards-signal` class used by current E2E contracts
- `TimecardExportTargetPanel`
  - feature-level Week Target selector panel for Timecard Export create-card flows
  - owns linked-job/foreman selector rendering, no-foreman warning copy, export target-field styling, and target update events while the parent tray keeps create-card readiness and workflow dispatch
- `TimecardSortModePicker`
  - feature-level Employee#/Name radio picker shared by job timecards and timecard export
  - emits only the selected sort mode so each parent still owns sorting behavior
- `TimecardPageShell`
  - feature-level page shell shared by job timecards and Timecard Export
  - composes `AppShell` and `TimecardWorkspaceShell` while preserving route-owned workflow orchestration and confirmation dialogs through slots
- `TimecardWorkspaceShell`
  - feature-level page/workbook shell shared by job timecards and Timecard Export
  - owns the green-sheet wrapper, workbook gap/padding/background, and shared toolbar CSS variables while routes keep workflow state
- `TimecardCanvasPanel`
  - feature-level card canvas shell shared by job timecards and Timecard Export
  - owns loading/empty states, header/card/action/footer slots, active/compact card chrome, collapse controls, scale/shell style passthrough, and measurement element events while route-specific canvas composers keep workbook/card workflow rules
- `JobTimecardCanvasPanel`
  - job Timecards canvas composer
  - preserves job header metadata, selected-week date formatting, job card ids/test ids, compact/footer rules, workbook prop forwarding, employee-header lock rules, workbook change events, delete-card events, and measurement event forwarding while `TimecardsView` keeps save/delete workflow ownership
- `TimecardExportCanvasPanel`
  - Timecard Export canvas composer
  - preserves export heading/meta labels, export card ids, edit/lock controls, edit/footer rules, archive week/burden workbook prop forwarding, measurement callback forwarding, workbook change events, and delete-card events while `TimecardExportView` keeps export filtering/edit/delete workflow ownership
- `TimecardSummaryPanel`
  - shared totals/account summary panel for job timecards and Timecard Export
  - preserves parent-owned total rendering, account summary rows, missing-label fallbacks, and empty account-total copy while parent views keep calculations
- `JobDashboardHeader`
  - feature-level job dashboard header built around `PagePanel`
  - keeps job title/meta rendering out of the route shell
- `ModuleLauncherGrid`
  - feature-level module launcher list for job dashboards
  - preserves real route links and e2e `data-testid` contracts
- `ModuleLauncherCard`
  - one linked dashboard module tile
  - owns module copy/presentation while linked card shell renders through `AppLinkCard`

### New shared primitives already started

- `AppButton`
  - thin wrapper over colocated `button-family.css` styles shared by the app button primitives
  - used by directory create actions, notification recipient actions, upload picker actions, and shop catalog/shop order/daily-log actions
- `AppButtonLink`
  - semantic `RouterLink` wrapper for links that intentionally use button styling
  - keeps button-looking links separate from real button actions
- `AppLinkCard`
  - semantic `RouterLink` wrapper for links that intentionally use card styling
  - already started
  - current consumer is the Job Dashboard module launcher card
- `AppLoadingButton`
  - button with consistent loading and disabled behavior
  - supports the same primary/success/danger/ghost visual variants used by `AppButton`
  - current consumers include ConfirmDialog confirm actions, Users create/delete actions, Employees create/delete actions, Jobs create/archive/delete actions, Daily Log save/create/delete/submit actions, Shop Catalog create/save/delete actions, and Shop Order create-order actions
- `AppListButton`
  - selectable card-like button shell for directory/list rows
  - shared by Users, Employees, and Jobs while each feature keeps its own row content
- `AppIconButton`
  - compact circular icon-only action button with an explicit accessible label
  - used for repeated add/remove controls in daily-log repeater tables and recipient rows
- `AppEmptyState`
  - reusable empty/loading/error placeholder block
  - current consumers include Daily Log, Users, Employees, Jobs, Shop Catalog, and Shop Order empty/loading states
- `AppStatusMessage`
  - inline status/error/success message block
- `SaveStatusIndicator`
  - autosave-specific wrapper around `AppStatusMessage`
  - used by Users, Employees, and Jobs detail autosave displays
- `AppMobilePanelTabs`
  - reusable mobile switcher for two-pane management screens
- `DirectoryEditorWorkspaceShell`
  - shared admin directory/editor page shell built on `AppShell`, `AppSplitWorkspace`, and `AppMobilePanelTabs`
  - current consumers are Users and Employees while each route keeps its own subscriptions, saves, filtering, datalists, and confirmation workflow
- `AppPaneHeader`
  - reusable pane eyebrow/title/action header
  - supports heading-level selection for nested panels
  - exposes CSS variables for compact panel-specific heading sizing
  - supports an optional copy-prefix slot for controls that belong before the eyebrow/title copy, such as mobile back buttons
  - supports optional description prop/slot rendering under the title copy
  - current consumers include PagePanel, Daily Log page header, Jobs detail headers, Users detail headers, Employees directory/detail headers, and Shop Order catalog/workspace/custom-item headers
- `AppSectionHeader`
  - reusable compact section eyebrow/title/action header
  - already started
  - owns the small section eyebrow/title/action/description pattern used inside feature panes and cards
  - current consumers are the Shop Order added-items/order-history section headers, Daily Log card headers, Jobs assigned-field-users header, Jobs notification recipients header, Users assigned-jobs header, Employees settings headers, and shared RecipientEditor headers
- `AppCard`
  - reusable feature-card shell for bordered card surfaces
  - already started
  - owns the common card border/background/gap/padding/shadow shell
  - exposes explicit density, elevation, and tone props for future visual polish while preserving CSS-variable overrides for dense feature sections
  - current consumers are the Daily Log site info, history, recipients, text section, attachment, selected log, manpower, indoor climate, and ImageUploadPicker uploaded attachment cards
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
  - uses the shared DOM input-value helper and exposes sizing/background/border/color/font/focus/box-shadow/resize CSS variables for feature-specific text areas
- `AppCheckbox`
  - reusable checkbox wrapper with native semantics and `update:modelValue` behavior
  - can re-emit native change events for workflows that still need the raw event
- `AppDateInput`
  - reusable native date input wrapper with fixed `type="date"` and shared text-input styling
  - used by Jobs, Daily Logs, Shop Orders, job Timecards, and Timecard Export date fields
- `AppField`
  - reusable label/help/field wrapper layout
  - used by job, user, employee, shop catalog, shop order, daily-log, recipient, and auth forms
  - exposes label color/weight/letter-spacing/text-transform CSS variables for compact feature forms
- `AppBadge`
  - reusable status/role pill styling
  - exposes CSS variables for feature-specific badge sizing, no-wrap behavior, and tone colors
  - current consumers include Daily Log toolbar/history status badges and Shop Order selected-order/history badges

## Needed Shared Components

### App primitives

These are small, generic pieces used everywhere.

- `AppButton`
  - already started
  - replacement for raw `app-button` class usage
  - owns the shared button-family stylesheet alongside `AppButtonLink` and `AppLoadingButton`
  - current variants: default, primary, success, danger, ghost
  - supports loading state or delegates that to `AppLoadingButton`
- `AppButtonLink`
  - already started
  - use for router links that need the same visual treatment as buttons
- `AppLoadingButton`
  - already started
  - use anywhere a button label changes during loading
  - prefer over inline `loading ? 'Saving...' : 'Save'` labels once the containing workflow has route coverage
- `AppEmptyState`
  - already started
  - use for empty list, loading placeholder, and missing-data states
  - continue replacing raw one-off empty/loading divs as feature routes receive coverage
- `AppStatusMessage`
  - already started
  - use for inline success/error/warning/info messages
- `AppBadge`
  - already started
  - statuses such as draft, submitted, active, archived, admin, foreman
  - supports CSS-variable overrides for compact feature-specific badge spacing, flex/no-wrap behavior, and tone colors
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
  - already started
  - consistent date field behavior
- `AppInlineInput`
  - already started
  - small inline editing field used in tables/lists
  - first consumer is Shop Catalog inline create/rename

### Layout components

These define repeated page structures.

- `AppSplitWorkspace`
  - already started
  - left browser/list pane plus right detail/workspace pane
  - supports fixed-width, equal-width, and single-pane layout modes
  - exposes compact/default/spacious density variants backed by tokenized split-pane gaps
  - currently used by Users, Employees, and Jobs
  - intended for shop orders, shop catalog, and timecard export after each page is ready for shell cleanup
- `DirectoryEditorWorkspaceShell`
  - already started
  - wraps the common Users/Employees `AppShell` + mobile-tabs + split-workspace layout
  - leaves route-level orchestration, feature panels, datalists, and dialogs in slots
- `AppPane`
  - titled panel with optional eyebrow, title, actions, and scroll body
  - already started
  - owns the common pane border/background/grid shell
  - exposes explicit density, elevation, and tone props for future visual polish while preserving CSS-variable overrides for feature workspaces
  - current consumers are the Jobs browser/detail panels, Employees directory/detail panes, Users directory/detail panes, Shop Catalog tree/inspector panes, and Shop Order catalog/workspace panes
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
  - already started
  - displays admin detail saving/saved/idle autosave state through the shared status-message primitive
  - can grow carefully toward timecard save queue status once that workflow is ready for shared UI treatment
- `PendingActionButton`
  - button-level pending state without disabling an entire pane
  - useful for add item, create draft, submit, delete, archive, and send actions
- `usePendingActionMap`
  - keyed pending-state primitive for row/button-level actions
  - first consumer is shop-order catalog item add row state
- `ConfirmAction`
  - app-native confirmation pattern now backed by `ConfirmDialog`
  - should support message, confirm label, destructive styling, and test-friendly behavior
- `PermissionNotice`
  - explains why a user can view but not edit
- `AppReadonlyField`
  - already started
  - consistent rendering for submitted/locked records
  - current consumers are Shop Order submitted metadata fields and submitted item quantity/note values
- `EntityHeader`
  - shared title/meta/status header for selected records
  - already started as `AppEntityHeader`
  - owns compact selected-record eyebrow/title/action layout
  - current consumer is the Shop Order selected-order header
- `HistoryList`
  - base history pattern for submitted timecards, daily logs, shop orders

### Recipient components

Recipient editing is duplicated enough to justify its own shared feature component.

- `RecipientEditor` - covered by `src/__tests__/RecipientEditor.spec.ts`
  - title/helper/count header now renders through `AppSectionHeader`
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

Current components:

- `JobsWorkspaceShell`
  - feature-level Jobs page shell built around `AppShell` and `AppSplitWorkspace`
  - owns the Jobs edit-mode topbar action, single/equal workspace mode choice, and primary/secondary/default slot layout while the route keeps subscriptions, persistence, navigation, and confirmation workflow
- `JobBrowserPanel`
  - jobs list/search/status browser, create entry point, all-jobs row, and field-user job navigation affordance
- `JobDetailsFormFields`
  - typed create/edit job metadata field grid
- `JobFieldUserAssignmentPanel`
  - assigned foreman/field-user picker with search and loading/empty states
- `JobNotificationRecipientsPanel`
  - per-module notification recipient editor shell for create, selected-job, and all-jobs/default settings
- `JobAdminDetailPane`
  - admin edit drawer detail pane for create-job, all-jobs defaults, selected-job edit, and empty editor states
  - route/composables own persistence, form mutation, recipient saves, archive/delete requests, and navigation
- `JobConfirmDialogs`
  - feature-level archive/restore/delete confirmation dialog group for Jobs admin workflows
  - route/composables own state/actions; component renders dialog copy, busy state, destructive intent, and events

Current composables:

- `useJobsViewState`
  - covered by `src/__tests__/useJobsViewState.spec.ts`
  - owns Jobs admin/non-admin visible job lists, selected-job lookup, create/all-jobs mode flags, all-jobs entry visibility, active/archive counts, field-user option filtering/sorting, job type options, and GC suggestions
- `useJobsCapabilities`
  - covered by `src/__tests__/useJobsCapabilities.spec.ts`
  - owns Jobs page route-level create/setup/delete/archive capability flags plus selected-job setup edit access derived from the auth source and selected job id
- `useJobsSelectionSync`
  - covered by `src/__tests__/useJobsSelectionSync.spec.ts`
  - owns Jobs selected-job form hydration, dirty-guard handoff, no-selection resets, field-user first-visible fallback, manager missing-selection fallback, create/all-jobs preservation, edit-drawer default selection, and drawer-close autosave cleanup
- `useJobsNavigationActions`
  - covered by `src/__tests__/useJobsNavigationActions.spec.ts`
  - owns Jobs create/edit drawer navigation, create-form reset, all-jobs default selection, create-mode preservation, edit-mode row selection, and dashboard routing outside edit mode
- `useJobDetailForm`
  - covered by `src/__tests__/useJobDetailForm.spec.ts`
  - owns Jobs selected-job form hydration/reset, notification recipient hydration, recipient-input reset, detail field updates, validation, explicit save handoff, autosave scheduling/gating, status copy, and dirty local field protection from stale remote echoes
- `useJobCreateForm`
  - covered by `src/__tests__/useJobCreateForm.spec.ts`
  - owns Jobs create-job form defaults, typed field updates, create notification recipient state, recipient input state, full form resets, assigned-foreman cleanup, and create-message cleanup
- `useJobCrudActions`
  - covered by `src/__tests__/useJobCrudActions.spec.ts`
  - owns Jobs create, detail persistence, archive/restore, delete, loading-state cleanup, selection handoff after delete, and service error forwarding
- `useJobNotificationRecipients`
  - covered by `src/__tests__/useJobNotificationRecipients.spec.ts`
  - owns Jobs create-recipient local edits, selected-job recipient persistence, all-jobs default recipient persistence, validation copy, duplicate handling, remove behavior, save-state cleanup, and service error forwarding
- `useJobsAdminSubscriptions`
  - covered by `src/__tests__/useJobsAdminSubscriptions.spec.ts`
  - owns Jobs admin-only user/all-jobs-recipient subscription startup, listener updates, replacement cleanup, explicit stop cleanup, user listener errors, and all-jobs recipient error forwarding
- `useJobsLifecycle`
  - covered by `src/__tests__/useJobsLifecycle.spec.ts`
  - owns Jobs page mount-time jobs/admin subscription startup order and unmount-time detail autosave/subscription cleanup order
- `useJobsSideEffects`
  - covered by `src/__tests__/useJobsSideEffects.spec.ts`
  - owns Jobs page detail-form change autosave scheduling and deduplicated jobs subscription error forwarding
- `useJobConfirmDialogs`
  - covered by `src/__tests__/useJobConfirmDialogs.spec.ts`
  - owns Jobs archive/restore/delete confirmation state, selected-job dialog copy, no-selection guards, manual close helpers, and busy-state close protection

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

- `JobDashboardPageShell`
  - feature-level page shell for the Job Dashboard route
  - composes `AppShell` and `JobDashboardWorkspaceShell` while preserving route-owned job context, lifecycle, header slot, module slot, and future dashboard-widget extension points
- `JobDashboardWorkspaceShell`
  - feature-level route layout shell for the Job Dashboard page test-id, header slot, module slot, and page grid spacing
- `JobDashboardHeader`
- `ModuleLauncherGrid`
- `ModuleLauncherCard`

Current composables:

- `useJobDashboardLifecycle`
  - covered by `src/__tests__/useJobDashboardLifecycle.spec.ts`
  - owns Job Dashboard route-job subscription startup, route-job id resubscription, and route-job subscription cleanup

Current feature helpers:

- `jobDashboardModules`
  - covered by `src/__tests__/jobDashboardModules.spec.ts`
  - owns the current Job Dashboard module launcher definitions and preserves a clean seam for later role-aware module filtering

This page is now a small route shell that owns route context/lifecycle and composes the dashboard components. It remains a good place to evolve future dashboard widget shell patterns because the navigation behavior is protected by e2e.

## Role Dashboards

Current page: `RoleDashboardView.vue`

Current components:

- `RoleDashboardModuleGrid`
  - feature-level module grid for role dashboard cards
  - renders absolute module target routes from `roleDashboardModules`
  - covered by `src/__tests__/RoleDashboardView.spec.ts`
- `RoleDashboardJobShortcuts`
  - feature-level job shortcut panel for the live role dashboard
  - renders role-filtered job dashboard/module links from the existing visible-jobs subscription and target access helpers
  - covered by `src/__tests__/RoleDashboardView.spec.ts`, `src/__tests__/roleDashboardJobShortcuts.spec.ts`, and `e2e/access-control.spec.ts`

Current route behavior:

- `/dashboard` is the live role landing page.
- AppShell workspace navigation now includes `Dashboard` before `Jobs`.
- Signed-in public-entry redirects and denied protected-route fallbacks now land on `/dashboard`.

Current target helpers:

- `targetJobAssignments`
  - covered by `src/__tests__/targetJobAssignments.spec.ts`
  - centralizes the target assigned-job membership check used by target job, field-email, and timecard policy helpers
- `targetRouteCapabilities`
  - covered by `src/__tests__/targetRouteCapabilities.spec.ts`
  - defines target protected-route capability metadata and workspace access for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users
- `targetRouteAccess`
  - covered by `src/__tests__/targetRouteAccess.spec.ts`
  - documents the target Vue Router access decision seam for public-entry redirects, workspace access, protected route capabilities, and job-scoped dashboard routes before live router wiring moves to target roles
- `targetAppShellNavigation`
  - covered by `src/__tests__/targetAppShellNavigation.spec.ts`
  - documents target AppShell workspace navigation, role-dashboard entry, admin/sidebar links, and role-label copy
- `targetFieldWorkflowAccess`
  - covered by `src/__tests__/targetFieldWorkflowAccess.spec.ts`
  - documents target Daily Log and Shop Order module viewing separately from create/edit/submit rights for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users
- `roleDashboardModules`
  - covered by `src/__tests__/roleDashboardModules.spec.ts`
  - owns the live target Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access dashboard modules
  - filters modules from `targetRoleCapabilities` so `/dashboard` is capability-driven instead of role-name-driven
- `roleDashboardJobShortcuts`
  - covered by `src/__tests__/roleDashboardJobShortcuts.spec.ts`
  - owns live role-dashboard job shortcut filtering and route construction for assigned jobs, Shop job workflow access, and submitted-timecard shortcut affordances
- `jobIdentity`
  - covered by `src/__tests__/roleDashboardJobShortcuts.spec.ts`
  - centralizes frontend Shop-job recognition so dashboard shortcuts and route access do not guess independently
- `targetFieldEmailRecipients`
  - covered by `src/__tests__/targetFieldEmailRecipients.spec.ts`
  - documents the target automatic Daily Log and Shop Order field-email recipient policy for assigned Foremen, Shop Foremen, and Project Managers before the live Cloud Functions/rules implementation is wired
- `targetTimecardAccess`
  - covered by `src/__tests__/targetTimecardAccess.spec.ts`
  - documents target timecard export/lock/delete-draft access, job workflow edit/submit access, and Project Manager submitted-timecard reporting as separate non-runtime planning seams

Current status: the live dashboard route, granular Jobs setup permissions, role dashboard job shortcuts, Shop Foreman Shop-job dashboard navigation proof, Project Manager read-only submitted-timecard page access, callable policy seams, and broad role E2E coverage are implemented. Direct Firestore/Storage Rules emulator coverage remains the intentionally deferred `R08` layer.

## Users

Current page: `UsersView.vue`

Current components:

- `UserDirectoryPanel`
  - feature-level user browser panel for search, active/inactive filtering, pending invite summary/actions, user role/status/invite badges, and row selection
- `UserEditorPanel`
  - feature-level create/edit/no-selection panel for user fields, current editable role selection, read-only display of stored target-only roles, self-edit lockout, create invite actions, detail autosave state, delete action, and assigned-job picker composition
- `UserAssignedJobsPanel`
  - feature-level assigned-jobs picker for user create/edit workflows when a role can be assigned jobs
- `UserConfirmDialogs`
  - feature-level delete-user confirmation dialog group for Users admin workflows
  - route/composables own delete state/actions; component renders dialog copy, destructive intent, busy state, and events

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

Current components:

- `EmployeeDirectoryPanel`
  - feature-level employee browser panel for search, active/inactive filtering, create-mode selection, employee type/status badges, employee number/occupation fallbacks, and row selection
- `EmployeeEditorPanel`
  - feature-level create/edit panel for employee identity fields, active/contractor toggles, blur-save signaling, detail save status, delete action, and mobile back navigation
- `EmployeeConfirmDialogs`
  - feature-level delete-employee confirmation dialog group for Employees admin workflows
  - route/composables own delete state/actions; component renders dialog copy, destructive intent, busy state, and events

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
- `TimecardExportPrintView.vue`
- `TimecardWorkbookCard.vue`
- `TimecardPrintRouteContent.vue`
- `TimecardPrintCard.vue`
- `TimecardConfirmDialog`
  - shared timecard confirmation renderer for job timecards and Timecard Export
  - routes/composables own selected action state and dispatchers; component renders dynamic copy, destructive state, busy state, and events
- `TimecardPageShell`
  - shared page shell for job timecards and Timecard Export
  - composes `AppShell` with the shared timecard workspace while route views keep payroll/export workflow state and dialogs in slots
- `TimecardWorkspaceShell`
  - shared outer workspace shell for job timecards and Timecard Export
  - preserves page `data-testid` hooks while moving duplicated wrapper styles out of the routes
- `TimecardPageMessages`
  - shared job/export page feedback wrapper
  - preserves the route-level rule that error messages render before informational messages while reusing `TimecardPageMessage` for visual/accessibility behavior
- `TimecardPageMessage`
  - shared timecard page-feedback primitive
  - preserves empty-message suppression, default status role, error alert role, and error tone class while wrapper/views own message priority
- `TimecardToolbarShell`
  - shared toolbar root shell for job timecards and Timecard Export
  - preserves the semantic root element, common toolbar surface styling, control CSS variables, and desktop stretch breakpoint while each parent owns toolbar tabs, panels, controls, and grid-template placement
- `timecard-toolbar-content.css`
  - shared feature stylesheet imported by job timecards, Timecard Export toolbars, `TimecardExportCreateTray`, and `TimecardCustomCardFields`
  - centralizes the repeated inner toolbar, export create-tray target-field, and custom-card label/search utility classes without globalizing them through `main.css`; extracted panels own workflow-specific responsive overrides for the internals they render
- `timecard-primevue-select.css`
  - shared feature stylesheet imported by the Timecard Export toolbar and create-card tray
  - centralizes the repeated PrimeVue `Select` control and overlay styling while keeping behavior and option lists parent-owned and leaving `MultiSelect` styling local to the archive filters panel
- `timecard-create-tray.css`
  - shared feature stylesheet imported by job Timecards and Timecard Export create-card trays
  - centralizes the repeated tray shell, shared input/search variable contract, panel shell, child-panel fieldset/legend support, heading/eyebrow/notice styling, export fieldset/legend reset, custom-card spacing, and mobile tray behavior while leaving target selectors, warnings, and employee/custom-card events parent/component-owned
- `TimecardToolbarPanel`
  - shared toolbar fieldset/legend/mobile panel wrapper for job timecards and Timecard Export
  - preserves tabpanel ids, `aria-labelledby` wiring, mobile-active classes, grid-area modifier classes, route-specific collapse breakpoints, and custom root class passthrough while each parent owns controls and workflow events
- `TimecardToolbarSignal`
  - shared toolbar status pill for job timecards and Timecard Export
  - centralizes default/success/error signal styling while parents keep status text, tone decisions, and mobile layout rules
- `JobTimecardToolbar`
  - job Timecards toolbar composition layer
  - owns mobile tab wiring and child panel layout while `TimecardsView` keeps week selection, card filtering, sorting, create/submit actions, history selection, and save-status state
- `JobTimecardWeekPanel`
  - job Timecards toolbar Week Filters panel
  - preserves job number/name display fields, selected week-ending date input, week date input/picker events, mobile tabpanel state, and display-field styling while `JobTimecardToolbar` keeps overall toolbar composition and week workflow ownership
- `JobTimecardSearchPanel`
  - job Timecards toolbar Card Filters panel
  - preserves employee search copy, current search value, search update events, mobile tabpanel state, and shared toolbar search styling while `JobTimecardToolbar` keeps overall toolbar composition and filter state ownership
- `JobTimecardSortPanel`
  - job Timecards toolbar Sort Cards panel
  - preserves the shared sort mode picker, selected sort value, sort update events, sort action disabled rules, mobile tabpanel state, and sort action event while `JobTimecardToolbar` keeps overall toolbar composition and sorting workflow ownership
- `JobTimecardActionsPanel`
  - job Timecards toolbar Workspace Actions panel
  - preserves create-week, create-card, submit-week, expand-all, and compact-all button copy/visibility/disabled rules, mobile tabpanel state, and action events while `JobTimecardToolbar` keeps overall toolbar composition and workflow dispatch ownership
- `JobTimecardSavedWeeksPanel`
  - job Timecards toolbar Saved Weeks panel
  - preserves recent-week date/status rows, active week styling, no-saved-weeks empty state, row test ids, mobile tabpanel state, and week-selection events while `JobTimecardToolbar` keeps overall toolbar composition and selected-week ownership
- `JobTimecardStatusBar`
  - job Timecards toolbar Status panel
  - preserves week-range, week-status, card-count, and save-state signals plus submitted success tone and save-error error tone while `JobTimecardToolbar` keeps overall toolbar composition and status value ownership
- `TimecardExportWeekFiltersPanel`
  - Timecard Export toolbar Week Filters panel
  - preserves week search, single/range date mode, week-ending/range date inputs, date picker open behavior, selected filter values, update events, mobile tabpanel state, and date-row layout while `TimecardExportToolbar` keeps overall toolbar composition and filter state ownership
- `TimecardExportArchiveFiltersPanel`
  - Timecard Export toolbar Archive Filters panel
  - preserves the jobs `MultiSelect`, foreman/status `Select` controls, selected filter values, update events, mobile tabpanel state, and archive-specific `MultiSelect` styling while `TimecardExportToolbar` keeps overall toolbar composition and filter state ownership
- `TimecardExportSortPanel`
  - Timecard Export toolbar Sort Cards panel
  - preserves the shared sort mode picker, employee search control, selected values, update events, mobile tabpanel state, and sort-panel spacing while `TimecardExportToolbar` keeps overall toolbar composition and filter state ownership
- `TimecardExportActionsPanel`
  - Timecard Export toolbar Workspace Actions panel
  - preserves expand/compact all actions, PDF/CSV export actions, create-tray toggle copy/disabled state, permission-based create visibility, mobile tabpanel state, and action button events while `TimecardExportToolbar` keeps overall toolbar composition and workflow dispatch ownership
- `TimecardExportSavedWeeksPanel`
  - Timecard Export toolbar Saved Weeks panel
  - preserves formatted saved-week rows, subtitles, draft/submitted status labels, delete-draft visibility/disabled rules, delete events, empty/loading copy, and mobile tabpanel state while `TimecardExportToolbar` keeps overall toolbar composition and selected-filter ownership
- `TimecardExportStatusBar`
  - Timecard Export toolbar Status panel
  - preserves desktop/mobile signal rendering, success/error/default tones, mobile always-visible panel behavior, and carousel control disabled state while `TimecardExportToolbar` keeps signal text/tone ownership
- `TimecardExportToolbar`
  - Timecard Export toolbar composition layer
  - owns mobile tab wiring and export panel layout while `TimecardExportView` keeps filtering, saved-week selection, export actions, draft deletion, create-tray visibility, and status signal state
- `JobTimecardCreateTray`
  - job Timecards create-card tray composer
  - preserves Employee Directory and Custom Card child-panel composition, disabled/read-only/loading forwarding, employee/custom-card event forwarding, and week edit-state boundaries while the route keeps week and add-card workflow ownership
- `TimecardExportCreateTray`
  - Timecard Export create-card tray composer
  - preserves notice-only rendering, Week Target/Employee Directory/Custom Card panel composition, target readiness and add-disabled rules, disabled/read-only/loading forwarding, and target/employee/custom-card event forwarding while the export route keeps target/week/card workflow ownership
- `TimecardCustomCardFields`
  - shared custom-card field grid for job timecards and Timecard Export
  - preserves field labels, values, disabled state, and update events while using `timecard-toolbar-content.css` for the shared label/search layout; each parent owns employee lookup, target selection, and add-card actions
- `JobTimecardCustomCardPanel`
  - job Timecards create-tray Custom Card panel
  - preserves job-side one-off card heading/eyebrow copy, shared custom-card field composition, field update events, contractor toggle updates, disabled field/add-button state, and add-card events while `JobTimecardCreateTray` keeps week edit state ownership
- `TimecardExportCustomCardPanel`
  - Timecard Export create-tray Custom Card panel
  - preserves one-off card heading copy, shared custom-card field composition, field update events, contractor toggle updates, add-button disabled state, and add-card events while `TimecardExportCreateTray` keeps target readiness and workflow ownership
- `TimecardEmployeePicker`
  - shared employee search/list picker for job timecards and Timecard Export
  - preserves search updates, employee add events, loading/empty copy, optional row test ids, and separate search/row disabled states while each parent owns its create-card rules
- `JobTimecardEmployeePanel`
  - job Timecards create-tray Employee Directory panel
  - preserves employee picker composition, job-page row test-id prefixing, employee search/update events, selected-employee add events, loading state, and shared disabled behavior while `JobTimecardCreateTray` keeps week edit state ownership
- `TimecardExportEmployeePanel`
  - Timecard Export create-tray Employee Directory panel
  - preserves employee search/list picker composition, search/update events, selected-employee add events, loading state, and disabled search/row behavior while `TimecardExportCreateTray` keeps create-card readiness and target ownership
- `TimecardExportTargetPanel`
  - Timecard Export create-tray target selector panel
  - preserves linked-job/foreman select options, selected values, update events, disabled foreman select behavior, no-foreman warning copy, and target hint copy while `TimecardExportCreateTray` keeps create-card readiness and add-card actions

Timecards are high risk because exact layout and input behavior are core requirements.

Needed components:

- `TimecardWeekToolbar`
  - week ending, week history controls, sort, submit/create actions
- `TimecardSaveStatus`
  - queue/pending/saving/error summary
- `TimecardCreateCardTray`
  - employee search/add and custom card form
- `TimecardCustomCardForm`
  - future wrapper if custom-card validation/action behavior needs to be shared beyond the extracted field grid
- `TimecardCanvasPanel`
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

- `useJobTimecardAccess`
  - covered by `src/__tests__/useJobTimecardAccess.spec.ts`
  - owns job Timecards route-level access derivation, stale profile-assignment repair from the job record, Shop-job identity input, and week-subscription mode selection for manager, field-user, and Project Manager submitted-report flows
- `useJobTimecardRecords`
  - already started
  - owns job timecard employee/week/card subscriptions and remote-card merge protection while keeping save/workbook behavior in focused composables
- `useJobTimecardSaveQueue`
  - already started
  - wraps the generic save queue with job-week `updateTimecardCard` persistence
- `useTimecardExportSaveQueue`
  - covered by `src/__tests__/useTimecardExportSaveQueue.spec.ts`
  - wraps the shared save queue with export archive-card `updateTimecardCard` persistence, editable-week gating, flush-before-action behavior, and service failure messaging
- `useTimecardExportUiState`
  - covered by `src/__tests__/useTimecardExportUiAdapters.spec.ts`
  - owns export mobile toolbar tab state and admin card edit-mode state with neutral edit-permission input, reset, and pruning helpers
- `useTimecardExportCreateTray`
  - covered by `src/__tests__/useTimecardExportUiAdapters.spec.ts`
  - owns export create-tray visibility, selected target job/foreman, employee search, and custom-card form reset state
- `useTimecardExportConfirmDialog`
  - covered by `src/__tests__/useTimecardExportUiAdapters.spec.ts`
  - adapts shared action-confirm state to Timecard Export remove-card and delete-week titles, messages, labels, and busy close behavior
- `useTimecardExportFilters`
  - covered by `src/__tests__/useTimecardExportFilters.spec.ts`
  - owns export current-week filter defaults, toolbar filter normalization, date snapping, range bounds, and week filtering
- `useTimecardExportVisibleCards`
  - covered by `src/__tests__/useTimecardExportVisibleCards.spec.ts`
  - owns export create-week card lookup, card search, and ordered visible-card derivation
- `useTimecardExportSummary`
  - covered by `src/__tests__/useTimecardExportSummary.spec.ts`
  - owns export totals, account summaries, result labels, save/status signals, empty-state copy, PDF subtitle text, and CSV filename derivation
- `useTimecardExportCreateContext`
  - covered by `src/__tests__/useTimecardExportCreateContext.spec.ts`
  - owns export create job/foreman/employee options, target create-week resolution, owner context, and create-tray guidance
- `useTimecardExportCreateDefaults`
  - covered by `src/__tests__/useTimecardExportCreateDefaults.spec.ts`
  - owns stable default job/foreman selection as option lists, filters, and target weeks change
- `useTimecardExportMutationActions`
  - covered by `src/__tests__/useTimecardExportMutationActions.spec.ts`
  - owns export remove-card/delete-draft confirmation payloads, pending-save flush ordering, delete service calls, archive cache cleanup, and mutation success/error messaging
- `useTimecardExportCreateActions`
  - covered by `src/__tests__/useTimecardExportCreateActions.spec.ts`
  - owns export employee/custom card creation, synthetic week creation, create validation, filter synchronization, create-tray cleanup, edit-mode selection, scroll side effects, and create failure messaging
- `useTimecardExportDownloadActions`
  - covered by `src/__tests__/useTimecardExportDownloadActions.spec.ts`
  - owns export PDF/CSV empty guards, pending-save flush ordering, PDF payload storage and print-route handoff, CSV build/download orchestration, and output success/error messaging
- `useTimecardExportFilteredWeekSync`
  - covered by `src/__tests__/useTimecardExportFilteredWeekSync.spec.ts`
  - owns filtered-week signature watching, pending-save flushing before archive card-set changes, page/workspace resets, card sync startup, and stale async sync cancellation
- `useTimecardExportSideEffects`
  - covered by `src/__tests__/useTimecardExportSideEffects.spec.ts`
  - owns export job-burden redecorating and ordered-card selection synchronization watchers behind a neutral ordered-card `ReadonlyRef` input
- `useTimecardExportLifecycle`
  - covered by `src/__tests__/useTimecardExportLifecycle.spec.ts`
  - owns export mount-time subscription startup and unmount-time save queue, measurement, week/card/employee/user cleanup
- `useTimecardExportSubscriptions`
  - covered by `src/__tests__/useTimecardExportSubscriptions.spec.ts`
  - owns export saved-week, employee, and foreman subscription adapters, feature-specific error forwarding, and Timecard Export permission-gated employee/user loading
- `useTimecardExportCardWorkspaceActions`
  - covered by `src/__tests__/useTimecardExportCardWorkspaceActions.spec.ts`
  - owns export workspace cleanup, page/save message reset, valid-card UI pruning, workbook-change recalculation/save scheduling, card scrolling, and employee-header lock rules
- `useTimecardExportArchiveCards`
  - covered by `src/__tests__/useTimecardExportArchiveCards.spec.ts`
  - owns export per-week archive card subscriptions, late card-change handler registration, loading/cache state, archive card decoration, stale subscription cleanup, pending local-state merge protection, burden redecorating, delete cache cleanup, and sort-index derivation
- `useTimecardSaveQueue`
  - covered by `src/__tests__/timecardSaveQueue.spec.ts`
  - shared by job timecards and admin export through feature-specific save-context adapters
- `useTimecardCardScaling`
  - shared measurement/scale behavior
- `useTimecardCardSelection`
  - selected card and scroll behavior
- `useTimecardCreation`
  - shared employee/custom card creation validation

Recommended extraction order:

1. `useTimecardSaveQueue`
2. `useTimecardCardScaling`
3. `TimecardCanvasPanel`
4. `TimecardCreateCardTray`
5. `TimecardWeekToolbar`
6. `TimecardExportFilters`

Keep `TimecardWorkbookCard` and `TimecardPrintCard` isolated and exact. Do not genericize the inner workbook grid unless we have a very specific reason.

## Daily Logs

Current page: `DailyLogsView.vue`

Current components:

- `DailyLogPageShell`
  - feature-level page shell for Daily Logs
  - composes `AppShell` and `DailyLogWorkspaceShell` while preserving route-owned workflow orchestration and confirmation dialogs through slots
- `DailyLogWorkspaceShell`
  - feature-level route shell for the Daily Log page header plus main/sidebar layout
  - owns the responsive Daily Logs page grid while route/composables keep workflow state and persistence
- `DailyLogPageHeader`
- `DailyLogMainColumn`
  - feature-level main form composition for site info, manpower, text sections, attachments, submit action, and saved-value test hooks
  - route/composables own draft save, submit, attachment upload/delete, repeater mutation, and text-field blur behavior
- `DailyLogSidebar`
  - feature-level sidebar composition for selected-log summary, per-log recipients, and selected-date history
  - route/composables own selected-log state, date navigation, recipient persistence, and delete-draft actions
- `DailyLogSelectedLogCard`
  - feature-level selected-log summary card with draft delete action, status/sequence/owner/timestamp display, and empty state
- `DailyLogRecipientsCard`
  - feature-level wrapper around shared `RecipientEditor` for admin-default and per-log additional recipients
- `DailyLogHistoryList`
  - feature-level history/date search list for submitted and draft logs on the selected date
  - route/composables own selected-date state, selected-log state, and intentional draft creation rules
- `DailyLogSiteInfoCard`
- `DailyLogManpowerCard`
- `DailyLogIndoorClimateCard`
- `DailyLogTextSectionCard`
- `DailyLogAttachmentCard`
- `DailyLogAttachmentSections`
- `DailyLogConfirmDialogs`
  - feature-level delete-draft confirmation dialog group for Daily Log workflows
  - route/composables own state/actions; component renders dialog copy, destructive intent, busy state, and events

Needed components:

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

Needed composables:

- `useDailyLogDraftSave`
- daily log submit validation helper
  - covered by `src/__tests__/dailyLogValidation.spec.ts`
  - owns required text-field, manpower-row, and indoor-climate-row submit validation while actions own save/submit orchestration
- `useDailyLogAttachments`
- `useRecipientEditor`

Recommended extraction order:

1. `DailyLogTextSection`
2. `DailyLogAttachmentSection`
3. `DailyLogForm`

## Shop Orders

Current page: `ShopOrdersView.vue`

Current components:

- `ShopOrderPageShell`
  - feature-level page shell for Shop Orders
  - composes `AppShell` and `ShopOrderExplorerShell` while preserving route-owned workflow orchestration and confirmation dialogs through slots
- `ShopOrderExplorerShell`
  - feature-level two-pane shell for catalog browser and order workspace
  - owns shop-order CSS variables, responsive grid sizing, and pane min-size guards while the route owns workflow orchestration
- `ShopOrderCatalogBrowser`
  - feature-level catalog browser/container for counts, search state, expansion/selection state, context-menu actions, quantity state, and add-item persistence
- `ShopOrderCatalogTree`
  - feature-level catalog tree renderer for root/category/item rows, loading/empty states, row-level pending disablement, and context-menu markup while the browser owns state/actions
- `ShopOrderWorkspacePane`
- `ShopOrderWorkspaceHeader`
  - feature-level workspace header for job title, New Order loading button, Submit Order visibility/disablement, and action event forwarding
- `ShopOrderWorkspaceSection`
  - feature-level section shell for Shop Order workspace sections with shared header/body chrome and action-slot support
- `ShopOrderSelectedOrderPanel`
  - feature-level selected-order summary panel for order number, status/count badges, and submitted/created metadata while composing the dedicated metadata form
- `ShopOrderMetaForm`
  - feature-level selected-order metadata form for delivery date, Thursday shortcut, comments, editable events, and read-only submitted fallbacks
- `ShopOrderCustomItemForm`
- `ShopOrderItemsEditor`
- `ShopOrderHistoryList`
- `ShopOrderConfirmDialogs`

Needed components:

- `ShopOrderCatalogPane`
  - search, root row, catalog tree, custom item area
- `ShopOrderCatalogNode`
  - one category or item row
- `ShopOrderContextMenu`
  - expand/collapse/catalog actions
- `ShopOrderItemsEditor`
  - current order items
- `ShopOrderItemRow`
  - quantity, note, remove, read-only display
- `ShopOrderCustomItemForm`
  - custom item add flow
- `ShopOrderHistoryList`
  - draft/submitted history
- `ShopOrderSubmitActions`
  - submit/delete/new order actions
- `ShopOrderConfirmDialogs`
  - renders remove-item, delete-draft, and submit confirmation dialogs while the route/composables own state and actions
  - current confirmation state adapter uses a neutral selected-order ref contract so callers do not need to expose a concrete Vue `ComputedRef`

Needed composables:

- `shopOrderCatalogTree`
  - covered by `src/__tests__/shopOrderCatalogTree.spec.ts`
  - owns category/item tree construction and search-time expansion behavior
- `useShopOrderDraftAutosave`
  - order meta save behavior
- `useShopOrderItemNotes`
  - covered by `src/__tests__/useShopOrderItemNotes.spec.ts`
  - note drafts and queued saves
- `useShopOrderWorkflow`
  - create draft, add item, submit, delete
- `useShopOrderOptimisticDraft`
  - local pending draft/items so create/add interactions feel immediate
  - first seam is the shared `optimisticRecords` utility, consumed by shop-order item persistence for local item-list replacement/rollback

Output boundary:

- Shop order email and PDF rendering should stay out of Vue components.
- Component extraction should preserve the dense workspace layout, forced no-horizontal-overflow behavior, order number visibility, and submitted read-only states.
- Component extraction should preserve localized pending states instead of greying out the whole workspace during normal adds/saves.
- PDF pagination, repeated table headers, and attached PDF generation belong in Cloud Functions/export code with preview/smoke coverage.

Recommended extraction order:

1. `shopOrderCatalogTree` helper
2. `ShopOrderItemsEditor`
3. `ShopOrderHistoryList`
4. `ShopOrderCatalogPane`
5. `ShopOrderConfirmDialogs`

## Shop Catalog Admin

Current page: `ShopCatalogAdminView.vue`

Current components:

- `ShopCatalogTreePane`
  - composes the catalog tree header, filters, loading/empty states, root row, node rows, inline create/rename state, and forwards tree/list/root/node events while the route owns tree data and actions
- `ShopCatalogInspectorPane`
  - routes the active inspector state to the root/create/detail child panel and forwards create/detail field, price, archive, delete, and submit events while the route owns selection and persistence
- `ShopCatalogContextMenu`
  - renders positioned catalog context-menu actions with disabled/danger states while the route owns target/action construction
- `ShopCatalogMobileNav`
  - renders the catalog/inspector mobile tab controls and forwards selected-panel changes
- `ShopCatalogTreeHeader`
  - renders the catalog admin pane heading through the shared pane-header primitive
- `ShopCatalogTreeFilters`
  - renders catalog search and archived visibility controls while the route owns filtering state
- `ShopCatalogTreeRootRow`
  - renders the Top Level tree row, root summary, root active/drop-target state, root expand toggle, and root pointer/drag/drop event forwarding
- `ShopCatalogTreeNodeRow`
  - renders catalog category/item rows, category expansion, archived state, drag/drop state, and inline create/rename controls while the route owns tree actions
- `ShopCatalogRootInspector`
  - renders root catalog overview counts and desktop/touch guidance for opening catalog actions
- `ShopCatalogCreateCategoryPanel`
  - renders create-folder fields, parent folder selection, active toggle, and create action while the route owns validation and persistence
- `ShopCatalogCreateItemPanel`
  - renders create-item description/folder/SKU/price/active fields and create action while the route owns price normalization, validation, and persistence
- `ShopCatalogCategoryDetailPanel`
  - renders selected-folder edit fields, path/summary metadata, save/archive-or-restore/delete actions, and delete-disabled state while the route owns validation and persistence
- `ShopCatalogItemDetailPanel`
  - renders selected-item edit fields, path/SKU/price metadata, save/archive-or-restore/delete actions, and price input events while the route owns price normalization, validation, and persistence
- `ShopCatalogConfirmDialog`
  - renders the dynamic archive/restore/delete confirmation dialog while the route/composables own the selected action and dispatcher
- `ShopCatalogPageShell`
  - feature-level page shell for the Shop Catalog admin route
  - composes `AppShell` and `ShopCatalogExplorerShell` while preserving route-owned catalog/inspector/context-menu/default dialog slots
- `ShopCatalogExplorerShell`
  - owns the admin catalog two-pane explorer grid, mobile catalog/inspector panel state classes, pane wrappers, and `shop-catalog-page` test-id shell while the route/composables own catalog records, selection, tree editing, drag/drop, create/save/archive/delete, and confirmation workflows

Current composables:

- `useShopCatalogContextMenu`
  - covered by `src/__tests__/useShopCatalogContextMenu.spec.ts`
  - owns context-menu visibility, viewport-aware positioning, touch/pen long-press behavior, drag-blocking state, suppressed-click windows, pointer capture release, and timer cleanup shared by Shop Catalog admin and Shop Order catalog browser
- `useShopCatalogTreeExpansion`
  - covered by `src/__tests__/useShopCatalogTreeExpansion.spec.ts`
  - owns root/category expansion state, archive-aware expand-all, collapse-all, ancestor expansion, context-menu cleanup for tree expansion actions, and neutral archive-filter ref input
- `useShopCatalogTreeDisplayState`
  - covered by `src/__tests__/useShopCatalogTreeDisplayState.spec.ts`
  - owns root count/summary derivation, root bucket child detection, detail parent-folder options, and visible tree node construction from expansion/search/archive/create state
- `useShopCatalogTreeInteractions`
  - covered by `src/__tests__/useShopCatalogTreeInteractions.spec.ts`
  - owns root, root-bucket, category, and item click/open behavior, suppressed long-press click handling, global pointer menu cleanup, and Escape drag/menu cleanup
- `useShopCatalogContextMenuTargets`
  - covered by `src/__tests__/useShopCatalogTreeInteractions.spec.ts`
  - owns root/category/item context-menu and long-press target mapping while blocking draft-node context menus
- `useShopCatalogContextMenuActions`
  - covered by `src/__tests__/useShopCatalogContextMenuActions.spec.ts`
  - owns root/folder/item context-menu action lists, single-pane inspect actions, create/rename/archive/delete action wiring, archive-vs-restore labels, child-aware folder delete disabling, and expand/collapse disabled-state derivation through neutral state refs
- `useShopCatalogContextDeleteActions`
  - covered by `src/__tests__/useShopCatalogContextMenuActions.spec.ts`
  - owns context-menu delete target selection before opening the shared confirmation flow
- `useShopCatalogConfirmDialog`
  - covered by `src/__tests__/useShopCatalogConfirmFlow.spec.ts`
  - owns catalog-specific confirmation copy, destructive-state derivation, confirmation action state, and busy close protection on top of the shared action-confirm primitive
- `useShopCatalogConfirmDispatcher`
  - covered by `src/__tests__/useShopCatalogConfirmFlow.spec.ts`
  - owns routing confirmed archive/delete category/item actions to the matching workflow handlers
- `useShopCatalogArchiveActions`
  - covered by `src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts`
  - owns selected folder/item archive-request adapters, folder/item archive and restore confirmation creation, descendant folder/item active-state cascading, update service payloads, hidden archived selection fallback, restore reselection, and archive error cleanup
- `useShopCatalogDeleteActions`
  - covered by `src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts`
  - owns category/item delete confirmation creation, child-folder delete blocking, delete service calls, post-delete selection fallback, and delete error cleanup
- `useShopCatalogForms`
  - covered by `src/__tests__/useShopCatalogFormWorkflows.spec.ts`
  - owns create/detail category/item form state, active-folder resets, selected record hydration, create item parent preparation, price input/focus/blur normalization, and neutral active-folder/message ref inputs
- `useShopCatalogFormActions`
  - covered by `src/__tests__/useShopCatalogFormWorkflows.spec.ts`
  - owns create/save validation, create/update service payloads, create/save loading state, category expansion updates, selected inspector updates, and create/detail success/error messaging
- `useShopCatalogDragDrop`
  - covered by `src/__tests__/useShopCatalogDragDropMoveActions.spec.ts`
  - owns valid drag source detection, root/folder/item drop-target validation, drag hover state, duplicate-drop blocking, drag-state cleanup, and move-error forwarding
- `useShopCatalogTreeAutoScroll`
  - covered by `src/__tests__/useShopCatalogTreeAutoScroll.spec.ts`
  - owns pointer-threshold auto-scroll, animation-frame scheduling, scroll clamping, safe-zone cancellation, no-drag no-op behavior, and non-scrollable list cleanup for the Shop Catalog tree
- `useShopCatalogResponsivePanel`
  - covered by `src/__tests__/useShopCatalogResponsivePanel.spec.ts`
  - owns Shop Catalog admin mobile panel state, catalog-first defaults, breakpoint-driven single-pane detection, custom breakpoint support, inspector shortcuts, and no-window fallback behavior
- `useShopCatalogAdminLifecycle`
  - covered by `src/__tests__/useShopCatalogAdminLifecycle.spec.ts`
  - owns Shop Catalog admin mount-time layout sync and catalog subscription startup plus unmount cleanup for context menus, tree auto-scroll, and catalog record listeners
- `useShopCatalogMoveActions`
  - covered by `src/__tests__/useShopCatalogDragDropMoveActions.spec.ts`
  - owns folder/item reparenting service payloads, moved record expansion and selection, top-level success copy, missing-target no-ops, and drag move error normalization
- `useShopCatalogInlineEditing`
  - covered by `src/__tests__/useShopCatalogInlineActions.spec.ts`
  - owns inline create/rename state, create/rename mutual exclusion, reset helpers, node-state checks, input refs, and focus/select behavior
- `useShopCatalogInlineActions`
  - covered by `src/__tests__/useShopCatalogInlineActions.spec.ts`
  - owns create-item inspector routing, inline create parent expansion, inline create service payloads, pending item-id selection fallback, inline rename target selection, rename no-op guards, category/item rename payloads, and create/rename failure recovery
- `useShopCatalogSelection`
  - covered by `src/__tests__/useShopCatalogSelection.spec.ts`
  - owns active-folder state, inspector key state, selected category/item lookup through neutral catalog refs, inspector-mode derivation, root/folder/item selection behavior, and optional inspector/expansion suppression
- `useShopCatalogSelectionSync`
  - covered by `src/__tests__/useShopCatalogSelection.spec.ts`
  - owns selected category/item form hydration, create-mode form resets, one-time root tree initialization, stale active-folder cleanup, stale selected-folder cleanup, and selected-item fallback as live catalog records change
- `useShopCatalogDerivedData`
  - covered by `src/__tests__/useShopCatalogDerivedData.spec.ts`
  - owns category/id indexes, sorted child category/item maps, archive-aware visible counts, direct/visible child counts, category path resolution, and category option label construction
- `useShopCatalogInspectorSummary`
  - covered by `src/__tests__/useShopCatalogDerivedData.spec.ts`
  - owns selected folder title/path/summary/child-state labels and selected item title/path/SKU/price labels with empty and fallback copy
- `useShopCatalogRecords`
  - covered by `src/__tests__/useShopCatalogRecords.spec.ts`
  - owns shared category/item listener startup, records state, loading-mode semantics, listener replacement cleanup, idempotent stop behavior, listener error normalization, and startup failure recovery for Shop Catalog Admin and Shop Orders

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
The scaffold intentionally reuses `ReferenceListPageShell`, `PagePanel`, and `ModulePlaceholder` so the route does not grow bespoke placeholder CSS or fake pre-CRUD components.

Current components:

- `ReferenceListPageShell`
  - scaffold-level page shell for Reference List routes
  - composes `AppShell`, `PagePanel`, and `ModulePlaceholder` while `ReferenceListView` only resolves the route title through the reference-list helper

Needed components when implemented:

- `ReferenceListEditor`
- `ReferenceListItemRow`
- `ReferenceListCreateForm`

Do not create fake component complexity before the feature exists.

## Shared Composables Needed

### `useAutosaveQueue`

For field-heavy pages that save after typing or commit events.

Use cases:

- job detail autosave
- user detail autosave
- daily log draft autosave
- shop order metadata

Current implementation:

- `src/composables/useAutosaveQueue.ts`
- first consumer is Jobs detail autosave
- ID-keyed workflows such as timecard cards and shop-order item notes keep their specialized queues until a keyed adapter is intentionally designed

Responsibilities:

- debounce saves
- track scheduled, saving, queued, error, and last-saved state
- queue a second save if a save is already in flight
- expose clear, flush, run-now, reset, and dispose helpers
- preserve feature-owned dirty snapshot and remote echo guards rather than owning them directly

### `useCommitAutosave`

For simpler edit forms that save on blur/change.

Use cases:

- users
- employees
- job metadata
- catalog detail forms

### `useAppToast` and `useToastMessages`

Shared app feedback wrapper around PrimeVue toast messages.

Status:

- `src/composables/useAppToast.ts`
- `src/composables/useToastMessages.ts`
- covered by `src/__tests__/useAppToast.spec.ts`
- current consumers include auth, Jobs, Users, Employees, Daily Logs, Shop Orders, and Shop Catalog admin routes

Responsibilities:

- keep all toast messages in the app toast group
- trim and suppress blank details
- preserve feature-specific summaries when provided
- provide severity-specific convenience helpers
- turn message refs into toasts without repeatedly showing unchanged messages
- optionally clear consumed message refs so route state stays tidy

### `useMeasuredCardScale`

Shared card canvas measurement and scale helper for fixed-layout documents rendered inside responsive app panes.

Status:

- `src/composables/useMeasuredCardScale.ts`
- covered by `src/__tests__/useMeasuredCardScale.spec.ts`
- current consumers are job Timecards and Timecard Export

Responsibilities:

- measure shell widths and fixed content sizes with `ResizeObserver`
- normalize Vue template refs through the shared template-ref resolver before observing elements
- calculate scale transforms without stretching fixed-layout workbook/card internals
- calculate shell heights from measured content height and scale
- prune measurements when cards leave the visible set
- disconnect observers during cleanup

### `useWindowEventListener`

Shared lifecycle helper for route/component-owned global browser events.

Status:

- `src/composables/useWindowEventListener.ts`
- covered by `src/__tests__/useWindowEventListener.spec.ts`
- current consumers are Shop Catalog admin and Shop Order catalog browser

Responsibilities:

- register window listeners on mount
- remove the same listener/options on unmount
- keep pointer, keyboard, and resize behavior feature-owned while lifecycle cleanup is reusable

### `useTemplateElementRef`

Shared template-ref normalizer for route/component-owned DOM-only refs.

Status:

- `src/composables/useTemplateElementRef.ts`
- covered by `src/__tests__/useTemplateElementRef.spec.ts`
- current consumers are Shop Catalog admin tree-list auto-scroll/list-ref contracts, `AppInlineInput` input-ref forwarding, Timecard Export status carousel refs, and Timecard card measurement refs

Responsibilities:

- accept Vue template refs that may be DOM elements, component instances, or null
- retain only DOM elements matching a page-supplied type guard
- provide shared HTML element guards for repeated DOM-ref cases such as `div` and `input`
- expose a pure resolver for indexed/array refs where a composable-owned single ref is not the right shape
- clear non-matching elements, component instances, and null refs
- keep DOM-ref normalization out of route shells while page-owned behavior stays local

### `useRouteJobContext`

Shared route/job-store convention for every job-scoped page.

Status:

- `src/composables/useRouteJobContext.ts`
- covered by `src/__tests__/useRouteJobContext.spec.ts`
- current consumers are Job Dashboard, Daily Logs, Shop Orders, and job Timecards

Responsibilities:

- resolve `jobId` from the current Vue Router params
- expose the selected job from the jobs store
- prefer the active `currentJob` subscription when it matches the route
- fall back to the visible jobs list while the current-job listener catches up
- expose subscribe/stop helpers for route-job lifecycle composables

### `useCurrentActor`

Shared current-user actor derivation for route shells that need to stamp workflow writes.

Status:

- `src/composables/useCurrentActor.ts`
- covered by `src/__tests__/useCurrentActor.spec.ts`
- current consumers are Daily Logs and Shop Orders

Responsibilities:

- expose the current user id as a reactive ref
- derive actor display name from app display name first, then auth email
- return a stable `{ userId, displayName }` actor payload for feature composables
- keep auth-store/Firebase imports out of shared helper code

### Firebase import boundary

Frontend Firebase SDK access should stay inside services. Stores, route views, layouts, router guards, components, feature helpers, and shared composables should consume service APIs instead of importing Firebase directly.

Status:

- `src/services/firebaseConfig.ts` owns the app-level Firebase configuration flag used by public auth views
- `src/services/auth.ts` owns Firebase Auth session subscription, password sign-in, sign-out, user-profile hydration, and profile snapshot subscription wrappers used by the auth store
- covered by `src/__tests__/architectureBoundaries.spec.ts`

Responsibilities:

- keep route views, layouts, router guards, stores, components, feature helpers, and shared composables from importing `@/firebase` or Firebase SDK packages directly
- let services normalize Firebase/config/auth-session details before route shells and stores consume them
- keep `src/stores/auth.ts` focused on Pinia state orchestration, profile hydration retry policy, sign-out cleanup, active-user enforcement, E2E auth state, and capability derivation

### Component dependency boundary

Components should render UI and emit user intent. They should not import service or store modules directly.

Status:

- covered by `src/__tests__/architectureBoundaries.spec.ts`
- `src/components/**` is currently service-free and store-free

Responsibilities:

- keep persistence, subscriptions, and cross-page state orchestration in views, stores, feature composables, or services
- pass data into components through props and pass user intent out through events
- create feature composables or thin route/container wrappers when a component needs workflow behavior that reaches services or stores

### `useDirectoryEditorPanels`

Shared mobile split-panel navigation for directory/editor admin pages.

Status:

- `src/composables/useDirectoryEditorPanels.ts`
- covered by `src/__tests__/useDirectoryEditorPanels.spec.ts`
- current consumers are Users and Employees

Responsibilities:

- expose the active `directory` / `editor` mobile panel
- expose shared mobile tab definitions with an optional directory label for page-specific copy
- switch panels from mobile tab events while ignoring unknown panel keys
- move directory record selections into the editor panel
- move create actions into the editor panel and run page-owned create cleanup

### `useConfirmAction`

Optional helper for pages that have enough repeated confirmation state to justify a composable.

Responsibilities:

- expose one consistent confirmation API
- compose cleanly with the existing `ConfirmDialog`
- keep action-specific labels, messages, and busy state testable through real dialog UI

### `useRecipientEditor`

Shared recipient add/remove normalization and duplicate behavior.

Status:

- started as `src/composables/useRecipientEditor.ts`
- shared lower-level recipient normalization/add/remove helpers still live in `recipientEmails`
- current workflow consumers are Jobs notification recipients and Daily Log additional recipients
- persistence, feature-specific messages, and save permissions stay in the feature composables

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

- `RecipientEditor` - covered by `src/__tests__/RecipientEditor.spec.ts`
- `AuthCard`, `AuthFirebaseConfigWarning`, `AuthStatusMessage`, `AuthSubmitButton`, `AuthTextLink`, `PagePanel`, and `ModulePlaceholder` - covered by `src/__tests__/FoundationalComponents.spec.ts`
- `AppBadge` - covered by `src/__tests__/AppBadge.spec.ts`
- `AppButton` - covered by `src/__tests__/AppButton.spec.ts`
- `AppButtonLink` - covered by `src/__tests__/AppButtonLink.spec.ts`
- `AppCheckbox` - covered by `src/__tests__/AppCheckbox.spec.ts`
- `AppDateInput` - covered by `src/__tests__/AppDateInput.spec.ts`
- `AppEmptyState` - covered by `src/__tests__/AppEmptyState.spec.ts`
- `AppField` - covered by `src/__tests__/AppField.spec.ts`
- `AppIconButton` - covered by `src/__tests__/AppIconButton.spec.ts`
- `AppInlineInput` - covered by `src/__tests__/AppInlineInput.spec.ts`
- `AppLinkCard` - covered by `src/__tests__/AppLinkCard.spec.ts`
- `AppListButton` - covered by `src/__tests__/AppListButton.spec.ts`
- `AppLoadingButton` - covered by `src/__tests__/AppLoadingButton.spec.ts`
- `AppMobilePanelTabs` - covered by `src/__tests__/AppMobilePanelTabs.spec.ts`
- `DirectoryEditorWorkspaceShell` - covered by `src/__tests__/DirectoryEditorWorkspaceShell.spec.ts`; owns the shared Users/Employees admin directory/editor app-shell, mobile-tab, split-workspace, attr-forwarding, slot, and tab-selection contract
- `AppCard` - covered by `src/__tests__/AppCard.spec.ts`; owns the shared card shell contract including root tag selection, attrs/class passthrough, and explicit density/elevation/tone visual variant classes
- `AppEntityHeader` - covered by `src/__tests__/AppEntityHeader.spec.ts`
- `AppPane` - covered by `src/__tests__/AppPane.spec.ts`; owns the shared pane shell contract including root tag selection, attrs/class passthrough, and explicit density/elevation/tone visual variant classes
- `AppPaneHeader` - covered by `src/__tests__/AppPaneHeader.spec.ts`
- `AppReadonlyField` - covered by `src/__tests__/AppReadonlyField.spec.ts`
- `AppSectionHeader` - covered by `src/__tests__/AppSectionHeader.spec.ts`
- `AppSearchInput` - covered by `src/__tests__/AppSearchInput.spec.ts`
- `AppSelect` - covered by `src/__tests__/AppSelect.spec.ts`
- `AppSplitWorkspace` - covered by `src/__tests__/AppSplitWorkspace.spec.ts`; owns shared primary/secondary workspace slots, active mobile-panel classes, fixed/equal/single layout modes, compact/default/spacious density classes, custom panel keys, primary-width styling, and attrs passthrough
- `AppStatusMessage` - covered by `src/__tests__/AppStatusMessage.spec.ts`
- `AppTextInput` - covered by `src/__tests__/AppTextInput.spec.ts`
- `AppTextarea` - covered by `src/__tests__/AppTextarea.spec.ts`; uses the shared text-entry DOM event helper and owns textarea focus/color/font CSS-variable hooks for feature-specific form polish
- `ImageUploadPicker` - covered by `src/__tests__/ImageUploadPicker.spec.ts`
- `UserConfirmDialogs` - covered by `src/__tests__/UserConfirmDialogs.spec.ts`
- `UserDirectoryPanel` - covered by `src/__tests__/UserDirectoryPanel.spec.ts`
- `UserAssignedJobsPanel` - covered by `src/__tests__/UserAssignedJobsPanel.spec.ts`
- `UserEditorPanel` - covered by `src/__tests__/UserEditorPanel.spec.ts`
- `EmployeeConfirmDialogs` - covered by `src/__tests__/EmployeeConfirmDialogs.spec.ts`
- `EmployeeDirectoryPanel` - covered by `src/__tests__/EmployeeDirectoryPanel.spec.ts`
- `EmployeeEditorPanel` - covered by `src/__tests__/EmployeeEditorPanel.spec.ts`
- `JobsWorkspaceShell` - covered by `src/__tests__/JobsWorkspaceShell.spec.ts`
- `JobBrowserPanel` - covered by `src/__tests__/JobBrowserPanel.spec.ts`
- `JobDetailsFormFields` - covered by `src/__tests__/JobDetailsFormFields.spec.ts`
- `JobFieldUserAssignmentPanel` - covered by `src/__tests__/JobFieldUserAssignmentPanel.spec.ts`
- `JobNotificationRecipientsPanel` - covered by `src/__tests__/JobNotificationRecipientsPanel.spec.ts`
- `JobAdminDetailPane` - covered by `src/__tests__/JobAdminDetailPane.spec.ts`
- `JobConfirmDialogs` - covered by `src/__tests__/JobConfirmDialogs.spec.ts`
- `TimecardConfirmDialog` - covered by `src/__tests__/TimecardConfirmDialog.spec.ts`
- `TimecardPageShell` - covered by `src/__tests__/TimecardPageShell.spec.ts`; composes the app shell, timecard workspace shell, forwarded attrs, workspace slot, and default dialog slot
- `TimecardWorkspaceShell` - covered by `src/__tests__/TimecardWorkspaceShell.spec.ts`
- `TimecardPageMessages` - covered by `src/__tests__/TimecardPageMessages.spec.ts`
- `TimecardPageMessage` - covered by `src/__tests__/TimecardPageMessage.spec.ts`
- `TimecardToolbarShell` - covered by `src/__tests__/TimecardToolbarShell.spec.ts`
- `TimecardToolbarPanel` - covered by `src/__tests__/TimecardToolbarPanel.spec.ts`
- `TimecardToolbarSignal` - covered by `src/__tests__/TimecardToolbarSignal.spec.ts`
- `TimecardButton` - covered by `src/__tests__/TimecardButton.spec.ts`
- `TimecardToolbarTabs` - covered by `src/__tests__/TimecardToolbarTabs.spec.ts`
- `TimecardSortModePicker` - covered by `src/__tests__/TimecardSortModePicker.spec.ts`
- `TimecardSummaryPanel` - covered by `src/__tests__/TimecardSummaryPanel.spec.ts`
- `JobTimecardToolbar` - covered by `src/__tests__/JobTimecardToolbar.spec.ts`
- `JobTimecardWeekPanel` - covered by `src/__tests__/JobTimecardWeekPanel.spec.ts`
- `JobTimecardSearchPanel` - covered by `src/__tests__/JobTimecardSearchPanel.spec.ts`
- `JobTimecardSortPanel` - covered by `src/__tests__/JobTimecardSortPanel.spec.ts`
- `JobTimecardActionsPanel` - covered by `src/__tests__/JobTimecardActionsPanel.spec.ts`
- `JobTimecardSavedWeeksPanel` - covered by `src/__tests__/JobTimecardSavedWeeksPanel.spec.ts`
- `JobTimecardStatusBar` - covered by `src/__tests__/JobTimecardStatusBar.spec.ts`
- `JobTimecardCreateTray` - covered by `src/__tests__/JobTimecardCreateTray.spec.ts`
- `TimecardExportCreateTray` - covered by `src/__tests__/TimecardExportCreateTray.spec.ts`
- `TimecardCustomCardFields` - covered by `src/__tests__/TimecardCustomCardFields.spec.ts`
- `TimecardExportWeekFiltersPanel` - covered by `src/__tests__/TimecardExportWeekFiltersPanel.spec.ts`
- `TimecardExportArchiveFiltersPanel` - covered by `src/__tests__/TimecardExportArchiveFiltersPanel.spec.ts`
- `TimecardExportSortPanel` - covered by `src/__tests__/TimecardExportSortPanel.spec.ts`
- `TimecardExportActionsPanel` - covered by `src/__tests__/TimecardExportActionsPanel.spec.ts`
- `TimecardExportSavedWeeksPanel` - covered by `src/__tests__/TimecardExportSavedWeeksPanel.spec.ts`
- `TimecardExportStatusBar` - covered by `src/__tests__/TimecardExportStatusBar.spec.ts`
- `TimecardExportToolbar` - covered by `src/__tests__/TimecardExportToolbar.spec.ts`
- `JobTimecardCustomCardPanel` - covered by `src/__tests__/JobTimecardCustomCardPanel.spec.ts`
- `TimecardExportCustomCardPanel` - covered by `src/__tests__/TimecardExportCustomCardPanel.spec.ts`
- `TimecardEmployeePicker` - covered by `src/__tests__/TimecardEmployeePicker.spec.ts`
- `JobTimecardEmployeePanel` - covered by `src/__tests__/JobTimecardEmployeePanel.spec.ts`
- `TimecardExportEmployeePanel` - covered by `src/__tests__/TimecardExportEmployeePanel.spec.ts`
- `TimecardExportTargetPanel` - covered by `src/__tests__/TimecardExportTargetPanel.spec.ts`
- `TimecardWorkbookHeader` and `TimecardWorkbookFooter` - covered by `src/__tests__/TimecardWorkbookHeaderFooter.spec.ts`
- `TimecardWorkbookCard` - covered by `src/__tests__/TimecardWorkbookCard.spec.ts`
- `TimecardPrintRouteContent` - covered by `src/__tests__/TimecardPrintRouteContent.spec.ts`; owns the Timecard Export print-route screen toolbar, missing-payload state, page/card shells, one-card empty slot, and exact copied route print CSS while leaving `TimecardPrintCard` as the protected card renderer
- `TimecardPrintCard` - covered by `src/__tests__/TimecardPrintCard.spec.ts`
- `TimecardCanvasPanel` - covered by `src/__tests__/TimecardCanvasPanel.spec.ts`
- `JobTimecardCanvasPanel` - covered by `src/__tests__/JobTimecardCanvasPanel.spec.ts`
- `TimecardExportCanvasPanel` - covered by `src/__tests__/TimecardExportCanvasPanel.spec.ts`
- `DailyLogTextSection` - covered by `src/__tests__/DailyLogTextSectionCard.spec.ts`
- `DailyLogPageShell` - covered by `src/__tests__/DailyLogPageShell.spec.ts`; composes the app shell, Daily Log workspace shell, forwarded attrs, header/main/sidebar slots, and default dialog slot
- `DailyLogWorkspaceShell` - covered by `src/__tests__/DailyLogWorkspaceShell.spec.ts`; owns the Daily Log page header/main/sidebar slot layout, responsive two-column grid, and page test-id passthrough
- `DailyLogMainColumn` - covered by `src/__tests__/DailyLogMainColumn.spec.ts`
- `DailyLogConfirmDialogs` - covered by `src/__tests__/DailyLogConfirmDialogs.spec.ts`
- `ShopCatalogConfirmDialog` - covered by `src/__tests__/ShopCatalogConfirmDialog.spec.ts`
- `ShopCatalogPageShell` - covered by `src/__tests__/ShopCatalogPageShell.spec.ts`; composes the app shell, catalog explorer shell, forwarded attrs, mobile-nav/catalog/inspector/context-menu slots, and default dialog slot
- `ShopCatalogExplorerShell` - covered by `src/__tests__/ShopCatalogExplorerShell.spec.ts`
- `ShopCatalogInspectorPane` - covered by `src/__tests__/ShopCatalogInspectorPane.spec.ts`
- `ShopCatalogMobileNav`, `ShopCatalogTreeFilters`, and `ShopCatalogTreeHeader` - covered by `src/__tests__/ShopCatalogNavigation.spec.ts`
- `ShopCatalogTreePane` - covered by `src/__tests__/ShopCatalogTreePane.spec.ts`
- `ShopCatalogRootInspector`, `ShopCatalogCreateCategoryPanel`, `ShopCatalogCreateItemPanel`, `ShopCatalogCategoryDetailPanel`, and `ShopCatalogItemDetailPanel` - covered by `src/__tests__/ShopCatalogInspectorPanels.spec.ts`
- `ShopCatalogContextMenu`, `ShopCatalogTreeRootRow`, and `ShopCatalogTreeNodeRow` - covered by `src/__tests__/ShopCatalogTreeComponents.spec.ts`
- `ShopOrderPageShell` - covered by `src/__tests__/ShopOrderPageShell.spec.ts`; composes the app shell, Shop Order explorer shell, forwarded attrs, catalog/workspace slots, and default dialog slot
- `ShopOrderExplorerShell` - covered by `src/__tests__/ShopOrderExplorerShell.spec.ts`
- `ShopOrderCatalogBrowser` - covered by `src/__tests__/ShopOrderCatalogBrowser.spec.ts`
- `ShopOrderCatalogTree` - covered by `src/__tests__/ShopOrderCatalogTreeComponent.spec.ts`; owns Shop Order catalog root/category/item tree rendering, loading/empty states, context-menu markup, row-level pending disablement, and event forwarding while `ShopOrderCatalogBrowser` keeps workflow state and persistence
- `ShopOrderCatalogTreeNodeRow` - covered by `src/__tests__/ShopOrderCatalogTreeNodeRow.spec.ts`
- `ShopOrderCustomItemForm` - covered by `src/__tests__/ShopOrderCustomItemForm.spec.ts`
- `ShopOrderItemsEditor` - covered by `src/__tests__/ShopOrderItemsEditor.spec.ts`
- `ShopOrderHistoryList` - covered by `src/__tests__/ShopOrderHistoryList.spec.ts`
- `ShopOrderMetaForm` - covered by `src/__tests__/ShopOrderMetaForm.spec.ts`
- `ShopOrderSelectedOrderPanel` - covered by `src/__tests__/ShopOrderSelectedOrderPanel.spec.ts`
- `ShopOrderWorkspaceHeader` - covered by `src/__tests__/ShopOrderWorkspaceHeader.spec.ts`
- `ShopOrderWorkspaceSection` - covered by `src/__tests__/ShopOrderWorkspaceSection.spec.ts`
- `ShopOrderWorkspacePane` - covered by `src/__tests__/ShopOrderWorkspacePane.spec.ts`
- `ShopOrderConfirmDialogs` - covered by `src/__tests__/ShopOrderConfirmDialogs.spec.ts`
- `SaveStatusIndicator` - covered by `src/__tests__/SaveStatusIndicator.spec.ts`

### Composable tests

Good candidates:

- `useAutosaveQueue` - first implementation covered by `src/__tests__/useAutosaveQueue.spec.ts`; Jobs detail autosave is the first consumer
- `useAppToast` and `useToastMessages` - covered by `src/__tests__/useAppToast.spec.ts`; shared PrimeVue toast/message-ref helpers for app-group payloads, severity defaults, feature summaries, clearing behavior through neutral writable message-ref inputs, and filtered messages
- `useJobsViewState` - covered by `src/__tests__/useJobsViewState.spec.ts`; owns Jobs page derived state for visible jobs, selected-job lookup, create/all-jobs modes, all-jobs entry visibility, status counts, field-user filtering/sorting, job type options, and GC suggestions
- `useJobsCapabilities` - covered by `src/__tests__/useJobsCapabilities.spec.ts`; owns Jobs page capability derivation for setup affordances and selected-job edit access
- `useJobsSelectionSync` - covered by `src/__tests__/useJobsSelectionSync.spec.ts`; owns Jobs page selected-job watcher behavior, form hydration/reset rules, visible-list selection fallback, create/all-jobs mode preservation, edit-drawer defaulting, and autosave cleanup
- `useJobsNavigationActions` - covered by `src/__tests__/useJobsNavigationActions.spec.ts`; owns Jobs page create/edit drawer navigation, create-form reset, all-jobs default selection, create-mode preservation, edit-mode row selection, and dashboard routing outside edit mode
- `useJobDetailForm` - covered by `src/__tests__/useJobDetailForm.spec.ts`; owns Jobs page selected-job detail form hydration/reset, notification recipient hydration, validation, explicit save handoff, autosave scheduling/gating, status copy, and dirty local field protection from stale remote echoes
- `useJobCreateForm` - covered by `src/__tests__/useJobCreateForm.spec.ts`; owns Jobs page create-job defaults, field updates, create notification recipient state, recipient input state, full resets, assigned-foreman cleanup, and create-message cleanup
- `useJobCrudActions` - covered by `src/__tests__/useJobCrudActions.spec.ts`; owns Jobs page create/save/archive/restore/delete persistence payloads, loading-state cleanup, post-delete selection fallback, and service error forwarding
- `useJobNotificationRecipients` - covered by `src/__tests__/useJobNotificationRecipients.spec.ts`; owns Jobs page create/job/all-jobs recipient add/remove workflows, validation, duplicate handling, selected-job/global persistence, save-state cleanup, service error forwarding, and neutral message/selected-job/global-recipient ref inputs
- `useJobsAdminSubscriptions` - covered by `src/__tests__/useJobsAdminSubscriptions.spec.ts`; owns Jobs page admin-only user/all-jobs-recipient subscription startup, live updates, restart cleanup, explicit stop cleanup, and subscription error forwarding
- `useJobsLifecycle` - covered by `src/__tests__/useJobsLifecycle.spec.ts`; owns Jobs page mount/unmount lifecycle order for jobs/admin subscription startup, detail autosave cleanup, and subscription cleanup
- `useJobsSideEffects` - covered by `src/__tests__/useJobsSideEffects.spec.ts`; owns Jobs page detail-form autosave scheduling from top-level/nested edits and jobs subscription error forwarding without duplicate/empty messages
- `useJobConfirmDialogs` - covered by `src/__tests__/useJobConfirmDialogs.spec.ts`; owns Jobs page archive/restore/delete confirmation state, selected-job copy, neutral selected-job ref input, no-selection guards, manual close helpers, and busy-state close prevention
- `useJobDashboardLifecycle` - covered by `src/__tests__/useJobDashboardLifecycle.spec.ts`; owns Job Dashboard route-job subscription startup, route-job id resubscription, route-job subscription cleanup, and neutral route-job id ref input
- `useUserFormState` and `useEmployeeFormState` - covered by `src/__tests__/useAdminFormState.spec.ts`; own Users and Employees admin create/detail form defaults, field/toggle updates, selected-record hydration, selected-record snapshot/dirty-check helpers, sync-state flags, role-based assignment cleanup, and reset/error-message callbacks
- `useUserCreateActions`, `useUserDetailActions`, and `useEmployeeActions` - covered by `src/__tests__/useAdminActions.spec.ts`; own Users and Employees admin create validation, service payloads, invite sending, autosave gating, selected-record dirty checks, Users assigned-job toggle/autosave behavior, delete confirmation handoff, busy-state cleanup, and error/info message forwarding
- `useUserAdminRecords`, `useEmployeeAdminRecords`, `useUserAdminViewSync`, and `useEmployeeAdminViewSync` - covered by `src/__tests__/useAdminRecordsSync.spec.ts`; own Users and Employees admin listener startup/error/cleanup behavior, stale selected-record fallback, mount/unmount subscription wiring, selected-record hydration triggers, clear-before-hydrate behavior, detail message reset behavior, and shared neutral ref contracts for selection inputs
- `useUserAdminViewState` and `useEmployeeAdminViewState` - covered by `src/__tests__/useAdminViewState.spec.ts`; own Users and Employees admin filtered directory lists, selected-record lookup, create-mode state, status counts, assignment option filtering, pending invite counts, passive-save success-toast filtering, and delete confirmation copy
- `authViewHelpers` - covered by `src/__tests__/authViewHelpers.spec.ts`; owns public auth route validation copy, email query prefill, forgot-password target building, password-created login info derivation, workspace redirect gating, and setup-link query parsing used by Login, Forgot Password, and Set Password routes
- `targetRoleCapabilities` - covered by `src/__tests__/targetRoleCapabilities.spec.ts`; documents the target Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access capability matrix as a non-runtime planning seam until the live role/rules/functions implementation is ready
- `targetRouteCapabilities` - covered by `src/__tests__/targetRouteCapabilities.spec.ts`; documents target protected-route capability metadata and workspace access without changing current Vue Router or AppShell navigation yet
- `targetRouteAccess` - covered by `src/__tests__/targetRouteAccess.spec.ts`; documents target router redirect decisions for public entry routes, protected workspace access, route capabilities, and job-scoped target dashboard access without changing current Vue Router behavior yet
- `targetAppShellNavigation` - covered by `src/__tests__/targetAppShellNavigation.spec.ts`; documents target AppShell workspace/admin navigation, role-dashboard entry, and target role-label copy without changing current live sidebar rendering yet
- `targetJobAssignments` - covered by `src/__tests__/targetJobAssignments.spec.ts`; centralizes target assigned-job membership checks so target job access, field-email, and timecard policies share the same job-id guard
- `targetJobAccess` - covered by `src/__tests__/targetJobAccess.spec.ts`; documents target job-list visibility, job-dashboard entry, job setup editing, job creation, and job delete/archive policy as a non-runtime planning seam for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users
- `targetFieldWorkflowAccess` - covered by `src/__tests__/targetFieldWorkflowAccess.spec.ts`; documents target Daily Log and Shop Order module viewing separately from create/edit/submit rights so PM assigned-job access stays view-first unless explicitly expanded
- `targetFieldEmailRecipients` - covered by `src/__tests__/targetFieldEmailRecipients.spec.ts`; documents target automatic Daily Log and Shop Order field-email recipient policy for assigned Foremen, Shop Foremen, and Project Managers without changing live email delivery yet
- `targetTimecardAccess` - covered by `src/__tests__/targetTimecardAccess.spec.ts`; documents target timecard export/lock/delete-draft access separately from job workflow edit/submit access and Project Manager submitted-timecard reporting
- `roleDashboardModules` - covered by `src/__tests__/roleDashboardModules.spec.ts`; documents the target role-dashboard module set using the target capability matrix without exposing target roles in live routing yet
- `appShellNavigation` - covered by `src/__tests__/appShellNavigation.spec.ts`; owns current AppShell workspace/admin navigation items and role-label copy while delegating route visibility to the current capability matrix, giving future role-dashboard navigation a tested policy seam
- `routeAccess` - covered by `src/__tests__/routeAccess.spec.ts`; owns pure router access decisions for public-route redirects, workspace access, route capability metadata, assigned-job route access, visible-job fallback access, and the temporary unassigned-timecard route exception while `src/router/index.ts` only wires Vue Router, auth/jobs stores, and document titles
- `timecardPrintViewHelpers` - covered by `src/__tests__/timecardPrintViewHelpers.spec.ts`; owns Timecard Export print-route export-id query parsing, two-card page chunking, generated timestamp formatting, and missing-payload copy while `TimecardPrintCard` keeps exact card visual fidelity
- `useTimecardPrintRoute` - covered by `src/__tests__/useTimecardPrintRoute.spec.ts`; owns Timecard Export print-route stored-payload loading, missing-payload state, print scheduling, duplicate-print guards, and paged-card derivation while `TimecardExportPrintView` focuses on loading/composing `TimecardPrintRouteContent`
- `referenceListViewHelpers` - covered by `src/__tests__/referenceListViewHelpers.spec.ts`; owns Reference List route-key normalization, unknown-key fallback behavior, and admin reference-list title copy used by `ReferenceListView`
- `jobViewHelpers` - covered by `src/__tests__/jobViewHelpers.spec.ts` and the Jobs composable specs; owns Jobs route-adjacent helper behavior including detail autosave success-toast filtering so passive save messages stay out of the route shell
- `shopOrderViewHelpers` - covered by `src/__tests__/shopOrderViewHelpers.spec.ts`; owns Shop Orders route-adjacent success-toast filtering so the route shell does not duplicate quiet background-save/item-added message rules
- `useMeasuredCardScale` - covered by `src/__tests__/useMeasuredCardScale.spec.ts`; shared ResizeObserver-backed card measurement/scaling helper for Timecards and Timecard Export fixed-layout card canvases
- `useWindowEventListener` - covered by `src/__tests__/useWindowEventListener.spec.ts`; shared mount/unmount helper for feature-owned window pointer, keyboard, and resize listeners
- `useTemplateElementRef` - covered by `src/__tests__/useTemplateElementRef.spec.ts`; shared Vue template-ref element normalizer for DOM-only refs, with Shop Catalog admin/tree-pane list refs using it for the tree-list auto-scroll container contract, `AppInlineInput` using it for input-ref forwarding, Timecard Export status-bar refs using its pure resolver, and Timecard card measurement refs using the same resolver path
- `useRouteJobContext` - covered by `src/__tests__/useRouteJobContext.spec.ts`; shared job-scoped route helper for resolving route job ids, selected jobs, route-job subscriptions, and cleanup
- `useCurrentActor` - covered by `src/__tests__/useCurrentActor.spec.ts`; shared store-free current actor helper for user id derivation, display-name priority, email fallback, null fallback, and reactive source changes used by Daily Logs and Shop Orders
- `useDirectoryEditorPanels` - covered by `src/__tests__/useDirectoryEditorPanels.spec.ts`; shared directory/editor mobile-panel navigation and tab-definition helper for Users and Employees create/select/tab transitions
- `useShopCatalogContextMenu` - covered by `src/__tests__/useShopCatalogContextMenu.spec.ts`; shared context-menu positioning, touch/pen long-press, drag-blocking, suppressed-click, and cleanup helper for Shop Catalog admin and Shop Order catalog browser
- `useShopCatalogTreeExpansion` - covered by `src/__tests__/useShopCatalogTreeExpansion.spec.ts`; owns Shop Catalog admin root/category expansion, ancestor expansion, archive-aware expand-all, collapse-all, context-menu cleanup, and neutral archive-filter ref input
- `useShopCatalogTreeDisplayState` - covered by `src/__tests__/useShopCatalogTreeDisplayState.spec.ts`; owns Shop Catalog admin root summaries, parent options, search/archive/create-aware tree nodes, and root bucket visibility state
- `useShopCatalogTreeInteractions` and `useShopCatalogContextMenuTargets` - covered by `src/__tests__/useShopCatalogTreeInteractions.spec.ts`; own Shop Catalog admin click/open handling, suppressed long-press click behavior, Escape cleanup, and root/category/item context-menu target mapping
- `useShopCatalogContextMenuActions` and `useShopCatalogContextDeleteActions` - covered by `src/__tests__/useShopCatalogContextMenuActions.spec.ts`; own Shop Catalog admin root/folder/item menu action derivation, create/rename/archive/delete wiring, child-aware delete disabling, neutral context state ref inputs, and context-delete selection
- `useShopCatalogConfirmDialog` and `useShopCatalogConfirmDispatcher` - covered by `src/__tests__/useShopCatalogConfirmFlow.spec.ts`; own catalog-specific confirmation copy/destructive state, busy close protection, and archive/delete confirm dispatch routing
- `useShopCatalogArchiveActions` and `useShopCatalogDeleteActions` - covered by `src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts`; own Shop Catalog admin selected-record archive/restore request adapters, archive/restore cascading, update/delete service payloads, hidden archived selection fallback, restore reselection, child-folder delete blocking, and delete fallback selection
- `useShopCatalogForms` and `useShopCatalogFormActions` - covered by `src/__tests__/useShopCatalogFormWorkflows.spec.ts`; own Shop Catalog admin form state/hydration, price normalization, neutral active-folder/message ref inputs, validation, create/save service payloads, expansion/selection updates, and success/error messaging
- `useShopCatalogDragDrop` and `useShopCatalogMoveActions` - covered by `src/__tests__/useShopCatalogDragDropMoveActions.spec.ts`; own Shop Catalog admin drag source/drop target validation, drag hover/drop cleanup, duplicate-drop blocking, category/item reparenting service payloads, post-move expansion/selection updates, and move error messaging
- `useShopCatalogTreeAutoScroll` - covered by `src/__tests__/useShopCatalogTreeAutoScroll.spec.ts`; owns Shop Catalog admin drag auto-scroll thresholds, animation-frame scheduling, scroll clamping, no-drag no-ops, safe-zone cancellation, and non-scrollable list cleanup
- `useShopCatalogResponsivePanel` - covered by `src/__tests__/useShopCatalogResponsivePanel.spec.ts`; owns Shop Catalog admin responsive panel state, catalog-first mobile defaults, breakpoint sync, custom breakpoint support, catalog/inspector switching, and no-window fallback behavior
- `useShopCatalogAdminLifecycle` - covered by `src/__tests__/useShopCatalogAdminLifecycle.spec.ts`; owns Shop Catalog admin mount-time layout sync, catalog subscription startup ordering, context-menu disposal, tree auto-scroll cleanup, and catalog listener cleanup on unmount
- `useShopCatalogInlineEditing` and `useShopCatalogInlineActions` - covered by `src/__tests__/useShopCatalogInlineActions.spec.ts`; own Shop Catalog admin inline create/rename state, create-item inspector routing, parent expansion, focus/select behavior, inline create/rename service payloads, pending item selection fallback, no-op guards, and failure recovery
- `useShopCatalogSelection` and `useShopCatalogSelectionSync` - covered by `src/__tests__/useShopCatalogSelection.spec.ts`; own Shop Catalog admin active-folder/inspector selection state, selected record lookup through neutral catalog refs, form hydration, create-mode form resets, root tree initialization, and stale record cleanup as live catalog records change
- `useShopCatalogDerivedData` and `useShopCatalogInspectorSummary` - covered by `src/__tests__/useShopCatalogDerivedData.spec.ts`; own Shop Catalog admin category/item indexes, sorted child maps, archive-aware counts, path labels, parent options, selected folder metadata, selected item metadata, and fallback summary copy
- `useShopCatalogRecords` - covered by `src/__tests__/useShopCatalogRecords.spec.ts`; owns shared Shop Catalog category/item subscription state, default and category-or-items loading semantics, listener replacement cleanup, idempotent stop behavior, and normalized listener/startup errors for Shop Catalog admin and Shop Orders
- `useSubscribedRecords` and `useSubscribedValue` - covered by `src/__tests__/subscribedHelpers.spec.ts`; shared Firebase-style listener state helpers for list/value loading, update, error, restart, and unsubscribe behavior; `useSubscribedValue` intentionally returns a Vue `Ref` because callers pass the value directly into Vue templates that rely on ref unwrapping
- `useDailyLogFormState` - covered by `src/__tests__/useDailyLogFormState.spec.ts`; owns Daily Log selected-date initialization, selected-log id state, empty payload initialization, E2E/real-clock today formatting, and text-field updates
- `useDailyLogSelectionState` - covered by `src/__tests__/dailyLogSelectionState.spec.ts`; owns visible log filtering, selected-log lookup, next-selection fallback rules, edit/create permissions, create-button labels, title text, and site-info derivation
- `useDailyLogPayloadPreparer` - covered by `src/__tests__/useDailyLogPayloadPreparer.spec.ts`; owns the prepared Daily Log payload callback consumed by draft-save, attachment, and submit workflows through neutral form/site-info refs
- `useDailyLogDraftSave` - covered by `src/__tests__/useDailyLogDraftSave.spec.ts`; owns Daily Log dirty snapshots, explicit draft saves, text-field save-on-blur behavior, and neutral editability/form/selection ref inputs
- `useDailyLogActions` - covered by `src/__tests__/useDailyLogActions.spec.ts`; owns Daily Log explicit draft creation, existing-draft reuse, draft save messaging, submit validation/status/email handling, delete confirmation, attachment cleanup, and workflow loading flags
- `useDailyLogDateNavigation` - covered by `src/__tests__/useDailyLogDateNavigation.spec.ts`; owns selected-date reset behavior, reset-to-today action, job-change route/log resubscription, and duplicate date-reset subscription prevention
- `useDailyLogRepeaters` - covered by `src/__tests__/useDailyLogRepeaters.spec.ts`; owns manpower and indoor-climate add/remove/update behavior, read-only guards, missing-index no-ops, blank-row resets, and manpower user attribution
- `useDailyLogRecipients` - covered by `src/__tests__/useDailyLogRecipients.spec.ts`; owns Daily Log admin/default recipient derivation, additional-recipient filtering, normalized add/remove persistence, local selected-log updates through neutral log-list refs, and read-only/no-selection guards
- `useDailyLogAttachments` - covered by `src/__tests__/useDailyLogAttachments.spec.ts`; owns Daily Log attachment section grouping, upload validation, Storage upload/delete coordination, draft payload persistence through neutral form/job/selection refs, saved-payload snapshot refreshes, section busy flags, and read-only/no-selection guards
- `useDailyLogFormHydration` - covered by `src/__tests__/useDailyLogFormHydration.spec.ts`; owns Daily Log selected-log hydration, empty-form resets, recipient input clearing, clean remote update hydration, unsaved local edit protection, saved-echo skips, and editable-only job/user snapshot field refreshes
- `useDailyLogSubscriptions` - covered by `src/__tests__/useDailyLogSubscriptions.spec.ts`; owns Daily Log recipient-default subscription start/stop, selected-date log subscription calls, delegated visible-log selection recovery, all-log viewer selection preservation, no-job guards, and subscription error state
- `useDailyLogSubscriptionLifecycle` - covered by `src/__tests__/useDailyLogSubscriptionLifecycle.spec.ts`; owns Daily Log mount-time recipient-default startup, route/log subscription startup when a job id exists, no-job startup guards, date-navigation route-change delegation, and unmount cleanup
- `dailyLogs/viewHelpers` - covered by `src/__tests__/dailyLogViewHelpers.spec.ts`; owns pure Daily Log payload/site-info formatting helpers used by the payload-preparer composable and display components
- `useJobTimecardWeekSelectionActions` - covered by `src/__tests__/useJobTimecardWeekSelectionActions.spec.ts`; owns job Timecard week-row selection, typed week-ending normalization to Saturday, pending-save flush before week/date changes, create-tray closing, explicit selected-week clearing, blank date handling, and native date-picker opening
- `useJobTimecardCreateActions` - covered by `src/__tests__/useJobTimecardCreateActions.spec.ts`; owns job Timecard employee/custom card creation, duplicate employee pages, next sort-index selection, selected-week/edit guards, custom-card validation, wage parsing, create-tray cleanup, card selection, scrolling, and create-failure reporting
- `useJobTimecardCreateTray` and `useJobTimecardConfirmDialog` - covered by `src/__tests__/useJobTimecardUiAdapters.spec.ts`; own job Timecard create-tray visibility, employee search, custom-card form reset behavior, confirmation copy/destructive state, and busy-state close prevention
- `useJobTimecardWeekActions` - covered by `src/__tests__/useJobTimecardWeekActions.spec.ts`; owns job Timecard create/open week orchestration, empty-draft backfill, ensure payload construction, duplicate in-flight guards, selected-week/date validation, loading cleanup, and week create/backfill failure reporting
- `useJobTimecardCardActions` - covered by `src/__tests__/useJobTimecardCardActions.spec.ts`; owns job Timecard delete/sort/submit action orchestration, confirmation payloads, pending-save flush ordering, card delete persistence, sort-index persistence, submit actor/email-result handling, confirmation dispatch, loading cleanup, and action failure reporting
- `useJobTimecardCardWorkspaceActions` - covered by `src/__tests__/useJobTimecardCardWorkspaceActions.spec.ts`; owns job Timecard workspace reset cleanup, page/save message reset, visible-card UI pruning, read-only derivation, scroll-to-card behavior, workbook-change total recalculation, card selection, and save scheduling
- `useJobTimecardWorkspaceSync` - covered by `src/__tests__/useJobTimecardWorkspaceSync.spec.ts`; owns job Timecard watcher side effects for selected-week card subscriptions, selected-date backfill/reset, route-job resubscription, subscribed-job backfill triggers, burden refresh guards, and visible-card selection synchronization
- `useJobTimecardSubscriptionLifecycle` - covered by `src/__tests__/useJobTimecardSubscriptionLifecycle.spec.ts`; owns job Timecard mount/unmount subscription startup/cleanup, route-job subscription helper, week subscription guard, selected-week card subscription startup, empty-week card/loading cleanup, save queue disposal, and measurement cleanup
- `useJobTimecardAccess` - covered by `src/__tests__/useJobTimecardAccess.spec.ts`; owns job Timecards route-level workflow/report access derivation, job-record assignment repair, Shop-job identity input, and manager/current-user/submitted-report week-subscription mode selection
- `useJobTimecardSaveQueue` - covered by `src/__tests__/useJobTimecardSaveQueue.spec.ts`; owns job Timecard save gating for editable selected weeks and adapts the shared save queue to `updateTimecardCard` with selected week id, selected week start date, card payload, and burden context
- `useJobTimecardWorkspaceState` - covered by `src/__tests__/useJobTimecardWorkspaceState.spec.ts`; owns job Timecard selected-week/date derivation, card and employee filters, editable/create guards, burden fallback, and recent-week slicing
- `useJobTimecardSummary` - covered by `src/__tests__/useJobTimecardSummary.spec.ts`; owns job Timecard account summaries, card totals, week range/status labels, job/week fallback labels, linked job number, save-state copy, and empty-canvas guidance
- `useJobTimecardRecords` - covered by `src/__tests__/useJobTimecardRecords.spec.ts`; owns job Timecard employee/week/card subscription adapter construction, foreman-vs-manager week scoping, selected-week card subscription burden context, remote-card merge protection against pending local save state, loading state, unsubscribe behavior, and records error fallback forwarding
- `useTimecardExportFilters` - covered by `src/__tests__/useTimecardExportFilters.spec.ts`; owns Timecard Export current-week defaults, date-mode and toolbar filter normalization, Saturday date snapping, range-bound derivation, and week filtering by date/job/foreman/status/search
- `useTimecardExportVisibleCards` - covered by `src/__tests__/useTimecardExportVisibleCards.spec.ts`; owns Timecard Export active create-week card lookup, missing-target guards, card search, and filtered-card ordering by name or employee number
- `useTimecardExportSummary` - covered by `src/__tests__/useTimecardExportSummary.spec.ts`; owns Timecard Export totals, account-summary aggregation, visible week/package/job/foreman/status labels, save/status signal derivation, empty-canvas messages, PDF subtitle text, and CSV filename derivation
- `useTimecardExportCreateContext` - covered by `src/__tests__/useTimecardExportCreateContext.spec.ts`; owns Timecard Export job options, foreman filter options, active foreman/project-manager user filtering, assignable foreman options, employee search, create target-week resolution, owner context, and create-tray guidance
- `useTimecardExportCreateDefaults` - covered by `src/__tests__/useTimecardExportCreateDefaults.spec.ts`; owns Timecard Export create-card job/foreman default selection policy for valid existing selections, target-week defaults, selected foreman filters, single-option fallbacks, and empty option clearing
- `useTimecardExportMutationActions` - covered by `src/__tests__/useTimecardExportMutationActions.spec.ts`; owns Timecard Export remove-card/delete-draft confirmation payloads, editable/export-capability guards, pending-save flush ordering, card/week delete persistence, archive cache cleanup, success/error messages, loading cleanup, and confirmation dispatch
- `useTimecardExportCreateActions` - covered by `src/__tests__/useTimecardExportCreateActions.spec.ts`; owns Timecard Export read-only and linked-job guards, existing/synthetic week creation, employee/custom card payloads, custom-card validation/trimming/wage rules, export filter synchronization, create-tray cleanup, edit-mode selection, scroll side effects, loading cleanup, and create failure messaging
- `useTimecardExportDownloadActions` - covered by `src/__tests__/useTimecardExportDownloadActions.spec.ts`; owns Timecard Export PDF/CSV empty guards, popup-blocked PDF messaging, pending-save flush ordering, PDF payload normalization/storage, print-route handoff, CSV build/download orchestration, no-detail-row messaging, success messages, and output failure fallbacks
- `useTimecardExportFilteredWeekSync` - covered by `src/__tests__/useTimecardExportFilteredWeekSync.spec.ts`; owns Timecard Export filtered-week signature watching, pending-save flushing before archive card-set changes, page/workspace reset ordering, archive card sync startup, ignored display-only week field changes, and stale async sync cancellation
- `useTimecardExportSideEffects` - covered by `src/__tests__/useTimecardExportSideEffects.spec.ts`; owns Timecard Export job production-burden signature watching, archive card redecorating, ordered-card id signature watching through a neutral ordered-card `ReadonlyRef` input, selected-card synchronization, and no-op behavior for display-only job/card content edits
- `useTimecardExportLifecycle` - covered by `src/__tests__/useTimecardExportLifecycle.spec.ts`; owns Timecard Export subscription startup order for jobs/weeks/employees/users and unmount cleanup order for the save queue, card measurements, week/card/employee/user subscriptions
- `useTimecardExportSubscriptions` - covered by `src/__tests__/useTimecardExportSubscriptions.spec.ts`; owns Timecard Export saved-week, employee, and foreman subscription adapter wiring, feature-specific error forwarding, archive week start/stop helpers, permission-gated employee/user subscription startup, denied-record clearing, and loading-state cleanup
- `useTimecardExportSaveQueue` - covered by `src/__tests__/useTimecardExportSaveQueue.spec.ts`; owns Timecard Export save gating for editable export weeks and adapts the shared save queue to `updateTimecardCard` with archive week id, archive week start date, archive card payload, and burden context
- `useTimecardExportUiState`, `useTimecardExportCreateTray`, and `useTimecardExportConfirmDialog` - covered by `src/__tests__/useTimecardExportUiAdapters.spec.ts`; own Timecard Export mobile tab state, admin card edit-mode gating/reset/pruning through a neutral edit-permission ref, create-tray field state, custom-card form reset behavior, and confirmation copy/close behavior
- `useActionConfirmDialog` - covered by `src/__tests__/useActionConfirmDialog.spec.ts`; owns shared action-confirm state, derived copy/destructive state, busy-safe close behavior, neutral writable action-ref output, and Vue `ComputedRef` outputs for template-unwrapped dialog copy
- `useTimecardExportCardWorkspaceActions` - covered by `src/__tests__/useTimecardExportCardWorkspaceActions.spec.ts`; owns Timecard Export workspace reset cleanup, page/save message reset, valid-card UI pruning, sorted selection synchronization, workbook-change total recalculation and save scheduling, smooth card scrolling, and employee-header lock rules
- `useTimecardExportArchiveCards` - covered by `src/__tests__/useTimecardExportArchiveCards.spec.ts`; owns Timecard Export per-week card subscription setup with burden resolution, late card-change handler registration for UI pruning/sync, loading state, archive card decoration, stale-week subscription cleanup, empty result resets, pending-local-state merge protection, burden redecorating, week-specific error forwarding, delete-week cache cleanup, sort-index derivation, and full subscription cleanup
- `exportViewHelpers` - covered by `src/__tests__/timecardExportViewHelpers.spec.ts`; owns Timecard Export route-level toolbar constants for date modes, week-status options, and the shared numeric/base collator consumed by the route shell and feature helpers
- `stateMapHelpers` - covered by `src/__tests__/timecardStateMapHelpers.spec.ts`; owns shared timecard state-map clearing/pruning helpers and pending save-state map collection used by job Timecards and Timecard Export subscription adapters
- `dirtySnapshotGuard` - covered by `src/__tests__/dirtySnapshotGuard.spec.ts`; Jobs detail hydration is the first consumer
- `optimisticRecords` - covered by `src/__tests__/optimisticRecords.spec.ts`; shop-order item persistence is the first consumer
- `usePendingActionMap` - covered by `src/__tests__/usePendingActionMap.spec.ts`; shop-order catalog item add rows are the first consumer
- `shopOrderCatalogTree` - covered by `src/__tests__/shopOrderCatalogTree.spec.ts`; `buildShopOrderCatalogTreeNodes` is the first protected feature tree helper
- `useShopOrderRecords` - covered by `src/__tests__/useShopOrderRecords.spec.ts`; owns current-job shop order subscription startup, explicit restart cleanup, listener/startup error normalization, local record replacement, and neutral job-id ref input
- `useShopOrderWorkspaceState` - covered by `src/__tests__/useShopOrderWorkspaceState.spec.ts`; owns selected-order lookup, draft/submitted grouping, editable/disabled state, category lookup, item counts, total quantity, and alphabetized selected-order item derivation
- `useShopOrderMetaForm` - covered by `src/__tests__/useShopOrderMetaForm.spec.ts`; owns selected-order metadata hydration, dirty remote-echo protection, delivery-date validation, debounced metadata persistence, saved-signature tracking, Thursday delivery shortcut behavior, and neutral selected-order/editability ref inputs
- `useShopOrderCustomItemForm` - covered by `src/__tests__/useShopOrderCustomItemForm.spec.ts`; owns custom-item form defaults and same-object reset behavior after successful saves
- `useShopOrderItemActions` - covered by `src/__tests__/useShopOrderItemActions.spec.ts`; owns catalog item add/merge, custom item validation/trimming/reset, draft-only quantity edits, and remove-confirm item filtering while keeping persistence injected
- `useShopOrderItemNotes` - covered by `src/__tests__/useShopOrderItemNotes.spec.ts`; owns item-note draft synchronization, debounced note saves, blur flushes, read-only/unchanged save suppression, queued saves while a prior note save is pending, and neutral selected-order ref input
- `useShopOrderDraftActions` - covered by `src/__tests__/useShopOrderDraftActions.spec.ts`; owns validated draft creation, selected/existing draft target reuse, item-target clone preparation, duplicate-draft blocking, and next-Thursday defaults
- `useShopOrderPersistence` - covered by `src/__tests__/useShopOrderPersistence.spec.ts`; owns metadata write callbacks, sorted item cloning, optimistic item replacement, rollback on failed saves, serialized item persistence, and loading/message side effects
- `useShopOrderSubmissionActions` - covered by `src/__tests__/useShopOrderSubmissionActions.spec.ts`; owns delete confirmation handling, submit preflight validation, metadata-save-before-confirm, submitted status persistence, email send handling, and loading/dialog side effects
- `useShopOrderSelectionSync` - covered by `src/__tests__/useShopOrderSelectionSync.spec.ts`; owns history order selection, delegated selected-order fallback, missing-selection reset, selected-order form/note-draft synchronization, same-order remote hydration decisions, metadata save queue triggers, and neutral order-list/selection ref inputs
- `useShopOrderSubscriptionLifecycle` - covered by `src/__tests__/useShopOrderSubscriptionLifecycle.spec.ts`; owns mount/change/unmount subscription starts and cleanup for route job, catalog records, order records, metadata timers, and note drafts
- `workbookNavigation` - covered by `src/__tests__/timecardWorkbookNavigation.spec.ts`; the timecard workbook is the first protected keyboard-navigation consumer
- `recipientEmails` - covered by `src/__tests__/recipientEmails.spec.ts`; Jobs and Daily Logs share add/remove preparation helpers while keeping persistence feature-owned
- `useRecipientEditor` - covered by `src/__tests__/useRecipientEditor.spec.ts`; Jobs and Daily Logs are the first consumers
- `shopOrderCatalogTree` - covered by `src/__tests__/shopOrderCatalogTree.spec.ts`; Shop Orders consume the helper for catalog category/item tree construction and search expansion behavior
- daily log submit validation - covered by `src/__tests__/dailyLogValidation.spec.ts`; Daily Logs consume the dedicated helper for required text-field, manpower-row, and indoor-climate-row submit validation
- `useTimecardSaveQueue` - covered by `src/__tests__/timecardSaveQueue.spec.ts`; job Timecards and Timecard Export consume feature-specific adapters around the shared save queue

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
