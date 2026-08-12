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
- foreman admin-surface denial for Users, Employees, Timecard Export, and Shop Catalog
- payroll route restrictions, employee create/edit access, Timecard Export access, job creation access, read-only job lookup after creation, and field-workflow denial
- shop foreman catalog access, real-route catalog create/edit behavior, restricted admin navigation, read-only all-job lookup, dashboard-to-`Shop` job workflow access, Shop Daily Logs/Timecards access without explicit assignment, and non-Shop workflow denial
- project manager assigned-job edit access, assigned-job dashboard shortcut visibility, submitted-timecard report access, and direct unassigned-dashboard denial
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
- Shop Foreman catalog management through the real Shop Catalog route
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
- long-order PDF smoke proves the PDF spans multiple pages and continuation table headers redraw at the top page margin
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
- smoke asserts the attached-PDF renderer receives employee name, employee number, occupation, wage, and week-ending data

## Future Test Additions

### Security Rules Emulator Tests

Add first tests around:

- admin-only collections and routes
- foreman assigned-job access
- payroll employee create/edit and Timecard Export access, job creation access, and job delete/archive denial
- shop foreman shop catalog management access, `Shop` job workflow access, read-only all-job lookup, and job delete/archive denial
- project manager assigned-job edit access and unassigned-job denial
- project manager submitted-timecard reporting for assigned jobs only
- assigned Foremen, Shop Foremen, and Project Managers included in Daily Log and Shop Order email recipient resolution
- submitted/read-only records
- timecard export/lock permissions
- daily log attachment Storage paths

### Component Tests

Current coverage:

- `src/__tests__/RecipientEditor.spec.ts` covers the shared recipient editor public contract: `AppSectionHeader`-backed title/hint/count rendering, editable input updates, add/remove events, disabled behavior, read-only/default recipient rendering, empty labels, and placeholders.
- `src/__tests__/JobDashboardComponents.spec.ts` covers the extracted Job Dashboard presentation contract: workspace shell slot/test-id rendering, module card links/test ids, module grid route construction, selected-job metadata, and missing-job empty state.
- `src/__tests__/useJobDashboardLifecycle.spec.ts` covers the Job Dashboard lifecycle contract: mount-time route-job subscription startup, route-job id resubscription, same-id no-op behavior, and route-job subscription cleanup on unmount.
- `src/__tests__/JobsWorkspaceShell.spec.ts` covers the Jobs route shell contract: admin edit-mode topbar action copy/events, single/equal workspace mode selection, field-user edit-control hiding, attr forwarding, and primary/secondary/default slot rendering.
- `src/__tests__/AppMobilePanelTabs.spec.ts` covers the shared responsive panel-tab primitive contract: tablist labeling, active tab state, and emitted panel keys.
- `src/__tests__/AppSplitWorkspace.spec.ts` covers the shared split-workspace primitive contract: tabs/primary/secondary slot rendering, active mobile panel classes, custom panel keys, primary-width styling, fixed/equal/single layout mode classes, compact/default/spacious density classes, and attrs passthrough.
- `src/__tests__/DirectoryEditorWorkspaceShell.spec.ts` covers the shared Users/Employees directory-editor workspace shell contract: AppShell composition, split-workspace attr forwarding, directory/editor panel keys, mobile tab copy/state, primary/secondary/default slot rendering, and tab-selection emits.
- `src/__tests__/AppStatusMessage.spec.ts` covers the shared status-message primitive contract: default status rendering, error alert rendering, and empty-state non-rendering.
- `src/__tests__/AppEmptyState.spec.ts` covers the shared empty-state primitive contract: title/message rendering and slot fallback rendering.
- `src/__tests__/AppBadge.spec.ts` covers the shared badge primitive contract: slot rendering, default tone, accent/success/danger/warning tone classes, attrs, title passthrough, custom class passthrough, and feature CSS-variable override support for sizing/no-wrap/tone behavior through public class passthrough.
- `src/__tests__/AppButton.spec.ts` covers the shared button primitive contract: default safe button type, slot rendering, variants, submit/reset types, attrs/class passthrough, disabled behavior, and native click passthrough.
- `src/__tests__/AppField.spec.ts` covers the shared field-wrapper primitive contract: label rendering, no-label rendering, default slot rendering, help slot rendering, attrs, `for` passthrough, and custom class passthrough.
- `src/__tests__/AppLoadingButton.spec.ts` covers the shared loading button primitive contract: normal/loading labels, fallback loading copy, disabled and `aria-busy` behavior, primary/success/danger/ghost variants, attrs/class passthrough, explicit button types, native click passthrough, and slot override behavior.
- `src/__tests__/AppButtonLink.spec.ts` covers the shared button-link primitive contract: RouterLink target passthrough, slot rendering, base/variant button classes, route-location object passthrough, and attrs/class passthrough.
- `src/__tests__/AppCheckbox.spec.ts` covers the shared checkbox primitive contract: checked state binding, boolean model updates, native change event passthrough, attrs, disabled state, accessible labels, and custom class passthrough.
- `src/__tests__/AppDateInput.spec.ts` covers the shared date-input primitive contract: fixed `type="date"` rendering, value binding, model update events, native input events, attrs, min/max passthrough, native listener passthrough, disabled state, and custom class passthrough.
- `src/__tests__/AppIconButton.spec.ts` covers the shared icon-button primitive contract: accessible labels, title fallback/override, safe default button type, success/danger variants, explicit submit/reset types, attrs/class passthrough, disabled behavior, and native click passthrough.
- `src/__tests__/AppInlineInput.spec.ts` covers the shared inline-input primitive contract: default text rendering, value binding, model/native input events, commit on blur/Enter, cancel on Escape, attr passthrough, disabled state, input-ref forwarding, and custom class passthrough.
- `src/__tests__/AppLinkCard.spec.ts` covers the shared card-link primitive contract: RouterLink target passthrough, route-location object passthrough, slot rendering, attrs, and custom class passthrough.
- `src/__tests__/AppListButton.spec.ts` covers the shared list-row button primitive contract: slot rendering, active and dashed state classes, safe default button type, explicit submit/reset types, attrs/class passthrough, disabled behavior, and native click passthrough.
- `src/__tests__/AppCard.spec.ts` covers the shared card shell primitive contract: default article rendering, alternate root tags, slot content, attrs, accessible labels, custom class passthrough, and explicit density/elevation/tone visual variant classes.
- `src/__tests__/AppEntityHeader.spec.ts` covers the shared selected-record header primitive contract: eyebrow/title rendering, title tag selection, optional actions slot rendering, identity class passthrough, root attrs, and custom class passthrough.
- `src/__tests__/AppPane.spec.ts` covers the shared pane shell primitive contract: default section rendering, alternate root tags, slot content, attrs, accessible labels, custom class passthrough, and explicit density/elevation/tone visual variant classes.
- `src/__tests__/AppPaneHeader.spec.ts` covers the shared pane-header primitive contract: eyebrow/title rendering, heading tag selection, optional actions slot rendering, optional description prop/slot rendering, root attrs, and custom class passthrough.
- `src/__tests__/AppReadonlyField.spec.ts` covers the shared read-only field primitive contract: slot content rendering, multiline state, attr passthrough, title passthrough, and custom class merging.
- `src/__tests__/AppSectionHeader.spec.ts` covers the shared compact section-header primitive contract: default span title rendering, title tag selection, optional eyebrow rendering, optional action slot rendering, description prop/slot rendering, root attrs, and custom class passthrough.
- `src/__tests__/AppSearchInput.spec.ts` covers the shared search-input primitive contract: search type rendering, value and placeholder binding, default and explicit accessible labels, model update events, attrs, disabled state, and custom class passthrough.
- `src/__tests__/AppSelect.spec.ts` covers the shared select primitive contract: option slot rendering, string/number value binding, model update events, attrs, disabled state, accessible labels, and custom class passthrough.
- `src/__tests__/AppTextInput.spec.ts` covers the shared text-input primitive contract: default and explicit input types, string/number value binding, model update events, native input event passthrough, attrs, disabled/read-only state, placeholders, and custom class passthrough.
- `src/__tests__/AppTextarea.spec.ts` covers the shared textarea primitive contract: value binding, model update events through the shared text-entry DOM helper, native input event passthrough, attrs, disabled/read-only state, row/placeholder passthrough, and custom class passthrough.
- `src/__tests__/domEvents.spec.ts` covers shared DOM text-entry value reads for text inputs, textareas, and non-text-entry fallback behavior.
- `src/__tests__/ConfirmDialog.spec.ts` covers the shared confirmation dialog component contract: open/closed rendering, accessible dialog labeling, cancel/confirm events, destructive styling, and busy-state action lockout.
- `src/__tests__/SaveStatusIndicator.spec.ts` covers the shared autosave status primitive contract: hidden idle state, saving copy, saved success tone, custom copy, and scoped-slot override behavior.
- `src/__tests__/FoundationalComponents.spec.ts` covers the foundational presentation contracts for `AuthCard`, `AuthFirebaseConfigWarning`, `AuthStatusMessage`, `AuthSubmitButton`, `AuthTextLink`, `PagePanel`, and `ModulePlaceholder`: auth heading/copy/slot rendering, optional auth copy suppression, shared Firebase configuration warning copy/tone, auth status chrome and inherited status role/tone behavior, auth submit button default submit/loading behavior, auth text-link route target/chrome behavior, page-panel header prop forwarding/body slot rendering, and module placeholder highlight rendering.
- `src/__tests__/UserConfirmDialogs.spec.ts` covers the Users confirmation dialog grouping contract: delete-user copy, destructive intent, busy-state passthrough, close events, and confirm events.
- `src/__tests__/EmployeeConfirmDialogs.spec.ts` covers the Employees confirmation dialog grouping contract: delete-employee copy, destructive intent, busy-state passthrough, close events, and confirm events.
- `src/__tests__/DailyLogPageShell.spec.ts` covers the Daily Log page shell contract: app-shell composition, workspace-shell composition, forwarded attrs, header/main/sidebar slot rendering, and default dialog slot rendering.
- `src/__tests__/DailyLogWorkspaceShell.spec.ts` covers the Daily Log workspace shell contract: preserved page test id, header/main/sidebar slot rendering, and responsive layout wrapper rendering.
- `src/__tests__/DailyLogTextSectionCard.spec.ts` covers the daily-log text-section component contract: `AppSectionHeader`-backed section copy, field labels, values, row counts, placeholders, update events, blur events, and disabled state.
- `src/__tests__/DailyLogMainColumn.spec.ts` covers the daily-log main form composition contract: site/manpower/text/attachment/submit composition, saved-value test hooks, text-field forwarding, repeater action forwarding, submit events, and disabled state.
- `src/__tests__/DailyLogConfirmDialogs.spec.ts` covers the Daily Log confirmation dialog grouping contract: delete-draft copy, destructive intent, busy-state passthrough, close events, and confirm events.
- `src/__tests__/DailyLogHistoryList.spec.ts` covers the Daily Log history/date-search contract: loading and empty states, submitted/draft row labels, active selection class, unknown-foreman fallback, date update events, today navigation events, and selected-log events.
- `src/__tests__/DailyLogSelectedLogCard.spec.ts` and `src/__tests__/DailyLogSidebar.spec.ts` cover the Daily Log sidebar seam: selected-log summary/delete/empty states, delete busy state, fallback copy, sidebar child composition, recipient visibility, and parent-owned event forwarding for delete, recipients, history selection, today, and date changes.
- `src/__tests__/DailyLogManpowerCard.spec.ts` and `src/__tests__/DailyLogIndoorClimateCard.spec.ts` cover the Daily Log editable table-card contracts: schema-driven headers/placeholders, current row values, add/remove events, field update events, manpower count numeric conversion, and read-only disabled propagation.
- `src/__tests__/DailyLogSiteInfoCard.spec.ts` and `src/__tests__/DailyLogRecipientsCard.spec.ts` cover the Daily Log display/recipient card contracts: schema-driven site-info labels and blank fallbacks, narrow field-list rendering, admin-default recipient read-only wiring, additional-recipient disabled rules, and recipient input/add/remove event forwarding.
- `src/__tests__/DailyLogAttachmentCard.spec.ts` and `src/__tests__/DailyLogAttachmentSections.spec.ts` cover the Daily Log attachment card contracts: picker configuration/state passthrough, upload-handler passthrough, description commit/update/remove event forwarding, and Photos/PTP card label/helper/busy-state wiring.
- `src/__tests__/ImageUploadPicker.spec.ts` covers the shared image upload primitive contract used by Daily Logs: PrimeVue upload prop wiring, choose callback, upload-handler entry normalization, disabled/busy upload suppression, local upload error display/clear, saved attachment description/commit/remove events, preview lightbox behavior, and busy-state control locking.
- `src/__tests__/DailyLogPageHeader.spec.ts` covers the Daily Log page-header contract: title/action rendering, Save Draft/Create Draft events, save-button disabled rules, loading copy, saving-vs-unsaved badge priority, log-count badges, and past/future date view-only guidance.
- `src/__tests__/useDailyLogFormState.spec.ts` covers the Daily Log form-state contract: E2E/real-clock today formatting, selected-date initialization, selected-log id defaults, empty payload initialization, and text-field updates without disturbing unrelated payload state.
- `src/__tests__/dailyLogViewHelpers.spec.ts` covers Daily Log route helper payload preparation: current-form/current-site-info adapter creation, explicit payload overrides, site-info stamping, manpower summary generation, QC inspection trimming, and clone/no-mutation behavior.
- `src/__tests__/ShopCatalogConfirmDialog.spec.ts` covers the Shop Catalog dynamic confirmation dialog contract: title/message/label passthrough, destructive and non-destructive state, busy-state passthrough, close events, and confirm events.
- `src/__tests__/ShopCatalogPageShell.spec.ts` covers the Shop Catalog admin page shell contract: app-shell composition, explorer-shell composition, active panel forwarding, forwarded attrs, mobile-nav/catalog/inspector/context-menu slot rendering, and default dialog slot rendering.
- `src/__tests__/ShopCatalogExplorerShell.spec.ts` covers the Shop Catalog admin explorer shell contract: preserved page test id, mobile catalog/inspector state classes, named slots, and catalog/inspector pane wrappers.
- `src/__tests__/ShopCatalogInspectorPane.spec.ts` covers the Shop Catalog inspector switchboard contract: root/create-category/create-item/category-detail/item-detail branch selection, mobile hidden class, child prop forwarding, create/detail field events, price input/focus/blur events, archive/delete events, and submit event forwarding.
- `src/__tests__/ShopCatalogNavigation.spec.ts` covers the Shop Catalog navigation/filter/header contracts: search value/update events, show-archived state/update events, mobile catalog/inspector tab active state and events, tablist accessibility labels, and shared catalog heading copy.
- `src/__tests__/ShopCatalogTreePane.spec.ts` covers the Shop Catalog tree-pane composition contract: heading/filter rendering and updates, list ref wiring, loading/empty states, root row prop derivation, node-row active/drag/drop/create/rename/draggable prop derivation, root list/root bucket event forwarding, and node event forwarding with owning node payloads.
- `src/__tests__/ShopCatalogInspectorPanels.spec.ts` covers the Shop Catalog root/create/detail inspector panel contracts: root overview counts and action guidance, create-folder field/parent/active/submit events, create-item description/folder/SKU/price/active/submit events, nullable top-level selections, selected-folder detail metadata and save/archive/delete events, selected-item detail metadata and save/archive/delete events, price focus/blur/input forwarding, archive-vs-restore labels, delete-disabled rules, and loading locks.
- `src/__tests__/ShopCatalogTreeComponents.spec.ts` covers the Shop Catalog tree/context-menu contracts: context-menu visibility/position/actions/disabled-danger states, root row active/drop-target/summary/toggle/event forwarding, category row active/drag/drop/archive/summary/toggle state, item row non-category behavior, and inline create/rename update/commit/cancel forwarding.
- `src/__tests__/useShopCatalogTreeExpansion.spec.ts` covers the Shop Catalog tree-expansion composable contract behind neutral catalog/archive refs: root initialization, explicit root initialization input, ancestor expansion, missing-category no-ops, category/root toggles, visible-category filtering, archived-category inclusion, expand-all behavior, collapse-all behavior, and context-menu cleanup.
- `src/__tests__/useShopCatalogTreeDisplayState.spec.ts` covers the Shop Catalog tree-display composable contract: root counts and summaries, root bucket child detection, top-level draft nodes, expansion-driven tree rows, search through collapsed branches, archived-record visibility, parent-option descendant blocking, and reactivity to root expansion/create-state changes.
- `src/__tests__/useShopCatalogTreeInteractions.spec.ts` covers the Shop Catalog tree-interaction composable contracts: category/item open behavior, draft-node no-ops, suppressed long-press click handling, root/root-bucket click behavior, global pointer/Escape cleanup, context-menu target translation, draft context-menu prevention, and long-press target forwarding.
- `src/__tests__/useShopCatalogContextMenu.spec.ts` covers the shared Shop Catalog context-menu composable contract: viewport-aware positioning, browser-menu suppression, close behavior, touch long-press delayed opening, pointer capture release, suppressed-click windows, movement cancellation, mouse/pen pointer-state handling, and disposal cleanup.
- `src/__tests__/useShopCatalogContextMenuActions.spec.ts` covers the Shop Catalog context-menu action contracts behind neutral state refs: root/folder/item action lists, single-pane inspect actions, create/rename/archive/delete action wiring, archive-vs-restore labels, child-aware delete disabling, expand/collapse disabled-state derivation, and context delete-selection adapters.
- `src/__tests__/useShopCatalogConfirmFlow.spec.ts` covers the Shop Catalog confirm-flow composable contracts: catalog-specific archive/restore/delete titles, messages, labels, destructive-state derivation, busy close protection, safe fallback copy, and confirm-action dispatch routing to archive/delete handlers.
- `src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts` covers the Shop Catalog archive/delete workflow contracts: selected folder/item archive-vs-restore request adapters, folder archive cascading to descendants/items, service payloads, hidden archived selection fallback, restore reselection, item archive/restore inspector behavior, confirmation creation, child-folder delete blocking, category/item delete selection fallback, and error cleanup.
- `src/__tests__/useShopCatalogFormWorkflows.spec.ts` covers the Shop Catalog form workflow contracts behind neutral active-folder/message refs: create/detail form resets and hydration, price input/focus/blur normalization, requested-parent item creation prep, create validation blocking, create folder/item service payloads, create selection/expansion updates, save folder/item service payloads, item save folder preservation, success messaging, and error cleanup.
- `src/__tests__/useShopCatalogDragDropMoveActions.spec.ts` covers the Shop Catalog drag/drop and move workflow contracts: drag-start blocking, draft/create/rename drag suppression, serialized drag payloads, category/item drop-target validation, root/folder drop hover state, duplicate drop prevention, drag-state cleanup, move-error reporting, folder/item move service payloads, moved record expansion/selection updates, top-level success copy, and missing-target no-ops.
- `src/__tests__/useShopCatalogTreeAutoScroll.spec.ts` covers the Shop Catalog tree auto-scroll contract: bottom-threshold scrolling, top-threshold scrolling and clamping, safe-zone cancellation, no-drag no-op behavior, and non-scrollable list cleanup.
- `src/__tests__/useShopCatalogResponsivePanel.spec.ts` covers the Shop Catalog responsive panel contract: catalog-first defaults, default breakpoint sync, custom breakpoint sync, mobile panel switching, inspector shortcut behavior, and no-window fallback behavior.
- `src/__tests__/useShopCatalogAdminLifecycle.spec.ts` covers the Shop Catalog admin lifecycle contract: layout sync before subscription startup, catalog subscription startup, no premature cleanup, context-menu disposal, tree auto-scroll cleanup, catalog listener cleanup, and cleanup ordering on unmount.
- `src/__tests__/useShopCatalogInlineActions.spec.ts` covers the Shop Catalog inline edit workflow contracts: create/rename mutual exclusion and resets, create-item mode routing, inline create parent expansion and focus, inline rename target selection and focus, blank create/rename cancellation, inline folder/item create payloads, pending item-id fallback selection, create failure recovery, unchanged rename no-ops, folder rename payloads, item rename payloads with updated descriptions, and rename failure recovery.
- `src/__tests__/useShopCatalogSelection.spec.ts` covers the Shop Catalog selection and synchronization contracts behind neutral catalog refs: root defaults, root/folder/item selection behavior, optional inspector/expansion suppression, top-level item inspection, selected folder/item form hydration, create-mode form resets, one-time root tree initialization, stale active-folder cleanup, stale selected-folder cleanup, and selected-item fallback to the active folder or root as live catalog records change.
- `src/__tests__/useShopCatalogDerivedData.spec.ts` covers the Shop Catalog derived data and inspector-summary contracts: category/id indexes, parent-grouped sorted categories/items, archive-aware visible counts, direct and visible child counts, category path fallback behavior, parent option labels, live record reactivity, selected-folder title/path/summary/child state, selected-item title/path/SKU/price labels, and empty-selection fallbacks.
- `src/__tests__/useShopCatalogRecords.spec.ts` covers the shared Shop Catalog records subscription contract: category/item listener startup, default all-record loading, category-or-items loading mode, replacement subscription cleanup, idempotent listener cleanup, listener error normalization, custom fallback copy, and synchronous startup failure recovery.
- `src/__tests__/TimecardConfirmDialog.spec.ts` covers the shared Timecard confirmation dialog contract: dynamic title/message/label passthrough, destructive and non-destructive state, busy-state passthrough, close events, and confirm events.
- `src/__tests__/TimecardPageMessages.spec.ts` covers the shared Timecard page-feedback contract: error messages take priority over info messages, errors render as alerts, info renders as status, and empty state renders nothing.
- `src/__tests__/TimecardPageMessage.spec.ts` covers the shared Timecard page-feedback primitive contract: default messages render as status, error messages render as alerts with the error tone class, and empty messages render no markup.
- `src/__tests__/TimecardPageShell.spec.ts` covers the shared Timecard page shell contract: app-shell composition, workspace-shell composition, forwarded attrs, workspace slot rendering, and default dialog slot rendering.
- `src/__tests__/TimecardWorkspaceShell.spec.ts` covers the shared timecard workspace shell contract: preserved page test id, shared page/workbook wrapper classes, and slot rendering for job timecards and Timecard Export.
- `src/__tests__/TimecardToolbarShell.spec.ts` covers the shared timecard toolbar shell contract: semantic root selection, toolbar shell classes, custom root class passthrough, route-specific desktop stretch breakpoint class, and slot rendering.
- `src/__tests__/TimecardToolbarPanel.spec.ts` covers the shared timecard toolbar panel contract: fieldset/legend rendering, optional tabpanel id and `aria-labelledby` wiring, modifier classes, custom root class passthrough, route-specific collapse breakpoint classes, mobile-active classes, mobile always-visible status panels, and slot rendering.
- `src/__tests__/TimecardToolbarSignal.spec.ts` covers the shared timecard toolbar signal contract: default slot rendering, legacy `.timecards-signal` compatibility class, custom class passthrough, and success/error tone classes.
- `src/__tests__/TimecardButton.spec.ts` covers the shared timecard action-button primitive contract: default/submit/reset type handling, default/primary variants, slot rendering, forwarded attributes, disabled state, and custom class passthrough.
- `src/__tests__/TimecardToolbarTabs.spec.ts` covers the shared timecard mobile-tab primitive contract: tablist labeling, generated tab/panel ids, active tab state, alternate collapse breakpoint class, and selected-tab events.
- `src/__tests__/TimecardSortModePicker.spec.ts` covers the shared timecard sort-mode picker contract: Employee#/Name radio rendering, shared input name forwarding, checked state for both modes, and model update events.
- `src/__tests__/TimecardSummaryPanel.spec.ts` covers the shared timecard summary contract: parent-owned card/hour/production totals rendering with one-decimal formatting, account summary table headers/rows, missing-label dash fallbacks, and the empty account-total row.
- `src/__tests__/JobTimecardToolbar.spec.ts` covers the job Timecards toolbar composition contract: mobile tab definitions/state, child-panel mobile-active derivation, route-owned state forwarding, and week/search/action/sort/history event forwarding.
- `src/__tests__/JobTimecardWeekPanel.spec.ts` covers the job Timecards Week Filters panel contract: job number/name display values, selected week-ending date value, date input events, and picker-open events.
- `src/__tests__/JobTimecardSearchPanel.spec.ts` covers the job Timecards Card Filters panel contract: panel copy, search value forwarding, placeholder copy, and search update events.
- `src/__tests__/JobTimecardSortPanel.spec.ts` covers the job Timecards Sort Cards panel contract: selected sort mode forwarding, sort mode update events, sort action events, and loading/read-only/card-count disabled rules.
- `src/__tests__/JobTimecardActionsPanel.spec.ts` covers the job Timecards Workspace Actions panel contract: button copy, create-week visibility, loading/create-tray label variants, action events, and week/card disabled rules.
- `src/__tests__/JobTimecardSavedWeeksPanel.spec.ts` covers the job Timecards Saved Weeks panel contract: formatted week dates, submitted/draft labels, active row state, row test ids, empty/loading state, raw-date fallback, and week-selection events.
- `src/__tests__/JobTimecardStatusBar.spec.ts` covers the job Timecards Status panel contract: status signal copy, card-count rendering, submitted success tone, and save-error tone behavior.
- `src/__tests__/TimecardCustomCardFields.spec.ts` covers the shared custom-card field grid contract: field values, field update events, contractor checkbox updates, numeric wage input attributes, and disabled-state propagation.
- `src/__tests__/TimecardExportWeekFiltersPanel.spec.ts` covers the Timecard Export Week Filters panel contract: panel copy, week-search value/update events, date-mode selected value/update events, single week-ending value/update events, and range start/end date value/update events.
- `src/__tests__/TimecardExportArchiveFiltersPanel.spec.ts` covers the Timecard Export Archive Filters panel contract: panel copy, jobs/foreman/status selected values, job multi-select updates, foreman filter updates, and week-status filter updates.
- `src/__tests__/TimecardExportSortPanel.spec.ts` covers the Timecard Export Sort Cards panel contract: panel copy, sort picker selected value/update events, employee-search value/update events, and search placeholder forwarding.
- `src/__tests__/TimecardExportActionsPanel.spec.ts` covers the Timecard Export Workspace Actions panel contract: action button copy, primary export button variants, expand/compact events, PDF/CSV events, create-tray toggle events, permission-based create visibility, and loading disabled state.
- `src/__tests__/TimecardExportSavedWeeksPanel.spec.ts` covers the Timecard Export Saved Weeks panel contract: formatted saved-week rows, subtitles, draft/submitted labels, delete-draft permission and loading behavior, delete events, and empty/loading copy.
- `src/__tests__/TimecardExportStatusBar.spec.ts` covers the Timecard Export Status panel contract: desktop/mobile signal rendering, success/error tone passthrough, and initial mobile carousel control disabled state.
- `src/__tests__/TimecardExportToolbar.spec.ts` covers the Timecard Export toolbar composition contract: tab definitions/state, child-panel mobile-active derivation, route-owned filter/action/saved-week/status state forwarding, formatter forwarding, and filter/sort/export/create/delete event forwarding.
- `src/__tests__/JobTimecardCustomCardPanel.spec.ts` covers the job Timecards create-tray Custom Card panel contract: heading/eyebrow copy, field-state forwarding, field update events, contractor update events, primary add-button disabled state, and add-card events.
- `src/__tests__/TimecardExportCustomCardPanel.spec.ts` covers the Timecard Export create-tray Custom Card panel contract: heading copy, field-state forwarding, field update events, contractor update events, primary add-button disabled state, and add-card events.
- `src/__tests__/TimecardEmployeePicker.spec.ts` covers the shared timecard employee-picker contract: search rendering/updates, employee row rendering, row test-id prefixing, selected employee events, loading/empty states, and separate search/row disabled states.
- `src/__tests__/JobTimecardEmployeePanel.spec.ts` covers the job Timecards create-tray Employee Directory panel contract: heading copy, picker state forwarding, job-page row test-id prefixing, search update events, selected-employee add events, loading passthrough, and shared disabled behavior.
- `src/__tests__/TimecardExportEmployeePanel.spec.ts` covers the Timecard Export create-tray Employee Directory panel contract: heading copy, picker state forwarding, search update events, selected-employee add events, loading passthrough, and disabled search/row behavior.
- `src/__tests__/TimecardExportTargetPanel.spec.ts` covers the Timecard Export create-tray target selector contract: Week Target copy, linked-job/foreman selected values, target update events, no-foreman warning behavior, and disabled foreman selection for new target weeks without assigned foremen.
- `src/__tests__/JobTimecardCreateTray.spec.ts` covers the job Timecards create-tray composer contract: Employee Directory and Custom Card child-panel prop forwarding, disabled/read-only/loading forwarding, employee/custom-card event forwarding, and keeping workflow ownership outside the child panels.
- `src/__tests__/TimecardExportCreateTray.spec.ts` covers the Timecard Export create-tray composer contract: notice-only rendering, target/employee/custom panel prop forwarding, target readiness and add-disabled rules, loading/read-only disabled behavior, and target/employee/custom-card event forwarding.
- `src/__tests__/TimecardWorkbookHeaderFooter.spec.ts` covers the interactive timecard workbook header/footer contract: locked/editable employee identity rendering, wage filter/update/commit events, read-only header locking, footer job/account/office/amount/notes rendering, OT/REG display, footer field update events, and read-only footer locking.
- `src/__tests__/TimecardWorkbookCard.spec.ts` covers the interactive timecard workbook card contract: employee header/grid/footer rendering, workbook column headers, H/P/C row labels, line/account/day/off field updates, job-number cascade behavior, numeric draft preservation through blur, read-only input locking, and compact header-only mode.
- `src/__tests__/TimecardPrintRouteContent.spec.ts` covers the Timecard Export print-route content shell contract: screen toolbar copy/print action, stored-payload document rendering, card shell test ids, one-card empty slot, and missing-payload empty state while stubbing the protected exact card renderer.
- `src/__tests__/TimecardPrintCard.spec.ts` covers the exact-print timecard card contract: employee header/week-ending rendering, printable workbook column headers, H/P/C row values, calculated line/total hours, footer account rows, notes, regular/overtime values, and blank zero-only production/off cells.
- `src/__tests__/timecardPrintViewHelpers.spec.ts` covers Timecard Export print-route helpers for export-id query parsing, fixed two-card page chunking, generated timestamp formatting, custom page-size chunking, invalid page-size guarding, and missing-payload copy.
- `src/__tests__/timecardExportViewHelpers.spec.ts` covers Timecard Export route helper constants for toolbar date modes, week-status options, and the shared numeric/base collator used by export option/card ordering.
- `src/__tests__/referenceListViewHelpers.spec.ts` covers Reference List route helpers for route-key normalization, unknown/empty/array fallback behavior, and display titles.
- `src/__tests__/ReferenceListPageShell.spec.ts` covers the Reference List page-shell scaffold contract: app-shell composition, page-panel copy/title forwarding, placeholder copy, and fixed highlight text while the route stays helper-only.
- `src/__tests__/JobDashboardPageShell.spec.ts` covers the Job Dashboard page-shell contract: app-shell composition, workspace-shell composition, forwarded attrs, header/module slot rendering, and default slot passthrough.
- `src/__tests__/ShopOrderPageShell.spec.ts` covers the Shop Order page shell contract: app-shell composition, explorer-shell composition, forwarded attrs, catalog/workspace slot rendering, and default dialog slot rendering.
- `src/__tests__/ShopOrderExplorerShell.spec.ts` covers the shop-order explorer shell contract: preserved page test id, named catalog/workspace slots, shell class, and pane wrappers.
- `src/__tests__/ShopOrderItemsEditor.spec.ts` covers the shop-order items editor contract: editable item values, note drafts, quantity/note/remove events, custom item metadata, pending remove disablement, `AppReadonlyField`-backed submitted values, and empty/loading states.
- `src/__tests__/ShopOrderCatalogTreeNodeRow.spec.ts` covers the shop-order catalog tree row contract: category/root-style selection controls, expanded-state toggle behavior, context-menu events, item quantity updates, add events, and disabled item controls.
- `src/__tests__/ShopOrderCatalogTreeComponent.spec.ts` covers the shop-order catalog tree renderer contract: root/category/item row rendering, root and node event forwarding, quantity/add event forwarding, context-menu rendering/action events, loading/empty states, and row-level pending item disablement.
- `src/__tests__/ShopOrderCatalogBrowser.spec.ts` covers the shop-order catalog browser/container contract: active entry counts, inactive entry filtering, search-time folder collapse/expand behavior, item quantity add calls, quantity reset after successful add, row-level pending add disablement, and disabled item controls.
- `src/__tests__/ShopOrderCustomItemForm.spec.ts` covers the shop-order custom-item form contract: current field values, description/quantity/note update events, submit events, whole-form disabled state, and keeping fields editable while only the add button is pending-disabled.
- `src/__tests__/ShopOrderWorkspaceHeader.spec.ts` covers the shop-order workspace header contract: job title fallback copy, New Order loading/disabled state, Submit Order visibility/disablement, and action event forwarding.
- `src/__tests__/ShopOrderWorkspaceSection.spec.ts` covers the shop-order workspace section shell contract: section title rendering, body slot rendering, optional action slot rendering, and root attribute forwarding.
- `src/__tests__/ShopOrderHistoryList.spec.ts`, `src/__tests__/ShopOrderSelectedOrderPanel.spec.ts`, and `src/__tests__/ShopOrderMetaForm.spec.ts` cover the shop-order history/selected-order display seam: order number fallbacks, status/due-date labels, item/delivery metadata, active history selection, editable delivery/comments/Thursday events, read-only submitted controls, submitted metadata, and missing-value fallbacks.
- `src/__tests__/TimecardCanvasPanel.spec.ts` covers the shared timecard canvas shell contract: loading/empty states, header/card/action/footer slots, selected and compact card classes, shell/scale styles, selection and compact-toggle events, and measurement element events.
- `src/__tests__/JobTimecardCanvasPanel.spec.ts` covers the job Timecards canvas composer contract: job header metadata, selected week date formatting, canvas id/test-id/style/footer rules, workbook prop forwarding, employee-header lock rules, workbook/remove events, and canvas event forwarding.
- `src/__tests__/TimecardExportCanvasPanel.spec.ts` covers the Timecard Export canvas composer contract: export header metadata, export card ids/style/footer rules, edit/lock controls, archive week/burden workbook prop forwarding, measurement callback forwarding, workbook/remove/edit events, and read-only action hiding.
- `src/__tests__/useTimecardExportFilters.spec.ts` covers Timecard Export filter state: default current-week filters, Saturday date snapping, range-bound normalization, selected-job normalization, status normalization, and week filtering by date/job/foreman/status/search.
- `src/__tests__/useTimecardExportVisibleCards.spec.ts` covers Timecard Export visible-card state: active create-week card lookup, missing-target guards, card search by display fields, and filtered-card sorting by name or employee number.
- `src/__tests__/useTimecardExportSummary.spec.ts` covers Timecard Export summary state: totals, account-summary aggregation, visible week/package/job/foreman/status labels, status signals, empty-canvas messages, PDF subtitle text, and CSV filename derivation.
- `src/__tests__/useTimecardExportCreateContext.spec.ts` covers Timecard Export create context: sorted job options, foreman filter options, active foreman/project-manager user filtering, assignable foreman options, employee search, existing/synthetic target-week resolution, owner context, and create-tray guidance.
- `src/__tests__/useTimecardExportCreateDefaults.spec.ts` covers Timecard Export create default selection policy: job selection preservation, target-week job defaults, single-option fallbacks, blank multi-option states, foreman preservation, active foreman-filter matching, target-week single-foreman defaults, and no-option clearing.
- `src/__tests__/useTimecardExportMutationActions.spec.ts` covers Timecard Export mutation actions: remove-card and delete-draft confirmation payloads, editable/export-capability guards, pending-save flush ordering, card/week delete service calls, archive-cache cleanup, success messages, error fallbacks, loading cleanup, confirmation cleanup, and confirm-dispatch behavior.
- `src/__tests__/useTimecardExportCreateActions.spec.ts` covers Timecard Export create-card actions: read-only guards, linked-job/job-number validation, existing and synthetic week creation, employee-card payloads, custom-card validation/trimming/wage rules, export filter synchronization, create-tray cleanup, edit-mode selection, scroll side effects, loading cleanup, and error fallbacks.
- `src/__tests__/useTimecardExportDownloadActions.spec.ts` covers Timecard Export download/output actions: empty-filter guards, popup-blocked PDF handling, pending-save flush ordering, PDF payload normalization, print-route resolution, CSV build/download orchestration, no-detail-row messaging, success messages, and PDF/CSV failure fallbacks.
- `src/__tests__/useTimecardExportFilteredWeekSync.spec.ts` covers Timecard Export filtered-week synchronization: immediate sync with no pending work, pending-save flush before card-set changes, queued-work flushes without loaded cards, tracked week-signature reruns, ignored display-only week field changes, and stale async sync cancellation when filters change mid-flush.
- `src/__tests__/useTimecardExportSideEffects.spec.ts` covers Timecard Export watcher side effects behind a neutral ordered-card `ReadonlyRef` input: job production-burden signature changes trigger archive card redecorating, display-only job edits do not, ordered-card id changes sync selected-card state, and same-card content edits do not resync selection.
- `src/__tests__/useTimecardExportLifecycle.spec.ts` covers Timecard Export lifecycle startup/cleanup: jobs, saved weeks, employees, and users start in mount order; save queue, card measurements, saved weeks, archive cards, employees, and users are cleaned up in unmount order.
- `src/__tests__/useTimecardExportSubscriptions.spec.ts` covers Timecard Export subscription adapter behavior: saved-week, employee, and foreman subscription wiring, feature-specific error forwarding, permission-independent week archive startup/stop, Timecard Export permission gating for employee/user records, clearing denied records/loading state, and latest-permission checks.
- `src/__tests__/useTimecardExportSaveQueue.spec.ts` covers Timecard Export save persistence: export-week edit gating, no-save scheduling/persistence guards, `updateTimecardCard` payloads with archive week id, archive week start date, archive card payload, and archive burden, scheduled-save flushing, last-saved state updates, and service failure propagation through shared save-error state.
- `src/__tests__/useTimecardExportUiAdapters.spec.ts` covers remaining Timecard Export UI-state adapters: mobile toolbar tab validation, card edit-state permission gating through a neutral edit-permission ref, edit-state reset/pruning, create-tray visibility and target/search/custom-card state, custom-card reset behavior, and Timecard Export confirmation-dialog copy/close behavior.
- `src/__tests__/useTimecardExportCardWorkspaceActions.spec.ts` covers Timecard Export card-workspace actions: workspace reset cleanup, page/save message reset, valid-card UI pruning, sorted selection synchronization, workbook-change total recalculation and save scheduling, smooth card scrolling, and employee-header lock rules.
- `src/__tests__/useTimecardExportArchiveCards.spec.ts` covers Timecard Export archive-card subscription state: per-week card listener setup with burden resolution, late card-change handler registration, loading state, archive card decoration, stale-week subscription cleanup, empty result resets, pending-local-state merge protection, redecorating after burden changes, week-specific error forwarding, delete-week cache cleanup, sort-index derivation, and full subscription cleanup.
- `src/__tests__/JobBrowserPanel.spec.ts` covers the Jobs browser panel contract: admin edit controls, counts, all-jobs row, job row metadata, search/status/create/select events, field-user visibility, loading state, and empty state.
- `src/__tests__/useJobsViewState.spec.ts` covers the Jobs view-state contract: admin all-job visibility with status/search filters, field-user active-job visibility, selected-job lookup, create/all-jobs mode flags, all-jobs entry visibility, active/archive counts, job type options, GC suggestions, and current field-user option filtering/sorting.
- `src/__tests__/useJobsCapabilities.spec.ts` covers the Jobs capability seam: route-level create/setup/delete/archive flags stay reactive from the auth source and selected-job setup edit access follows the selected job id.
- `src/__tests__/useJobsSelectionSync.spec.ts` covers the Jobs selection-sync contract: no-selection form reset, selected-job hydration, hydration guard blocking, previous-job handoff, field-user first-visible selection, manager fallback to empty/all-jobs modes, create/all-jobs preservation, edit-drawer all-jobs defaulting, and drawer-close autosave cleanup.
- `src/__tests__/useJobsNavigationActions.spec.ts` covers the Jobs navigation-actions contract: create-mode permission gating, create-form reset, edit-drawer opening to selected jobs or all-jobs defaults, create-mode preservation, close behavior, edit-mode row selection, and dashboard routing outside edit mode.
- `src/__tests__/useJobDetailForm.spec.ts` covers the Jobs detail-form contract: selected-job hydration, null-selection reset, notification recipient/input resets, field updates, validation blocking, explicit save handoff, autosave scheduling for changed editable forms, autosave permission gating, success/status copy, and dirty local field protection against same-job remote echoes.
- `src/__tests__/useJobCreateForm.spec.ts` covers the Jobs create-form contract: default create-job field values, empty notification recipients, empty recipient inputs, typed field updates, full reset behavior, recipient/input cleanup, assigned-foreman cleanup, and create-message clearing.
- `src/__tests__/useJobCrudActions.spec.ts` covers the Jobs CRUD-actions contract: create validation, create payload normalization, create error forwarding, detail persistence payload normalization, detail save errors, archive/restore service calls, delete service calls, post-delete selection fallback, and busy-state cleanup.
- `src/__tests__/useJobNotificationRecipients.spec.ts` covers the Jobs notification-recipient workflow contract: create-recipient validation and local edits, selected-job recipient persistence, all-jobs recipient default persistence, add/remove behavior, duplicate handling, pending input preservation on failure, and save-state cleanup.
- `src/__tests__/useJobsAdminSubscriptions.spec.ts` covers the Jobs admin-subscription contract: admin-only startup, user/all-jobs-recipient listener updates, restart cleanup, explicit stop cleanup, user listener error normalization, and all-jobs recipient error forwarding.
- `src/__tests__/useJobsLifecycle.spec.ts` covers the Jobs lifecycle contract: jobs subscription startup before admin-only subscriptions, no premature cleanup, and unmount cleanup order for detail autosave, jobs subscriptions, and admin subscriptions.
- `src/__tests__/useJobsSideEffects.spec.ts` covers the Jobs side-effect contract: top-level and nested detail-form edits schedule autosave, empty job errors are ignored, unchanged job errors are not re-forwarded, and new job errors are sent to the page toast/error adapter.
- `src/__tests__/useJobConfirmDialogs.spec.ts` covers the Jobs confirm-dialog contract: no-selection guards, archive/restore/delete open state, selected-job copy, manual close helpers, and busy-state close prevention.
- `src/__tests__/ShopOrderWorkspacePane.spec.ts` covers the shop-order workspace pane orchestration contract: job/order summaries, create/submit/delete actions, selected-order metadata forwarding, item editor forwarding, history selection, read-only submitted controls, and empty workspace state.
- `src/__tests__/ShopOrderConfirmDialogs.spec.ts` covers the shop-order confirmation dialog grouping contract: existing remove/delete/submit copy, update events, confirm events, busy-state passthrough, and destructive intent passthrough.
- `src/__tests__/JobNotificationRecipientsPanel.spec.ts` covers the Jobs notification-recipient panel contract: module sections, counts, recipients, empty labels, per-module input/add/remove forwarding, and disabled state.
- `src/__tests__/JobFieldUserAssignmentPanel.spec.ts` covers the Jobs field-user assignment panel contract: selected counts, search value and events, row display/fallback labels, checked-state binding, toggle events, loading state, and empty state.
- `src/__tests__/JobDetailsFormFields.spec.ts` covers the Jobs details form fields contract: labels, current field values, test-id prefixing, field attributes, formatted job-type options, and typed `updateField` events for every job detail field.
- `src/__tests__/JobAdminDetailPane.spec.ts` covers the Jobs admin detail pane contract: create-job, all-jobs defaults, selected-job edit, empty editor states, and forwarding field, foreman, recipient, save, archive, and delete events to the parent.
- `src/__tests__/JobConfirmDialogs.spec.ts` covers the Jobs confirmation dialog grouping contract: archive/delete copy, update events, confirm events, independent busy-state passthrough, and destructive intent passthrough.
- `src/__tests__/UserDirectoryPanel.spec.ts` covers the Users browser panel contract: pending invite summary/actions, search/status filters, role/status/invite badges, selected row state, create/invite/selection events, invite loading state, and loading/empty states.
- `src/__tests__/UserAssignedJobsPanel.spec.ts` covers the Users assigned-jobs picker contract: selected count, search value/events, assigned-job row labels and code fallbacks, checked-state binding, toggle events, disabled-state propagation, and loading/empty states.
- `src/__tests__/UserEditorPanel.spec.ts` covers the Users editor panel contract: create/edit/no-selection states, create text/role/assignment events, create-action loading locks, detail text/role/active/assignment/delete/submit events, self-edit lockout, save-loading state, non-assignable role behavior, and empty selected-user guidance.
- `src/__tests__/EmployeeDirectoryPanel.spec.ts` covers the Employees browser panel contract: employee search/status filters, create-mode selection, employee display fallbacks, type/status badges, row selection, create events, loading state, and empty state.
- `src/__tests__/EmployeeEditorPanel.spec.ts` covers the Employees editor panel contract: create/detail rendering, create text/toggle events, create-loading lockout, detail text/toggle events, blur-save signaling, delete/submit/back events, save status, and saving/deleting disabled states.
- `src/__tests__/useAdminFormState.spec.ts` covers Users and Employees admin form-state composables: create/detail defaults, text/boolean/role updates, assigned-job toggles, role-based assignment cleanup, selected-record hydration, dirty detail snapshots, sync-state flags, and reset/error callback behavior.
- `src/__tests__/useAdminActions.spec.ts` covers Users and Employees admin action composables: create validation, normalized service payloads, pending-invite sending, detail autosave gating, validation/error forwarding, delete confirmation workflows, selection resets, and busy-state cleanup.
- `src/__tests__/useAdminRecordsSync.spec.ts` covers Users and Employees admin records/sync composables: user/job/employee listener startup, listener error fallbacks, listener cleanup/restart behavior, stale selection fallback, mount/unmount subscription wiring, selected-record hydration, create-mode resets, save-timer cleanup, and detail status-message resets.
- `src/__tests__/useAdminViewState.spec.ts` covers Users and Employees admin derived view-state composables: directory filtering, selected-record lookup, create-mode flags, self-edit detection, active-job assignment filtering, pending invite counts, employee status counts, occupation suggestions, passive-save success-toast filtering, and delete-confirmation copy.

Good next test targets:

- pending action state that only disables the affected control

Coverage expectations:

- assert public props/events/slots instead of private implementation details
- cover disabled/loading/error states for shared controls
- cover keyboard/focus behavior for interactive shared controls where practical

### Unit Tests

Current coverage:

- `src/__tests__/capabilities.spec.ts` locks in the live frontend capability bridge from stored roles to target-backed workspace access, route capabilities, all-job visibility, job-management controls, timecard-export access, all-daily-log visibility, job-timecard management, assigned-job route access, visible-job fallback access, and the temporary unassigned-timecard route exception.
- `src/__tests__/roles.spec.ts` locks in the runtime role catalog, stored-role normalization, legacy effective-role compatibility mapping, assignable-job policy, editable frontend role options for the full target role set, default editable role, and role labels; services, form state, foreman filters, and E2E runtime role assignment consume this helper.
- `src/__tests__/backendRoleCatalog.spec.ts` guards the frontend stored-role catalog against Cloud Functions `VALID_ROLES` drift so Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access records remain recognized consistently across frontend and Functions code.
- `src/__tests__/functionRoleAccess.spec.ts` locks in the Cloud Functions role helper contract: stored-role recognition for the full target role set, callable current-user shaping, assigned-job cleanup, display-name fallback, current role checks, assigned-job access checks for Admin plus assigned Foreman/Shop Foreman/Project Manager users, Payroll denial for assigned workflow access, and pending-invite eligibility.
- `src/__tests__/functionTargetRoleCapabilities.spec.ts` locks in parity between the frontend target role matrix and the Functions-local target role capability seam so future callable/rules implementation work starts from the same requested role boundaries as the UI plan.
- `src/__tests__/functionTargetJobAccess.spec.ts` locks in parity between the frontend target assigned-job/job-access helpers and the Functions-local target job-scope policy seam so backend callable/rules work can share the same Payroll, Shop Foreman, Project Manager, Foreman, and Admin job boundaries.
- `src/__tests__/functionTargetFieldWorkflowAccess.spec.ts` locks in parity between the frontend target Daily Log/Shop Order workflow helper and the Functions-local target field-workflow policy seam so backend callable/rules work preserves PM view-only access, Payroll exclusion, Foreman assigned-job editing, and Shop Foreman Shop-job editing.
- `src/__tests__/functionFieldWorkflowAccess.spec.ts` covers the live Functions helper used by Daily Log and Shop Order record write callables: Admin can write any job, assigned Foremen can write assigned jobs, Shop Foremen can write the Shop job without explicit assignment and assigned non-Shop jobs, unassigned Foremen are denied, and Project Managers/Payroll stay out of field workflow writes.
- `src/__tests__/functionTargetFieldEmailRecipients.spec.ts` locks in parity between the frontend target automatic field-email recipient helper and the Functions-local recipient policy seam so backend delivery wiring can include assigned Foremen, assigned Project Managers, and Shop Foremen on Shop jobs while skipping inactive/missing-email/Admin/Payroll/no-access users.
- `src/__tests__/functionTargetTimecardAccess.spec.ts` locks in parity between the frontend target timecard helper and the Functions-local timecard policy seam so backend callable/rules work can preserve Payroll export/lock/delete-draft access, Shop Foreman Shop-job entry, Foreman assigned-job entry, and Project Manager submitted-reporting boundaries.
- `src/__tests__/functionTimecardWeekAccess.spec.ts` covers the live Functions helper used by `ensureTimecardWeekRecord`: Admin/Payroll can create weeks through management/export paths, assigned Foremen can create assigned job weeks, Shop Foremen can create Shop job weeks without explicit assignment, unassigned Foremen are denied, and Project Managers stay report-only.
- `src/__tests__/functionEmailStatus.spec.ts` locks in the shared Cloud Functions submitted-email operation/status contract: operation IDs are stable per submitted record, claim payloads stamp attempted/in-progress metadata before sending, successful sends stamp operation/attempted/sent metadata and clear the in-progress/error fields, skipped/failed sends stamp operation/attempted metadata with null sent time and a user-safe message, same-operation sent records can be detected for duplicate suppression, and stale in-progress claims can retry instead of becoming permanent locks.
- `src/__tests__/functionSubmittedEmailOperations.spec.ts` covers the submitted-email transaction/helper layer directly: `claimed`, `already-sent`, `in-progress`, stale retry, missing-record, existing-document-only update behavior, and shared short-circuit copy are pinned without invoking email rendering or PDF generation.
- `src/__tests__/functionSubmittedFieldEmailHandlers.spec.ts` covers the submitted Daily Log and Shop Order email handler branches with mocked dependencies: Daily Log success, unassigned-Foreman denial, duplicate/in-progress short-circuiting, disabled email, missing recipients, send failure status recording, Shop Order PDF attachment success, and Shop Order job mismatch denial.
- `src/__tests__/functionTimecardWeekSubmitHandler.spec.ts` covers Timecard Week submit/email handler branches with mocked dependencies: submit success/status recording, skipped notification status, duplicate/in-progress short-circuiting, owner denial before claim, and notification failure recovery while keeping the week submitted.
- `src/__tests__/targetRoleCapabilities.spec.ts` locks in the requested target role capability matrix as a non-runtime planning artifact: Admin full access, Payroll employee/timecard export/job creation/read-only jobs, Shop Foreman shop catalog plus Shop job workflow access, Project Manager assigned-job editing/submitted-timecard visibility, Foreman assigned-job field workflow access, and no-access users receiving no capabilities.
- `src/__tests__/targetRouteCapabilities.spec.ts` locks in target protected-route capability metadata and workspace access as a non-runtime planning artifact: Admin can use every protected admin route capability, Payroll can use Employees and Timecard Export routes only, Shop Foreman can use Shop Catalog only, Project Manager/Foreman/no-access users cannot use protected admin routes, and inactive/unauthenticated/no-access users are blocked from the workspace.
- `src/__tests__/targetRouteAccess.spec.ts` locks in target router access as a non-runtime planning artifact: signed-in users leave public entry routes for the role dashboard, protected routes require target workspace access, protected admin routes filter by target route capability, and job-scoped routes require target dashboard access for assigned, Shop, or admin users.
- `src/__tests__/targetAppShellNavigation.spec.ts` locks in target AppShell navigation as a non-runtime planning artifact: active target roles receive Dashboard/Jobs workspace links, no-access users receive no workspace links, admin/sidebar links are filtered by target route capabilities, and target role-label copy stays centralized.
- `src/__tests__/targetJobAssignments.spec.ts` locks in the shared target assigned-job membership helper used by target job, field-email, and timecard access policy seams.
- `src/__tests__/targetJobAccess.spec.ts` locks in target job-scoped policy as a non-runtime planning artifact: Admin full job access, Payroll job creation plus read-only all-job lookup without workflow dashboards, Shop Foreman all-job lookup plus Shop/assigned workflow dashboards, Project Manager assigned-job dashboard/edit access, Foreman assigned-job dashboard access without setup editing, and no-access users receiving no job surfaces.
- `src/__tests__/targetFieldWorkflowAccess.spec.ts` locks in target Daily Log and Shop Order workflow policy as a non-runtime planning artifact: Admin has full field-workflow access, Payroll receives no field-workflow modules, Shop Foremen can create/edit/submit Shop and assigned non-Shop workflow records, Project Managers can open/view assigned workflow modules without create/edit/submit rights, Foremen can create/edit/submit assigned workflow records, and no-access users receive no field-workflow surfaces.
- `src/__tests__/targetFieldEmailRecipients.spec.ts` locks in target automatic Daily Log and Shop Order field-email recipient policy as a non-runtime planning artifact: Admin/Payroll/no-access users are not automatic field-email recipients, assigned Foremen and Project Managers receive assigned-job field emails, Shop Foremen receive Shop job field emails without explicit assignment plus assigned non-Shop job field emails, and recipient lists skip inactive/missing-email users while normalizing/deduplicating addresses.
- `src/__tests__/targetTimecardAccess.spec.ts` locks in target timecard access policy as a non-runtime planning artifact: Admin has full timecard access, Payroll gets export/lock/delete-draft access without job workflow access, Shop Foremen can use Shop and assigned non-Shop job timecard workflows, Project Managers get assigned-job submitted-timecard reporting without edit/submit/export access, Foremen get assigned-job workflow access without export/lock/reporting access, and no-access users receive no timecard surfaces.
- `src/__tests__/roleDashboardModules.spec.ts` locks in the target role-dashboard module policy as a non-runtime planning artifact: Admin full dashboard modules, Payroll employee/job/timecard export modules, Shop Foreman shop catalog plus Shop/assigned job dashboard modules, Project Manager assigned-job and submitted-timecard modules, Foreman assigned field-workflow modules, and no-access users receiving no modules.
- `src/__tests__/RoleDashboardView.spec.ts` covers the live role-dashboard route and module grid contract: signed-in user title/role copy, target role module links, absolute route targets, and the no-module empty state.
- `src/__tests__/appShellNavigation.spec.ts` locks in the live AppShell sidebar policy: workspace navigation exposes Dashboard before Jobs, admin navigation is filtered through target-backed route capabilities, Admin sees all admin links, Payroll sees Employees and Timecard Export, Shop Foreman sees Shop Catalog, and role-label copy stays centralized.
- `src/__tests__/routeAccess.spec.ts` locks in the router guard decision seam: signed-in public-route redirects to the role dashboard, signed-out protected-route redirects, route capability metadata, unknown capability metadata fallback, assigned-job workflow access, visible-job fallback access, temporary unassigned-timecard access, denied-route dashboard fallback, and route meta/param normalization.
- `src/__tests__/architectureBoundaries.spec.ts` guards the frontend Firebase boundary so route views, layouts, router guards, stores, components, features, and composables cannot import `@/firebase` or Firebase SDK packages directly; services remain the allowed layer for Firebase configuration, Auth session, profile, and SDK details.
- The same architecture boundary spec also guards `src/components/**` from importing `@/services/*` or `@/stores/*` directly, preserving the Vue component rule that components receive data through props and emit intent through events.
- `src/__tests__/authService.spec.ts` covers auth profile normalization for complete records, recognized target stored roles, missing/unknown fields, invalid assigned-job IDs, unknown roles, and inactive users.
- `src/__tests__/authViewHelpers.spec.ts` covers public auth route helpers for forgot-password route targets, email query prefill, password-created query info, login/reset validation copy, workspace redirect gating, setup-password validation ordering, and setup-link query parsing.
- `src/__tests__/dateTime.spec.ts` covers shared timestamp normalization for native dates, Firestore-like timestamp objects, invalid values, app timestamp formatting, and service-sort millisecond conversion.
- `src/__tests__/dirtySnapshotGuard.spec.ts` covers shared dirty snapshot guard behavior: selection-change hydration, local dirty-state protection, incoming saved-echo skips, optional local-mismatch protection, and clean remote update hydration.
- `src/__tests__/optimisticRecords.spec.ts` covers shared optimistic record-list behavior: immutable replace, upsert, append, and remove helpers for local UI updates while remote persistence is pending.
- `src/__tests__/recipientEmails.spec.ts` covers shared recipient email normalization, validation, add-result classification, append/remove helpers, filtering, and duplicate removal used by Jobs and Daily Logs.
- `src/__tests__/routerQuery.spec.ts` covers shared route query-string normalization used by public auth routes.
- `src/__tests__/useActionConfirmDialog.spec.ts` covers shared action-confirm dialog copy, destructive-state derivation, busy-safe close behavior, neutral writable action-ref output, and template-friendly computed copy/destructive refs.
- `src/__tests__/useAutosaveQueue.spec.ts` covers shared autosave queue behavior: debounce timing, rescheduling, `canSave` gating, clearing pending saves, last-saved timestamps, and background error capture.
- `src/__tests__/useAppToast.spec.ts` covers shared app toast behavior: PrimeVue group/severity/detail/lifetime payloads, custom summary preservation, blank-message suppression, severity convenience helpers, watched message refs, filtered messages, clear-on-consume behavior, and non-clearing message mode.
- `src/__tests__/useMeasuredCardScale.spec.ts` covers shared card-measurement scaling: default unmeasured styles, shell/content measurement, ResizeObserver updates, max-scale clamping, replaced/removed element cleanup, pruning, full clearing, and observed-element filtering.
- `src/__tests__/useWindowEventListener.spec.ts` covers shared window-listener lifecycle behavior: mount-time registration, unmount cleanup, option passthrough, and native event dispatch while mounted.
- `src/__tests__/useTemplateElementRef.spec.ts` covers shared Vue template-ref normalization: matching DOM element retention, pure stateless ref resolution, shared input/div element guards, non-matching element clearing, component instance clearing, and null clearing.
- `src/__tests__/useRouteJobContext.spec.ts` covers shared job-route context behavior: route job id resolution, current-job priority, visible-job fallback, route-param/store reactivity, empty-route subscription guards, and route-job cleanup delegation.
- `src/__tests__/useCurrentActor.spec.ts` covers shared current actor derivation: user id tracking, display-name priority, email fallback, null fallback, and reactive source changes for route shells that stamp workflow writes.
- `src/__tests__/useDirectoryEditorPanels.spec.ts` covers shared directory/editor mobile-panel navigation: shared tab definitions with default/custom directory labels, default directory state, valid tab switching, invalid key ignores, create-mode selection plus cleanup, and record selection into the editor panel.
- `src/__tests__/subscribedHelpers.spec.ts` covers shared subscription helpers: list/value initial loading state, update callbacks, restart cleanup, explicit stop cleanup, normalized callback errors, synchronous subscriber failures, error reset on restart, preservation of existing value state on listener errors, and the Vue-native value-ref contract used by template-facing subscription consumers.
- `src/__tests__/jobDashboardModules.spec.ts` covers the current Job Dashboard module launcher definitions, workflow priority order, and fresh-copy behavior so later role-aware module filtering has a stable base.
- `src/__tests__/jobViewHelpers.spec.ts` covers Jobs route-adjacent toast filtering so passive detail autosave success messages stay quiet while actionable job success messages can still surface.
- `src/__tests__/useDailyLogPayloadPreparer.spec.ts` covers Daily Log prepared-payload callback behavior behind neutral form/site-info refs: latest site-info usage, explicit payload preparation, and source-payload immutability.
- `src/__tests__/useDailyLogDraftSave.spec.ts` covers Daily Log draft-save behavior behind neutral editability/form/selection refs: dirty snapshot tracking, explicit full-draft saves, text-field save-on-blur payloads, unchanged/read-only/missing-log no-op guards, QC legacy snapshot alignment, and failed-save preservation of local typed text.
- `src/__tests__/dailyLogSelectionState.spec.ts` covers Daily Log view-first selection behavior: user-visible log filtering, preferred-log fallback order, next-selection resolution for subscription updates, edit/create permissions, "Another Daily Log" labeling, title derivation, and job/form/selected-log site-info fallback rules.
- `src/__tests__/dailyLogValidation.spec.ts` covers Daily Log submit validation: all configured required text fields, manpower row completeness, indoor-climate row completeness, row-specific validation messages, and complete-payload acceptance.
- `src/__tests__/useDailyLogActions.spec.ts` covers Daily Log create/save/submit/delete behavior: explicit draft creation, existing-draft reuse, context/date guards, draft save messages, submit validation, status update payloads, email success/skip/failure reporting, delete confirmation, attachment cleanup, and delete failure handling.
- `src/__tests__/useDailyLogDateNavigation.spec.ts` covers Daily Log date/job navigation behavior: selected-log/log-list reset on date changes, reset-to-today action behavior, job-change resubscription, empty/unchanged job guards, and avoiding duplicate log subscriptions when job changes also reset the date.
- `src/__tests__/useDailyLogRepeaters.spec.ts` covers Daily Log manpower and indoor-climate repeater behavior: row add/remove/reset, read-only guards, missing-index no-ops, manpower user attribution, blank count draft preservation, and typed field updates.
- `src/__tests__/useDailyLogRecipients.spec.ts` covers Daily Log recipient persistence behavior behind neutral job/log/recipient refs: admin/default recipient derivation, additional-recipient filtering, empty/invalid/duplicate add validation, normalized add/remove payloads, local selected-log updates, read-only/no-selection guards, and failed-save busy-state cleanup.
- `src/__tests__/useDailyLogAttachments.spec.ts` covers Daily Log attachment persistence behavior behind neutral form/job/selection refs: attachment section grouping, local description updates, upload validation, typed upload wrappers, Storage upload/delete payloads, prepared draft persistence, saved snapshot refreshes, section busy flags, read-only/no-selection guards, and failed-delete preservation of local attachments.
- `src/__tests__/shopOrderViewHelpers.spec.ts` covers Shop Orders route-adjacent toast filtering so frequent background save/item-added success messages stay quiet while meaningful success messages can still surface.
- `src/__tests__/useTimecardPrintRoute.spec.ts` covers Timecard Export print-route orchestration: stored-payload loading by export id, paged-card derivation, print scheduling, missing-payload messaging, and duplicate-print guards.
- `src/__tests__/useDailyLogFormHydration.spec.ts` covers Daily Log form hydration behavior: selected-log hydration, empty-form reset, recipient input clearing on selection changes, clean same-log remote update hydration, unsaved local edit protection, saved-echo skips, and editable-only job/user snapshot field refreshes.
- `src/__tests__/useDailyLogSubscriptions.spec.ts` covers Daily Log subscription behavior: global recipient default subscription start/stop, recipient default update/error handling, selected job/date log subscription calls, no-job guards, visible-log selection recovery, all-log viewer selection preservation, empty visible-log clearing, and log subscription error state.
- `src/__tests__/useDailyLogSubscriptionLifecycle.spec.ts` covers Daily Log subscription lifecycle behavior: mount-time recipient default startup, job-present route/log startup, no-job startup guards, route-change non-watch behavior delegated to date navigation, and unmount cleanup for logs, recipient defaults, and route-job subscriptions.
- `src/__tests__/usePageMessages.spec.ts` covers shared page-message mutual exclusion, one-channel clearing, and full reset behavior.
- `src/__tests__/usePendingActionMap.spec.ts` covers shared keyed pending-action behavior: only the active key is marked pending, pending state clears after resolve/reject, counts are exposed, and all keys can be cleared.
- `src/__tests__/dailyLogFormat.spec.ts` covers daily-log display formatting: status labels, selected-log labels, Firestore-like timestamps, invalid timestamp fallbacks, and timestamp priority.
- `src/__tests__/directoryFilters.spec.ts` covers shared directory active/inactive/both filtering.
- `src/__tests__/shopOrderCatalogTree.spec.ts` covers shop-order catalog tree construction: expanded active nodes, direct-child folder/item summaries, collapsed categories outside search, SKU/path search, and search-time collapsed folders.
- `src/__tests__/shopOrders.spec.ts` covers shared shop-order display/ordering rules: order-number fallback, Firestore-like timestamp formatting, status/due labels, catalog folder-prefix removal, and alphabetized item ordering.
- `src/__tests__/useShopOrderRecords.spec.ts` covers Shop Order record subscription behavior: current-job listener startup, explicit restart cleanup, stop idempotency, listener/startup error normalization, and local record replacement.
- `src/__tests__/useShopOrderWorkspaceState.spec.ts` covers Shop Order workspace derived state: selected order lookup, draft/submitted grouping, editable/submitted state, job-context disabled rules, item counts, total quantity, category lookup, and alphabetized selected-order items.
- `src/__tests__/useShopOrderMetaForm.spec.ts` covers Shop Order selected-order metadata behavior: selected-order hydration, default reset, stale remote echo protection, delivery-date validation, debounced metadata saves, successful-save signature updates, read-only queue suppression, and next-Thursday shortcut behavior.
- `src/__tests__/useShopOrderCustomItemForm.spec.ts` covers Shop Order custom-item form state: default form creation and same-object reset back to defaults.
- `src/__tests__/useShopOrderItemActions.spec.ts` covers Shop Order item mutation behavior: catalog item add/merge, category-path item descriptions, normalized quantities, custom item validation/trimming/reset, failed-save preservation of custom input, draft-only quantity edits, and remove-confirm behavior.
- `src/__tests__/useShopOrderItemNotes.spec.ts` covers Shop Order item-note behavior: selected-order draft synchronization, no-order cleanup, debounced note saves, blur flushes, unchanged/read-only save suppression, and queued saves when the user keeps typing while a prior save is pending.
- `src/__tests__/useShopOrderDraftActions.spec.ts` covers Shop Order draft create/target behavior: job/date validation, create payloads, selection of created drafts, reuse of selected/existing draft targets, clone-before-mutate item targets, duplicate draft prevention, and next-Thursday defaults.
- `src/__tests__/useShopOrderPersistence.spec.ts` covers Shop Order persistence behavior: metadata update payloads, save failure messages, sorted clone helpers, optimistic item replacement, rollback on failed item saves, serialized item-save queueing, loading state, and no-order guards.
- `src/__tests__/useShopOrderSubmissionActions.spec.ts` covers Shop Order submit/delete orchestration: draft delete request/confirm behavior, delete failure handling, submit validation, metadata-save-before-confirm, read-only guards, status update payloads, email send/error handling, and loading/dialog state.
- `src/__tests__/useShopOrderSelectionSync.spec.ts` covers Shop Order selection/history synchronization: explicit history-order selection, pure next-selection resolution, first-order fallback selection, preserving existing selections, missing-selection fallback/null reset, selected-order reset behavior, same-order remote hydration/skips, note-draft sync, and metadata save queueing.
- `src/__tests__/useShopOrderSubscriptionLifecycle.spec.ts` covers Shop Order subscription lifecycle behavior: mount-time route/catalog/order subscription starts, null-job order-subscription guards, route-job change resubscription with local save-state cleanup, null route-change no-ops, and unmount cleanup.
- `src/__tests__/timecardCardSelection.spec.ts`, `src/__tests__/timecardSaveQueue.spec.ts`, `src/__tests__/timecardStateMapHelpers.spec.ts`, and `src/__tests__/timecardWorkbookNavigation.spec.ts` cover timecard UI state, save queue behavior, pending save-state map collection/cleanup, and workbook keyboard navigation helpers.
- `src/__tests__/useJobTimecardWeekSelectionActions.spec.ts` covers job Timecard week selection behavior: selected-week switching after pending saves flush, same-week no-ops, week-ending input snapping to Saturdays, clearing explicit selected weeks for typed dates, blank date clearing, and safe native date-picker opening.
- `src/__tests__/useJobTimecardCreateActions.spec.ts` covers job Timecard card-creation behavior: duplicate employee-card creation, selected-week/edit guards, employee-card payloads and next sort indexes, custom-card validation, manager-only wage validation, custom-card payloads, create-tray reset/close behavior, card select/scroll side effects, and failure loading cleanup.
- `src/__tests__/useJobTimecardUiAdapters.spec.ts` covers job Timecard UI adapter state: create-tray visibility, employee search persistence, custom-card form resets, remove-card confirmation copy/destructive state, submit-week confirmation copy, and busy-state close prevention.
- `src/__tests__/useJobTimecardWeekActions.spec.ts` covers job Timecard week lifecycle behavior: guarded create-week validation, existing-week selection, pending-save flush before week creation, create-tray closing, ensure payload construction, duplicate in-flight protection, failure retry cleanup, and automatic empty-draft backfill guardrails.
- `src/__tests__/useJobTimecardCardActions.spec.ts` covers job Timecard card action behavior: delete confirmation guards, delete persistence after pending-save flush, sort persistence by last name/employee number, sort no-op guards, submit confirmation guards, submit actor/email-result handling, confirmation dispatch, action loading cleanup, and error fallbacks.
- `src/__tests__/useJobTimecardCardWorkspaceActions.spec.ts` covers job Timecard card workspace behavior: workspace reset cleanup, page/save message reset, visible-card id pruning for save queues and measurements, read-only derivation, scroll-to-card scheduling, workbook-change card selection, total recalculation, and save scheduling.
- `src/__tests__/useJobTimecardWorkspaceSync.spec.ts` covers job Timecard workspace sync watcher behavior: selected-week card reset/resubscribe, selected-date reset/backfill, route job reset/resubscribe, subscribed-job backfill trigger, burden refresh guards, and visible-card selection synchronization.
- `src/__tests__/useJobTimecardSubscriptionLifecycle.spec.ts` covers job Timecard subscription lifecycle behavior: mount-time route-job/week/employee startup, no-job week guards, non-watch behavior for later route job changes, exposed route-job/week/card subscription helpers, card-loading state transitions, empty-week card clearing, and unmount cleanup.
- `src/__tests__/useJobTimecardAccess.spec.ts` covers job Timecard access derivation: job-record assignment repair when profile assignments are stale, Project Manager submitted-report mode, manager all-week mode, and Shop Foreman Shop-job workflow access.
- `src/__tests__/useJobTimecardSaveQueue.spec.ts` covers job Timecard save queue wiring: selected-week/edit guards, service update payloads with week/start-date/burden context, no-save scheduling guards, flush of scheduled current cards, last-saved state, and save-error propagation.
- `src/__tests__/useJobTimecardWorkspaceState.spec.ts` covers job Timecard workspace derived state: selected-week selection/fallback, selected-week start-date fallback, card and active-employee filtering, edit/create guards, burden fallback, and recent-week limits.
- `src/__tests__/useJobTimecardSummary.spec.ts` covers job Timecard summary derivation: account-summary aggregation, total hours/production, week range/status labels, job/week fallback labels, linked job number, save-state priority, and empty-canvas guidance.
- `src/__tests__/useJobTimecardRecords.spec.ts` covers job Timecard records adapter behavior: employee subscription state, foreman-vs-manager week scoping, Project Manager submitted-report week scoping, no-job week guards, selected-week card subscriptions with burden context, remote-card merge protection for pending local save state, no-week card guards, unsubscribe behavior, and feature fallback error forwarding.
- `src/__tests__/roleDashboardJobShortcuts.spec.ts` covers Shop-job identity recognition, role-dashboard job shortcut filtering, Project Manager submitted-timecard shortcut affordances, Shop Foreman Shop/assigned job shortcuts, and Payroll workflow exclusion.
- `e2e/jobs.spec.ts` covers the real Jobs page for Admin management, Payroll create/read-only behavior, and Project Manager assigned-edit/no-delete plus unassigned-read-only behavior.
- `e2e/access-control.spec.ts` covers the live role dashboard for denied-route fallback, Project Manager assigned-job shortcuts, Project Manager assigned-job submitted-timecard read-only reporting, and Shop Foreman dashboard-to-Shop-Orders navigation.

Near-term additions:

- rules-emulator proof when `R08` is reintroduced, plus output-specific smoke assertions for rendered PDFs/emails where visual fidelity matters
- shared component event contracts as `RecipientEditor`, confirmation, and split workspace primitives stabilize

### Composable Tests

Good first composable tests:

- autosave queue behavior - covered by `src/__tests__/useAutosaveQueue.spec.ts`
- app toast/message forwarding - covered by `src/__tests__/useAppToast.spec.ts`; app routes consume `useAppToast` and `useToastMessages` so feature-specific summaries such as Jobs, Daily Logs, Shop Orders, and employee/user editors survive the shared PrimeVue wrapper while using neutral writable message-ref inputs
- jobs view state and capabilities - covered by `src/__tests__/useJobsViewState.spec.ts` and `src/__tests__/useJobsCapabilities.spec.ts`; Jobs consumes the composables for admin/non-admin visible job lists, selected-job lookup, create/all-jobs mode flags, all-jobs entry visibility, status counts, target assignable field-user option filtering, job type options, GC suggestions, route-level setup affordance flags, and selected-job edit access
- jobs selection synchronization - covered by `src/__tests__/useJobsSelectionSync.spec.ts`; Jobs consumes the composable for selected-job form hydration, dirty-guard handoff, no-selection resets, field-user first-visible fallback, admin all-jobs fallback, non-admin setup-editor no-global fallback, create/all-jobs preservation, edit-drawer default selection, and drawer-close autosave cleanup
- jobs navigation actions - covered by `src/__tests__/useJobsNavigationActions.spec.ts`; Jobs consumes the composable for create/edit drawer navigation, create-form reset, all-jobs default selection, create-mode preservation, setup-mode row selection, and dashboard routing outside edit mode
- jobs detail form and autosave - covered by `src/__tests__/useJobDetailForm.spec.ts`; Jobs consumes the composable for selected-job form hydration/reset, notification recipient hydration, validation, selected-job edit permission gating, explicit saves, detail autosave scheduling/gating, success/error/status copy, and dirty local field protection from stale remote echoes
- jobs create form - covered by `src/__tests__/useJobCreateForm.spec.ts`; Jobs consumes the composable for create-job defaults, typed field updates, create notification recipient state, recipient input state, full form resets, and create-message cleanup
- jobs CRUD actions - covered by `src/__tests__/useJobCrudActions.spec.ts`; Jobs consumes the composable for create validation/persistence, detail persistence, archive/restore, delete, loading cleanup, post-delete selection fallback, and service error forwarding
- jobs notification recipients - covered by `src/__tests__/useJobNotificationRecipients.spec.ts`; Jobs consumes the composable for create/job/all-jobs recipient validation, duplicate handling, add/remove state changes, selected-job and global persistence, pending input preservation on failure, save-state cleanup, and neutral message/selected-job/global-recipient ref inputs
- jobs admin subscriptions - covered by `src/__tests__/useJobsAdminSubscriptions.spec.ts`; Jobs consumes the composable for admin-only user and all-jobs-recipient listener startup, live updates, replacement cleanup, explicit stop cleanup, and listener error forwarding
- jobs lifecycle - covered by `src/__tests__/useJobsLifecycle.spec.ts`; Jobs consumes the composable for mount-time jobs/admin subscription startup and unmount-time detail autosave/subscription cleanup ordering
- jobs side effects - covered by `src/__tests__/useJobsSideEffects.spec.ts`; Jobs consumes the composable for detail-form autosave scheduling from top-level/nested edits and subscription error forwarding that ignores empty/unchanged messages
- jobs confirm dialogs - covered by `src/__tests__/useJobConfirmDialogs.spec.ts`; Jobs consumes the composable for archive/restore/delete confirmation state, selected-job copy, no-selection guards, manual close helpers, and busy-state close prevention
- job dashboard lifecycle - covered by `src/__tests__/useJobDashboardLifecycle.spec.ts`; Job Dashboard consumes the composable for route-job subscription startup, route-job id resubscription, same-id no-op behavior, cleanup on unmount, and neutral route-job id ref input
- daily log form state - covered by `src/__tests__/useDailyLogFormState.spec.ts`; Daily Logs consume the composable for today-date derivation, selected date/log defaults, empty payload initialization, and text-field mutation
- measured card scaling - covered by `src/__tests__/useMeasuredCardScale.spec.ts`; Timecards and Timecard Export consume the ResizeObserver-backed helper so card canvases scale like fixed-size output instead of stretching their internals
- window event lifecycle - covered by `src/__tests__/useWindowEventListener.spec.ts`; Shop Catalog admin and Shop Order catalog browser consume the helper for global pointer/keyboard/resize cleanup without owning raw lifecycle code
- template element refs - covered by `src/__tests__/useTemplateElementRef.spec.ts`; Shop Catalog admin/tree-pane list refs, `AppInlineInput`, Timecard Export status-bar refs, and Timecard card measurement refs consume the helper so Vue template ref values are normalized to DOM-only scroll/input/measurement elements outside route/component-local bespoke adapters
- route job context - covered by `src/__tests__/useRouteJobContext.spec.ts`; Job Dashboard, Daily Logs, Shop Orders, and job Timecards consume the helper so job-scoped pages resolve, subscribe to, and clean up the current route job consistently
- current actor derivation - covered by `src/__tests__/useCurrentActor.spec.ts`; Daily Logs and Shop Orders consume the helper so actor payloads and shop-order foreman defaults share one tested display-name/email fallback rule
- directory/editor mobile panels - covered by `src/__tests__/useDirectoryEditorPanels.spec.ts`; Users and Employees consume the helper so tab definitions plus create/select/tab transitions share one tested mobile split-panel navigation rule
- shop catalog tree expansion - covered by `src/__tests__/useShopCatalogTreeExpansion.spec.ts`; Shop Catalog admin consumes the composable for root/category expansion, archive-aware expand-all, collapse-all, and ancestor expansion when selecting categories through neutral catalog/archive refs
- shop catalog tree display state - covered by `src/__tests__/useShopCatalogTreeDisplayState.spec.ts`; Shop Catalog admin consumes the composable for root summaries, parent options, tree nodes, search visibility, archive visibility, and draft row rendering
- shop catalog tree interactions - covered by `src/__tests__/useShopCatalogTreeInteractions.spec.ts`; Shop Catalog admin consumes the composables for root/category/item click behavior, long-press click suppression, Escape cleanup, context-menu target mapping, and draft-node context-menu blocking
- shop catalog context menu - covered by `src/__tests__/useShopCatalogContextMenu.spec.ts`; Shop Catalog admin and Shop Order catalog browser consume the composable for viewport-aware menu positioning, touch/pen long-press behavior, drag blocking, suppressed-click windows, and timer/capture cleanup
- shop catalog context menu actions - covered by `src/__tests__/useShopCatalogContextMenuActions.spec.ts`; Shop Catalog admin consumes the composables for root/folder/item menu action derivation, mobile inspect actions, create/rename/archive/delete wiring, expand/collapse state, neutral context-state refs, and context-driven delete selection
- shop catalog confirm flow - covered by `src/__tests__/useShopCatalogConfirmFlow.spec.ts`; Shop Catalog admin consumes the composables for catalog-specific confirmation copy/destructive state, busy close protection, and archive/delete confirm dispatch routing
- shop catalog archive/delete workflows - covered by `src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts`; Shop Catalog admin consumes the composables for selected-record archive/restore request adapters, archive/restore cascading, update/delete service payloads, hidden archived selection fallback, restore reselection, child-folder delete blocking, and delete fallback selection
- shop catalog form workflows - covered by `src/__tests__/useShopCatalogFormWorkflows.spec.ts`; Shop Catalog admin consumes the composables for create/detail form state, selected record hydration, price normalization, neutral active-folder/message refs, validation, create/save service payloads, expansion updates, selection updates, and success/error messaging
- shop catalog drag/drop move workflows - covered by `src/__tests__/useShopCatalogDragDropMoveActions.spec.ts`; Shop Catalog admin consumes the composables for valid drag source detection, root/folder/item drop-target validation, drag hover/drop cleanup, duplicate-drop blocking, category/item reparenting service payloads, post-move expansion/selection updates, and move error messaging
- shop catalog tree auto-scroll - covered by `src/__tests__/useShopCatalogTreeAutoScroll.spec.ts`; Shop Catalog admin consumes the composable for pointer-threshold auto-scroll, animation-frame scheduling, scroll clamping, drag-state no-ops, safe-zone cancellation, and non-scrollable list cleanup
- shop catalog responsive panels - covered by `src/__tests__/useShopCatalogResponsivePanel.spec.ts`; Shop Catalog admin consumes the composable for catalog-first mobile defaults, breakpoint-driven single-pane state, custom breakpoint support, catalog/inspector panel switching, and no-window fallback behavior
- shop catalog admin lifecycle - covered by `src/__tests__/useShopCatalogAdminLifecycle.spec.ts`; Shop Catalog admin consumes the composable for mount-time layout sync, subscription startup ordering, unmount cleanup, context-menu disposal, tree auto-scroll cancellation, and catalog listener cleanup
- shop catalog inline edit workflows - covered by `src/__tests__/useShopCatalogInlineActions.spec.ts`; Shop Catalog admin consumes the composables for inline create/rename state, create-item inspector routing, parent expansion, focus behavior, inline create payloads, pending selection fallback, rename no-ops, rename payloads, and failure recovery
- shop catalog selection and synchronization - covered by `src/__tests__/useShopCatalogSelection.spec.ts`; Shop Catalog admin consumes the composables for active-folder state, inspector key state, root/folder/item selection through neutral catalog refs, form hydration, create-mode form resets, root tree initialization, and stale selection cleanup as live catalog records change
- shop catalog derived data and inspector summaries - covered by `src/__tests__/useShopCatalogDerivedData.spec.ts`; Shop Catalog admin consumes the composables for category/item indexes, sorted child maps, archive-aware counts, path labels, parent options, selected folder metadata, selected item metadata, SKU/price fallbacks, and live record reactivity
- shop catalog records subscriptions - covered by `src/__tests__/useShopCatalogRecords.spec.ts`; Shop Catalog admin and Shop Orders consume the composable for shared category/item subscriptions, loading-mode semantics, replacement listener cleanup, idempotent stop behavior, and normalized listener/startup errors
- daily log selection/view-first behavior - covered by `src/__tests__/dailyLogSelectionState.spec.ts`; Daily Logs consume the composable/helpers to choose visible logs, recover selected logs after subscription updates, derive edit/create state, and build site-info display without creating drafts implicitly
- daily log payload preparation - covered by `src/__tests__/useDailyLogPayloadPreparer.spec.ts` and `src/__tests__/dailyLogViewHelpers.spec.ts`; Daily Logs consume the composable/helper so current form/site-info payload stamping is shared by draft-save, attachments, and submit workflows
- daily log save-on-blur behavior - covered by `src/__tests__/useDailyLogDraftSave.spec.ts`; Daily Logs consume the composable through neutral editability/form/selection refs to save changed text fields without overwriting local typing
- daily log submit validation - covered by `src/__tests__/dailyLogValidation.spec.ts`; Daily Logs consume the dedicated validation helper so submit rules stay isolated from action orchestration and page rendering
- daily log actions - covered by `src/__tests__/useDailyLogActions.spec.ts`; Daily Logs consume the composable for explicit draft creation, draft saves, submit/email, delete confirmation, attachment cleanup, and user-facing workflow messages
- daily log date navigation - covered by `src/__tests__/useDailyLogDateNavigation.spec.ts`; Daily Logs consume the composable for selected-date changes, reset-to-today behavior, job-change resubscription, and duplicate-subscription prevention
- daily log repeaters - covered by `src/__tests__/useDailyLogRepeaters.spec.ts`; Daily Logs consume the composable for manpower and indoor-climate row mutation with read-only guards and stable blank-row behavior
- daily log recipients - covered by `src/__tests__/useDailyLogRecipients.spec.ts`; Daily Logs consume the composable through neutral job/log/recipient refs for admin/default recipient derivation, additional-recipient persistence, normalized add/remove behavior, local log updates, and read-only guards
- daily log attachments - covered by `src/__tests__/useDailyLogAttachments.spec.ts`; Daily Logs consume the composable through neutral form/job/selection refs for upload/delete persistence, upload validation, section grouping, section busy flags, saved-payload snapshots, and read-only guards
- daily log form hydration - covered by `src/__tests__/useDailyLogFormHydration.spec.ts`; Daily Logs consume the composable for selected-log hydration, clean remote update adoption, dirty local edit protection, saved-echo skips, empty reset, and job/user snapshot field refreshes
- daily log subscriptions - covered by `src/__tests__/useDailyLogSubscriptions.spec.ts`; Daily Logs consume the composable for recipient-default subscriptions, selected-date log subscriptions, visible-log selection recovery, no-job guards, and subscription error state
- daily log subscription lifecycle - covered by `src/__tests__/useDailyLogSubscriptionLifecycle.spec.ts`; Daily Logs consume the composable for mount-time recipient/default route/log startup and unmount cleanup while date navigation owns route-job changes
- daily log view helpers - covered by `src/__tests__/dailyLogViewHelpers.spec.ts`; Daily Logs keep pure payload formatting/stamping helpers isolated from route rendering
- shared subscription helpers - covered by `src/__tests__/subscribedHelpers.spec.ts`; Jobs, Daily Logs, Shop Orders, Employees, Users, and Timecards consume list/value subscription helpers for loading, update, error, restart, unsubscribe behavior, and Vue-native template-facing value refs around Firebase listeners
- admin form state - covered by `src/__tests__/useAdminFormState.spec.ts`; Users and Employees consume feature form-state composables for create/detail defaults, selected-record hydration, selected-record snapshot/dirty checks, field updates, assignment cleanup, target-only role assignment suppression, syncing flags, and reset/error callbacks
- admin create/detail actions - covered by `src/__tests__/useAdminActions.spec.ts`; Users and Employees consume feature action composables for create/update/delete service calls, pending-invite sends, selected-record dirty checks, autosave guards, target-only stored role preservation, Users assigned-job toggle/autosave behavior, validation, selection resets, and busy/error/info state cleanup
- admin records and view sync - covered by `src/__tests__/useAdminRecordsSync.spec.ts`; Users and Employees consume feature records/sync composables for listener startup/error/cleanup behavior, stale selection fallback, selected-record hydration, create-mode resets, lifecycle wiring, and neutral ref-contract selection inputs
- admin derived view state - covered by `src/__tests__/useAdminViewState.spec.ts`; Users and Employees consume feature view-state composables for filtering, selected-record lookup, create-mode flags, status counts, assignment options, pending invites, passive-save success-toast filtering, and confirmation copy
- auth route helpers - covered by `src/__tests__/authViewHelpers.spec.ts`; public auth routes consume feature helpers for validation copy, route query normalization/email prefill, forgot-password navigation targets, password-created login info, workspace redirect gating, and setup-link parsing
- timecard print route helpers - covered by `src/__tests__/timecardPrintViewHelpers.spec.ts`; Timecard Export print route consumes feature helpers for export-id parsing, card-page chunking, generated timestamp formatting, and missing-payload copy
- timecard print route orchestration - covered by `src/__tests__/useTimecardPrintRoute.spec.ts`; Timecard Export print route consumes the composable for stored-payload loading, missing-payload state, paged-card derivation, print scheduling, and duplicate-print guards while `TimecardPrintRouteContent` owns route rendering without touching `TimecardPrintCard` visuals
- reference list route helpers - covered by `src/__tests__/referenceListViewHelpers.spec.ts`; Reference List consumes feature helpers for route-key normalization, unknown-key fallback behavior, and title copy
- reference list page shell - covered by `src/__tests__/ReferenceListPageShell.spec.ts`; Reference List consumes a scaffold-level page shell for app-shell/page-panel/placeholder composition while the route stays helper-only until real CRUD work begins
- job dashboard page shell - covered by `src/__tests__/JobDashboardPageShell.spec.ts`; Job Dashboard consumes a feature page shell for app-shell/workspace-shell composition while the route keeps only route job context, lifecycle, and module wiring
- job view helpers - covered by `src/__tests__/jobViewHelpers.spec.ts`; Jobs consumes the helper for detail autosave success-toast filtering so route-level message noise policy stays tested outside the page component
- shop order view helpers - covered by `src/__tests__/shopOrderViewHelpers.spec.ts`; Shop Orders consumes the helper for success-toast filtering so route-level message noise policy stays tested outside the page component
- dirty snapshot guard - covered by `src/__tests__/dirtySnapshotGuard.spec.ts`
- optimistic list behavior - covered by `src/__tests__/optimisticRecords.spec.ts`; shop-order item persistence is the first consumer
- pending action state that only disables the affected control - first implementation covered by `src/__tests__/usePendingActionMap.spec.ts`; shop-order catalog item add rows are the first consumer
- recipient normalization/add/remove helpers - covered by `src/__tests__/recipientEmails.spec.ts`; Jobs and Daily Logs are the first shared workflow consumers
- recipient editor state and keyed/value-based add preparation - covered by `src/__tests__/useRecipientEditor.spec.ts`; Jobs and Daily Logs consume the composable while keeping persistence feature-owned
- shop order tree construction - covered by `src/__tests__/shopOrderCatalogTree.spec.ts`
- shop order records subscription - covered by `src/__tests__/useShopOrderRecords.spec.ts`; Shop Orders consume the composable for current-job order listener startup, replacement cleanup, normalized listener/startup errors, local record replacement, and neutral job-id ref input
- shop order workspace state - covered by `src/__tests__/useShopOrderWorkspaceState.spec.ts`; Shop Orders consume the composable to derive selected order, edit/disabled state, history buckets, totals, and alphabetized items without creating drafts implicitly
- shop order meta form/autosave state - covered by `src/__tests__/useShopOrderMetaForm.spec.ts`; Shop Orders consume the composable to protect local comments/delivery-date edits from stale remote echoes while debouncing metadata persistence through neutral selected-order/editability ref inputs
- shop order custom item form - covered by `src/__tests__/useShopOrderCustomItemForm.spec.ts`; Shop Orders consume the composable for custom item defaults and same-object reset after successful saves
- shop order item actions - covered by `src/__tests__/useShopOrderItemActions.spec.ts`; Shop Orders consume the composable for catalog/custom item mutation, quantity edits, and remove-confirm behavior while persistence stays injected
- shop order item notes - covered by `src/__tests__/useShopOrderItemNotes.spec.ts`; Shop Orders consume the composable to keep note drafts local while debouncing saves, flushing on blur, suppressing unchanged/read-only writes, and queueing follow-up saves when persistence is already pending through a neutral selected-order ref input
- shop order draft actions - covered by `src/__tests__/useShopOrderDraftActions.spec.ts`; Shop Orders consume the composable for explicit draft creation, existing-draft reuse, and validated item-action targets
- shop order persistence - covered by `src/__tests__/useShopOrderPersistence.spec.ts`; Shop Orders consume the composable for metadata writes, optimistic item replacement, rollback, serialized item-save queueing, and loading/message state
- shop order submission actions - covered by `src/__tests__/useShopOrderSubmissionActions.spec.ts`; Shop Orders consume the composable for draft delete confirmation, submit validation, metadata-save-before-confirm, status update, email send, and partial email-failure reporting
- shop order selection synchronization - covered by `src/__tests__/useShopOrderSelectionSync.spec.ts`; Shop Orders consume the composable/helper to keep history-order selection, fallback selection, selected-order form hydration, note drafts, and metadata save queueing coordinated as order records change through neutral order-list/selection ref inputs
- shop order subscription lifecycle - covered by `src/__tests__/useShopOrderSubscriptionLifecycle.spec.ts`; Shop Orders consume the composable to start/stop route, catalog, and order subscriptions while clearing local pending save/note state on job changes and unmount
- timecard keyboard navigation helpers - covered by `src/__tests__/timecardWorkbookNavigation.spec.ts`
- job timecard week selection actions - covered by `src/__tests__/useJobTimecardWeekSelectionActions.spec.ts`; job Timecards consume the composable for selected-week switching, typed week-ending normalization, pending-save flushing, create-tray closing, and native date-picker opening
- job timecard card creation actions - covered by `src/__tests__/useJobTimecardCreateActions.spec.ts`; job Timecards consume the composable for employee/custom card creation, duplicate employee pages, custom-card validation, wage parsing, next sort-index selection, create-tray cleanup, card selection, scrolling, and failure messages
- job timecard UI adapters - covered by `src/__tests__/useJobTimecardUiAdapters.spec.ts`; job Timecards consume the create-tray and confirm-dialog adapters for create-tray visibility/form reset behavior and remove-card/submit-week confirmation copy, destructive state, and busy-close prevention
- job timecard week lifecycle actions - covered by `src/__tests__/useJobTimecardWeekActions.spec.ts`; job Timecards consume the composable for create/open week orchestration, empty draft backfill, ensure payload construction, duplicate in-flight guards, loading cleanup, and failure messages
- job timecard card actions - covered by `src/__tests__/useJobTimecardCardActions.spec.ts`; job Timecards consume the composable for delete confirmation payloads, card removal, card sorting, submit confirmation payloads, submit-week execution, confirmation dispatch, pending-save flushing, loading cleanup, and action error messages
- job timecard card workspace actions - covered by `src/__tests__/useJobTimecardCardWorkspaceActions.spec.ts`; job Timecards consume the composable for workspace reset cleanup, page/save message reset, visible-card UI pruning, read-only checks, scroll-to-card behavior, workbook-change total recalculation, card selection, and save scheduling
- job timecard workspace sync - covered by `src/__tests__/useJobTimecardWorkspaceSync.spec.ts`; job Timecards consume the composable for selected-week, selected-date, route-job, subscribed-job, burden, and visible-card watcher side effects
- job timecard subscription lifecycle - covered by `src/__tests__/useJobTimecardSubscriptionLifecycle.spec.ts`; job Timecards consume the composable for mount/unmount subscription startup/cleanup plus route-job, week, and card subscription helper behavior
- job timecard access derivation - covered by `src/__tests__/useJobTimecardAccess.spec.ts`; job Timecards consume the composable for route-level workflow/report access, stale profile-assignment repair from the job record, Shop-job identity input, and manager/current-user/submitted-report week-subscription mode selection
- job timecard save queue - covered by `src/__tests__/useJobTimecardSaveQueue.spec.ts`; job Timecards consume the wrapper around the shared timecard save queue to gate saves by editable selected week and persist card changes through the Timecard service with week, start-date, and burden context
- job timecard workspace state - covered by `src/__tests__/useJobTimecardWorkspaceState.spec.ts`; job Timecards consume the composable for selected-week derivation, selected-week start fallback, filters, permissions/create state, burden fallback, and recent weeks
- job timecard summary - covered by `src/__tests__/useJobTimecardSummary.spec.ts`; job Timecards consume the composable for account summaries, totals, week/job labels, save status, linked job number, and empty-canvas guidance
- job timecard records adapter - covered by `src/__tests__/useJobTimecardRecords.spec.ts`; job Timecards consume the composable for employee/week/card subscription setup, foreman filtering, card merge protection for pending local save state, loading state, unsubscribe behavior, and records error fallbacks
- timecard state-map helpers - covered by `src/__tests__/timecardStateMapHelpers.spec.ts`; job Timecards and Timecard Export consume shared pending save-state map collection plus in-place state-map clear/prune helpers
- timecard export view helpers - covered by `src/__tests__/timecardExportViewHelpers.spec.ts`; Timecard Export consumes route helper constants for toolbar date modes, week-status options, and the shared numeric/base collator
- timecard export filters - covered by `src/__tests__/useTimecardExportFilters.spec.ts`; Timecard Export consumes the composable for current-week defaults, date snapping, range bounds, toolbar filter normalization, and week filtering
- timecard export visible cards - covered by `src/__tests__/useTimecardExportVisibleCards.spec.ts`; Timecard Export consumes the composable for create-week card lookup, card search, and filtered-card ordering
- timecard export summary - covered by `src/__tests__/useTimecardExportSummary.spec.ts`; Timecard Export consumes the composable for totals, account summaries, result labels, save/status signals, empty-state copy, PDF subtitle text, and CSV filenames
- timecard export create context - covered by `src/__tests__/useTimecardExportCreateContext.spec.ts`; Timecard Export consumes the composable for job/foreman/employee options, target create-week resolution, owner context, and create-tray guidance
- timecard export create defaults - covered by `src/__tests__/useTimecardExportCreateDefaults.spec.ts`; Timecard Export consumes the composable for stable default job/foreman selection as filters, target weeks, and option lists change
- timecard export mutation actions - covered by `src/__tests__/useTimecardExportMutationActions.spec.ts`; Timecard Export consumes the composable for remove-card and delete-draft confirmations, pending-save flushing, delete service calls, archive cache cleanup, success/error messaging, and confirmation dispatch
- timecard export create actions - covered by `src/__tests__/useTimecardExportCreateActions.spec.ts`; Timecard Export consumes the composable for employee/custom card creation, synthetic week creation, filter synchronization, create-tray cleanup, edit-mode selection, scroll side effects, and create failure handling
- timecard export download actions - covered by `src/__tests__/useTimecardExportDownloadActions.spec.ts`; Timecard Export consumes the composable for PDF/CSV empty guards, pending-save flushing, PDF payload storage/print-route navigation, CSV build/download orchestration, and output success/error messaging
- timecard export filtered-week sync - covered by `src/__tests__/useTimecardExportFilteredWeekSync.spec.ts`; Timecard Export consumes the composable for flushing pending saves before filtered-week card-set changes, resetting page/workspace state, syncing archive cards, and cancelling stale async sync work
- timecard export side effects - covered by `src/__tests__/useTimecardExportSideEffects.spec.ts`; Timecard Export consumes the composable for job-burden redecorating and visible-card selection synchronization watchers through a neutral ordered-card `ReadonlyRef` input
- timecard export lifecycle - covered by `src/__tests__/useTimecardExportLifecycle.spec.ts`; Timecard Export consumes the composable for mount-time subscription startup and unmount-time save queue, measurement, card, employee, user, and week cleanup ordering
- timecard export subscriptions - covered by `src/__tests__/useTimecardExportSubscriptions.spec.ts`; Timecard Export consumes the composable for saved-week, employee, and foreman subscription adapters, feature-specific error forwarding, and Timecard Export permission-gated employee/user loading
- timecard export save queue - covered by `src/__tests__/useTimecardExportSaveQueue.spec.ts`; Timecard Export consumes the wrapper around the shared save queue to gate saves by editable export weeks and persist archive card changes through the Timecard service with archive week id, week start date, card payload, and burden context
- timecard export UI adapters - covered by `src/__tests__/useTimecardExportUiAdapters.spec.ts`; Timecard Export consumes small adapters for mobile toolbar tab state, admin card edit-mode state through a neutral edit-permission ref, create-tray field state, and confirmation-dialog copy/close behavior
- timecard export card workspace actions - covered by `src/__tests__/useTimecardExportCardWorkspaceActions.spec.ts`; Timecard Export consumes the composable for workspace cleanup, page/save message reset, valid-card UI pruning, selection synchronization, workbook-change recalculation/save scheduling, scrolling, and employee-header lock rules
- timecard export archive cards - covered by `src/__tests__/useTimecardExportArchiveCards.spec.ts`; Timecard Export consumes the composable for per-week archive card subscriptions, late card-change handler registration, loading/cache state, archive decoration, stale subscription cleanup, pending local-state merge protection, burden redecorating, delete cache cleanup, and sort-index derivation
- runtime schema/normalization helpers
- pagination/query helper behavior where added

### Responsiveness Regression Tests

Add focused tests as optimistic workflow helpers are adopted by more workflows:

- slow save still leaves text inputs editable
- adding an item shows the item locally before remote confirmation - first covered in shop-order E2E plus `optimisticRecords` unit coverage
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
