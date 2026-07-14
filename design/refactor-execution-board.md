# Refactor Execution Board

Date started: 2026-07-08

Purpose: this is the working board for the refactor. The design docs define the target. This file tracks the actual slices we intend to implement, what each slice is allowed to touch, and which tests must pass before moving on.

## Status Legend

- `Backlog`: known slice, not started.
- `Ready`: scope is small enough and tests are identified.
- `In Progress`: currently being worked.
- `Blocked`: waiting on product answer, tooling, test setup, or another slice.
- `Done`: implemented, tested, and documented.
- `Deferred`: valid idea, intentionally not part of the current refactor pass.

## Execution Rules

- One slice should have one primary goal.
- Do not mix UI extraction with Firestore Rules, Storage Rules, Cloud Functions, PDF rendering, or email rendering.
- Do not touch timecard workbook/PDF internals unless the slice is specifically a timecard output/input slice.
- Preserve `data-testid` values unless a test is updated in the same slice.
- Prefer props/events for extracted components.
- Keep Firebase SDK usage inside services, stores that are explicitly integration boundaries, or Cloud Functions.
- Add tests before or during the slice, not after several slices have accumulated.

## Baseline Checkpoint

Before the first implementation slice, run and record:

```sh
npm run type-check
npm run test:e2e
npm --prefix functions run smoke:daily-log-email
npm --prefix functions run smoke:shop-order-email
npm --prefix functions run smoke:timecard-email
```

If a command fails for known environmental reasons, record:

- command
- failure summary
- whether it blocks refactor work
- owner/next action

## Current Board

| ID | Slice | Status | Primary Goal | Allowed Files | Do Not Touch | Required Tests | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R00 | Baseline checkpoint | Done | Establish known test/build state before refactor work. | none, unless docs need status notes | app code | `npm run type-check`, `npm run test:e2e`, function smoke scripts | Baseline result is recorded in this file or a dated note. |
| R01 | Capability helper scaffold, current behavior only | Done | Introduce a frontend capability helper that reproduces current permissions without changing behavior. | `src/types`, `src/stores/auth.ts`, route/page checks as needed, tests | `firestore.rules`, `storage.rules`, functions | `npm run type-check`; `npx playwright test e2e/access-control.spec.ts e2e/job-dashboard.spec.ts --project=chromium` | Existing admin/foreman/project-manager behavior is unchanged and route checks use helper in at least one real path. |
| R02 | Shared `RecipientEditor` | Done | Extract repeated recipient add/remove/list UI. | Jobs/daily log recipient sections, new shared component, focused tests | Rules, functions, email delivery | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Recipient behavior and saved data are unchanged; parent view gets smaller. |
| R03 | Shared confirmation primitive | Done | Replace direct `window.confirm` in one low-risk admin page. | new confirm component/composable, one admin page | destructive behavior semantics, rules/functions | `npm run type-check`; `npx playwright test e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium` | User-facing copy and confirmation behavior are preserved or intentionally improved. |
| R04 | Shop order catalog browser extraction | Done | Extract catalog tree/search/expand/collapse from `ShopOrdersView`. | shop order catalog browser component/composable, `ShopOrdersView.vue` integration | shop order PDF/email, submit callable, rules | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Search can still expand/collapse folders and item names remain clean. |
| R05 | Daily log save-on-blur composable | Done | Isolate dirty guard/save-on-blur behavior. | daily log page, new composable, focused tests | attachments/email/rules/functions | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | Typing spaces and unsaved edits are not overwritten while persistence is pending. |
| R06 | First visual token pass | Done | Normalize the smallest useful set of color/space/radius/type tokens before GUI polish. | `src/styles/main.css` or new imported token file, one low-risk component/page if needed | print/email/PDF CSS, timecard print/workbook dimensions | `npm run type-check`; targeted E2E for touched route | New visual work uses tokens instead of new one-off values. |
| R07 | Role capability implementation | Backlog | Add target roles and enforce capabilities across app/rules/functions. | types, auth store, router, rules, functions, e2e runtime, role tests | unrelated UI polish, PDF/email layout | Requires rules emulator tests before rules changes; E2E access-control expansion | Payroll, Shop Foreman, PM, Foreman, Admin behavior matches `role-capability-matrix.md`. |
| R08 | Firestore Rules emulator test suite | Deferred | Add lower-layer security tests before broad role/rules changes. | test config, rules tests, package scripts if needed | app visual code | emulator test command to be defined | Rules behavior is testable without relying only on Playwright. |
| R09 | Function status/idempotency cleanup | Backlog | Make submit/email functions report reliable status and avoid duplicate sends. | Cloud Functions, function tests | UI extraction, CSS | function unit tests/smoke scripts | Daily log/shop order/timecard sends have consistent status metadata. |
| R10 | CSS ownership split | Done | Move global CSS toward tokens/base/components/vendor/page ownership. | styles and touched components | workflow behavior, print/PDF output | targeted E2E for each moved page | `main.css` gets smaller or more foundational. |
| R11 | Shared auth card ownership | Done | Move shared auth/not-found shell markup and styles out of global CSS. | auth public views, shared auth component, global CSS cleanup | auth service behavior, routing semantics, Firebase config flow | `npm run type-check`; `npx playwright test e2e/public-routes.spec.ts e2e/access-control.spec.ts --project=chromium` | Public auth routes render the same while `main.css` no longer owns `auth-*` selectors. |
| R12 | Shared panel component style ownership | Done | Move already-componentized panel/placeholder styles out of global CSS. | `PagePanel`, `ModulePlaceholder`, global CSS cleanup | feature page behavior, route structure, PDF/email/print CSS | `npm run type-check`; `npx playwright test e2e/job-dashboard.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Shared panel components render through their owners while `main.css` drops their selectors. |
| R13 | Jobs/dashboard CSS ownership cleanup | Done | Move active dashboard/reference styles to owning views and remove stale legacy jobs styles from global CSS. | `JobDashboardView`, `ReferenceListView`, global CSS cleanup | workflow behavior, AppShell/Auth/PagePanel styles, PDF/email/print CSS | `npm run type-check`; `npx playwright test e2e/job-dashboard.spec.ts e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Dashboard/reference routes render from scoped styles and `main.css` drops stale jobs/dashboard selectors. |
| R14 | Admin empty-state primitive adoption | Done | Replace duplicated users/employees empty/loading/no-selection blocks with the shared `AppEmptyState` primitive. | `UsersView`, `EmployeesView` | admin save/delete semantics, Firebase services, rules/functions | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Users and employees admin pages keep behavior while using the shared empty-state component. |
| R15 | Loading button primitive adoption | Done | Replace duplicated create/send loading-label buttons with `AppLoadingButton` on low-risk admin/job paths. | `UsersView`, `EmployeesView`, `JobsView` | delete/archive semantics, danger-button styling, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | Admin and jobs create/send workflows keep behavior while using the shared loading button primitive. |
| R16 | Admin directory filter helper | Done | Extract shared active/inactive/both and search matching logic used by Users and Employees. | `UsersView`, `EmployeesView`, `src/utils`, unit tests | list row UI, persistence, role behavior, Firebase services | `npm run type-check`; `npm run test:unit -- --run`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Users and employees filtering behavior is preserved behind one shared pure helper. |
| R17 | Jobs directory filter helper adoption | Done | Reuse the directory filter helper for jobs active/inactive/both and search filtering. | `JobsView`, shared directory filter tests | job row UI, job persistence, recipient workflows, Firebase services | `npm run type-check`; `npm run test:unit -- --run`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Jobs page filtering behavior is preserved behind the shared helper. |
| R18 | Jobs confirmation dialog adoption | Done | Replace native archive/delete browser confirms with the shared app confirmation dialog. | `JobsView`, jobs E2E | archive/delete semantics, Firebase services, rules/functions | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Jobs archive/restore/delete still work through app-native confirmations. |
| R19 | Jobs empty-state primitive adoption | Done | Replace duplicated Jobs empty/loading/no-selection blocks with `AppEmptyState`. | `JobsView` | filtering behavior, persistence, confirmation behavior, Firebase services | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Jobs page keeps behavior while using the shared empty-state primitive. |
| R20 | Shop order items editor extraction | Done | Move added-item list rendering/edit controls out of `ShopOrdersView` into a focused feature component. | `ShopOrdersView`, `ShopOrderItemsEditor` | shop order submit/email/PDF, catalog browser behavior, Firestore services | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Add/edit/remove/submit item workflows keep behavior while item-list UI lives in a component. |
| R21 | Shop order history list extraction | Done | Move order history list rendering/selection out of `ShopOrdersView` into a focused feature component. | `ShopOrdersView`, `ShopOrderHistoryList` | delete-draft action, submit/email/PDF, Firestore services | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Order history display and selection behavior stay unchanged while history UI lives in a component. |
| R22 | Users confirmation dialog adoption | Done | Replace native user delete browser confirm with the shared app confirmation dialog. | `UsersView`, admin management E2E | delete semantics, Auth/Firestore services, rules/functions | `npm run type-check`; `npx playwright test e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium` | User deletion still works through an app-native confirmation. |
| R23 | Shop order confirmation dialog adoption | Done | Replace native shop-order remove/delete-draft/submit browser confirms with the shared app confirmation dialog. | `ShopOrdersView`, shop order E2E | submit/email/PDF behavior, Firestore services | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Shop order destructive/submit confirmations use app dialogs while workflows keep behavior. |
| R24 | Daily log confirmation dialog adoption | Done | Replace native daily-log draft delete browser confirm with the shared app confirmation dialog. | `DailyLogsView`, daily-log draft E2E | submit/email behavior, attachment upload/delete services, Firestore services | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Daily log draft deletion still removes the draft through an app-native confirmation. |
| R25 | Shop catalog confirmation dialog adoption | Done | Replace native shop-catalog archive/delete browser confirms with the shared app confirmation dialog. | `ShopCatalogAdminView`, admin pages E2E | catalog create/edit/move semantics, Firebase services, rules/functions | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Shop catalog archive/delete workflows still work through app-native confirmations. |
| R26 | Job timecard confirmation dialog adoption | Done | Replace native job-timecard delete-card and submit-week browser confirms with the shared app confirmation dialog. | `TimecardsView`, timecard workbook E2E | workbook input behavior, rollover, submit/email function, export page | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Job timecard submit/remove workflows still work through app-native confirmations. |
| R27 | Timecard export confirmation dialog adoption | Done | Replace native timecard-export delete-card and delete-draft-week browser confirms with the shared app confirmation dialog. | `TimecardExportView`, admin pages E2E | payroll export filters, CSV/PDF export, card lock/edit behavior, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Timecard export delete workflows still work through app-native confirmations. |
| R28 | Confirmation test hardening and docs alignment | Done | Remove the E2E browser-confirm shim and update refactor docs to match the completed `ConfirmDialog` migration. | E2E fixture, refactor docs | app workflow logic, Firebase services, PDF/email output | `npm run type-check`; `npm run test:unit -- --run`; `npx playwright test --project=chromium` | Future E2E fails if app code reintroduces native browser confirms. |
| R29 | Daily log history list extraction | Done | Move daily-log history/date search rendering out of `DailyLogsView` into a focused component with shared label formatting. | `DailyLogsView`, `DailyLogHistoryList`, daily-log formatting helper | draft save/submit/email behavior, attachment services, Firestore services | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Daily log history selection/date search behavior stays unchanged while history UI lives in a component. |
| R30 | Daily log selected card extraction | Done | Move selected daily-log summary/delete affordance out of `DailyLogsView` into a focused component. | `DailyLogsView`, `DailyLogSelectedLogCard` | delete confirmation/service behavior, draft save/submit/email behavior, attachments | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Selected-log status, metadata, empty state, and delete-draft affordance keep behavior while UI lives in a component. |
| R31 | Daily log text section extraction | Done | Move repeated daily-log text-section rendering out of `DailyLogsView` into a focused component. | `DailyLogsView`, `DailyLogTextSectionCard` | save-on-blur composable, submit/email behavior, attachments, Firestore services | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Text fields keep local typing and blur-save behavior while section UI lives in a component. |
| R32 | Daily log attachment card extraction | Done | Move repeated daily-log attachment card shells out of `DailyLogsView` into a focused component. | `DailyLogsView`, `DailyLogAttachmentCard` | upload/delete service logic, attachment picker internals, submit/email behavior | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Photo/PTP/QC attachment upload, description, and delete behavior stays unchanged while attachment card UI lives in a component. |
| R33 | Daily log recipients card extraction | Done | Move daily-log recipient email-list rendering out of `DailyLogsView` into a focused component. | `DailyLogsView`, `DailyLogRecipientsCard` | recipient persistence handlers, admin defaults loading, submit/email behavior | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Admin/default recipient display and per-log add/remove behavior stay unchanged while recipient UI lives in a component. |
| R34 | Daily log site info card extraction | Done | Move daily-log job/site metadata rendering out of `DailyLogsView` into a focused display component. | `DailyLogsView`, `DailyLogSiteInfoCard` | site-info computation, draft payload hydration, save/submit/email behavior | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Job/site metadata keeps the same display while the card UI lives in a component. |
| R35 | Daily log manpower card extraction | Done | Move daily-log manpower table rendering out of `DailyLogsView` into a focused component. | `DailyLogsView`, `DailyLogManpowerCard` | draft save semantics, submit validation, Firestore services | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Manpower add/remove/edit behavior stays unchanged while the table UI lives in a component. |
| R36 | Daily log indoor climate card extraction | Done | Move daily-log indoor climate table rendering out of `DailyLogsView` into a focused component. | `DailyLogsView`, `DailyLogIndoorClimateCard` | draft save semantics, submit validation, Firestore services | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Indoor climate add/remove/edit behavior stays unchanged while the table UI and table styles live in a component. |
| R37 | Shop order custom item form extraction | Done | Move the shop-order custom-item form out of `ShopOrdersView` into a focused component. | `ShopOrdersView`, `ShopOrderCustomItemForm` | add-item persistence, catalog browser behavior, submit/email/PDF behavior | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Custom item description/quantity/note entry and add behavior stay unchanged while the form UI lives in a component. |
| R38 | Shop order selected panel extraction | Done | Move selected-order metadata, delivery date, shortcut, comments, and status badges out of `ShopOrdersView`. | `ShopOrdersView`, `ShopOrderSelectedOrderPanel` | order metadata autosave, item editor/history behavior, submit/email/PDF behavior | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Selected order details and editable metadata keep behavior while the panel UI lives in a component. |
| R39 | Shop order stale component CSS cleanup | Done | Remove item/history styles from `ShopOrdersView` now owned by extracted child components. | `ShopOrdersView` | item editor/history component internals, submit/email/PDF behavior | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Parent Shop Orders styling now only keeps parent-owned workspace styles and a dedicated delete-draft button style. |
| R40 | Shop catalog root inspector extraction | Done | Move the Shop Catalog root inspector overview/help cards out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogRootInspector` | tree interactions, create/edit/archive/delete forms, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Root catalog overview stays unchanged while the first Shop Catalog admin inspector UI lives in a component. |
| R41 | Shop catalog create panels extraction | Done | Move create-folder and create-item inspector form shells out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogCreateCategoryPanel`, `ShopCatalogCreateItemPanel` | create/save service handlers, tree interactions, archive/delete flows | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Create folder/item workflows keep behavior while creation UI lives in focused components. |
| R42 | Shop catalog detail panels extraction | Done | Move selected-folder and selected-item inspector form shells out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogCategoryDetailPanel`, `ShopCatalogItemDetailPanel` | save/archive/delete handlers, tree interactions, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Edit/archive/delete workflows keep behavior while detail inspector UI lives in focused components. |
| R43 | Shop catalog stale inspector CSS cleanup | Done | Remove inspector form/card/action styles from `ShopCatalogAdminView` now owned by child components. | `ShopCatalogAdminView`, shop catalog components | tree styling, create/detail component internals, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Parent Shop Catalog styling now only keeps parent-owned tree/search/pane styles. |
| R44 | Shop catalog context menu extraction | Done | Move context-menu rendering/styles out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogContextMenu` | context action construction, tree interactions, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Context menu create/archive/delete workflows keep behavior while menu UI lives in a component. |
| R45 | Shop catalog mobile nav extraction | Done | Move the responsive Catalog/Inspector tab switcher out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogMobileNav` | desktop tree/inspector behavior, catalog actions, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Mobile panel switching UI owns its PrimeVue button dependency and responsive styles. |
| R46 | Shop catalog tree header/filter extraction | Done | Move tree title, search, and archived toggle UI out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogTreeHeader`, `ShopCatalogTreeFilters` | tree node interactions, context actions, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Shop Catalog search and archived toggle behavior stay unchanged while controls own their styles. |
| R47 | Timecard export summary panel extraction | Done | Move Current Results/Totals summary UI out of `TimecardExportView`. | `TimecardExportView`, `TimecardExportSummaryPanel` | export filters, workbook editing, CSV/PDF generation, Firebase services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Timecard Export totals/account summary display stays unchanged while summary UI owns its styles. |
| R48 | Timecard export helper extraction | Done | Move pure Timecard Export formatting/sorting/state-map helpers out of the view. | `TimecardExportView`, `exportViewHelpers` | subscriptions, save pipeline, workbook component, PDF/CSV builders | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Sorting, display labels, employee seed creation, and state-map clearing remain unchanged behind shared helpers. |
| R49 | Timecard export message banner extraction | Done | Move Timecard Export page error/info banner UI out of `TimecardExportView`. | `TimecardExportView`, `TimecardExportMessage` | export logic, save pipeline, workbook component, toolbar behavior | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Error/info banner behavior and workbook-paper styling stay unchanged while banner UI owns its styles. |
| R50 | Timecard export status bar extraction | Done | Move Timecard Export status strip/carousel UI and local carousel state out of `TimecardExportView`. | `TimecardExportView`, `TimecardExportStatusBar` | export filters, workbook editing, save pipeline, PDF/CSV builders | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Status labels and mobile carousel behavior stay unchanged while status UI owns its state and styles. |
| R51 | Timecard export saved weeks extraction | Done | Move Timecard Export saved-week history rendering out of `TimecardExportView`. | `TimecardExportView`, `TimecardExportSavedWeeksPanel` | week filtering/subscriptions, delete confirmation, workbook editing, export builders | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Saved-week rows and admin delete-draft affordance keep behavior while the panel owns its row styles. |
| R52 | Timecard export mobile tabs extraction | Done | Move Timecard Export responsive toolbar tab rendering out of `TimecardExportView`. | `TimecardExportView`, `TimecardExportToolbarTabs` | toolbar panel contents, filters, export actions, workbook editing | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Mobile tab ids/ARIA state and responsive tab styling stay unchanged while tabs own their styles. |
| R53 | Measured card scale composable | Done | Move reusable ResizeObserver-based card measurement/scaling mechanics out of `TimecardExportView`. | `TimecardExportView`, `useMeasuredCardScale` | workbook calculations, save pipeline, canvas markup, export builders | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Export cards keep their measured scale behavior while observer setup/cleanup lives in a composable. |
| R54 | Users directory panel extraction | Done | Move Users admin directory/search/status/invite panel rendering out of `UsersView`. | `UsersView`, `UserDirectoryPanel` | user create/update/delete services, detail editor, job assignment editor | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | User filtering, row selection, create mode, and pending-invite send workflows keep behavior while browser UI owns its styles. |
| R55 | Employees directory panel extraction | Done | Move Employees admin directory/search/status panel rendering out of `EmployeesView`. | `EmployeesView`, `EmployeeDirectoryPanel` | employee create/update/delete services, detail editor, occupation suggestions | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Employee filtering, row selection, create mode, and row labels keep behavior while browser UI owns its styles. |
| R56 | Shop catalog tree row extraction | Done | Move Shop Catalog root/category/item row rendering out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogTreeRootRow`, `ShopCatalogTreeNodeRow`, `treeTypes` | tree data construction, drag/drop/context menu handlers, create/edit/archive/delete services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Tree rows keep context menu, drag/drop, inline create/rename, and E2E hooks while row markup/styles live in components. |
| R57 | Timecard export create tray extraction | Done | Move admin create-card tray rendering out of `TimecardExportView`. | `TimecardExportView`, `TimecardExportCreateTray` | card creation handlers, week target resolution, subscriptions, workbook/PDF/CSV behavior | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Admin create-card tray keeps target selection, employee search, custom card entry, and add-card events while tray UI owns its styles. |
| R58 | Timecard export canvas panel extraction | Done | Move Timecard Export workbook canvas rendering out of `TimecardExportView`. | `TimecardExportView`, `TimecardExportCanvasPanel` | card save pipeline, subscriptions, filters, PDF/CSV builders, measured-scale composable internals | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Canvas cards keep collapse/edit/delete/measurement/workbook events while canvas markup/styles live in a component. |
| R59 | Job timecard measured scale composable adoption | Done | Reuse the shared card measurement/scaling composable in `TimecardsView`. | `TimecardsView`, `useMeasuredCardScale` | workbook input/save behavior, rollover, submit/email, create/delete card workflows | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Job timecard cards keep their scaled canvas behavior while ResizeObserver setup/cleanup is shared with Timecard Export. |
| R60 | Job timecard create tray extraction | Done | Move job timecard employee/custom-card create tray rendering out of `TimecardsView`. | `TimecardsView`, `JobTimecardCreateTray` | card creation handlers, save pipeline, rollover, submit/email, workbook canvas | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Employee-directory and custom-card create workflows keep behavior while tray markup/styles live in a component. |
| R61 | Job timecard toolbar extraction | Done | Move job timecard week filters/actions/sort/history/status toolbar rendering out of `TimecardsView`. | `TimecardsView`, `JobTimecardToolbar` | week creation/selection, create tray toggle, sorting, submit flow, save status, mobile tabs | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Toolbar state remains parent-controlled while toolbar markup, events, desktop layout, and mobile tab styling live in a component. |
| R62 | Shared timecard summary panel | Done | Replace duplicated job/export timecard totals summary UI with one shared component. | `TimecardsView`, `TimecardExportView`, `TimecardSummaryPanel` | totals calculations, account summary rows, Timecard Export admin flows, job workbook flows | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Job Timecards and Timecard Export share the same totals/account summary component without changing parent-owned calculations. |
| R63 | Job timecard canvas panel extraction | Done | Move job timecard workbook canvas rendering out of `TimecardsView`. | `TimecardsView`, `JobTimecardCanvasPanel` | workbook input/save behavior, card measurement refs, compact/read-only state, delete confirmation, submit/email | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Card rendering/test ids/measurement callbacks live in a component while save, selection, read-only, and delete logic stay parent-owned. |
| R64 | Job timecard helper extraction | Done | Move pure job timecard filter/sort/week/employee-seed helpers out of `TimecardsView`. | `TimecardsView`, `jobViewHelpers` | last-name sort rules, employee search, card search, display-week preference, card creation | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Job timecard helper rules are isolated without changing parent subscriptions or save behavior. |
| R65 | Jobs browser panel extraction | Done | Move Jobs list/search/status browser rendering out of `JobsView`. | `JobsView`, `JobBrowserPanel` | job filtering, edit-mode selection, field-user job navigation, create-mode entry | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Jobs browser search/filter/list behavior keeps its E2E hooks while browser UI/styles live in a component. |
| R66 | Jobs field-user assignment panel extraction | Done | Replace duplicated assigned field-user panel markup in Jobs create/edit with one component. | `JobsView`, `JobFieldUserAssignmentPanel` | assigned-id mutation, field-user filtering, job create/update/autosave behavior | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Create/edit assigned field-user UI keeps behavior and test ids while panel markup/styles live in a component. |
| R67 | Jobs notification recipients panel extraction | Done | Replace repeated Jobs email-recipient panel loops with one component. | `JobsView`, `JobNotificationRecipientsPanel` | recipient add/remove persistence, global/job/create recipient state, job autosave behavior | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Create, all-jobs, and selected-job recipient panels share one shell while persistence remains parent-owned. |
| R68 | Jobs detail form fields extraction | Done | Replace duplicated job create/edit field grids with one event-driven component. | `JobsView`, `JobDetailsFormFields` | create/save validation, autosave scheduling, job notification/assignment behavior | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Create/edit job fields share one typed field component while form state and persistence stay parent-owned. |
| R69 | Timecard export toolbar extraction | Done | Move the Timecard Export toolbar filters/actions/saved/status UI into one component. | `TimecardExportView`, `TimecardExportToolbar` | week/card subscriptions, export builders, create-card flow, delete confirmations, save pipeline | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Toolbar UI/styles are component-owned while filter state and export/create/delete behavior stay parent-owned. |
| R70 | Shop catalog tree pane extraction | Done | Move Shop Catalog tree-pane shell/rendering/styles out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogTreePane` | tree data construction, drag/drop/long-press behavior, inline create/rename saves, catalog persistence | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Catalog tree pane markup/styles are component-owned while all behavior and persistence stay parent-owned. |
| R71 | Shop catalog helper extraction | Done | Move pure Shop Catalog labels/search/price/summary helpers out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `adminViewHelpers` | catalog subscriptions, tree construction state, drag/drop, inline create/rename saves, catalog persistence | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Pure formatting/parsing/search helpers are isolated without changing catalog behavior. |
| R72 | Shop catalog inspector pane extraction | Done | Move the Shop Catalog inspector mode switcher/shell out of `ShopCatalogAdminView`. | `ShopCatalogAdminView`, `ShopCatalogInspectorPane` | create/save/archive/delete persistence, tree interactions, catalog subscriptions | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Inspector shell and child-panel routing are component-owned while parent keeps form state and persistence handlers. |
| R73 | Shop catalog tree builder extraction | Done | Move recursive tree node construction/search shaping into the Shop Catalog feature layer. | `ShopCatalogAdminView`, `adminViewHelpers`, `treeTypes` | selection, expansion state mutation, drag/drop, inline create/rename saves, catalog persistence | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Tree search/draft/category/item row shaping is feature-owned while parent keeps runtime state and handlers. |
| R74 | Shared catalog display helpers | Done | Reuse catalog search/name/summary helpers between Shop Catalog admin and Shop Orders. | `catalogDisplayHelpers`, `adminViewHelpers`, `ShopOrderCatalogBrowser` | shop-order add/search behavior, admin catalog persistence, PDF/email output | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium` | Catalog display/search helper logic has one neutral source shared by both workflows. |
| R75 | Shop order catalog tree helper extraction | Done | Move Shop Order catalog browser recursive tree/search shaping out of the component. | `ShopOrderCatalogBrowser`, `catalogBrowserHelpers` | add-item persistence, order item sorting, submit/email/PDF behavior | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Search, active-folder collapse, item labels, quantities, and add actions keep behavior while tree construction is feature-owned. |
| R76 | Timecard export filter helper extraction | Done | Move Timecard Export week/card filtering and summary labels out of the view. | `TimecardExportView`, `exportViewHelpers` | subscriptions, save pipeline, create-card flow, PDF/CSV builders, workbook rendering | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Filter results and status labels remain unchanged while pure calculations live in feature helpers. |
| R77 | Shop order view catalog display helper reuse | Done | Reuse shared catalog display helpers in the Shop Orders view. | `ShopOrdersView`, `catalogDisplayHelpers` | order item persistence, delivery defaults, submit/email/PDF behavior | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Shop Orders view no longer duplicates catalog folder/item display fallback rules. |
| R78 | Users assigned jobs panel extraction | Done | Move repeated user assigned-job picker markup into a focused component. | `UsersView`, `UserAssignedJobsPanel` | user create/update/delete services, autosave semantics, job filtering logic, role behavior | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Create/edit user assigned-job UI shares one component while filtering, selected-id mutation, autosave, and persistence stay parent-owned. |
| R79 | Users helper extraction | Done | Move pure user display, assigned-job search, and detail snapshot helpers out of `UsersView`. | `UsersView`, `UserAssignedJobsPanel`, `userViewHelpers` | user create/update/delete services, autosave timing, assignment filtering, role behavior | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | User helper rules have one feature-owned source while the view keeps subscriptions and persistence. |
| R80 | Shop order catalog row extraction | Done | Move root/category/item catalog row rendering out of `ShopOrderCatalogBrowser`. | `ShopOrderCatalogBrowser`, `ShopOrderCatalogTreeNodeRow` | catalog search/expand state, item quantity state, add-item persistence, context menu behavior | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Catalog row markup/styles are component-owned while browser state and persistence stay parent-owned. |
| R81 | Daily Logs helper extraction | Done | Move pure Daily Logs visibility, site-info, recipient, attachment, payload-prep, and submit-validation rules out of the view. | `DailyLogsView`, `dailyLogs/viewHelpers` | draft save-on-blur, create/delete draft flow, submit/email behavior, attachment upload/delete, recipient persistence | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | Daily Logs business rules are feature-owned while the page keeps subscriptions and persistence orchestration. |
| R82 | Daily Logs page header extraction | Done | Move Daily Logs title/actions/status badges/date-view message out of the view. | `DailyLogsView`, `DailyLogPageHeader` | draft save/create handlers, selected-log/date state, submit/delete/save flags, Daily Logs cards/sidebar | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | Page chrome markup/styles are component-owned while the view keeps all behavior and persistence. |
| R83 | Daily Logs sidebar extraction | Done | Move Daily Logs selected-log, recipients, and history sidebar composition out of the view. | `DailyLogsView`, `DailyLogSidebar` | selected-date/log state, delete draft handler, recipient persistence, history filtering, Daily Logs main form | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | Sidebar card composition/styles are component-owned while the view keeps state and persistence handlers. |
| R84 | Daily Logs photo attachment section extraction | Done | Move adjacent Photos/PTP attachment card configuration out of the Daily Logs view. | `DailyLogsView`, `DailyLogAttachmentSections` | attachment upload/delete persistence, description edits, QC attachment placement, save-on-blur draft behavior | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | Photo/PTP attachment card markup is component-owned while upload/remove/update handlers stay parent-owned and QC order is preserved. |
| R85 | Employees helper extraction | Done | Move pure employee display, validation, search, counts, suggestions, and snapshot helpers out of the view. | `EmployeesView`, `EmployeeDirectoryPanel`, `employeeViewHelpers` | employee create/update/delete services, blur-save timing, directory filtering, active/inactive/contractor behavior | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Employee helper rules have one feature-owned source while the view keeps subscriptions and persistence. |
| R86 | Employees editor panel extraction | Done | Move Employees create/edit form rendering and editor styles out of the view. | `EmployeesView`, `EmployeeEditorPanel`, `employeeViewHelpers` | employee create/update/delete services, blur-save timing, validation rules, directory filtering | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Employee editor markup/styles are component-owned while the view keeps reactive form state, autosave, and persistence handlers. |
| R87 | Users editor panel extraction | Done | Move Users create/edit/no-selection rendering and editor styles out of the view. | `UsersView`, `UserEditorPanel`, `userViewHelpers` | user create/update/delete services, invite send behavior, autosave timing, assigned-job mutation | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | User editor markup/styles are component-owned while the view keeps subscriptions, autosave, invites, and persistence handlers. |
| R88 | Jobs helper extraction | Done | Move pure job form, notification-recipient, display, validation, and serialization helpers out of the view. | `JobsView`, `jobViewHelpers`, Jobs child components | job create/update/delete/archive services, autosave timing, recipient persistence, routing | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Jobs helper rules have one feature-owned source while the view keeps subscriptions, timers, and persistence handlers. |
| R89 | Shop Orders helper extraction | Done | Move pure delivery-date, quantity, note, id, and order-meta serialization helpers out of the view. | `ShopOrdersView`, `shopOrders/viewHelpers` | subscriptions, submit/email behavior, item persistence, note-save timers, catalog browser behavior | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Shop Orders pure view rules have one feature-owned source while the view keeps subscriptions, timers, and persistence handlers. |
| R90 | Shop Catalog form helper extraction | Done | Move shared catalog form types, factories, hydration, reset, and validation helpers into the feature layer. | `ShopCatalogAdminView`, `shopCatalog/adminViewHelpers`, Shop Catalog form panels | drag/drop, long-press/context-menu behavior, catalog persistence service calls | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Catalog form rules and types have one feature-owned source while the view keeps service calls and interaction orchestration. |
| R91 | Shop Catalog confirmation helper extraction | Done | Move catalog confirmation action typing and dialog copy/destructive rules into the feature layer. | `ShopCatalogAdminView`, `shopCatalog/adminViewHelpers` | archive/delete service behavior, drag/drop, context menu action construction | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Catalog confirmation copy has one feature-owned source while the view keeps execution of confirmed actions. |
| R92 | Shop Catalog write payload helper extraction | Done | Move catalog create/update payload normalization into feature helpers. | `ShopCatalogAdminView`, `shopCatalog/adminViewHelpers` | inline rename payloads, drag/drop movement payloads, service implementations | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Create/edit catalog payload shaping has one feature-owned source while the view keeps service orchestration. |
| R93 | Shared timecard card display helpers | Done | Move duplicated workbook/print card row kinds, formatting, numeric parsing, and line display helpers into the feature layer. | `TimecardWorkbookCard`, `TimecardPrintCard`, `timecards/cardDisplayHelpers` | workbook mutation behavior, keyboard navigation, save pipeline, PDF/export builders | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Editable and printable timecard cards share display rules while each component keeps its own rendering and workflow behavior. |
| R94 | Timecard workbook navigation helper extraction | Done | Move workbook input selection and arrow-key target scoring into the feature layer. | `TimecardWorkbookCard`, `timecards/workbookNavigation` | workbook mutation behavior, numeric draft state, save pipeline, card rendering | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Workbook input navigation behavior is feature-owned while the card component keeps event hooks and editable state. |
| R95 | Timecard workbook footer extraction | Done | Move editable workbook footer markup and styles into a focused component. | `TimecardWorkbookCard`, `TimecardWorkbookFooter` | workbook mutation behavior, numeric draft state, navigation helpers, print card layout | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Footer markup/styles are component-owned while the parent keeps card mutation and save behavior. |
| R96 | Timecard workbook header extraction | Done | Move editable workbook header markup and styles into a focused component. | `TimecardWorkbookCard`, `TimecardWorkbookHeader` | workbook row grid mutation behavior, footer component, navigation helpers, print card layout | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Header markup/styles are component-owned while the parent keeps card mutation, wage draft parsing, and save behavior. |
| R97 | Shop Orders workspace pane extraction | Done | Move the right-side Shop Orders workspace shell and section chrome into a focused component. | `ShopOrdersView`, `ShopOrderWorkspacePane` | shop order subscriptions, autosave timers, item persistence, submit/email/PDF behavior | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Workspace layout is component-owned while the view keeps Firebase orchestration and persistence handlers. |
| R98 | Shop Catalog relationship helper extraction | Done | Move pure catalog child-map, visibility, descendant, and path helpers into the feature layer. | `ShopCatalogAdminView`, `shopCatalog/adminViewHelpers` | drag/drop handlers, context menu execution, inline create/rename persistence, catalog services | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Catalog relationship rules are feature-owned while the view keeps interaction state and service orchestration. |
| R99 | Timecard export confirmation helper extraction | Done | Move Timecard Export delete confirmation action typing and copy into the feature layer. | `TimecardExportView`, `timecards/exportViewHelpers` | delete-card/delete-week service behavior, export builders, workbook editing, subscriptions | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Timecard Export confirmation copy has one feature-owned source while the view keeps execution of confirmed actions. |
| R100 | Timecard export custom-card form helper extraction | Done | Move Timecard Export custom-card form defaults and validation into the feature layer. | `TimecardExportView`, `timecards/exportViewHelpers` | create-card service behavior, create-week resolution, export builders, subscriptions | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Custom-card form rules have one feature-owned source while the view keeps target resolution and create-card orchestration. |
| R101 | Timecard export option helper extraction | Done | Move Timecard Export job/foreman option building into the feature layer. | `TimecardExportView`, `timecards/exportViewHelpers` | toolbar behavior, create-card target resolution, subscriptions, export builders | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Dropdown/filter option rules have one feature-owned source while the view keeps selected filter state. |
| R102 | Timecard export archive-card helper extraction | Done | Move archive card typing, decoration, local-state merge, burden lookup, and sort-index rules into the feature layer. | `TimecardExportView`, `TimecardExportCanvasPanel`, `timecards/exportViewHelpers` | subscriptions, save pipeline, delete/export behavior, workbook rendering | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Archive-card rules have one feature-owned source while the view keeps subscriptions and persistence orchestration. |
| R103 | Timecard export display helper extraction | Done | Move Timecard Export employee filtering, headings, status labels, empty-state copy, week subtitles, and export filename/subtitle formatting into the feature layer. | `TimecardExportView`, `timecards/exportViewHelpers` | subscriptions, save pipeline, create-card orchestration, export execution | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Presentation copy/format rules have one feature-owned source while the view keeps reactive wiring and action handling. |
| R104 | Timecard export create-target helper extraction | Done | Move Timecard Export create-card job number, foreman option, selected foreman, and target week resolution rules into the feature layer. | `TimecardExportView`, `timecards/exportViewHelpers` | ensure-week/create-card service calls, validation execution, save/export behavior | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Create-card target rules have one feature-owned source while the view keeps Firebase orchestration. |
| R105 | Jobs view selector helper extraction | Done | Move job directory filtering, selected-job lookup, foreman filtering, job type/GC option building, status counts, and archive/delete confirmation copy into the feature layer. | `JobsView`, `jobs/jobViewHelpers` | subscriptions, autosave, create/update/delete/archive service calls, route actions | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Jobs selectors and copy have one feature-owned source while the view keeps persistence and routing orchestration. |
| R106 | Jobs form-state helper extraction | Done | Move Jobs create/detail form defaults, reset, and job-record hydration rules into the feature layer. | `JobsView`, `jobs/jobViewHelpers` | autosave, recipient state, validation execution, create/update service calls | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Jobs form shape has one feature-owned source while the view keeps messages, recipients, and persistence orchestration. |
| R107 | Jobs watcher decision helper extraction | Done | Move Jobs detail rehydration and visible-list selection decisions into the feature layer. | `JobsView`, `jobs/jobViewHelpers` | watcher mutation, autosave timers, subscriptions, route/edit drawer state | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts --project=chromium` | Watchers now delegate pure decisions while the view keeps state assignment and side effects. |
| R108 | Shop Catalog selector helper extraction | Done | Move Shop Catalog inspector ID parsing, visible counts, category option/parent filtering, root bucket checks, and selected item/category labels into the feature layer. | `ShopCatalogAdminView`, `shopCatalog/adminViewHelpers` | drag/drop, context menu actions, create/edit/archive/delete service calls, tree interaction state | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Catalog selectors and labels have one feature-owned source while the view keeps complex interactions. |
| R109 | Daily Logs view-state helper extraction | Done | Move Daily Logs title, edit/create eligibility, submitted-log detection, create button copy, and saved-field display into the feature layer. | `DailyLogsView`, `dailyLogs/viewHelpers` | draft save-on-blur composable, subscriptions, create/submit/delete service calls, attachment uploads | `npm run type-check`; `npx playwright test e2e/daily-log-*.spec.ts --project=chromium` | Daily Logs state decisions have one feature-owned source while the view keeps persistence and upload orchestration. |
| R110 | Job Timecards state helper extraction | Done | Move job timecard custom-card form defaults/reset/validation plus confirmation, week status, save status, and empty-state copy into the feature layer. | `TimecardsView`, `timecards/jobViewHelpers` | subscriptions, create/delete/submit service calls, save timers, workbook rendering | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Job timecard state/copy rules have one feature-owned source while the view keeps persistence and workbook orchestration. |
| R111 | Job Timecards merge helper extraction | Done | Move job timecard remote/local card merge and next sort-index rules into the feature layer. | `TimecardsView`, `timecards/jobViewHelpers` | snapshot subscription, save timers/promises, UI state cleanup, create-card service calls | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts --project=chromium` | Pending-save merge rules have one feature-owned source while the view keeps reactive state maps and persistence. |
| R112 | Shop Orders form/item helper extraction | Done | Move Shop Orders order/custom form defaults, order meta hydration, remove-item copy, sorted item cloning, item count, and total quantity into the feature layer. | `ShopOrdersView`, `shopOrders/viewHelpers` | subscriptions, autosave timers, item persistence, submit/email service calls, catalog interactions | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Shop order form/item rules have one feature-owned source while the view keeps persistence and email orchestration. |
| R113 | Shop Catalog drag/drop decision helper extraction | Done | Move Shop Catalog drag payload, drop-target, and drop-eligibility rules into the feature layer. | `ShopCatalogAdminView`, `shopCatalog/adminViewHelpers` | drag/drop browser events, auto-scroll, inline create/rename, catalog update service calls | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts --project=chromium` | Drag/drop decisions have one feature-owned source while the view keeps event handling and persistence. |
| R114 | Shared viewport context-menu positioning helper | Done | Replace duplicated context-menu viewport positioning math with a shared utility. | `ShopCatalogAdminView`, `ShopOrderCatalogBrowser`, `utils/viewportPosition` | context menu action behavior, archive/delete/add-item workflows, catalog persistence | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Floating menu positioning math has one shared source while each feature keeps its own menu actions. |
| R115 | Shared timecard state-map helper extraction | Done | Move duplicated reactive record clear/prune helpers out of job/export timecard views into a shared timecard helper. | `TimecardsView`, `TimecardExportView`, `timecards/stateMapHelpers` | save timing, save queue recursion, card persistence, workbook rendering, export actions | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Timecard view state cleanup has one shared source while save orchestration remains unchanged. |
| R116 | Shop Orders note-draft helper extraction | Done | Move Shop Orders item note draft cleanup and subscription sync rules into the feature layer. | `ShopOrdersView`, `shopOrders/viewHelpers` | note debounce timing, note save recursion, item persistence, submit/email flow | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Note draft sync has one feature-owned source while the view keeps save orchestration. |
| R117 | Shared mobile panel tabs component | Done | Replace duplicated Users/Employees mobile panel tab markup and styles with a shared common component. | `UsersView`, `EmployeesView`, `components/common/AppMobilePanelTabs` | user/employee persistence, directory filtering, editor forms, mobile panel state ownership | `npm run type-check`; `npx playwright test e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Mobile tab UI has one component-owned visual contract while pages keep state and workflow behavior. |
| R118 | Shared timecard save queue composable | Done | Move duplicated job/export timecard save timers, queued saves, active saves, flush, and prune behavior into one composable. | `TimecardsView`, `TimecardExportView`, `timecards/useTimecardSaveQueue` | card save payloads, `updateTimecardCard` service behavior, workbook rendering, export actions | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Timecard save queue mechanics have one reusable source while each view keeps save payload/context rules. |
| R119 | Shared timecard card selection composable | Done | Move duplicated job/export timecard selected-card and compact-card state behavior into one composable. | `TimecardsView`, `TimecardExportView`, `timecards/useTimecardCardSelection` | workbook rendering, admin edit-mode state, card scaling, save queue, export actions | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Card selection/compact state has one reusable source while export keeps admin-only card edit state. |
| R120 | Timecard composable unit coverage | Done | Add focused Vitest coverage for the shared timecard save queue and card selection composables. | `src/__tests__`, `timecards/useTimecardSaveQueue`, `timecards/useTimecardCardSelection` | view behavior, workbook rendering, Firebase services | `npm run test:unit -- --run`; `npm run type-check` | Shared timecard composables have direct behavioral tests in addition to real-route E2E coverage. |
| R121 | Shared timecard canvas panel chrome | Done | Move duplicated job/export timecard canvas shell markup and styles into one shared panel component. | `JobTimecardCanvasPanel`, `TimecardExportCanvasPanel`, `TimecardCanvasPanel` | inner workbook grid, print/PDF output, save queue, admin edit-mode behavior | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Job and export timecard canvases share outer panel/card-frame chrome while each keeps its own workbook slot and actions. |
| R122 | Shared timecard page message component | Done | Replace duplicated job/export timecard page message rendering with one feature component. | `TimecardsView`, `TimecardExportView`, `TimecardPageMessage` | message state rules, workbook rendering, export workflows | `npm run type-check`; `npx playwright test e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Timecard page info/error messages use one component while each view keeps its own message state. |
| R123 | Shared pane header primitive | Done | Move repeated pane eyebrow/title/action header markup into one common component. | `AppPaneHeader`, `UserDirectoryPanel`, `EmployeeDirectoryPanel`, `JobBrowserPanel` | directory filtering, editor forms, job create/edit behavior, subscriptions | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | Admin/users/employees/jobs browser headers share one visual primitive while feature panels keep their workflows. |
| R124 | Shared search input primitive | Done | Move repeated directory search input DOM/styling into one common input component. | `AppSearchInput`, `UserDirectoryPanel`, `EmployeeDirectoryPanel`, `JobBrowserPanel` | filtering selectors, list rendering, status filters, create/edit workflows | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | Admin/users/employees/jobs search controls share one input primitive while each panel keeps its filtering events and state. |
| R125 | Shared native select primitive | Done | Add a common native select wrapper and use it for directory status filters. | `AppSelect`, `UserDirectoryPanel`, `EmployeeDirectoryPanel`, `JobBrowserPanel` | search inputs, filter state, list rendering, create/edit workflows, global select CSS | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | Directory status filters share a Vue component API while existing select styling remains stable. |
| R126 | Shared badge/status primitive | Done | Move repeated status pill styles into one common badge component. | `AppBadge`, `UserDirectoryPanel`, `UserEditorPanel`, `EmployeeDirectoryPanel`, `EmployeeEditorPanel`, `JobsView` | row selection, edit forms, job archive/delete actions, filtering behavior | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | User/employee/job role and status pills share one visual primitive while surrounding workflows stay unchanged. |
| R127 | Additional native select migration | Done | Extend the shared select wrapper to user role and job type controls. | `AppSelect`, `UserEditorPanel`, `JobDetailsFormFields` | role assignment behavior, job autosave, form validation, existing global select CSS | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | User role and job type selects use the shared wrapper while preserving emitted field updates. |
| R128 | Complete native select wrapper migration | Done | Move remaining shop catalog native selects onto `AppSelect`. | `AppSelect`, `ShopCatalogCategoryDetailPanel`, `ShopCatalogCreateCategoryPanel`, `ShopCatalogCreateItemPanel` | catalog create/edit/archive/delete flows, category option rules, global select CSS | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | All app-owned native selects now render through `AppSelect`; only the wrapper owns the raw `<select>`. |
| R129 | Shop catalog shared pane headers | Done | Reuse `AppPaneHeader` for shop catalog create/detail panel headings. | `AppPaneHeader`, `ShopCatalogCategoryDetailPanel`, `ShopCatalogCreateCategoryPanel`, `ShopCatalogCreateItemPanel` | catalog form state, create/edit/archive/delete flows, panel body styling | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Shop catalog panel headers share the common heading primitive while keeping local panel borders and `h2` semantics. |
| R130 | Shared text input primitive | Done | Add a common text/date/number input wrapper and migrate core admin/job editor forms. | `AppTextInput`, `JobDetailsFormFields`, `UserEditorPanel`, `EmployeeEditorPanel` | user role/select behavior, employee blur-save behavior, job autosave, checkbox controls | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | Jobs, Users, and Employees editor inputs share one primitive while preserving field-update and blur-save behavior. |
| R131 | Shop catalog form input migration | Done | Extend `AppTextInput` to shop catalog create/detail forms. | `AppTextInput`, `ShopCatalogCategoryDetailPanel`, `ShopCatalogItemDetailPanel`, `ShopCatalogCreateCategoryPanel`, `ShopCatalogCreateItemPanel` | checkbox controls, tree filter/inline-edit controls, catalog create/edit/archive/delete flows | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Shop catalog form text/price fields share the text input primitive while price handlers still receive native input events. |
| R132 | Shop catalog tree primitive migration | Done | Reuse shared search/header primitives in the shop catalog tree and root inspector. | `AppPaneHeader`, `AppSearchInput`, `ShopCatalogTreeFilters`, `ShopCatalogTreeHeader`, `ShopCatalogRootInspector` | inline rename/create inputs, tree rows, drag/drop, create/edit/delete flows | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Shop catalog tree search and headers share common primitives while inline tree edit fields stay local. |
| R133 | Shared field wrapper first migration | Done | Add a common form field wrapper and migrate the job details form. | `AppField`, `JobDetailsFormFields` | job autosave, field controls, `AppTextInput`/`AppSelect` behavior | `npm run type-check`; `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium` | Job details fields share one field wrapper while form update behavior stays unchanged. |
| R134 | Admin editor field wrapper migration | Done | Reuse the common form field wrapper in Users and Employees editor forms. | `AppField`, `UserEditorPanel`, `EmployeeEditorPanel` | user create/invite/delete workflows, employee blur-save, role/job assignment controls | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Users and Employees editor fields share the field wrapper while form behavior stays unchanged. |
| R135 | Shop catalog field wrapper migration | Done | Reuse the common form field wrapper in shop catalog create/detail forms. | `AppField`, `ShopCatalogCategoryDetailPanel`, `ShopCatalogItemDetailPanel`, `ShopCatalogCreateCategoryPanel`, `ShopCatalogCreateItemPanel` | catalog create/edit/archive/delete flows, price formatting events, tree inline editing | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Shop catalog form fields share the field wrapper while catalog workflows stay unchanged. |
| R136 | Shared button primitive first migration | Done | Add a thin shared button wrapper and migrate low-risk directory create actions. | `AppButton`, `UserDirectoryPanel`, `EmployeeDirectoryPanel`, `JobBrowserPanel` | loading buttons, destructive buttons, row buttons, create workflow behavior | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | Directory create actions share a button primitive while existing global button styling and create flows stay unchanged. |
| R137 | Shop catalog action button migration | Done | Reuse the shared button wrapper for shop catalog non-destructive form actions. | `AppButton`, `ShopCatalogCategoryDetailPanel`, `ShopCatalogItemDetailPanel`, `ShopCatalogCreateCategoryPanel`, `ShopCatalogCreateItemPanel` | delete/danger buttons, catalog workflow behavior, price formatting events | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Shop catalog save/archive/create actions share `AppButton`; delete buttons remain feature-styled until danger styling is centralized. |
| R138 | Shop order action button migration | Done | Reuse the shared button wrapper for shop order non-destructive actions. | `AppButton`, `ShopOrderWorkspacePane`, `ShopOrderCustomItemForm`, `ShopOrderCatalogTreeNodeRow` | delete/danger buttons, order submit/create behavior, catalog item quantity behavior | `npm run type-check`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | Shop order create/submit/add actions share `AppButton` while workflow behavior stays unchanged. |
| R139 | Daily log action button migration | Done | Reuse the shared button wrapper for daily-log non-destructive actions. | `AppButton`, `DailyLogPageHeader`, `DailyLogHistoryList`, `DailyLogsView` | delete/danger buttons, save-on-blur inputs, attachments, submit validation/email behavior | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Daily-log save/create/today/submit buttons share `AppButton` while draft typing and submit workflows stay unchanged. |
| R140 | Shared danger button variant | Done | Centralize danger button styling and migrate the shared confirmation dialog. | `AppButton`, `ConfirmDialog`, `main.css` | feature delete buttons, confirmation semantics, dialog state management | `npm run type-check`; `npm run test:e2e -- --project=chromium` | `AppButton` supports `danger`, confirmations use it, and destructive workflows stay unchanged. |
| R141 | Shop catalog danger button cleanup | Done | Reuse the shared danger button variant for shop catalog delete actions. | `AppButton`, `ShopCatalogCategoryDetailPanel`, `ShopCatalogItemDetailPanel` | catalog delete semantics, archive/restore behavior, context menu danger styling | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Shop catalog delete buttons use `AppButton` danger styling while delete behavior stays unchanged. |
| R142 | Shop order danger button cleanup | Done | Reuse the shared danger button variant for shop order delete/remove actions. | `AppButton`, `ShopOrderItemsEditor`, `ShopOrderWorkspacePane` | remove-item/delete-draft semantics, order submit/create behavior, item autosave | `npm run type-check`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | Shop order remove/delete buttons use `AppButton` danger styling while workflows stay unchanged. |
| R143 | Daily log danger button cleanup | Done | Reuse the shared danger button variant for daily-log delete draft action. | `AppButton`, `DailyLogSelectedLogCard` | draft delete semantics, save-on-blur inputs, submit behavior | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-draft.spec.ts --project=chromium` | Daily-log delete draft button uses `AppButton` danger styling while delete behavior stays unchanged. |
| R144 | Admin and jobs danger button cleanup | Done | Reuse the shared danger button variant for user, employee, and job delete actions. | `AppButton`, `UserEditorPanel`, `EmployeeEditorPanel`, `JobsView` | delete semantics, job archive/restore behavior, autosave and assignments | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | User/employee/job delete buttons use `AppButton` danger styling while workflows stay unchanged. |
| R145 | Shared recipient and topbar button migration | Done | Reuse the shared button wrapper for recipient add and Jobs edit-mode topbar actions. | `AppButton`, `RecipientEditor`, `JobsView` | recipient add/remove semantics, Jobs edit drawer state, topbar layout | `npm run type-check`; `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-pages.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Recipient add and Jobs edit-mode controls share `AppButton` while behavior stays unchanged. |
| R146 | Image upload picker button migration | Done | Reuse the shared button wrapper for image upload picker actions. | `AppButton`, `ImageUploadPicker` | PrimeVue upload behavior, preview image button, attachment description save | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-submit.spec.ts --project=chromium` | Upload choose/delete/lightbox buttons share `AppButton` while daily-log attachment behavior stays unchanged. |
| R147 | Button-styled link primitive | Done | Add a semantic router-link wrapper for links that use button styling. | `AppButtonLink`, `NotFoundView` | router behavior, auth shell layout, raw button component API | `npm run type-check`; `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`; `npm run test:e2e -- --project=chromium` | Button-styled links have a semantic wrapper and full E2E remains green. |
| R148 | Shop order custom item input migration | Done | Reuse shared field/text input primitives in the shop order custom item form. | `AppField`, `AppTextInput`, `ShopOrderCustomItemForm` | add-custom-item behavior, shop order submit flow, catalog item flow | `npm run type-check`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | Custom item fields share common primitives while compact shop-order styling and behavior stay unchanged. |
| R149 | Daily log history date input migration | Done | Reuse shared field/text input primitives for the daily-log history date search. | `AppField`, `AppTextInput`, `DailyLogHistoryList` | date navigation, draft creation rules, submitted-log history display | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-draft.spec.ts --project=chromium` | Daily-log history date search shares common input primitives while behavior stays unchanged. |
| R150 | Recipient editor input migration | Done | Reuse the shared text input primitive in the shared recipient editor. | `AppTextInput`, `RecipientEditor` | add/remove recipient behavior, Enter-to-add keyboard behavior, job/daily-log recipient flows | `npm run type-check`; `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Recipient email input shares `AppTextInput` while notification recipient behavior stays unchanged. |
| R151 | Auth form input migration | Done | Reuse shared field/text input primitives in public auth forms. | `AppField`, `AppTextInput`, `AuthCard`, `LoginView`, `ForgotPasswordView`, `SetPasswordView` | auth service behavior, route redirects, reset/setup token logic | `npm run type-check`; `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium` | Public auth forms share common input primitives while route behavior stays unchanged. |
| R152 | Daily log textarea primitive migration | Done | Add a shared textarea primitive and migrate daily-log text sections without changing save-on-blur behavior. | `AppTextarea`, `DailyLogTextSectionCard` | daily-log draft creation, attachment uploads, submit/email behavior | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-draft.spec.ts --project=chromium` | Daily-log textareas share one primitive while focused typing and blur-save behavior stay stable. |
| R153 | Upload picker textarea migration | Done | Reuse the shared textarea primitive for attachment descriptions. | `AppTextarea`, `ImageUploadPicker` | PrimeVue upload behavior, attachment remove/preview behavior, daily-log submit flow | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-typing.spec.ts --project=chromium` | Attachment description textareas share the primitive while upload, blur-save, and submit behavior stay unchanged. |
| R154 | Assignment search input migration | Done | Reuse the shared search input in user/job assignment panels. | `AppSearchInput`, `UserAssignedJobsPanel`, `JobFieldUserAssignmentPanel` | checkbox assignment behavior, role/job save flows, recipient settings | `npm run type-check`; `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-management.spec.ts --project=chromium` | Assignment panel searches share `AppSearchInput` while filtering and assignment workflows stay unchanged. |
| R155 | Shop order workspace input migration | Done | Reuse the shared text input primitive in selected-order metadata and item editors. | `AppTextInput`, `ShopOrderSelectedOrderPanel`, `ShopOrderItemsEditor` | delivery shortcut behavior, comments autosave, item quantity/note autosave, submit/read-only flows | `npm run type-check`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | Shop-order workspace inputs share `AppTextInput` while all workspace regression flows stay unchanged. |
| R156 | Daily log table input migration | Done | Reuse the shared text input primitive in daily-log manpower and indoor climate tables. | `AppTextInput`, `DailyLogManpowerCard`, `DailyLogIndoorClimateCard` | draft typing stability, row add/remove behavior, submit validation/email behavior | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | Daily-log table inputs share `AppTextInput` while local editing and submission workflows stay unchanged. |
| R157 | Job timecard toolbar input migration | Done | Reuse shared text/search primitives in the job timecard toolbar. | `AppTextInput`, `AppSearchInput`, `JobTimecardToolbar` | workbook cells, week creation, week picker events, card search, submit/rollover behavior | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium` | Timecard toolbar date/search controls share common primitives while workbook behavior remains unchanged. |
| R158 | Job timecard create tray input migration | Done | Reuse shared text/search primitives in the job timecard create-card tray. | `AppTextInput`, `AppSearchInput`, `JobTimecardCreateTray` | employee selection, custom-card creation, workbook cells, submit/rollover behavior | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium` | Job timecard create tray inputs share common primitives while card creation behavior remains unchanged. |
| R159 | Timecard export input migration | Done | Reuse shared text/search primitives in the admin timecard export toolbar and create-card tray. | `AppTextInput`, `AppSearchInput`, `TimecardExportToolbar`, `TimecardExportCreateTray` | PrimeVue selects, export actions, saved week deletion, print/PDF route behavior | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Timecard export native inputs share common primitives while admin export workflows stay unchanged. |
| R160 | Shop order catalog input migration | Done | Reuse shared text/search primitives in the shop-order catalog browser. | `AppSearchInput`, `AppTextInput`, `ShopOrderCatalogBrowser`, `ShopOrderCatalogTreeNodeRow` | search expand/collapse behavior, item quantity/add behavior, submit/read-only flows | `npm run type-check`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | Shop-order catalog search and quantity inputs share common primitives while catalog workflows stay unchanged. |
| R161 | Assignment checkbox primitive migration | Done | Add a shared checkbox primitive and migrate job/user assignment checkboxes. | `AppCheckbox`, `UserAssignedJobsPanel`, `JobFieldUserAssignmentPanel` | assignment save behavior, user role changes, job editor workflows | `npm run type-check`; `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Assignment checkboxes share `AppCheckbox` while assignment workflows stay unchanged. |
| R162 | Admin toggle checkbox migration | Done | Reuse the shared checkbox primitive for user, employee, and shop catalog active/type toggles. | `AppCheckbox`, `UserEditorPanel`, `EmployeeEditorPanel`, shop catalog create/detail panels | admin create/edit/delete behavior, employee autosave, catalog create/edit/archive flows | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Admin boolean toggles share `AppCheckbox` while editor workflows stay unchanged. |
| R163 | Timecard/catalog checkbox cleanup | Done | Reuse the shared checkbox primitive for remaining simple timecard and catalog filter toggles. | `AppCheckbox`, `JobTimecardCreateTray`, `TimecardExportCreateTray`, `ShopCatalogTreeFilters` | workbook cells, card creation, export workflows, catalog filtering | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Contractor and show-archived toggles share `AppCheckbox` while covered workflows stay unchanged. |
| R164 | Job timecard action button primitive | Done | Add a timecard-specific action button and migrate job toolbar actions. | `TimecardButton`, `JobTimecardToolbar` | toolbar tabs/history rows, workbook cells, create/submit/sort behavior | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium` | Job timecard toolbar action buttons share `TimecardButton` while workbook workflows stay unchanged. |
| R165 | Timecard tray/export action button migration | Done | Extend the timecard-specific action button to create trays and export toolbar actions. | `TimecardButton`, `JobTimecardCreateTray`, `TimecardExportCreateTray`, `TimecardExportToolbar` | employee row buttons, saved-week delete buttons, workbook cells, export behavior | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Timecard create/export action buttons share `TimecardButton` while covered workflows stay unchanged. |
| R166 | Shared timecard mobile tablist | Done | Promote the export mobile tablist into a reusable timecard toolbar tab component. | `TimecardToolbarTabs`, `JobTimecardToolbar`, `TimecardExportToolbar` | toolbar panel contents, action behavior, workbook cells, export behavior | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Job and export timecard toolbars share tablist markup/styles while keeping their existing ARIA id/control patterns. |
| R167 | Shared timecard sort mode picker | Done | Extract the repeated Employee#/Name sort radio pair from timecard toolbars. | `TimecardSortModePicker`, `JobTimecardToolbar`, `TimecardExportToolbar` | sort behavior implementation, workbook cells, export filters, card search | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium` | Job and export sort controls share markup/styles while each parent keeps its sort workflow. |
| R168 | Shared directory list button shell | Done | Extract repeated selectable card-button row styling from directory panels. | `AppListButton`, `UserDirectoryPanel`, `EmployeeDirectoryPanel`, `JobBrowserPanel` | directory filtering, row content, create/select behavior, editor workflows | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium` | Users, Employees, and Jobs rows share a button-card shell while preserving existing row selector hooks and workflows. |
| R169 | Shared compact icon button | Done | Extract repeated circular add/remove icon button styling from daily-log repeater tables. | `AppIconButton`, `DailyLogManpowerCard`, `DailyLogIndoorClimateCard` | daily-log row state, field editing, submit/email behavior | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Daily-log add/remove controls share an accessible icon-button primitive while row workflows stay unchanged. |
| R170 | Recipient icon button adoption | Done | Reuse the compact icon button for recipient row remove actions. | `AppIconButton`, `RecipientEditor` | recipient add/remove behavior, job notification settings, daily-log recipients | `npm run type-check`; `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Recipient remove actions share the accessible icon-button primitive while recipient workflows stay unchanged. |
| R171 | Shared component CSS ownership pass | Done | Move safe shared component styles out of global CSS and into their owning components. | `AppSelect`, `AppEmptyState`, `AppStatusMessage`, `main.css` | AppButton family styles, app shell styles, feature/workbook/output CSS | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts e2e/daily-log-draft.spec.ts --project=chromium` | Select, empty-state, and status-message styles are component-owned while heavily used routes stay unchanged. |
| R172 | Global CSS foundation split | Done | Split global CSS foundation rules into focused files with `main.css` as the import entry point. | `main.css`, `reset.css`, `base.css`, `button-family.css`, `primevue.css`, `css-architecture.md` | feature scoped CSS, app shell layout, output CSS, token redesign | `npm run type-check`; `npm run test:e2e -- e2e/public-routes.spec.ts e2e/admin-pages.spec.ts e2e/jobs.spec.ts e2e/daily-log-draft.spec.ts --project=chromium` | Global CSS ownership matches the target folder shape without changing visible behavior. |
| R173 | Shop catalog context-menu composable | Done | Move shop catalog menu positioning and mobile long-press state out of the route view. | `ShopCatalogAdminView`, `useShopCatalogContextMenu` | catalog create/edit/archive/delete semantics, drag/drop move writes, tree rendering | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Catalog context-menu/long-press machinery is isolated while admin catalog workflows stay unchanged. |
| R174 | Shop catalog drag auto-scroll composable | Done | Move shop catalog tree drag auto-scroll frame/velocity logic out of the route view. | `ShopCatalogAdminView`, `useShopCatalogTreeAutoScroll` | catalog drag/drop write semantics, context menu behavior, tree rendering | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Tree auto-scroll is isolated while catalog admin workflows stay unchanged. |
| R175 | Shared shop catalog records subscription | Done | Centralize duplicated category/item subscription state used by catalog admin and shop orders. | `useShopCatalogRecords`, `ShopCatalogAdminView`, `ShopOrdersView` | catalog/order write semantics, order subscriptions, tree/browser rendering | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium` | Both real pages load catalog records through one composable while preserving their existing loading/error behavior. |
| R176 | Window event listener composable | Done | Replace raw route-level window listener setup with a lifecycle composable. | `useWindowEventListener`, `ShopCatalogAdminView` | catalog interaction behavior, event handler semantics, service subscriptions | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Window listener registration/removal is reusable while shop catalog workflows stay unchanged. |
| R177 | Shop order catalog window listener adoption | Done | Reuse the lifecycle window-listener composable in the shop-order catalog browser. | `useWindowEventListener`, `ShopOrderCatalogBrowser` | context-menu behavior, search expand/collapse behavior, add-item flow | `npm run type-check`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | Both catalog browser surfaces use the shared window listener helper while shop order workflows stay unchanged. |
| R178 | Shop order catalog context-menu adoption | Done | Reuse the shared shop catalog context-menu positioning helper in the order catalog browser. | `useShopCatalogContextMenu`, `ShopOrderCatalogBrowser` | context-menu actions, item add flow, search expand/collapse behavior | `npm run type-check`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | Admin and order catalog browsers share context-menu positioning while shop order workflows stay unchanged. |
| R179 | Generic subscribed-records helper | Done | Add a small reusable list subscription helper and migrate simple admin directories. | `useSubscribedRecords`, `UsersView`, `EmployeesView` | create/edit/delete user or employee semantics, jobs subscription, invite flow | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Users and Employees list subscriptions share loading/error/unsubscribe handling while admin workflows stay unchanged. |
| R180 | Jobs assignable-user subscription adoption | Done | Reuse the generic subscribed-records helper for Jobs assignable users. | `useSubscribedRecords`, `JobsView` | jobs store subscription, global recipients, create/edit/archive/delete semantics | `npm run type-check`; `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium` | JobsView shares list subscription loading/error/unsubscribe handling while jobs workflows stay unchanged. |
| R181 | Job timecard employee subscription adoption | Done | Reuse the generic subscribed-records helper for job timecard employees. | `useSubscribedRecords`, `TimecardsView` | week/card subscriptions, save queue, workbook cells, submit/rollover behavior | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium` | Job timecard employee loading uses the shared helper while workbook workflows stay unchanged. |
| R182 | Timecard export list subscription adoption | Done | Reuse the generic subscribed-records helper for timecard export employees and users. | `useSubscribedRecords`, `TimecardExportView` | week/card archive subscriptions, export actions, PDF/CSV payloads, lock/edit behavior | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Timecard export simple list subscriptions share loading/error/unsubscribe handling while export workflows stay unchanged. |
| R183 | Generic subscribed-value helper | Done | Reuse a small single-value subscription helper for global notification recipient defaults. | `useSubscribedValue`, `JobsView`, `DailyLogsView` | job writes, daily-log draft/save/submit behavior, recipient service semantics | `npm run type-check`; `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | Global recipient-default subscriptions share loading/error/unsubscribe handling while recipient workflows stay unchanged. |
| R184 | Users assigned-jobs subscription adoption | Done | Reuse the generic subscribed-records helper for user assignment job options. | `useSubscribedRecords`, `UsersView` | user create/edit/delete semantics, invite flow, job service query behavior | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium` | Users page job assignment options share loading/error/unsubscribe handling while admin workflows stay unchanged. |
| R185 | Shop order history subscription adoption | Done | Reuse the generic subscribed-records helper for job-scoped shop order history. | `useSubscribedRecords`, `useSubscribedValue`, `ShopOrdersView` | order create/edit/delete/submit semantics, catalog subscription, PDF/email output | `npm run type-check`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | Shop order history loading/error/unsubscribe handling is shared while order workspace workflows stay unchanged. |
| R186 | Daily log date subscription adoption | Done | Reuse the generic subscribed-records helper for date-scoped daily log history. | `useSubscribedRecords`, `DailyLogsView` | draft creation, save-on-blur, attachment upload/delete, submit/email semantics | `npm run type-check`; `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Daily log loading/error/unsubscribe handling is shared while history selection and draft workflows stay stable. |
| R187 | Job timecard subscription adoption | Done | Reuse the generic subscribed-records helper for job timecard weeks and cards. | `useSubscribedRecords`, `TimecardsView` | employee subscription, save queue, rollover/backfill behavior, workbook cell editing, submit/email semantics | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium` | Timecard week/card loading/error/unsubscribe handling is shared while workbook workflows stay unchanged. |
| R188 | Timecard export week subscription adoption | Done | Reuse the generic subscribed-records helper for admin timecard export week archives. | `useSubscribedRecords`, `TimecardExportView` | per-week card subscription fanout, export actions, lock/edit behavior, PDF/CSV payloads | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Export week archive loading/error/unsubscribe handling is shared while export workflows stay unchanged. |
| R189 | Shared DOM event helpers | Done | Centralize simple input-value reading and native date-picker opening helpers. | `domEvents`, shop order items, timecard toolbar/header/footer, shop catalog price input | workbook cell internals, common input primitive behavior, save semantics | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/shop-order-workspace.spec.ts e2e/timecard-workbook.spec.ts --project=chromium` | Touched input/date workflows use shared helpers while behavior stays unchanged. |
| R190 | Timecard workbook input helper cleanup | Done | Remove inline workbook template casts and name H/P/C field mapping helpers. | `TimecardWorkbookCard`, `domEvents` | workbook calculation rules, navigation semantics, save queue behavior, print/PDF output | `npm run type-check`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium` | Workbook cell editing uses shared input helpers while workbook behavior stays unchanged. |
| R191 | Common input primitive event cleanup | Done | Reuse shared DOM event helpers in base input/search/checkbox primitives and catalog inline tree inputs. | `domEvents`, `AppTextInput`, `AppSearchInput`, `AppCheckbox`, `ShopCatalogTreeNodeRow` | component public APIs, input styling, feature save semantics | `npm run type-check`; `npm run test:e2e -- --project=chromium` | Common input primitives parse DOM events consistently while full app behavior stays unchanged. |

## Slice Template

Use this template when adding a new row:

```md
### RX - Slice Name

Status:
Owner:
Primary goal:
Allowed files:
Do not touch:
Known risks:
Tests:
Exit criteria:
Notes:
```

## Baseline Notes

2026-07-09 baseline before `R01`:

- `npm run type-check`: passed.
- `npm run test:e2e`: passed, 82/82.
- `npm --prefix functions run smoke:daily-log-email`: passed.
- `npm --prefix functions run smoke:shop-order-email`: passed.
- `npm --prefix functions run smoke:timecard-email`: passed.

## Slice Notes

2026-07-09 `R01`:

- Added `src/auth/capabilities.ts` as the frontend capability helper for current admin/foreman/project-manager behavior.
- Wired `src/stores/auth.ts`, `src/router/index.ts`, and the shell role label through the helper without changing route behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/job-dashboard.spec.ts --project=chromium`: passed, 8/8.

2026-07-09 `R02`:

- Added `src/components/RecipientEditor.vue` for reusable recipient title/count, input, empty state, list, and remove controls.
- Replaced duplicated recipient markup in `src/views/JobsView.vue` and `src/views/DailyLogsView.vue`.
- Preserved existing recipient copy, including the current `1 recipients` count text.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 7/7.

2026-07-09 `R03`:

- Added `src/components/ConfirmDialog.vue` as the shared app-native confirmation primitive.
- Replaced the employee delete `window.confirm` flow in `src/views/EmployeesView.vue` with the shared dialog.
- Updated `e2e/admin-management.spec.ts` to confirm deletion through the real dialog UI.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 15/15.

2026-07-09 `R04`:

- Added `src/components/shopOrders/ShopOrderCatalogBrowser.vue` for the shop order catalog search/tree/context menu UI state.
- Replaced the left catalog browser in `src/views/ShopOrdersView.vue` while keeping custom item input and order persistence in the parent.
- Preserved existing shop order catalog `data-testid` values and cleaned the parent view of extracted catalog tree/context-menu state and styles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-09 `R05`:

- Added `src/features/dailyLogs/useDailyLogDraftSave.ts` to own daily log dirty state, saved snapshots, full draft saves, and text-field save-on-blur behavior.
- Replaced the duplicated daily log save/snapshot helpers in `src/views/DailyLogsView.vue` while preserving the local-while-focused typing guard.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 9/9.

2026-07-09 `R06`:

- Added `src/styles/tokens.css` as the first owned location for app color, surface, radius, spacing, shadow, font, and app background tokens.
- Updated `src/styles/main.css` to import those tokens and reference tokenized root/body/font values without changing print/email/PDF styling.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 7/7.

2026-07-09 `R08`:

- Deferred direct Firestore Rules emulator tests for now by product decision.
- `npm install --save-dev @firebase/rules-unit-testing` was attempted in the sandbox and failed because npm was cache-only; the networked install approval was not used.

2026-07-09 `R10`:

- Moved `AppShell` layout/navigation/topbar/statusbar styles from `src/styles/main.css` into scoped styles in `src/layouts/AppShell.vue`.
- Preserved slotted topbar action styling with `:slotted(.app-shell__topbar-button)` for the Jobs page editing action.
- Confirmed no `.app-shell` selectors remain in global `main.css`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 13/13.

2026-07-09 `R11`:

- Added `src/components/auth/AuthCard.vue` to own the shared login/reset/set-password/not-found card shell and auth field styles.
- Replaced repeated auth card wrappers in `src/views/LoginView.vue`, `src/views/ForgotPasswordView.vue`, `src/views/SetPasswordView.vue`, and `src/views/NotFoundView.vue`.
- Removed `auth-*` selectors from `src/styles/main.css`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/access-control.spec.ts --project=chromium`: passed, 12/12.

2026-07-09 `R12`:

- Moved `page-panel*` styles into `src/components/PagePanel.vue`.
- Moved `module-placeholder*` styles into `src/components/ModulePlaceholder.vue` and gave the placeholder its own eyebrow class instead of borrowing `page-panel__eyebrow`.
- Removed those component-owned selectors from `src/styles/main.css`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R13`:

- Moved job dashboard layout/module launcher styles into `src/views/JobDashboardView.vue`.
- Moved reference list catalog preview styles into `src/views/ReferenceListView.vue`.
- Removed stale legacy jobs/dashboard/reference selectors from `src/styles/main.css`, leaving global CSS focused on app base, shared primitives, vendor overrides, and accessibility motion rules.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 19/19.

2026-07-10 `R14`:

- Reused `AppEmptyState` for users list loading, users empty search results, assigned-job loading/empty messages, and the no-user-selected state.
- Reused `AppEmptyState` for employees list loading and empty search results.
- Left admin create/edit/delete persistence and service calls unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 15/15.

2026-07-10 `R15`:

- Reused `AppLoadingButton` for users pending-invite sending, user creation, employee creation, and job creation.
- Preserved existing labels, loading labels, disabled behavior, and `data-testid` values on the tested job create path.
- Left delete/archive/danger buttons as raw buttons for a later dedicated danger-button primitive.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 21/21.

2026-07-10 `R16`:

- Added `src/utils/directoryFilters.ts` with pure helpers for active/inactive/both filtering and normalized text matching.
- Replaced duplicated user and employee directory search/status filtering logic with the shared helper.
- Added `src/__tests__/directoryFilters.spec.ts` for fast unit coverage of the shared helper.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 4/4. The first sandboxed run failed with Windows `spawn EPERM`; rerunning the same command outside the sandbox passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 15/15.

2026-07-10 `R17`:

- Reused `filterDirectoryRecords` for the jobs page active/inactive/both visible list and text search behavior.
- Left assigned field-user filtering separate because it has role-specific filtering and active-user sorting.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 4/4.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-10 `R18`:

- Replaced Jobs page `window.confirm` archive/restore/delete prompts with `ConfirmDialog`.
- Updated the Jobs E2E archive/restore/delete workflow to confirm through the real app dialog.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-10 `R19`:

- Reused `AppEmptyState` for Jobs list loading, no matching jobs, assignable-user loading/empty states, and the no-job-selected state.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-10 `R20`:

- Added `src/components/shopOrders/ShopOrderItemsEditor.vue` for added-item empty states, read-only submitted item display, quantity editing, note editing, and remove controls.
- Replaced the active item editor body in `src/views/ShopOrdersView.vue` with the new component while keeping persistence and save queues in the parent.
- Removed now-unused parent input-reading and note-display helpers.
- A small HTML-commented legacy fragment remains in `ShopOrdersView.vue` because the source contains mojibake characters that resisted exact patch deletion; it is not compiled and should be cleaned in a later encoding/formatting pass.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-10 `R21`:

- Added `src/components/shopOrders/ShopOrderHistoryList.vue` for order history empty state, row labels, metadata, status badges, and selection events.
- Replaced the inline history list body in `src/views/ShopOrdersView.vue` while keeping draft deletion and order counts in the parent.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-10 `R22`:

- Replaced the Users page `window.confirm` delete prompt with `ConfirmDialog`.
- Updated admin-management E2E to confirm user deletion through the real app dialog.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 15/15.

2026-07-10 `R23`:

- Replaced Shop Orders `window.confirm` prompts for item removal, draft deletion, and order submission with `ConfirmDialog`.
- Updated shop-order E2E helpers to confirm submit/remove through app dialogs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-10 `R24`:

- Replaced the Daily Logs draft delete `window.confirm` prompt with `ConfirmDialog`.
- Added a daily-log draft delete E2E regression that confirms through the real app dialog and verifies the draft is removed.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-10 `R25`:

- Replaced Shop Catalog Admin `window.confirm` prompts for archive/restore folder, archive/restore item, delete folder, and delete item with `ConfirmDialog`.
- Updated the shop catalog admin E2E workflow to confirm archive/delete actions through the real app dialog.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 12/12.

2026-07-10 `R26`:

- Replaced Job Timecards `window.confirm` prompts for deleting a card and submitting a week with `ConfirmDialog`.
- Updated timecard workbook E2E submit/delete workflows to confirm through the real app dialog.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-10 `R27`:

- Replaced Timecard Export `window.confirm` prompts for deleting a saved card and deleting a draft week with `ConfirmDialog`.
- Updated admin E2E to confirm draft-week deletion through the real app dialog.
- Added admin E2E coverage for deleting an editable saved card through the real app dialog.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R28`:

- Removed the `window.confirm = () => true` shim from the shared E2E fixture now that app views use `ConfirmDialog`.
- Updated `design/refactor-gap-audit.md`, `design/frontend-architecture.md`, and `design/component-architecture.md` so confirmation architecture reflects the current implementation.
- Confirmed no `window.confirm` usage remains under `src`.
- `npm run type-check`: passed.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.
- `npm run test:unit -- --run`: first sandboxed run failed with Windows `spawn EPERM`; rerunning outside the sandbox passed, 4/4.

2026-07-10 `R29`:

- Added `src/components/dailyLogs/DailyLogHistoryList.vue` to own the daily-log history card, date search, selected-row state, and empty/loading states.
- Added `src/features/dailyLogs/format.ts` for shared daily-log labels and timestamp display.
- Replaced the inline history block in `DailyLogsView.vue` and removed the moved history-specific scoped styles from the parent view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-10 `R30`:

- Added `src/components/dailyLogs/DailyLogSelectedLogCard.vue` to own selected-log title, metadata, empty state, and delete-draft button rendering.
- Replaced the inline selected-log card in `DailyLogsView.vue` while keeping delete confirmation and persistence in the parent view.
- Removed moved selected-log scoped styles from `DailyLogsView.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-10 `R31`:

- Added `src/components/dailyLogs/DailyLogTextSectionCard.vue` to own repeated text-section card rendering for schedule, safety, deliveries, QC, and notes.
- Replaced five repeated text-section blocks in `DailyLogsView.vue` with component instances while keeping draft state and save-on-blur behavior in the parent.
- Removed moved text-section scoped styles from `DailyLogsView.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-10 `R32`:

- Added `src/components/dailyLogs/DailyLogAttachmentCard.vue` to own repeated attachment card shells around `ImageUploadPicker`.
- Replaced Photos, PTP Photos, and QC Photos inline card markup in `DailyLogsView.vue` while keeping upload/delete handlers in the parent view.
- Preserved the `daily-logs-card` class on the extracted attachment card so existing E2E scoping and external affordances continue to work.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11. A first run failed because the extracted card no longer had the old `.daily-logs-card` class used by the upload test; restoring the compatibility class fixed it.

2026-07-10 `R33`:

- Added `src/components/dailyLogs/DailyLogRecipientsCard.vue` to own the daily-log recipient card shell and its two `RecipientEditor` instances.
- Replaced the inline recipient card in `DailyLogsView.vue` while keeping recipient add/remove persistence, default-recipient loading, and submit/email behavior in the parent view.
- Preserved the `daily-logs-card` class on the extracted recipient card so existing affordances remain stable.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-10 `R34`:

- Added `src/components/dailyLogs/DailyLogSiteInfoCard.vue` to own the Daily Logs job/site metadata card.
- Replaced the inline site-info card in `DailyLogsView.vue` while keeping site-info computation and draft payload hydration in the parent view.
- Removed moved site-info display styles from `DailyLogsView.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-10 `R35`:

- Added `src/components/dailyLogs/DailyLogManpowerCard.vue` to own the Daily Logs manpower table, add-row button, row inputs, and remove-row buttons.
- Replaced the inline manpower table in `DailyLogsView.vue` while keeping draft state, row creation/removal, and submit validation in the parent view.
- Preserved editable typing behavior by routing field changes through explicit parent events instead of changing persistence timing.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-10 `R36`:

- Added `src/components/dailyLogs/DailyLogIndoorClimateCard.vue` to own the Daily Logs indoor climate table, add-row button, row inputs, and remove-row buttons.
- Replaced the inline indoor climate table in `DailyLogsView.vue` while keeping draft state, row creation/removal, and submit validation in the parent view.
- Removed the old card/table/remove-button scoped styles from `DailyLogsView.vue` now that the remaining Daily Logs table UIs own their styles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-10 `R37`:

- Added `src/components/shopOrders/ShopOrderCustomItemForm.vue` to own the custom-item form shell, inputs, and submit button.
- Replaced the inline custom-item slot content in `ShopOrdersView.vue` while keeping reactive form state and add-item persistence in the parent view.
- Preserved the `form.shop-orders-form__grid` selector used by the Shop Orders E2E custom-item tests.
- Removed stale `shop-orders-tree-card` scoped styling from `ShopOrdersView.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-10 `R38`:

- Added `src/components/shopOrders/ShopOrderSelectedOrderPanel.vue` to own selected-order metadata, status badges, delivery date, Thursday shortcut, comments, and created/submitted labels.
- Replaced the inline selected-order strip in `ShopOrdersView.vue` while keeping order metadata state, autosave, and submit behavior in the parent view.
- Removed selected-panel formatting helpers and moved selected-panel scoped styles out of `ShopOrdersView.vue`.
- Preserved the legacy `.shop-orders-workspace-strip__identity` class on the extracted component after E2E caught that the order-number assertion still depended on it.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: first run failed on the missing compatibility class; after restoring it, passed, 16/16.

2026-07-10 `R39`:

- Replaced the Shop Orders history delete-draft button's borrowed `shop-orders-item-card__danger` class with a parent-owned `shop-orders-draft-delete-button` class.
- Removed stale item editor and order history scoped styles from `ShopOrdersView.vue` now that `ShopOrderItemsEditor` and `ShopOrderHistoryList` own those styles.
- Confirmed the parent view no longer references item/history component classes except through child components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- Checkpoint `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-10 `R40`:

- Added `src/components/shopCatalog/ShopCatalogRootInspector.vue` to own the root Shop Catalog inspector overview and help cards.
- Replaced the inline root inspector block in `ShopCatalogAdminView.vue` while keeping archive visibility filtering and catalog state in the parent view.
- Added parent computed counts for visible folders/items so the component stays presentation-only.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R41`:

- Added `src/components/shopCatalog/ShopCatalogCreateCategoryPanel.vue` and `src/components/shopCatalog/ShopCatalogCreateItemPanel.vue` for the create-folder and create-item inspector panels.
- Replaced the inline create inspector blocks in `ShopCatalogAdminView.vue` while keeping validation, price formatting, persistence, and tree state in the parent view.
- Used explicit field-update and price events so the new components remain UI-focused without mutating props.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R42`:

- Added `src/components/shopCatalog/ShopCatalogCategoryDetailPanel.vue` and `src/components/shopCatalog/ShopCatalogItemDetailPanel.vue` for selected-folder and selected-item inspector forms.
- Replaced inline detail inspector blocks in `ShopCatalogAdminView.vue` while keeping validation, archive/delete confirmations, and Firebase persistence in the parent view.
- Gave extracted inspector panels their own two-row header/body layout so they preserve the old inspector-pane scrolling behavior as standalone children.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R43`:

- Removed stale `catalog-form`, `catalog-inspector-card`, `catalog-inspector-pane__body`, `catalog-inspector-pane__actions`, and inspector danger-button styles from `ShopCatalogAdminView.vue`.
- Kept parent-owned tree/search/toggle styles in place while extracted Shop Catalog inspector components own their own form/card/action styling.
- Confirmed no stale inspector selector matches remain in `ShopCatalogAdminView.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R44`:

- Added `src/components/shopCatalog/ShopCatalogContextMenu.vue` to own context-menu markup and styles.
- Replaced the inline context-menu block in `ShopCatalogAdminView.vue` while keeping all action construction and mutation logic in the parent view.
- Moved the existing context-menu visual styling into the component without intentionally changing the look.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R45`:

- Added `src/components/shopCatalog/ShopCatalogMobileNav.vue` to own the responsive Catalog/Inspector tab switcher and its PrimeVue button dependency.
- Replaced the inline mobile nav in `ShopCatalogAdminView.vue` and removed the parent-owned mobile-toggle styles.
- Kept the parent responsible for `activeMobilePanel` state and panel switching.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R46`:

- Added `src/components/shopCatalog/ShopCatalogTreeHeader.vue` and `src/components/shopCatalog/ShopCatalogTreeFilters.vue`.
- Replaced inline Shop Catalog tree title/search/archived-toggle markup while preserving the `shop-catalog-search` test id and parent-owned filter state.
- Removed stale parent header/search/toggle styles now owned by those components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R47`:

- Added `src/components/timecards/TimecardExportSummaryPanel.vue` for the Timecard Export Current Results/Totals panel.
- Replaced the inline totals/account-summary table in `TimecardExportView.vue` while keeping all totals and account-summary computation in the parent view.
- Moved the summary panel/table/stat styling into the component and removed stale summary/sidebar panel styles from the parent.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R48`:

- Added `src/features/timecards/exportViewHelpers.ts` for pure Timecard Export helpers: date formatting, card sorting, record clearing, employee seed creation, and foreman display labels.
- Replaced local helper implementations in `TimecardExportView.vue` while preserving existing behavior, including export-created employee cards using `wageRate: null`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- Checkpoint `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-10 `R49`:

- Added `src/components/timecards/TimecardExportMessage.vue` to own the Timecard Export page error/info banner and its workbook-paper styling.
- Replaced inline `pageError`/`pageInfo` message markup in `TimecardExportView.vue`.
- Removed stale `timecards-message` styles from the parent view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R50`:

- Added `src/components/timecards/TimecardExportStatusBar.vue` to own the Timecard Export status strip/carousel markup, local scrolling state, and status-specific styles.
- Replaced the inline status fieldset in `TimecardExportView.vue` while keeping status label computation in the parent view.
- Removed stale Timecard Export status/scroller/signal styles and local carousel state from the parent view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R51`:

- Added `src/components/timecards/TimecardExportSavedWeeksPanel.vue` to own the Saved Weeks fieldset, row rendering, empty state, and delete-draft button styling.
- Replaced the inline saved-week history block in `TimecardExportView.vue` while keeping filtering, date/subtitle formatting, and delete confirmation behavior in the parent view.
- Removed stale saved-week history row/action styles from the parent view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R52`:

- Added `src/components/timecards/TimecardExportToolbarTabs.vue` to own the responsive Timecard Export toolbar tablist, tab buttons, ARIA ids/controls, and tab-specific responsive styles.
- Replaced the inline mobile tablist in `TimecardExportView.vue` while keeping active-tab state in the parent view.
- Removed stale toolbar-tab styles from the parent view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R53`:

- Added `src/composables/useMeasuredCardScale.ts` to own the ResizeObserver-backed shell/content measurement maps, scale style calculation, pruning, and disconnect cleanup.
- Replaced the local Timecard Export card-measurement state and helper functions while keeping canvas markup and workbook editing behavior unchanged.
- Kept compact/edit/save state in `TimecardExportView.vue`; only the reusable measurement mechanics moved.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- Checkpoint `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-10 `R54`:

- Added `src/components/users/UserDirectoryPanel.vue` to own the Users directory header, search/status filter controls, pending-invite summary/actions, list rows, and browser-specific responsive styles.
- Replaced the inline Users browser section in `UsersView.vue` while keeping filtering, selected-user state, create mode, and invite send handlers in the parent view.
- Preserved `.users-browser__row` and existing test ids because the E2E suite uses them to assert real Users page behavior.
- Removed stale browser-only helpers/styles from `UsersView.vue` while leaving shared detail badge/status styles in place.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-10 `R55`:

- Added `src/components/employees/EmployeeDirectoryPanel.vue` to own the Employees directory header, search/status filter controls, create row, employee rows, empty states, and browser-specific responsive styles.
- Replaced the inline Employees browser section in `EmployeesView.vue` while keeping filtering, selected-employee state, create mode, and row label helpers in the parent view.
- Preserved `.employees-browser__secondary`, `employee-row-*`, and `employees-search`/`employees-status-filter` hooks used by the E2E suite.
- Removed stale browser-only styles from `EmployeesView.vue` while leaving shared detail badge/status styles in place.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-10 `R56`:

- Added `src/components/shopCatalog/treeTypes.ts`, `ShopCatalogTreeRootRow.vue`, `ShopCatalogTreeNodeRow.vue`, and `shopCatalogTreeRows.css` to own Shop Catalog tree row markup and row-specific styles.
- Replaced the inline root/category/item tree rows in `ShopCatalogAdminView.vue` while keeping tree data, drag/drop, long-press, context menu, inline create/rename, and persistence handlers in the parent view.
- Preserved existing tree classes and test ids used by Shop Catalog E2E coverage.
- Removed stale tree-row/node styles from `ShopCatalogAdminView.vue`; the parent still owns tree pane/list/container styling.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R57`:

- Added `src/components/timecards/TimecardExportCreateTray.vue` to own the admin Timecard Export create-card tray markup, target selectors, employee search list, custom-card fields, and tray-specific styles.
- Replaced the inline create tray in `TimecardExportView.vue` while keeping job/foreman target resolution, create validation, employee/custom card creation, and Firestore calls in the parent view.
- Used explicit field-update events instead of mutating props, preserving the existing `customCardForm`, `employeeSearchTerm`, and add-card handlers.
- Removed stale create-tray-only styles from `TimecardExportView.vue`; parent toolbar/canvas styles remain parent-owned.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-10 `R58`:

- Added `src/components/timecards/TimecardExportCanvasPanel.vue` to own the Timecard Export workbook canvas header, loading/empty states, card shell markup, card controls, and canvas-specific styles.
- Replaced the inline canvas block in `TimecardExportView.vue` while keeping card ordering, compact/edit state, save scheduling, remove confirmation, and measured-scale callbacks in the parent view.
- Moved direct `TimecardWorkbookCard` rendering into the canvas component while preserving existing collapse/edit/delete and workbook-changed events.
- Removed stale canvas/workbook-panel styles from `TimecardExportView.vue`; the parent now keeps toolbar and page-shell styling.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-12 `R59`:

- Updated `TimecardsView.vue` to use `src/composables/useMeasuredCardScale.ts` for card shell/content ResizeObserver setup, measurement pruning, scale style calculation, and disconnect cleanup.
- Removed the local card shell/content measurement maps, observer maps, and duplicated measurement helper functions from the job timecard page.
- Kept workbook card rendering, save scheduling, rollover, create/delete, and submit behavior unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-12 `R60`:

- Added `src/components/timecards/JobTimecardCreateTray.vue` to own the job timecard employee-directory create tray, custom-card fields, employee-row test ids, and tray-specific styles.
- Replaced the inline create tray in `TimecardsView.vue` while keeping employee/custom card validation, creation, scrolling, and Firestore calls in the parent view.
- Used explicit field-update events instead of mutating props, preserving `employeeSearchTerm`, `customCardForm`, and existing add-card handlers.
- Removed stale create-tray styles from `TimecardsView.vue`; parent toolbar/workbook/canvas styles remain parent-owned.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-12 `R61`:

- Added `src/components/timecards/JobTimecardToolbar.vue` to own the job timecard week filters, card search, action buttons, sort controls, saved-week history, status strip, mobile tabs, and toolbar-specific styles.
- Replaced the inline toolbar in `TimecardsView.vue` with parent-controlled props/events so week creation, week selection, sorting, submit confirmation, and save state stay in the view.
- Removed stale toolbar/button/status/history-row styles from `TimecardsView.vue`; the parent keeps only workbook variables plus canvas/message/summary styles.
- Preserved existing E2E hooks such as `timecards-week-ending`, `create-week`, `create-card`, and `timecards-history-*`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-12 `R62`:

- Added `src/components/timecards/TimecardSummaryPanel.vue` as the shared totals/account-summary panel for both Job Timecards and Timecard Export.
- Updated `TimecardsView.vue` to use the shared panel and removed the duplicated summary/sidebar styles from the parent.
- Updated `TimecardExportView.vue` to use the shared panel and deleted the export-only `TimecardExportSummaryPanel.vue` duplicate.
- Kept totals and account-summary calculations parent-owned in each view; only the rendering/styling is shared.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-12 `R63`:

- Added `src/components/timecards/JobTimecardCanvasPanel.vue` to own job timecard canvas header, loading/empty states, card shell markup, collapse/delete controls, workbook rendering, and canvas-specific styles.
- Replaced the inline canvas block in `TimecardsView.vue` while keeping card selection, compact/read-only state, save scheduling, delete confirmation, and measured-scale state in the parent view.
- Moved measured shell/content DOM refs through explicit component events so the existing `useMeasuredCardScale` lifecycle remains parent-owned.
- Removed stale canvas/workspace/empty-state styles and the unused date formatter from `TimecardsView.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-12 `R64`:

- Added `src/features/timecards/jobViewHelpers.ts` for job-specific display-week preference, card search, active employee search, employee seed creation, and last-name-first sorting.
- Updated `TimecardsView.vue` to use the extracted helpers while keeping Firestore subscriptions, save scheduling, create-card calls, and submit behavior in the view.
- Preserved the client-requested last-name sort behavior separately from Timecard Export sorting rules.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-12 `R65`:

- Added `src/components/jobs/JobBrowserPanel.vue` to own the Jobs browser header, search box, status filter, global-default row, job rows, loading/empty states, and browser-specific styles.
- Replaced the inline Jobs browser section in `JobsView.vue` while keeping filtering, edit-mode selection, create-mode opening, and field-user navigation parent-owned.
- Preserved existing Jobs E2E hooks such as `jobs-new-button`, `jobs-search`, `jobs-status-filter`, `job-card-*`, and `jobs-empty`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-12 `R66`:

- Added `src/components/jobs/JobFieldUserAssignmentPanel.vue` to own the repeated Assigned Field Users panel, search input, selected-count display, field-user rows, and panel-specific styles.
- Replaced both create-job and edit-job assignment panels in `JobsView.vue` while keeping field-user filtering, selected-id mutation, and job save/autosave behavior parent-owned.
- Preserved the existing create-flow row test id pattern (`jobs-foreman-*`) for current Jobs E2E coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-12 `R67`:

- Added `src/components/jobs/JobNotificationRecipientsPanel.vue` to own the repeated Jobs Email Recipients shell, module loop, `RecipientEditor` wiring, and notification-panel styles.
- Replaced the create-job, all-jobs defaults, and selected-job notification panels in `JobsView.vue` while keeping recipient input state and add/remove persistence handlers parent-owned.
- Used explicit multi-argument component events for module-specific input/add/remove actions so the parent stays typed and persistence flow is unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-12 `R68`:

- Added `src/components/jobs/JobDetailsFormFields.vue` for the repeated job number/type/name/GC/burden/date/address field grid.
- Replaced both create-job and edit-job field grids in `JobsView.vue` with explicit typed field-update events while keeping validation, autosave scheduling, and Firestore writes in the view.
- Preserved the existing `jobs-create-*` test ids only for create mode through an optional test-id prefix.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-12 `R69`:

- Added `src/components/timecards/TimecardExportToolbar.vue` to own the Timecard Export week/archive/sort/action toolbar groups plus saved-week and status-bar placement.
- Replaced the inline toolbar in `TimecardExportView.vue` while keeping filter state, date snapping, sort mode, compact controls, exports, create-card toggling, and delete-week confirmation parent-owned.
- Removed stale toolbar styles and PrimeVue control styling from `TimecardExportView.vue`; the view now keeps only the workbook shell variables inherited by toolbar children.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-12 `R70`:

- Added `src/components/shopCatalog/ShopCatalogTreePane.vue` to own the Shop Catalog tree pane shell, filters, root row, node rows, loading/empty states, and tree-pane-specific styles.
- Replaced the inline tree-pane section in `ShopCatalogAdminView.vue` while keeping tree data construction, selection, drag/drop, long-press context menu, inline create/rename, and catalog persistence handlers parent-owned.
- Kept parent-owned DOM access for tree auto-scroll through an explicit `setListRef` callback and preserved the root click event payloads used by long-press suppression.
- Removed stale tree-pane/list/empty styles from `ShopCatalogAdminView.vue`; the parent keeps overall explorer/inspector layout and mobile pane visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-12 `R71`:

- Added `src/features/shopCatalog/adminViewHelpers.ts` for pure Shop Catalog search normalization, category/item display labels, price parsing/formatting/sanitizing, archive status labels, and folder/item summary labels.
- Updated `ShopCatalogAdminView.vue` to import those helpers while keeping stateful form handlers, tree construction, drag/drop/long-press logic, inline create/rename, and Firestore persistence in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-12 `R72`:

- Added `src/components/shopCatalog/ShopCatalogInspectorPane.vue` to own the Shop Catalog inspector shell, mobile visibility state, and routing between root/create/detail inspector panels.
- Updated `ShopCatalogAdminView.vue` to pass derived display labels and explicit form/update/archive/delete events into the inspector pane while keeping form state, validation, confirmations, and Firestore persistence in the parent.
- Moved inspector-pane layout styles out of `ShopCatalogAdminView.vue`; the parent now owns only the explorer grid/mobile shell rules.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-12 `R73`:

- Moved the Shop Catalog tree-node type to `src/features/shopCatalog/treeTypes.ts` so tree model shape is feature-owned instead of component-owned.
- Added `buildShopCatalogTreeNodes` to `src/features/shopCatalog/adminViewHelpers.ts` for recursive category/item/draft-node construction, search matching, archive visibility, and child summary labels.
- Replaced the inline `treeNodes` computed body in `ShopCatalogAdminView.vue` with a feature-helper call while keeping expansion state, selection, drag/drop, inline create/rename saves, and catalog subscriptions in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-12 `R74`:

- Added `src/features/shopCatalog/catalogDisplayHelpers.ts` as the neutral source for catalog search normalization, folder/item display names, and folder/item summary labels.
- Updated `adminViewHelpers.ts` to import and re-export the shared display helpers so existing admin imports stay stable.
- Updated `ShopOrderCatalogBrowser.vue` to use the shared catalog display helpers instead of duplicating local search/name/summary functions.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 29/29.

2026-07-12 `R75`:

- Added `src/features/shopOrders/catalogBrowserHelpers.ts` with the Shop Order catalog tree-node type and `buildShopOrderCatalogTreeNodes`.
- Moved recursive Shop Order catalog browser category/item search matching, active-only filtering, child summaries, and search-collapse expansion rules out of `ShopOrderCatalogBrowser.vue`.
- Updated `ShopOrderCatalogBrowser.vue` to keep UI state, selection, quantity input, context menu, and add-item persistence while delegating tree node construction to the feature helper.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-12 `R76`:

- Expanded `src/features/timecards/exportViewHelpers.ts` with Timecard Export filter types, week filter bounds, week/card filtering, saved-package/job/foreman labels, and week-status label helpers.
- Updated `TimecardExportView.vue` to delegate filter result calculation and summary/status labels to feature helpers while keeping subscriptions, save scheduling, create-card flow, PDF/CSV export, and workbook rendering in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-12 `R77`:

- Updated `ShopOrdersView.vue` to use shared `getShopCategoryDisplayName` and `getShopCatalogItemDisplayName` helpers from `src/features/shopCatalog/catalogDisplayHelpers.ts`.
- Removed duplicated local catalog folder/item display fallback helpers from the Shop Orders view while preserving category-path construction and stored order item description behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-12 post-`R77` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-12 `R78`:

- Added `src/components/users/UserAssignedJobsPanel.vue` for the repeated Assigned Jobs panel, search input, selected-count display, loading/empty state, and job checkbox rows.
- Updated `UsersView.vue` to use the shared panel in create and edit modes while keeping job filtering, selected-id mutation, autosave, and user persistence in the view.
- Moved assigned-job panel styles out of `UsersView.vue`; preserved existing panel class hooks used by E2E coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-12 `R79`:

- Added `src/features/users/userViewHelpers.ts` for user display names, assigned-job labels/search, assigned-job ID normalization, editable-role normalization, and detail snapshot comparison.
- Updated `UsersView.vue` to use the helper module for assigned-job filtering, empty-state labels, and autosave dirty checks while keeping all subscriptions and Firestore writes in the view.
- Updated `UserAssignedJobsPanel.vue` to reuse the shared assigned-job display helpers instead of duplicating local label fallbacks.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-12 `R80`:

- Added `src/components/shopOrders/ShopOrderCatalogTreeNodeRow.vue` to own root/category/item catalog row markup, row icons, expand twist, quantity input, add button, test IDs, and row-specific styles.
- Updated `ShopOrderCatalogBrowser.vue` to render root and catalog tree nodes through the shared row component while keeping expansion state, active selection, context menu placement/actions, quantity state, and add-item persistence in the browser component.
- Removed row-specific CSS and the local input reader from `ShopOrderCatalogBrowser.vue`; the browser now owns pane/search/list/context-menu styling only.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-12 post-`R80` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R81`:

- Added `src/features/dailyLogs/viewHelpers.ts` for visible-log filtering, preferred-log selection, site-info shaping, payload preparation, attachment filtering/section mapping, recipient normalization/merging, saved-field keys, and submit validation.
- Updated `DailyLogsView.vue` to delegate pure Daily Logs rules to the feature helper module while keeping subscriptions, draft save-on-blur, create/delete draft flow, submit/email calls, attachment upload/delete, and recipient persistence in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R82`:

- Added `src/components/dailyLogs/DailyLogPageHeader.vue` for the Daily Logs title card, Save/Create Draft actions, selected-log/date badges, unsaved/saving badge, and non-today view-only message.
- Updated `DailyLogsView.vue` to pass title/status/action props into the header component while keeping save/create handlers, selected-log/date state, submit/delete/save flags, cards, sidebar, and persistence in the view.
- Moved header/toolbar/message styles out of `DailyLogsView.vue`; removed stale date-field/message styles from the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 post-`R82` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R83`:

- Added `src/components/dailyLogs/DailyLogSidebar.vue` to compose the selected-log, recipients, and history cards with the existing sidebar layout class.
- Updated `DailyLogsView.vue` to use the sidebar component while keeping selected date/log state, delete draft handling, recipient add/remove persistence, and history selection in the view.
- Removed direct selected-log/recipients/history card imports and moved sidebar layout styling out of `DailyLogsView.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R84`:

- Added `src/components/dailyLogs/DailyLogAttachmentSections.vue` for the adjacent Photos and PTP attachment cards.
- Updated `DailyLogsView.vue` to use the new attachment-section wrapper while keeping upload, remove, and description-update handlers parent-owned.
- Preserved the existing Daily Logs form order by leaving QC Photos after the QC text section.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 post-`R84` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R85`:

- Added `src/features/employees/employeeViewHelpers.ts` for employee display labels, search tokens, active/inactive counts, occupation suggestions, form validation, and autosave snapshot comparison.
- Updated `EmployeesView.vue` to delegate pure employee rules to the helper module while keeping subscriptions, create/update/delete calls, blur-save behavior, and selected-employee state in the view.
- Updated `EmployeeDirectoryPanel.vue` to use the shared employee display helpers directly instead of accepting formatter callbacks from the parent.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R86`:

- Added `src/components/employees/EmployeeEditorPanel.vue` to own Employees create/edit form markup, settings/status UI, mobile back affordance, save-status message, and editor-specific styles.
- Updated `EmployeesView.vue` to pass reactive form state into the editor and receive explicit field-update, submit, blur-save, toggle-save, and delete events while keeping all create/update/delete service calls parent-owned.
- Added typed employee text/boolean field names to `employeeViewHelpers.ts` so parent-child form update events stay explicit and type-safe.
- Removed editor-only form/settings/status styles from `EmployeesView.vue`; the view now keeps the two-panel workspace shell and mobile panel switching rules.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-`R86` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R87`:

- Added `src/components/users/UserEditorPanel.vue` to own Users create/edit/no-selection markup, role controls, assigned-job panel placement, delete affordance, save-status messages, and editor-specific styles.
- Updated `UsersView.vue` to pass create/detail form state into the editor and receive explicit text, role, active, job-search, job-toggle, create, delete, and autosave-submit events while keeping subscriptions and Firebase writes parent-owned.
- Added typed user create/detail form shapes and field-name types to `userViewHelpers.ts` so the editor boundary is explicit and type-safe.
- Removed editor-only form/status/toggle/note styles from `UsersView.vue`; the view now keeps the two-panel workspace shell and mobile panel switching rules.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R88`:

- Added `src/features/jobs/jobViewHelpers.ts` for job form state/types, all-jobs id, notification module metadata, recipient initialization/reset, job/field-user display labels, assigned-user toggling, form validation, email validation, text normalization, and job form/record serialization.
- Updated `JobsView.vue` to import those helpers while keeping store subscriptions, drawer state, autosave timers, create/update/archive/delete service calls, recipient persistence, and routing in the view.
- Updated `JobBrowserPanel.vue` and `JobFieldUserAssignmentPanel.vue` to reuse the shared display helpers instead of duplicating local fallback logic.
- Preserved the previous field-user fallback labels by allowing the shared field-user display helper to accept a caller-specific fallback.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 post-`R88` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R89`:

- Added `src/features/shopOrders/viewHelpers.ts` for Shop Orders form state types, runtime-aware delivery-date defaults, date validation, local item IDs, quantity parsing, note normalization, and order meta serialization.
- Updated `ShopOrdersView.vue` to use the helper module while keeping category-path building, subscriptions, draft creation, item persistence, note-save timers, submit/email calls, and confirmation dialogs in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R90`:

- Added shared Shop Catalog form state and option types to `src/features/shopCatalog/adminViewHelpers.ts`.
- Moved form factories, reset/hydration helpers, and create/edit validation helpers into the Shop Catalog feature helper module.
- Updated `ShopCatalogAdminView.vue` and the Shop Catalog inspector/create/detail panels to use the shared form types and helpers while keeping create/update/delete service calls, drag/drop, long-press, context menu, and selection orchestration in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R91`:

- Added `ShopCatalogConfirmAction` plus confirmation title, message, button label, and destructive-state helpers to `src/features/shopCatalog/adminViewHelpers.ts`.
- Updated `ShopCatalogAdminView.vue` to delegate catalog confirmation dialog copy to the feature helper while keeping archive/delete service execution in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R92`:

- Added Shop Catalog category/item write-payload helpers to `src/features/shopCatalog/adminViewHelpers.ts`.
- Updated `ShopCatalogAdminView.vue` create/edit category and item saves to use the shared payload helpers while keeping inline rename, drag/drop movement, and service execution behavior unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-`R92` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R93`:

- Added `src/features/timecards/cardDisplayHelpers.ts` for shared timecard row kinds, card header formatting, currency/hour/number formatting, wage input parsing, numeric draft parsing, line totals, line day/off display values, and printable text fallback.
- Updated `TimecardWorkbookCard.vue` to use the shared display/numeric helpers while keeping card mutation, numeric draft state, select-on-focus, and arrow-key navigation in the component.
- Updated `TimecardPrintCard.vue` to use the same shared display helpers so editable and printable timecard cards stay aligned.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R94`:

- Added `src/features/timecards/workbookNavigation.ts` for workbook navigable input detection, focus/select behavior, arrow-key direction mapping, dataset-grid target scoring, and geometry fallback navigation.
- Updated `TimecardWorkbookCard.vue` to delegate navigation helpers to the feature module while keeping mouse/focus/keyboard event handlers and numeric draft/edit state in the component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 post-`R94` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R95`:

- Added `src/components/timecards/TimecardWorkbookFooter.vue` for editable workbook footer fields, OT/REG totals display, notes input, and footer-specific styles.
- Updated `TimecardWorkbookCard.vue` to render the footer component and receive typed field update events while keeping card mutation and save signaling in the parent.
- Removed footer and notes styles from `TimecardWorkbookCard.vue` so the footer component owns its own presentation.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R96`:

- Added `src/components/timecards/TimecardWorkbookHeader.vue` for the editable/locked employee header, wage display/input, week-ending display, and header-specific styles.
- Updated `TimecardWorkbookCard.vue` to render the header component while keeping card field mutation, wage draft parsing, wage commit behavior, and save signaling in the parent.
- Tightened numeric draft fallback reads so header props always receive strings under strict indexed access.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R97`:

- Added `src/components/shopOrders/ShopOrderWorkspacePane.vue` to own the right-side order workspace shell, actions, selected-order panel composition, added-items section, and order-history section.
- Updated `ShopOrdersView.vue` to render the workspace pane with props/events while keeping catalog/order subscriptions, draft creation, metadata autosave, item persistence, confirmations, and submit/email behavior in the view.
- Removed workspace-pane and dead workspace-card styles from `ShopOrdersView.vue`; catalog browser and workspace pane now own their respective presentation.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R98`:

- Added pure Shop Catalog relationship helpers to `src/features/shopCatalog/adminViewHelpers.ts` for child category/item maps, archive visibility, direct/visible child counts, descendant category lookup, and category path labels.
- Updated `ShopCatalogAdminView.vue` to use those helpers while keeping drag/drop, context menu actions, inline create/rename, archive/delete, and service orchestration in the view.
- Removed the local child-map builders and descendant walker from the Shop Catalog admin view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-`R98` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R99`:

- Added `TimecardExportConfirmAction` and confirmation title/message/label helpers to `src/features/timecards/exportViewHelpers.ts`.
- Updated `TimecardExportView.vue` to use the shared confirmation helpers while keeping delete-card/delete-week execution and confirmation state in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R100`:

- Added `TimecardExportCustomCardFormState`, custom-card form factory/reset helpers, and custom-card validation helper to `src/features/timecards/exportViewHelpers.ts`.
- Updated `TimecardExportView.vue` to use the shared form helpers while keeping create target resolution, week creation, and card creation service calls in the view.
- Preserved the existing validation messages for linked job, job number, foreman owner, employee fields, and admin wage entry.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R101`:

- Added Timecard Export job option, foreman filter option, available foreman, and active foreman-user helpers to `src/features/timecards/exportViewHelpers.ts`.
- Updated `TimecardExportView.vue` to use the feature helpers for toolbar/create-tray option lists while keeping selected filter state and target resolution in the view.
- Removed the direct role-normalization dependency from `TimecardExportView.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-`R101` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R102`:

- Added shared `TimecardExportArchiveCardRecord` plus archive-card decoration, week burden lookup, remote/local merge, and next sort-index helpers to `src/features/timecards/exportViewHelpers.ts`.
- Updated `TimecardExportView.vue` to use those helpers while keeping card subscriptions, save timers/promises, delete/export actions, and workbook change handling in the view.
- Updated `TimecardExportCanvasPanel.vue` to use the shared archive-card type instead of duplicating the type locally.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R103`:

- Added Timecard Export display helpers for employee filtering, create-tray messages, visible week headings, week-row subtitles, save-state labels, mobile status signals, empty-canvas copy, and export filename/subtitle formatting to `src/features/timecards/exportViewHelpers.ts`.
- Updated `TimecardExportView.vue` to delegate those formatting/filtering rules while keeping reactive state, subscriptions, create-card orchestration, save flushing, and export execution in the view.
- Tightened `formatTimecardExportWeekStatusLabel` so strict indexed access always returns a concrete string.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R104`:

- Added Timecard Export create-target helpers for assigned foreman options, target week resolution, linked job number resolution, and selected foreman lookup to `src/features/timecards/exportViewHelpers.ts`.
- Updated `TimecardExportView.vue` to use those helpers while keeping `ensureTimecardWeek`, `createTimecardCard`, validation execution, and filter syncing in the view.
- Removed direct target-week construction and user-display formatting from the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-`R104` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R105`:

- Added Jobs view selectors/formatters for directory filtering, selected-job lookup, foreman option filtering/sorting, active/archive counts, job type options, GC suggestions, and archive/delete confirmation copy to `src/features/jobs/jobViewHelpers.ts`.
- Updated `JobsView.vue` to delegate those pure rules while keeping user/job subscriptions, create/detail form state, autosave, recipient persistence, archive/delete service calls, and routing in the view.
- Kept the existing `filterDirectoryRecords` behavior by passing a shallow mutable copy from the helper.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 19/19.

2026-07-13 `R106`:

- Added Jobs create/detail form state helpers for default form creation, resetting, and hydrating from a `JobRecord` to `src/features/jobs/jobViewHelpers.ts`.
- Updated `JobsView.vue` to initialize and reset/hydrate forms through those helpers while keeping detail messages, recipient state, hydration flags, signatures, and autosave orchestration in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R107`:

- Added Jobs watcher decision helpers for detail-form rehydration and visible-job selection fallback to `src/features/jobs/jobViewHelpers.ts`.
- Updated `JobsView.vue` watchers to delegate those pure decisions while keeping timer clearing, form hydration, and selected-job mutation in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R108`:

- Added Shop Catalog selector/label helpers for inspector ID parsing, archive-visible counts, category options, parent option filtering, root bucket presence, selected-category child/summary labels, and selected-item path/SKU labels to `src/features/shopCatalog/adminViewHelpers.ts`.
- Updated `ShopCatalogAdminView.vue` to delegate those pure rules while keeping drag/drop, context menus, long-press handling, inline create/rename, and service calls in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R109`:

- Added Daily Logs view-state helpers for page title, selected-log editability, submitted-log detection, create-log eligibility, create button copy, and saved-field display to `src/features/dailyLogs/viewHelpers.ts`.
- Updated `DailyLogsView.vue` to delegate those decisions while keeping the save-on-blur composable, subscriptions, create/submit/delete flows, recipient persistence, and attachment uploads in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 post-`R109` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R110`:

- Added Job Timecard state helpers for custom-card form defaults/reset/validation, confirmation title/message/label/destructive state, week status labels, save-state labels, and empty-canvas copy to `src/features/timecards/jobViewHelpers.ts`.
- Updated `TimecardsView.vue` to use those helpers while keeping week/card subscriptions, backfill, create/delete/submit service calls, save timers/promises, and workbook rendering in the view.
- Preserved the existing optional wage validation behavior and “Enter a valid wage amount.” message.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R111`:

- Added Job Timecard remote/local card merge and next sort-index helpers to `src/features/timecards/jobViewHelpers.ts`.
- Updated `TimecardsView.vue` to delegate pending-save snapshot merge and create-card sort-index calculation while keeping reactive state maps, subscriptions, save timers/promises, and service calls in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R112`:

- Added Shop Orders helper functions for order meta/custom item default state, order meta hydration, remove-item confirmation copy, sorted item cloning, item count, and total quantity to `src/features/shopOrders/viewHelpers.ts`.
- Updated `ShopOrdersView.vue` to delegate those pure rules while keeping subscriptions, autosave timers, item persistence, submit/email flow, and catalog interactions in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R113`:

- Added Shop Catalog helper functions for drag payload extraction, current drag-key parsing, drop-target resolution, and drop-eligibility checks to `src/features/shopCatalog/adminViewHelpers.ts`.
- Updated `ShopCatalogAdminView.vue` to delegate those pure drag/drop decisions while keeping browser events, auto-scroll, inline create/rename, drag move execution, and catalog service calls in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R114`:

- Added `src/utils/viewportPosition.ts` to centralize existing floating-menu viewport clamping math.
- Updated `ShopCatalogAdminView.vue` and `ShopOrderCatalogBrowser.vue` to use the shared helper while keeping each menu's actions and workflow callbacks feature-owned.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R115`:

- Added `src/features/timecards/stateMapHelpers.ts` for shared reactive record clearing and valid-ID pruning.
- Updated `TimecardsView.vue` and `TimecardExportView.vue` to use the shared helpers while preserving existing save timers, save promises, queued-save behavior, card persistence, and workbook/export rendering.
- Removed the generic record cleanup helpers from `src/features/timecards/exportViewHelpers.ts`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-`R115` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R116`:

- Added Shop Orders note-draft state helpers for clearing note timers/drafts, pruning queued saves, and syncing draft values from subscription snapshots without overwriting pending local edits.
- Updated `ShopOrdersView.vue` to delegate note-draft cleanup/sync while preserving existing debounce timing, save recursion, item persistence, and submit/email flow.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R117`:

- Added `src/components/common/AppMobilePanelTabs.vue` to own shared mobile two-panel tab markup, ARIA tablist attributes, and tab styling.
- Updated `UsersView.vue` and `EmployeesView.vue` to use the shared tabs component while keeping active-panel state and page workflows in the views.
- Removed duplicated mobile tab CSS from Users and Employees.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-`R117` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R118`:

- Added `src/features/timecards/useTimecardSaveQueue.ts` to own shared timecard save timers, active/scheduled/queued save maps, queued resave recursion, flush-before-action behavior, valid-ID pruning, and teardown.
- Updated `TimecardsView.vue` to provide only its job-week save payload/context while delegating queue mechanics to the composable.
- Updated `TimecardExportView.vue` to provide only its archive-card save payload/context while delegating queue mechanics to the composable and preserving its existing queued-save reset behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-13 `R119`:

- Added `src/features/timecards/useTimecardCardSelection.ts` to own selected-card state, compact-card state, expand/select behavior, select-first-visible fallback, and remote card sync defaults.
- Updated `TimecardsView.vue` to delegate selected/compact state while keeping job-week subscriptions, card creation, save queue, and workbook rendering in the view.
- Updated `TimecardExportView.vue` to delegate selected/compact state while keeping admin-only card edit-mode state and export workflows in the view.
- Tightened the export card UI sync type to use decorated archive cards instead of plain timecard records.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-13 post-`R119` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R120`:

- Added `src/__tests__/timecardSaveQueue.spec.ts` for debounce timing, queued resave behavior while a save is in flight, recent-save tracking, and valid-ID pruning.
- Added `src/__tests__/timecardCardSelection.spec.ts` for default selection/compact behavior, ordered fallback selection, pruning removed cards, expand/select on create, and filtered visible-card fallback.
- `npm run test:unit -- --run`: initial sandbox run failed during Vite/Vitest startup with Windows `spawn EPERM`; rerun outside the sandbox passed, 4 files / 12 tests.
- `npm run type-check`: passed.

2026-07-13 `R121`:

- Added `src/components/timecards/TimecardCanvasPanel.vue` as the shared timecard canvas shell for loading/empty states, panel header slot, card grid, collapse/expand controls, measurement refs, active/compact frame classes, and footer/action slots.
- Updated `JobTimecardCanvasPanel.vue` to keep job-specific header copy, workbook props, and delete behavior while delegating canvas chrome to the shared panel.
- Updated `TimecardExportCanvasPanel.vue` to keep archive/export-specific header copy, admin edit-mode action, workbook props, and delete behavior while delegating canvas chrome to the shared panel.
- Kept the inner `TimecardWorkbookCard` rendering untouched.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-13 `R122`:

- Added `src/components/timecards/TimecardPageMessage.vue` for shared timecard page info/error messages.
- Updated `TimecardsView.vue` to replace inline `timecards-message` markup/styles with `TimecardPageMessage`.
- Updated `TimecardExportView.vue` to use `TimecardPageMessage`.
- Removed the one-off `TimecardExportMessage.vue` component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-13 post-`R122` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R123`:

- Added `src/components/common/AppPaneHeader.vue` for shared pane eyebrow/title/action header chrome.
- Updated `UserDirectoryPanel.vue`, `EmployeeDirectoryPanel.vue`, and `JobBrowserPanel.vue` to use the shared header while keeping their feature-specific actions and list bodies.
- Kept directory filtering, editor forms, job create/edit behavior, and subscriptions untouched.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R124`:

- Added `src/components/common/AppSearchInput.vue` for shared search input styling, attrs passthrough, and `update:modelValue` behavior.
- Updated `UserDirectoryPanel.vue`, `EmployeeDirectoryPanel.vue`, and `JobBrowserPanel.vue` to use `AppSearchInput`.
- Removed the repeated panel-specific search input styles while preserving each panel's filtering event/state ownership.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R125`:

- Added `src/components/common/AppSelect.vue` as a light native select wrapper with attrs passthrough and `update:modelValue` behavior.
- Updated the Users, Employees, and Jobs directory status filters to use `AppSelect`.
- Kept the existing global `.app-select` styling in place for compatibility with unmigrated native selects.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 post-`R125` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R126`:

- Added `src/components/common/AppBadge.vue` for shared status/role pill styling.
- Updated Users, Employees, and Jobs status/role badges to use `AppBadge`.
- Removed repeated badge/status CSS from the converted panels/views while keeping status-group layout wrappers local.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R127`:

- Updated `UserEditorPanel.vue` user role selects to use `AppSelect`.
- Updated `JobDetailsFormFields.vue` job type selection to use `AppSelect`.
- Preserved role/job field emit behavior and existing `.app-select` visual styling.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R128`:

- Updated shop catalog category detail, create category, and create item parent/category selects to use `AppSelect`.
- Verified `AppSelect.vue` is the only app-owned component still rendering a raw native `<select>`.
- Preserved nullable parent/category value handling and existing `.app-select` visual styling.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R129`:

- Extended `AppPaneHeader.vue` with a `titleTag` prop so nested panels can keep `h2` headings.
- Updated shop catalog category detail, create category, and create item panel headers to use `AppPaneHeader`.
- Kept shop catalog panel body styles, form state, and create/edit/archive/delete behavior unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-`R129` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R130`:

- Added `src/components/common/AppTextInput.vue` for shared text/date/number input styling, attrs passthrough, and `update:modelValue` behavior.
- Updated `JobDetailsFormFields.vue`, `UserEditorPanel.vue`, and `EmployeeEditorPanel.vue` inputs to use `AppTextInput`.
- Preserved employee field blur-save listeners by allowing non-declared listeners to pass through to the underlying input.
- Removed repeated input chrome styles from the migrated forms.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R131`:

- Extended `AppTextInput.vue` to re-emit native `input` events in addition to `update:modelValue`.
- Updated shop catalog category/item create/detail form text and price fields to use `AppTextInput`.
- Updated `ShopCatalogItemDetailPanel.vue` to use `AppPaneHeader`, matching the other shop catalog form panels.
- Preserved price formatting event flow by keeping native input events available to the parent handlers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R132`:

- Added sizing CSS-variable hooks to `AppPaneHeader.vue` and `AppSearchInput.vue`.
- Updated `ShopCatalogTreeFilters.vue` to use `AppSearchInput`.
- Updated `ShopCatalogTreeHeader.vue` and `ShopCatalogRootInspector.vue` to use `AppPaneHeader`.
- Left inline tree create/rename inputs local because they own keyboard and blur-save behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-`R132` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R133`:

- Added `src/components/common/AppField.vue` for shared label/help/field wrapper layout.
- Updated `JobDetailsFormFields.vue` to use `AppField` around existing `AppTextInput` and `AppSelect` controls.
- Kept job field update events, `data-testid` attributes, and autosave flow unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R134`:

- Updated `UserEditorPanel.vue` create/detail fields to use `AppField`.
- Updated `EmployeeEditorPanel.vue` create/detail fields to use `AppField`.
- Preserved user role/job-assignment events and employee detail blur-save events.
- Removed now-redundant local field label wrapper CSS from the migrated panels.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R135`:

- Updated shop catalog category/item create/detail forms to use `AppField`.
- Preserved parent/category select handling and item price native input/focus/blur event flow.
- Removed now-redundant local field label wrapper CSS from the migrated shop catalog panels.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-`R135` checkpoint:

- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R136`:

- Added `src/components/common/AppButton.vue` as a thin wrapper over the existing `.app-button` classes.
- Migrated the Users, Employees, and Jobs directory create buttons to `AppButton`.
- Preserved the Jobs New Job `data-testid` and all create-button click behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R137`:

- Migrated shop catalog category/item create buttons to `AppButton`.
- Migrated shop catalog category/item save and archive/restore buttons to `AppButton`.
- Left delete buttons on their existing feature-specific danger classes until a dedicated danger variant is centralized.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R138`:

- Migrated Shop Orders New Order and Submit Order buttons to `AppButton`.
- Migrated the custom item Add Custom Item submit button to `AppButton`.
- Migrated catalog row add-item `+` buttons to `AppButton`, preserving item-specific `data-testid` values.
- Left draft/item delete buttons on their existing feature-specific danger classes until a dedicated danger variant is centralized.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R139`:

- Migrated Daily Log Save Draft and create-draft header actions to `AppButton`.
- Migrated the Daily Log History Today button to `AppButton`.
- Migrated the main Submit Daily Log action to `AppButton`, preserving its feature sizing class and success variant.
- Left Delete Draft on its existing feature-specific danger class until a dedicated danger variant is centralized.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R140`:

- Added an `AppButton` `danger` variant.
- Added centralized `.app-button--danger` styling to `src/styles/main.css`.
- Migrated `ConfirmDialog.vue` cancel/confirm actions to `AppButton`.
- Removed the dialog-local duplicate danger button styling.
- `npm run type-check`: passed.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R141`:

- Migrated shop catalog folder/item delete buttons to `AppButton` with `variant="danger"`.
- Removed duplicate shop catalog detail-panel danger button CSS.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R142`:

- Migrated Shop Order item remove buttons to `AppButton` with `variant="danger"`.
- Migrated Shop Order draft delete button to `AppButton` with `variant="danger"`.
- Kept shop-order-specific sizing classes while removing duplicate red border/text styling from those classes.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R143`:

- Migrated the Daily Log selected-card Delete Draft button to `AppButton` with `variant="danger"`.
- Removed duplicate selected-card danger button CSS.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts --project=chromium`: passed, 5/5.

2026-07-13 `R144`:

- Migrated User and Employee delete buttons to `AppButton` with `variant="danger"`, preserving their mobile width classes.
- Migrated Jobs delete button to `AppButton` with `variant="danger"`.
- Migrated Jobs archive/restore button to `AppButton`.
- Removed duplicate user/employee/job local danger button color styles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R145`:

- Migrated the shared `RecipientEditor` Add button to `AppButton`, preserving its feature sizing class.
- Migrated the Jobs topbar Edit Mode/Done Editing button to `AppButton`, preserving `data-testid="jobs-edit-mode"`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-pages.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 20/20.

2026-07-13 `R146`:

- Migrated image upload choose, delete attachment, and lightbox close buttons to `AppButton`.
- Used `variant="danger"` for attachment deletion while preserving upload-picker sizing classes.
- Removed duplicate upload-picker remove-button danger color CSS.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts --project=chromium`: passed, 4/4.

2026-07-13 `R147`:

- Added `src/components/common/AppButtonLink.vue` for router links that intentionally use button styling.
- Migrated the Not Found page Back to Jobs link to `AppButtonLink`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R148`:

- Extended `AppField` with label color/weight/letter-spacing/text-transform CSS-variable hooks.
- Extended `AppTextInput` with a box-shadow CSS-variable hook.
- Migrated `ShopOrderCustomItemForm.vue` description, quantity, and note fields to `AppField` + `AppTextInput`.
- Preserved compact shop-order field sizing through CSS variables.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R149`:

- Migrated `DailyLogHistoryList.vue` Calendar Search date input to `AppField` + `AppTextInput`.
- Preserved `data-testid="dailylog-date-search"` and selected-date update behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts --project=chromium`: passed, 5/5.

2026-07-13 `R150`:

- Migrated the shared `RecipientEditor.vue` email input to `AppTextInput`.
- Preserved Enter-to-add behavior and existing recipient input sizing through CSS variables.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 7/7.

2026-07-13 `R151`:

- Moved auth field input sizing onto `AppTextInput` CSS variables in `AuthCard.vue`.
- Migrated Login, Forgot Password, and Set Password email/password fields to `AppField` + `AppTextInput`.
- Preserved field ids, autocomplete values, readonly email display, and route behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.

2026-07-13 `R152`:

- Added `src/components/common/AppTextarea.vue` with attrs passthrough, `update:modelValue`, and native `input` re-emission.
- Migrated `DailyLogTextSectionCard.vue` text fields to `AppField` + `AppTextarea`.
- Preserved `data-testid` values, rows, disabled state, placeholders, focused typing updates, and blur-save events.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R153`:

- Migrated `ImageUploadPicker.vue` attachment description textareas to `AppTextarea`.
- Preserved description update payloads, commit-on-blur behavior, disabled state, rows, and placeholders.
- Removed duplicate upload-picker textarea styling in favor of `AppTextarea` CSS variables.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 5/5.

2026-07-13 `R154`:

- Migrated `UserAssignedJobsPanel.vue` assigned-job search to `AppSearchInput`.
- Migrated `JobFieldUserAssignmentPanel.vue` assigned field-user search to `AppSearchInput`.
- Removed duplicate local search input CSS from both assignment panels.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 9/9.
- `npm run test:e2e -- --project=chromium`: passed, 84/84 after the R151-R154 control migrations.

2026-07-13 `R155`:

- Migrated `ShopOrderSelectedOrderPanel.vue` delivery date and comments fields to `AppTextInput`.
- Migrated `ShopOrderItemsEditor.vue` quantity and note inputs to `AppTextInput`.
- Preserved delivery-date updates, comments autosave, item quantity `change` behavior, note draft input, note blur-save, and existing test ids.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R156`:

- Migrated `DailyLogManpowerCard.vue` trade/count/area inputs to `AppTextInput`.
- Migrated `DailyLogIndoorClimateCard.vue` reading inputs to `AppTextInput`.
- Preserved existing row update payloads and table-specific sizing through input CSS variables.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 10/10.

2026-07-13 `R157`:

- Added color/font/focus variable hooks to `AppTextInput` and `AppSearchInput` for light themed toolbars.
- Migrated `JobTimecardToolbar.vue` week-ending date input to `AppTextInput`.
- Migrated `JobTimecardToolbar.vue` employee card search to `AppSearchInput`.
- Preserved week picker events, card search updates, existing test ids, and timecard toolbar light styling through CSS variables.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R158`:

- Migrated `JobTimecardCreateTray.vue` employee search to `AppSearchInput`.
- Migrated custom card first name, last name, employee number, occupation, and wage inputs to `AppTextInput`.
- Preserved custom-card update events, employee-card creation, and light timecard tray styling through CSS variables.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R159`:

- Migrated `TimecardExportToolbar.vue` week/card search controls to `AppSearchInput`.
- Migrated `TimecardExportToolbar.vue` single/range date inputs to `AppTextInput`.
- Migrated `TimecardExportCreateTray.vue` employee search and custom-card fields to shared input primitives.
- Preserved PrimeVue select controls, export actions, create-card events, date picker click behavior, and admin export route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R160`:

- Migrated `ShopOrderCatalogBrowser.vue` catalog search to `AppSearchInput`.
- Migrated `ShopOrderCatalogTreeNodeRow.vue` item quantity inputs to `AppTextInput`.
- Added a normal-state box-shadow CSS-variable hook to `AppSearchInput` for compact feature search fields.
- Preserved catalog search expand/collapse behavior, item quantity updates, add-item behavior, and existing test ids.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R161`:

- Added `src/components/common/AppCheckbox.vue` with native checkbox semantics, `update:modelValue`, and native `change` re-emission.
- Migrated `UserAssignedJobsPanel.vue` assigned-job checkboxes to `AppCheckbox`.
- Migrated `JobFieldUserAssignmentPanel.vue` assigned field-user checkboxes to `AppCheckbox`.
- Preserved assignment toggle events and existing assignment-panel styling.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R162`:

- Migrated `UserEditorPanel.vue` active-user toggle to `AppCheckbox`.
- Migrated `EmployeeEditorPanel.vue` active/contractor toggles to `AppCheckbox`.
- Migrated shop catalog folder/item active toggles in create/detail panels to `AppCheckbox`.
- Removed now-unneeded checkbox event parsing helpers from those panels.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R163`:

- Migrated `JobTimecardCreateTray.vue` custom-card Contractor toggle to `AppCheckbox`.
- Migrated `TimecardExportCreateTray.vue` custom-card Contractor toggle to `AppCheckbox`.
- Migrated `ShopCatalogTreeFilters.vue` Show Archived toggle to `AppCheckbox`.
- Removed now-unneeded checkbox event parsing helpers from those components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-13 `R164`:

- Added `src/components/timecards/TimecardButton.vue` for repeated green-sheet timecard action button styling.
- Migrated `JobTimecardToolbar.vue` create week, create card, submit week, expand/compact, and sort buttons to `TimecardButton`.
- Left toolbar tabs and saved-week history rows local because they are different controls.
- Removed the duplicated job-toolbar `.timecards-button` CSS block.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R165`:

- Migrated `JobTimecardCreateTray.vue` Add Custom Card action to `TimecardButton`.
- Migrated `TimecardExportCreateTray.vue` Add Custom Card action to `TimecardButton`.
- Migrated `TimecardExportToolbar.vue` expand/compact/export/toggle create actions to `TimecardButton`.
- Removed duplicated `.timecards-button` CSS blocks from the tray/export components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R166`:

- Replaced the export-only `TimecardExportToolbarTabs.vue` with shared `TimecardToolbarTabs.vue`.
- Migrated `JobTimecardToolbar.vue` mobile tab buttons to `TimecardToolbarTabs`.
- Migrated `TimecardExportToolbar.vue` to the same shared tablist while preserving export tab ids and panel controls.
- Kept separate responsive breakpoints (`900px` for job timecards, `960px` for export) through a small component prop.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-13 `R167`:

- Added `src/components/timecards/TimecardSortModePicker.vue` for the shared Employee#/Name radio pair.
- Migrated `JobTimecardToolbar.vue` sort controls to the shared picker.
- Migrated `TimecardExportToolbar.vue` sort controls to the shared picker.
- Removed duplicated sort radio styles from both toolbar components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-13 `R168`:

- Added `src/components/common/AppListButton.vue` for reusable selectable card-like directory rows.
- Migrated `UserDirectoryPanel.vue`, `EmployeeDirectoryPanel.vue`, and `JobBrowserPanel.vue` row buttons to `AppListButton`.
- Preserved existing `.users-browser__row`, `.employees-browser__row`, and `.jobs-browser__row` hooks for tests and compatibility.
- Removed duplicated row shell hover/active CSS from the three directory panels.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R169`:

- Added `src/components/common/AppIconButton.vue` for compact circular icon-only actions with required accessible labels.
- Migrated daily-log manpower table add/remove buttons to `AppIconButton`.
- Migrated daily-log indoor climate table add/remove buttons to `AppIconButton`.
- Removed duplicated plus/remove button CSS and local screen-reader-only helper styles from those table components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R170`:

- Migrated `RecipientEditor.vue` remove-row buttons to `AppIconButton`.
- Preserved recipient remove labels/titles and add/remove event behavior.
- Removed duplicated circular danger button CSS from `RecipientEditor.vue`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 7/7.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R171`:

- Moved `.app-select` styling from `src/styles/main.css` into `AppSelect.vue`.
- Moved `.app-empty-state__title` and `.app-empty-state__message` styling into `AppEmptyState.vue`.
- Moved `.app-status-message` tone styling into `AppStatusMessage.vue`.
- Left the AppButton family styles global for now because `AppButton`, `AppButtonLink`, and `AppLoadingButton` intentionally share that class contract.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 27/27.

2026-07-13 `R172`:

- Reduced `src/styles/main.css` to an import-only entry point.
- Added `reset.css` for box sizing, app root sizing, form font inheritance, and reduced-motion behavior.
- Added `base.css` for root/body text rendering, links, code font, selection, scrollbars, and default text-input focus behavior.
- Added `button-family.css` for the shared `.app-button` contract used by `AppButton`, `AppButtonLink`, and `AppLoadingButton`.
- Added `primevue.css` for PrimeVue toast overrides.
- Updated `css-architecture.md` with the current split and the intentional temporary button-family exception.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/admin-pages.spec.ts e2e/jobs.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 29/29.

2026-07-13 `R173`:

- Added `src/features/shopCatalog/useShopCatalogContextMenu.ts` for menu state, viewport positioning, touch/pen long-press handling, suppressed click consumption, and cleanup.
- Updated `ShopCatalogAdminView.vue` to consume the composable instead of owning context-menu and long-press timer internals directly.
- Preserved root/category/item context targets, drag-start blocking during menu/long-press interaction, and unmount cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R174`:

- Added `src/features/shopCatalog/useShopCatalogTreeAutoScroll.ts` for tree drag auto-scroll thresholds, velocity, animation-frame stepping, and cancellation.
- Updated `ShopCatalogAdminView.vue` to use the composable and cancel auto-scroll on unmount.
- Kept existing drag/drop handlers, move validation, and Firestore update behavior in the route view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R175`:

- Added `src/features/shopCatalog/useShopCatalogRecords.ts` to own category/item subscriptions, shared loading state, shared error normalization, and unsubscribe cleanup.
- Migrated `ShopCatalogAdminView.vue` to use the composable with the admin catalog loading mode and existing error copy.
- Migrated `ShopOrdersView.vue` to use the composable with the existing wait-for-folders-and-items loading behavior.
- Removed duplicated raw catalog subscription setup from both route views.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 29/29.
- Post-slice checkpoint: `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R176`:

- Added `src/composables/useWindowEventListener.ts` for lifecycle-managed `window.addEventListener` / `removeEventListener`.
- Migrated `ShopCatalogAdminView.vue` pointerdown, keydown, and resize listeners to the composable.
- Kept explicit catalog subscription and interaction cleanup in the view.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R177`:

- Migrated `ShopOrderCatalogBrowser.vue` global pointerdown and Escape-key listeners to `useWindowEventListener`.
- Removed the component's local `onMounted` / `onBeforeUnmount` listener boilerplate.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R178`:

- Migrated `ShopOrderCatalogBrowser.vue` to use `useShopCatalogContextMenu` for context-menu state and viewport-aware positioning.
- Removed the component's duplicate `getViewportFloatingPosition` wrapper and local menu state.
- Kept order-specific context-menu action construction in the component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R179`:

- Added `src/composables/useSubscribedRecords.ts` for shared list subscription state, loading state, normalized errors, and unsubscribe cleanup.
- Migrated `EmployeesView.vue` employee list subscription to the helper while preserving selected-employee fallback behavior.
- Migrated `UsersView.vue` user list subscription to the helper while preserving selected-user fallback behavior.
- Left each page's write flows and non-list subscriptions unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R180`:

- Added an `initialLoading` option to `useSubscribedRecords` for lazily started subscriptions.
- Migrated `JobsView.vue` assignable-user subscription to the helper while preserving admin-only startup behavior.
- Left jobs-store and global-notification-recipient subscriptions unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 19/19.

2026-07-13 `R181`:

- Migrated `TimecardsView.vue` employee-list subscription to `useSubscribedRecords`.
- Preserved the existing page-level employee load error behavior through the helper's `onError` hook.
- Left job, week, card, save queue, rollover, and submit behavior unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R182`:

- Migrated `TimecardExportView.vue` employee-list subscription to `useSubscribedRecords` while preserving admin guard behavior and page-level errors.
- Migrated `TimecardExportView.vue` user/foreman subscription to `useSubscribedRecords`.
- Left archive week/card subscriptions and export actions unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R183`:

- Added `src/composables/useSubscribedValue.ts` for shared single-document/value subscription state, loading state, normalized errors, and unsubscribe cleanup.
- Migrated `JobsView.vue` all-jobs/global notification recipient defaults to the helper while preserving admin-only startup behavior.
- Migrated `DailyLogsView.vue` global daily-log recipient defaults to the helper while preserving existing action-error messaging.
- Left job writes, daily-log draft handling, daily-log submit, and recipient mutation semantics unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R184`:

- Migrated the `UsersView.vue` assigned-job options subscription to `useSubscribedRecords` through a small adapter around `subscribeVisibleJobs`.
- Split job-load errors into a dedicated `jobsError` source while keeping the same visible "Failed to load jobs." message path on the Users page.
- Left user create/edit/delete, invite sending, and assignment mutation behavior unchanged.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R185`:

- Hardened `useSubscribedRecords.ts` and `useSubscribedValue.ts` so synchronous subscriber failures use the same normalized error/loading behavior as callback failures.
- Migrated `ShopOrdersView.vue` job-scoped order-history subscription to `useSubscribedRecords` through a small adapter around the current route job id.
- Preserved selected-order fallback, order metadata autosave, item-note autosave, catalog subscription, and submit/delete workflows.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R186`:

- Migrated `DailyLogsView.vue` date-scoped daily-log subscription to `useSubscribedRecords` through a small adapter around the current route job id and selected date.
- Corrected selected-log fallback to use `getVisibleDailyLogs(...)` directly instead of accidentally treating that returned array as a truthy `.filter()` predicate.
- Preserved draft creation, save-on-blur typing behavior, attachments, recipients, delete draft, and submit workflows.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R187`:

- Migrated `TimecardsView.vue` week subscription to `useSubscribedRecords` while preserving admin/foreman visibility options and draft backfill.
- Migrated `TimecardsView.vue` card subscription to `useSubscribedRecords` through an adapter that still merges remote cards with local pending-save state before updating the UI.
- Preserved workbook typing, totals, job-number cascading, last-name sort, rollover, duplicate employee cards, submitted-week read-only behavior, and submit notification reporting.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R188`:

- Migrated `TimecardExportView.vue` admin archive week subscription to `useSubscribedRecords`.
- Left the custom per-week card subscription fanout in place because it coordinates filtered week sets, pending week loads, local save merges, and grouped card rebuilds.
- Preserved export archive filtering, draft-week deletion, editable card deletion, CSV/PDF export routes, lock/edit toggles, and print payload rendering.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 subscription sweep checkpoint:

- Broad search confirmed remaining manual subscription/lifecycle code is intentionally owned by shared composables, the shop catalog paired-record composable, or Timecard Export's per-week card fanout.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R189`:

- Added `src/utils/domEvents.ts` with shared `readInputValue` and `openNativeDatePicker` helpers.
- Migrated simple one-off input/date helpers in `ShopOrderItemsEditor.vue`, `TimecardWorkbookHeader.vue`, `TimecardWorkbookFooter.vue`, `TimecardExportToolbar.vue`, `ShopCatalogAdminView.vue`, and `TimecardsView.vue`.
- Left dense workbook cell inline handlers for a separate focused slice.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/shop-order-workspace.spec.ts e2e/timecard-workbook.spec.ts --project=chromium`: passed, 51/51.

2026-07-13 `R190`:

- Migrated `TimecardWorkbookCard.vue` grid cell inputs to the shared `readInputValue` helper.
- Added named H/P/C mapping helpers for day fields and off fields, replacing repeated nested template ternaries.
- Left workbook calculations, navigation helpers, save queue behavior, and print/PDF output untouched.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R191`:

- Extended `src/utils/domEvents.ts` with `readCheckboxChecked`.
- Migrated `AppTextInput.vue`, `AppSearchInput.vue`, `AppCheckbox.vue`, and `ShopCatalogTreeNodeRow.vue` to shared DOM event helpers.
- Preserved primitive component APIs, styling, catalog inline create/rename behavior, and all feature save semantics.
- `npm run type-check`: passed.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R192`:

- Added `useShopCatalogResponsivePanel` to own catalog mobile/inspector panel state and breakpoint detection.
- Added `useShopCatalogTreeExpansion` to own root bucket expansion, category expansion, expand-all/collapse-all, and initial root expansion behavior.
- Migrated `ShopCatalogAdminView.vue` off its inline responsive-panel and tree-expansion state while preserving selection, inspector switching, context-menu expansion actions, and create flows.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R193`:

- Added `useShopCatalogInlineEditing` to own catalog inline create/rename state, input refs, cancel/reset helpers, and focus/select behavior.
- Migrated `ShopCatalogAdminView.vue` to start inline creates/renames through the composable instead of owning the edit refs and state reset mechanics directly.
- Preserved catalog tree inline create, rename, item/folder selection, and real route CRUD behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R194`:

- Added `useShopCatalogDragDrop` to own catalog drag state, drag/drop DOM handlers, drop highlighting, and tree auto-scroll lifecycle.
- Kept the actual catalog move persistence in `ShopCatalogAdminView.vue`, so Firestore writes and selection/error messaging remain owned by the page workflow.
- Migrated `ShopCatalogAdminView.vue` off its duplicated drag/drop event handlers while preserving tree props/events and catalog CRUD behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R195`:

- Added `useShopCatalogConfirmDialog` to own catalog confirmation action state, labels, destructive styling, and safe close behavior while operations are busy.
- Migrated `ShopCatalogAdminView.vue` to use the shared confirmation-dialog state while keeping archive/delete persistence workflows in the page.
- Preserved catalog archive/delete confirmations and surrounding admin-page confirmation behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R196`:

- Added `useShopCatalogForms` to own catalog create/detail form state, selected-record hydration, create-form resets, and price input normalization.
- Migrated `ShopCatalogAdminView.vue` off its local form reactive state and form formatting helpers while keeping submit/save persistence workflows in the page.
- Preserved catalog create/edit/archive/delete behavior through the real admin route.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R197`:

- Added `useTimecardExportConfirmDialog` to own timecard export confirmation action state, labels, and safe close behavior while actions are loading.
- Migrated `TimecardExportView.vue` off its local confirmation label/open handler logic while keeping card/week delete workflows in the route.
- Preserved timecard export saved-week display, draft-week deletion, editable-card deletion, CSV/PDF export, lock/edit toggles, and print payload rendering.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R198`:

- Added `useTimecardExportFilters` to own export filter state, week filter bounds, filtered-week computation, and toolbar filter updates.
- Migrated `TimecardExportView.vue` off its route-local filter initialization/update function while preserving the same filter object consumed by the toolbar and create-card workflows.
- Preserved saved-week filtering, CSV/PDF export behavior, delete workflows, lock/edit toggles, and print route rendering.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R199`:

- Added `useTimecardExportArchiveCards` to own timecard export archive-card loading, per-week card subscriptions, cached cards by week, loading state, remote/local save-state merges, redecorating loaded cards, and week-cache cleanup.
- Migrated `TimecardExportView.vue` off its route-local card subscription fanout while keeping UI pruning, save queue coordination, messages, and create/delete/export workflows in the route.
- Preserved saved-week loading, draft-week deletion, editable-card deletion, CSV/PDF export, lock/edit toggles, and print payload rendering.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-admin-decomposition checkpoint:

- Full e2e suite passed after the shop catalog and timecard export composable extractions.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R200`:

- Added `useRouteJobContext` as the shared convention for job-scoped routes to resolve `jobId`, select the current job from the jobs store, subscribe to the route job, and stop the current-job subscription.
- Migrated `JobDashboardView.vue`, `DailyLogsView.vue`, `ShopOrdersView.vue`, and `TimecardsView.vue` off their duplicated route/store job lookup and subscription wiring.
- Preserved dashboard navigation, daily log draft/submission behavior, shop order workspace behavior, and job timecard workbook behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts e2e/timecard-workbook.spec.ts --project=chromium`: passed, 48/48.

2026-07-13 `R201`:

- Added `useDailyLogRecipients` to own Daily Logs recipient input state, saving state, admin/default recipient resolution, duplicate validation, add/remove persistence, and local selected-log recipient updates.
- Migrated `DailyLogsView.vue` off its route-local recipient computed values and add/remove handlers while preserving draft save-on-blur, submit, attachment, and selected-log hydration behavior.
- Preserved stale recipient error clearing when retrying recipient saves.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 10/10.

2026-07-13 `R202`:

- Added `useDailyLogAttachments` to own Daily Logs attachment lists, section busy state, description edits, upload validation/persistence, and single-attachment removal.
- Migrated `DailyLogsView.vue` off route-local attachment helper state/actions while keeping whole-draft delete cleanup in the view.
- Preserved attachment upload/remove behavior, draft snapshot updates, and save-on-blur text behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-draft.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 10/10.

2026-07-13 `R203`:

- Added `useDailyLogRepeaters` to own Daily Logs manpower rows and indoor climate reading add/remove/update behavior.
- Migrated `DailyLogsView.vue` off route-local repeater mutators while preserving current edit guards, blank-row reset behavior, and foreman user attribution on added manpower rows.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-draft.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 10/10.

2026-07-13 `R204`:

- Added `useShopOrderConfirmDialogs` to own Shop Orders remove-item, delete-draft, and submit confirmation dialog state plus the remove-item confirmation message.
- Migrated `ShopOrdersView.vue` off route-local confirmation refs and remove-target lookup while keeping all order persistence workflows in the page.
- Preserved draft creation, item add/remove, item notes, delivery shortcuts, submit behavior, submitted read-only state, and order-history numbering.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R205`:

- Added `useShopOrderItemNotes` to own Shop Orders item-note drafts, save timers, queued saves, remote sync, input handling, and blur flushing.
- Migrated `ShopOrdersView.vue` off its route-local item-note autosave queue while keeping item persistence routed through the page's existing `persistOrderItems` workflow.
- Preserved note autosave while typing, stale remote echo protection, item removal, submit behavior, and history/read-only behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R206`:

- Added `useShopOrderMetaForm` to own Shop Orders delivery-date/comments form state, selected-order hydration, stale remote echo protection, debounced metadata autosave, validation, and Thursday delivery shortcut behavior.
- Migrated `ShopOrdersView.vue` off route-local metadata hydration/timer/signature state while keeping the Firestore metadata update callback in the page workflow.
- Preserved next-Thursday defaults, comment autosave stability while typing, item-note autosave, submit validation, submitted read-only rendering, and order-history numbering.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R207`:

- Added `useJobTimecardConfirmDialog` to own job Timecards remove-card/submit confirmation action state, labels, destructive styling, and safe close behavior while actions are busy.
- Migrated `TimecardsView.vue` off route-local confirmation computed values while keeping delete-card and submit-week persistence workflows in the page.
- Preserved week creation, foreman permissions, workbook typing/navigation, totals, rollover, duplicate employee cards, submit email result messaging, read-only submitted weeks, and card removal behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R208`:

- Added `useJobConfirmDialogs` to own Jobs archive/delete confirmation open state, archive labels, delete messaging, and safe close behavior while archive/delete actions are busy.
- Migrated `JobsView.vue` off route-local archive/delete dialog refs and computed confirmation text while keeping archive/delete persistence workflows in the page.
- Preserved admin page behavior across users, employees, shop catalog, timecard export, print route, and Jobs route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R209`:

- Added `useJobDetailForm` to own Jobs detail form state, selected-job hydration, detail recipient hydration/reset, stale remote echo protection, debounced autosave, validation, and explicit save submission.
- Migrated `JobsView.vue` off route-local detail form autosave timer/signature/hydration state while keeping the Firestore job update callback in the page workflow.
- Preserved admin page behavior across users, employees, shop catalog, timecard export, print route, and Jobs route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R210`:

- Added `useShopCatalogSelection` to own Shop Catalog active-folder state, selected inspector key, selected category/item lookup, inspector-mode computed values, and root/folder/item selection behavior.
- Migrated `ShopCatalogAdminView.vue` off route-local selection refs/computed values while keeping create-mode preparation, drag/drop moves, archive/delete persistence, and inline create/rename workflows in the page.
- Preserved shop catalog filtering, real catalog create/edit/archive/delete behavior, and surrounding admin route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R210 full-suite checkpoint:

- Full Chromium e2e suite passed after the Daily Logs, Shop Orders, job Timecards, Jobs, and Shop Catalog composable extraction sequence.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R211`:

- Added `useJobCreateForm` to own Jobs create form state, create notification recipients, create recipient inputs, create-form reset behavior, and create-field updates.
- Migrated `JobsView.vue` off route-local create-form state/update/reset helpers while keeping `createJobRecord` persistence in the page workflow.
- Preserved job search, job creation, detail autosave, module-specific recipients, archive/restore/delete, and all-jobs recipient defaults.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R212`:

- Added `useJobNotificationRecipients` to own Jobs recipient saving state, create/job/all recipient target resolution, email validation, duplicate handling, add/remove persistence coordination, and recipient status/error messages.
- Migrated `JobsView.vue` off route-local recipient add/remove handlers while keeping selected-job and all-jobs recipient update callbacks explicit.
- Preserved job search, job creation, detail autosave, module-specific recipients, archive/restore/delete, and all-jobs recipient defaults.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R213`:

- Added `useTimecardExportCreateTray` to own Timecard Export create-tray visibility, selected job/foreman ids, employee search, custom card form state, reset behavior, and close/toggle helpers.
- Migrated `TimecardExportView.vue` off route-local create-tray refs and custom-card reset helper while keeping week/card creation and export workflows in the page.
- Preserved admin page behavior across users, employees, shop catalog, timecard export, print route, saved-week deletion, card deletion, CSV/PDF export, and card lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R214`:

- Added `useJobTimecardCreateTray` to own job Timecards create-tray visibility, employee search, custom card form state, reset behavior, and close/toggle helpers.
- Migrated `TimecardsView.vue` off route-local create-tray refs and custom-card reset helper while keeping week/card creation, workbook saving, and submit workflows in the page.
- Preserved week creation, foreman permissions, workbook typing/navigation, totals, rollover, duplicate employee cards, submit email result messaging, read-only submitted weeks, and card removal behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 post-R214 full-suite checkpoint:

- Full Chromium e2e suite passed after the Jobs create form/recipient, Timecard Export create-tray, and job Timecards create-tray extraction sequence.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R215`:

- Added `useTimecardExportUiState` to own Timecard Export mobile toolbar tab selection and admin card edit-mode flags.
- Migrated `TimecardExportView.vue` off route-local tab/edit-state bookkeeping while preserving explicit newly-created-card edit mode and card-state pruning/reset behavior.
- Preserved admin page behavior across users, employees, shop catalog, timecard export, print route, saved-week deletion, card deletion, CSV/PDF export, and card lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R216`:

- Added `useTimecardExportSummary` to own Timecard Export derived totals, account summaries, visible-week labels, package/job/foreman labels, status signals, empty canvas messaging, PDF subtitle, and CSV filename.
- Migrated `TimecardExportView.vue` off route-local summary/status/export-label computed values while keeping PDF and CSV action orchestration in the page.
- Preserved admin page behavior across users, employees, shop catalog, timecard export, print route, saved-week deletion, card deletion, CSV/PDF export, and card lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R217`:

- Added `useShopCatalogContextMenuActions` to own Shop Catalog context-menu action visibility, labels, disabled states, and root/category/item menu branching.
- Migrated `ShopCatalogAdminView.vue` off its route-local context-menu action builder while keeping create, rename, archive, delete, selection, expansion, and inspector workflows in the page callbacks.
- Preserved admin page behavior across users, employees, shop catalog, timecard export, print route, saved-week deletion, card deletion, CSV/PDF export, and card lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R217 full-suite checkpoint:

- Full Chromium e2e suite passed after Timecard Export UI/summary and Shop Catalog context-menu action extraction.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R218`:

- Added `useShopCatalogTreeInteractions` to own Shop Catalog tree opening, root/root-bucket click handling, node click handling, and global pointer/Escape menu cleanup behavior.
- Migrated `ShopCatalogAdminView.vue` off route-local tree interaction functions while keeping selection, expansion, drag cleanup, and inspector routing callbacks explicit.
- Preserved admin page behavior across users, employees, shop catalog, timecard export, print route, saved-week deletion, card deletion, CSV/PDF export, and card lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R219`:

- Added shared `usePageMessages` to own normalized page error/info refs, mutually exclusive message setters, and basic message reset behavior.
- Migrated `TimecardExportView.vue` and `TimecardsView.vue` off duplicated local page-message helpers while preserving each route's existing save-error reset behavior through route-local wrappers.
- Preserved job Timecards workbook behavior and Timecard Export/admin behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R220`:

- Added `useJobTimecardSummary` to own job Timecards account summary, total hours/production, week status/range labels, display job labels, linked job number, save state label, and empty canvas message.
- Migrated `TimecardsView.vue` off route-local summary/display computed values while keeping `burdenValue` route-local for save orchestration.
- Preserved job Timecards workbook behavior, including typing/navigation, totals, rollover, duplicate employee cards, submit email result messaging, submitted read-only behavior, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 post-R220 full-suite checkpoint:

- Full Chromium e2e suite passed after shared page-message extraction and job Timecards summary extraction.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R221`:

- Extended shared `usePageMessages` with a plain string error setter for action-message workflows that already normalize errors at call sites.
- Migrated `DailyLogsView.vue` and `ShopOrdersView.vue` off duplicated local action error/info refs and setter helpers while preserving their existing toast behavior and direct message assignments.
- Preserved Daily Logs draft/submit/recipient/typing behavior and Shop Orders draft/order-item/submit/history behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-draft.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R222`:

- Moved `getShopCatalogCategoryPath` into the shared Shop Catalog display helper module while re-exporting it through the existing admin helper surface for compatibility.
- Added `getShopOrderCatalogItemDescription` to Shop Orders view helpers so catalog item order descriptions use shared catalog display/path behavior instead of route-local category walking.
- Migrated `ShopOrdersView.vue` off local catalog path/item-description formatting while preserving added catalog item names, item sorting, quantity handling, submit behavior, and history behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-R222 full-suite checkpoint:

- Full Chromium e2e suite passed after Daily Logs/Shop Orders shared action-message cleanup and Shop Orders catalog display helper extraction.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R223`:

- Updated shared `usePageMessages` so empty info/error setter calls clear only their own channel, keeping validation errors intact when form helpers clear stale info text.
- Migrated `JobsView.vue` create/detail message state to two shared `usePageMessages` channels while preserving existing job create, autosave, recipient, archive, restore, and delete workflows.
- Preserved job page behavior including delayed autosave text stability and all-jobs/default notification recipient editing.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R224`:

- Migrated `UsersView.vue` create, invite, and detail/editor messages to shared `usePageMessages` channels while preserving pending invite sending, autosave status text, role/job assignment editing, and delete confirmation behavior.
- Migrated `EmployeesView.vue` create and detail/editor messages to shared `usePageMessages` channels while preserving blur-save status text, validation behavior, employee creation, editing, and deletion.
- Preserved admin management and admin route behavior across users, employees, shop catalog, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R225`:

- Migrated `ShopCatalogAdminView.vue` create/detail message normalization to shared `usePageMessages` channels while keeping existing ref-based form hydration and reset behavior intact.
- Preserved catalog create, validation, move, archive/restore, inline create/rename, save, and delete user-facing messages through shared setters.
- Preserved admin route behavior across users, employees, shop catalog, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R225 full-suite checkpoint:

- Full Chromium e2e suite passed after shared message cleanup across Jobs, Users, Employees, and Shop Catalog admin views.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R226`:

- Added `useShopCatalogDerivedData` to own core Shop Catalog admin indexes, child maps, visible counts, category path helpers, direct/visible child-count helpers, and category options.
- Migrated `ShopCatalogAdminView.vue` off route-local catalog map/count/path helpers while leaving selection-dependent tree-node derivation in the page for a later, safer slice.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R227`:

- Added `useShopCatalogInspectorSummary` to own selected folder/item display state, including child-presence checks, path labels, summary labels, SKU labels, and price labels.
- Migrated `ShopCatalogAdminView.vue` off route-local inspector display computed values while preserving archive/delete checks and inspector props.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R228`:

- Added `useTimecardExportCreateContext` to own Timecard Export job options, foreman filter options, assignable foreman options, create target week resolution, available employee filtering, and create-tray messaging.
- Migrated `TimecardExportView.vue` off route-local create-tray option/target computed values while keeping create/delete/export action orchestration in the page.
- Preserved admin route behavior across users, employees, shop catalog, timecard export saved weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R229`:

- Added `useTimecardExportVisibleCards` to own Timecard Export active create-week cards, filtered cards, and ordered cards.
- Migrated `TimecardExportView.vue` off route-local visible-card computed values while keeping card sync, PDF/CSV export, selection syncing, and action orchestration in the page.
- Preserved admin route behavior across users, employees, shop catalog, timecard export saved weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R229 full-suite checkpoint:

- Full Chromium e2e suite passed after Timecard Export create-context and visible-card extractions.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R230`:

- Added `useDailyLogSelectionState` to own Daily Logs selected-date state, visible-log filtering, selected-log lookup, title text, edit/create permissions, create-button label, and site-info display values.
- Migrated `DailyLogsView.vue` off route-local selected-log/date/site-info computed values while keeping draft creation, save-on-blur, submit, recipient, attachment, and delete workflows in the page/composables.
- Preserved Daily Logs submit, draft, recipient, attachment, read-only, and typing/save-on-blur behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-draft.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R231`:

- Added `useJobTimecardWorkspaceState` to own job Timecards selected-week resolution, week-start date, filtered cards, available employees, edit/create permissions, job burden, and recent-week list state.
- Migrated `TimecardsView.vue` off route-local workspace computed values while keeping week creation/backfill, card creation/removal, save queue, submit, sort, and date-picker workflows in the page.
- Preserved job Timecards workbook behavior, including create-week validation, no lock controls, row cascades, keyboard navigation, totals, rollover, submit email result messaging, duplicate employee cards, read-only submitted weeks, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R232`:

- Added `useShopOrderWorkspaceState` to own Shop Orders category lookup, selected order, edit permission, draft/submitted groups, mutation-disabled state, item count, total quantity, and sorted selected-order items.
- Migrated `ShopOrdersView.vue` off route-local workspace computed values while keeping draft creation, metadata autosave, item persistence, note autosave, submit, delete, and catalog/custom item actions in the page/composables.
- Preserved Shop Orders workspace behavior, including default delivery dates, catalog search expansion, item naming/sorting, custom items, autosave, submit, quantity handling, removal, submitted read-only state, order numbers, and history reset behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-R232 full-suite checkpoint:

- Full Chromium e2e suite passed after Daily Logs selection-state, job Timecards workspace-state, and Shop Orders workspace-state extractions.
- `npm run test:e2e -- --project=chromium`: passed, 84/84.

2026-07-13 `R233`:

- Added `useJobsViewState` to own Jobs page directory visibility, selected-job lookup, create/all-jobs mode flags, status counts, foreman filtering, job type options, and GC suggestions.
- Migrated `JobsView.vue` off route-local derived directory state while keeping create, edit, archive, delete, autosave, recipient, and navigation workflows in the page/composables.
- Preserved Jobs behavior across search, create, autosave under slow responses, module recipient saving, archive/restore/delete, and all-jobs notification defaults.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R234`:

- Added `useShopCatalogTreeDisplayState` to own Shop Catalog admin root bucket counts/summary, root-bucket child detection, detail parent options, and tree-node building.
- Migrated `ShopCatalogAdminView.vue` off route-local tree display computed values while keeping drag/drop, selection, inline create/rename, archive, delete, and inspector workflows in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R235`:

- Added `useTimecardExportCreateActions` to own Timecard Export create-card workflow: linked job validation, create-week resolution, employee/custom card creation, filter syncing, card edit-mode selection, tray close, and scroll-to-card behavior.
- Migrated `TimecardExportView.vue` off route-local create-card action helpers while keeping subscription, card sync, delete, CSV export, PDF export, and workbook editing workflows in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog, timecard export saved weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R235 full-suite checkpoint:

- Full Chromium e2e suite passed after Jobs directory-state, Shop Catalog tree-display, and Timecard Export create-action extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R236`:

- Added `useJobTimecardCreateActions` to own job Timecards employee/custom card creation, including sort-index assignment, seed payload building, validation, create-tray reset/close, card selection, and scroll-to-card behavior.
- Migrated `TimecardsView.vue` off route-local card creation helpers while keeping week creation, rollover/backfill, card save queue, sorting, deletion, submission, date selection, and subscriptions in the page/composables.
- Preserved job Timecards workbook behavior, including create-week validation, no lock controls, row cascades, keyboard navigation, totals, rollover, foreman creation/submission, duplicate employee cards, read-only submitted weeks, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R237`:

- Added `useDailyLogActions` to own Daily Logs create-draft, explicit save, submit/email, delete confirmation, and delete workflows.
- Migrated `DailyLogsView.vue` off route-local daily-log action handlers while keeping form hydration, save-on-blur typing, recipient editing, attachments, repeaters, date selection, and subscriptions in the page/composables.
- Preserved Daily Logs behavior across intentional draft creation, submitted-log selection, submit validation/email success, attachment upload/delete, recipient editing, save-on-blur typing, read-only submitted logs, and draft deletion.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-draft.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R238`:

- Added `useShopCatalogArchiveActions` to own Shop Catalog folder/item archive and restore workflows, including descendant folder/item cascading, hidden archived selection fallback, and restore reselection behavior.
- Migrated `ShopCatalogAdminView.vue` off route-local archive/restore action handlers while keeping inline create/rename, drag/drop, create/save/delete, inspector, context menu, and tree interactions in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R239`:

- Added `useShopCatalogDeleteActions` to own Shop Catalog folder/item delete confirmation and execution workflows, including non-empty folder protection and post-delete selection fallback.
- Migrated `ShopCatalogAdminView.vue` off route-local delete action handlers while keeping inline create/rename, drag/drop, create/save, archive/restore, inspector, context menu, and tree interactions in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R239 full-suite checkpoint:

- Full Chromium e2e suite passed after job Timecards create-action, Daily Logs action, Shop Catalog archive-action, and Shop Catalog delete-action extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R240`:

- Added `useShopCatalogFormActions` to own Shop Catalog inspector create/save form workflows for folders and items, including validation, write payload building, loading state, expansion updates, selection updates, and success/error messaging.
- Migrated `ShopCatalogAdminView.vue` off route-local create/save form handlers while preserving inline create/rename, drag/drop, archive/restore, delete, inspector summaries, context menu, and tree interactions in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R241`:

- Added `useShopOrderPersistence` to own Shop Orders metadata persistence, sorted item cloning, sorted item persistence, loading state, actor attribution, and success/error messaging.
- Migrated `ShopOrdersView.vue` off route-local persistence helpers while keeping draft creation, catalog/custom item actions, quantity updates, item removal, order deletion, submission/email, autosave scheduling, and history selection in the page/composables.
- Preserved Shop Orders workspace behavior, including default delivery dates, catalog search expansion, item naming/sorting, custom items, autosave, submit, quantity handling, removal, submitted read-only state, order numbers, and history reset behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R242`:

- Added `useTimecardExportDownloadActions` to own Timecard Export PDF and CSV export workflows, including pending-save flushing, print-route payload creation, popup handling, CSV detail generation/download, and export status messaging.
- Migrated `TimecardExportView.vue` off route-local PDF/CSV handlers while keeping subscription, filter/card sync, create-card, delete, and workbook editing workflows in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog, timecard export saved weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R242 full-suite checkpoint:

- Full Chromium e2e suite passed after Shop Catalog form-action, Shop Orders persistence, and Timecard Export download-action extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R243`:

- Added `useJobCrudActions` to own Jobs create, detail persistence, archive/restore, and delete workflows, including validation, production burden normalization, notification recipient writes, loading state, selection fallback, and user-facing messages.
- Migrated `JobsView.vue` off route-local CRUD handlers while preserving directory state, edit drawer navigation, detail autosave, field-user assignment, notification recipient editing, and all-jobs defaults in the page/composables.
- Preserved Jobs behavior across search, create, autosave under slow responses, module recipient saving, archive/restore/delete, and all-jobs notification defaults.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R244`:

- Added `useShopCatalogInlineActions` to own Shop Catalog context-menu inline create/rename workflows, including inspector create-item mode, inline folder/item creation, inline rename, expansion/selection updates, and failure messaging.
- Migrated `ShopCatalogAdminView.vue` off route-local inline create/rename handlers while preserving drag/drop, inspector form create/save, archive/restore, delete, inspector summaries, context menu, and tree interactions in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R244 full-suite checkpoint:

- Full Chromium e2e suite passed after Jobs CRUD and Shop Catalog inline-action extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R245`:

- Added `useJobTimecardWeekActions` to own job Timecards week lifecycle behavior, including explicit week creation, empty-draft backfill, in-flight de-duping, pending-save flushing, create-tray closing, actor attribution, and user-facing success/error messages.
- Migrated `TimecardsView.vue` off route-local week create/backfill handlers while preserving subscriptions, workbook editing, card creation, card deletion, sorting, submission, date selection, save queue, and display state in the page/composables.
- Preserved job Timecards behavior across required date entry, foreman week creation/submission, prior-week rollover/backfill, submitted-week preference over accidental blank drafts, duplicate employee cards, read-only submitted weeks, totals, keyboard navigation, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R246`:

- Added `useJobTimecardCardActions` to own job Timecards remove-card, sort-card, submit-week, and confirm-dispatch workflows, including pending-save flushing, loading state, actor attribution, service writes, and user-facing messages.
- Migrated `TimecardsView.vue` off route-local card action handlers while preserving week lifecycle, subscriptions, workbook editing, create tray, selection, save queue, date selection, and display state in the page/composables.
- Preserved job Timecards behavior across last-name sorting, card deletion empty-state reset, foreman submission, notification result messaging, duplicate employee cards, read-only submitted weeks, totals, keyboard navigation, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R247`:

- Added `useTimecardExportMutationActions` to own Timecard Export remove-card, delete-draft-week, and confirm-dispatch workflows, including pending-save flushing, loading state, archive cache cleanup, confirmation payloads, and user-facing messages.
- Migrated `TimecardExportView.vue` off route-local export mutation handlers while preserving archive subscriptions, filters, workbook editing, create tray, CSV/PDF exports, print route payloads, lock/edit controls, and visible-card summaries in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R247 full-suite checkpoint:

- Full Chromium e2e suite passed after job Timecards week/action extractions and Timecard Export mutation-action extraction.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R248`:

- Added `useShopOrderDraftActions` to own Shop Orders draft lifecycle behavior, including explicit draft creation, next-Thursday default delivery dates, delivery-date validation, existing-draft targeting, selected-order updates, and user-facing messages.
- Migrated `ShopOrdersView.vue` off route-local draft create/target handlers while preserving catalog item actions, custom items, quantity updates, item removal, draft deletion, submission/email, autosave, history selection, and order subscriptions in the page/composables.
- Preserved Shop Orders behavior across default delivery dates, new draft reset, catalog search expansion/collapse, item naming/sorting, custom item submission, quantity handling, autosave, item removal empty state, submitted read-only state, order numbers, and history reset behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R249`:

- Added `useShopOrderItemActions` to own Shop Orders catalog-item add, custom-item add, quantity update, and remove-item confirmation workflows, including catalog display naming, quantity normalization, custom form reset, draft targeting, persistence, and user-facing validation.
- Migrated `ShopOrdersView.vue` off route-local item mutation handlers while preserving draft creation, metadata autosave, note autosave, draft deletion, submission/email, history selection, and order subscriptions in the page/composables.
- Preserved Shop Orders behavior across catalog item naming, custom items, catalog/custom single-table submission, item alphabetizing, quantity handling, item note autosave, item removal empty state, submitted read-only state, order numbers, and history reset behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R250`:

- Added `useShopOrderSubmissionActions` to own Shop Orders draft deletion, submit validation, submit confirmation, status update, email send, loading state, and user-facing error/success messaging.
- Migrated `ShopOrdersView.vue` off route-local draft-delete and submit/email handlers while preserving draft creation, catalog/custom item actions, metadata autosave, note autosave, history selection, and order subscriptions in the page/composables.
- Preserved Shop Orders behavior across next-Thursday defaults, item naming/sorting, catalog/custom single-table submission, quantity handling, item note autosave, item removal, submitted read-only state, order numbers, and history reset behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-R250 full-suite checkpoint:

- Full Chromium e2e suite passed after Shop Orders draft lifecycle, item action, and submission/delete action extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R251`:

- Added `useUserCreateActions` to own Users admin create-user and pending-invite workflows, including required-field validation, role-based assigned-job payloads, loading state, selection updates, and user-facing messages.
- Migrated `UsersView.vue` off route-local create/invite service handlers while preserving directory filtering, create/detail forms, assigned-job editing, detail autosave, delete confirmation, and mobile panel behavior in the page/composables.
- Preserved admin route behavior across user filtering, project-manager creation with job assignments, employees filtering, shop catalog admin flows, timecard export flows, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R252`:

- Added `useUserDetailActions` to own Users detail autosave timing, detail persistence, delete confirmation, delete execution, loading state, selection reset, and user-facing messages.
- Migrated `UsersView.vue` off route-local detail mutation/timer handlers while preserving directory filtering, create/invite actions, detail form hydration, assigned-job editing, role cleanup, mobile panel behavior, and delete dialog wiring in the page/composables.
- Preserved admin route behavior across user filtering, project-manager creation with job assignments, employees filtering, shop catalog admin flows, timecard export flows, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R253`:

- Added `useEmployeeActions` to own Employees create, save-on-blur, delete confirmation, delete execution, loading state, selection reset, and user-facing messages.
- Migrated `EmployeesView.vue` off route-local employee mutation handlers while preserving directory filtering, create/detail form hydration, status counts, occupation suggestions, mobile panel behavior, and delete dialog wiring in the page/composables.
- Preserved admin route behavior across user filtering, project-manager creation with job assignments, employees filtering, shop catalog admin flows, timecard export flows, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R253 full-suite checkpoint:

- Full Chromium e2e suite passed after Users create/detail action and Employees action extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R254`:

- Added `useShopCatalogMoveActions` to own Shop Catalog drag/drop move persistence for folders and items, including write payloads, selection updates, expansion updates, and move error messaging.
- Migrated `ShopCatalogAdminView.vue` off route-local drag/drop move handlers while preserving tree drag/drop validation, inline create/rename, inspector form create/save, archive/restore, delete, context menu, and tree interactions in the page/composables.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R255`:

- Added `useShopCatalogContextMenuTargets` to translate Shop Catalog root/category/item pointer and context-menu events into context menu targets outside the route view.
- Migrated `ShopCatalogAdminView.vue` off route-local root/node context-menu adapter functions while preserving draft-node suppression, root long-press, node long-press, and context-menu opening behavior.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R256`:

- Added `useShopCatalogContextDeleteActions` and `useShopCatalogConfirmDispatcher` to move context-menu delete selection and confirm-dialog archive/delete dispatch out of `ShopCatalogAdminView.vue`.
- Reordered Shop Catalog context-menu action setup so delete actions are composed from initialized delete handlers while preserving archive/restore/delete confirmations, selected-folder/item targeting, and mobile inspector context actions.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R256 full-suite checkpoint:

- Full Chromium e2e suite passed after Shop Catalog drag/drop move, context-menu target, context-delete, and confirm-dispatch extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R257`:

- Added `useTimecardExportSubscriptions` to own Timecard Export week, employee, and user subscription setup, including admin-only employee/foreman loading and page-level subscription error messaging.
- Migrated `TimecardExportView.vue` off raw `useSubscribedRecords` calls and direct employee/user/week subscription service imports while preserving archive week loading, employee create-tray options, foreman filters, and cleanup behavior.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R258`:

- Added `useTimecardExportFilteredWeekSync` and `useTimecardExportCreateDefaults` to own Timecard Export filtered-week resync behavior and create-tray job/foreman default selection policies.
- Migrated `TimecardExportView.vue` off the corresponding route-local watcher bodies while preserving pending-save flushing before filter changes, stale sync protection, card workspace resets, create-tray job targeting, and foreman default selection.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R259`:

- Added `useJobsNavigationActions` and `useJobsSelectionSync` to own Jobs create/edit drawer navigation, job primary action routing, selected job form hydration, visible-job selection recovery, and edit-drawer selection cleanup.
- Migrated `JobsView.vue` off route-local navigation handlers and selection synchronization watchers while preserving admin edit mode, create-job reset behavior, job drill-down routing, all-jobs selection, detail form hydration, and autosave timer cleanup.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R260`:

- Added `useJobsAdminSubscriptions` to own Jobs admin-only assignable-user and global notification recipient subscriptions, including all-jobs recipient load error messaging and grouped start/stop lifecycle methods.
- Migrated `JobsView.vue` off direct user/global-recipient subscription service imports while preserving assignable foreman lists, users loading/error state, all-jobs notification defaults, and cleanup on unmount.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R260 full-suite checkpoint:

- Full Chromium e2e suite passed after Timecard Export subscription/watcher extractions and Jobs navigation/selection/subscription extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R261`:

- Added `useDailyLogSubscriptions` to own Daily Logs recipient-default and selected-date log subscriptions, including visible-log selection recovery and daily log recipient default load error messaging.
- Migrated `DailyLogsView.vue` off direct daily-log/global-recipient subscription service imports while preserving per-date log loading, admin/foreman visible-log filtering, preferred log selection, and recipient defaults.
- Preserved Daily Logs behavior across intentional draft creation, submitted-log selection, save-on-blur typing stability, validation, submission/email success messaging, attachments, recipient add/remove, read-only submitted logs, and draft deletion.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R262`:

- Added `useDailyLogFormHydration` to own Daily Logs form reset, selected-log hydration, unsaved-local-change protection, and job/user snapshot field refresh behavior.
- Migrated `DailyLogsView.vue` off route-local hydration state, reset helper, selected-log watcher, and job snapshot watcher while preserving save-on-blur draft editing and remote snapshot reconciliation semantics.
- Preserved Daily Logs behavior across intentional draft creation, submitted-log selection, save-on-blur typing stability, validation, submission/email success messaging, attachments, recipient add/remove, read-only submitted logs, and draft deletion.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R263`:

- Added `useDailyLogDateNavigation` to own Daily Logs job/date change behavior, including selected-log reset, loaded-log clearing, form reset, route job resubscription, and selected-date reset-to-today action.
- Migrated `DailyLogsView.vue` off route-local job/date watcher bodies and local today-date setter while preserving sidebar date navigation and per-date log subscription reset behavior.
- Preserved Daily Logs behavior across intentional draft creation, submitted-log selection, save-on-blur typing stability, validation, submission/email success messaging, attachments, recipient add/remove, read-only submitted logs, and draft deletion.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 post-R263 full-suite checkpoint:

- Full Chromium e2e suite passed after Daily Logs subscription, form hydration, and date navigation extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R264`:

- Added `useJobTimecardWorkspaceSync` to own job Timecards selected-week, selected-date, job, burden, and filtered-card synchronization watchers.
- Migrated `TimecardsView.vue` off route-local workspace sync watchers while preserving card workspace resets, card subscription refreshes, job route resubscription, week/card clearing, draft backfill triggers, burden refresh behavior, and visible-card selection sync.
- Preserved job Timecards behavior across week-date requirement, no lock controls on job pages, job-number cascade, keyboard navigation, immediate totals, note editing, last-name sorting, foreman create/submit permissions, rollover/backfill, duplicate employee cards, submitted read-only weeks, wage formatting, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R265`:

- Added `useJobTimecardWeekSelectionActions` to own job Timecards week selection, week-ending input normalization, native picker opening, pending-save flushing, and create-tray closing behavior.
- Migrated `TimecardsView.vue` off route-local week selection/input handlers and direct DOM/date utility imports while preserving selected-week switching and Saturday snapping semantics.
- Preserved job Timecards behavior across week-date requirement, no lock controls on job pages, job-number cascade, keyboard navigation, immediate totals, note editing, last-name sorting, foreman create/submit permissions, rollover/backfill, duplicate employee cards, submitted read-only weeks, wage formatting, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 post-R265 full-suite checkpoint:

- Full Chromium e2e suite passed after job Timecards workspace-sync and week-selection action extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R266`:

- Added `useShopCatalogSelectionSync` to own Shop Catalog selected-category/item form hydration, create-mode form resets, root tree initialization, and stale selected folder/item cleanup when catalog records change.
- Migrated `ShopCatalogAdminView.vue` off route-local selection/form synchronization watchers while preserving inspector selection, create-category/create-item form behavior, root expansion initialization, and stale selection fallback.
- Preserved admin route behavior across users, employees, shop catalog tree filtering, catalog create/edit/archive/delete, timecard export, and print-route coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R267`:

- Added `useJobsSideEffects` to own Jobs detail-form autosave triggering and Jobs store error toast behavior.
- Migrated `JobsView.vue` off its remaining route-local watchers while preserving admin detail autosave and Jobs error toast behavior.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R267 full-suite checkpoint:

- Full Chromium e2e suite passed after Shop Catalog selection-sync extraction and Jobs side-effect extraction.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R268`:

- Added `useTimecardExportCardWorkspaceActions` to own Timecard Export card workspace resets, page/save message resets, card UI state pruning/sync, workbook change handling, scroll-to-card behavior, and employee-header lock rules.
- Migrated `TimecardExportView.vue` off the corresponding route-local card helper functions, using a deferred card-sync callback to preserve archive-card/save-queue setup order.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R268 full-suite checkpoint:

- Full Chromium e2e suite passed after Timecard Export card workspace action extraction.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R269`:

- Expanded `src/styles/tokens.css` into the normalized token categories from `css-architecture.md`, adding backwards-compatible color, typography, spacing, radius, shadow, density, motion, and breakpoint aliases while preserving existing token names and values.
- Kept `main.css` as the single style entry point and avoided page-specific CSS changes, so this slice improves the design-system foundation without intentionally changing app, print, email, or PDF rendering.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.

2026-07-13 `R270`:

- Added `useUserFormState` to own Users admin create/detail form state, job-assignment search state, role-based assignment cleanup, field update helpers, assignment toggles, selected-user form hydration, and detail snapshot comparison.
- Migrated `UsersView.vue` off route-local form mutation/hydration helpers while preserving subscriptions, toasts, create/invite actions, detail autosave, delete confirmation, and mobile panel behavior.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R271`:

- Added `useEmployeeFormState` to own Employees admin create/detail form state, selected-employee form hydration, syncing-detail guard state, and field update helpers.
- Migrated `EmployeesView.vue` off route-local form reset/apply/update helpers while preserving employee subscriptions, create/edit/delete actions, blur-save behavior, confirmation dialog wiring, directory filtering, and mobile panel behavior.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R272`:

- Added `useShopOrderSelectionSync` to own Shop Orders selected-order fallback, selected-order form hydration, item-note draft synchronization, and order metadata autosave watchers.
- Migrated `ShopOrdersView.vue` off route-local selected-order synchronization watchers while preserving draft creation, catalog/custom item actions, item quantity/note persistence, metadata autosave, submission, draft deletion, history selection, and order subscriptions.
- Preserved Shop Orders behavior across next-Thursday defaults, catalog search collapse/expand, clean item names, catalog/custom item submit, alphabetized added items, comments autosave, item note autosave, quantity inputs, submitted read-only rendering, order number display, and new-order state reset.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R273`:

- Added `useJobTimecardCardWorkspaceActions` to own job Timecards card workspace resets, page/save message resets, card UI state pruning/sync, read-only checks, scroll-to-card behavior, and workbook change handling.
- Migrated `TimecardsView.vue` off those route-local card workspace helpers while preserving subscriptions, week lifecycle, rollover/backfill, create tray, card creation/deletion, sorting, submission, date selection, save queue, card measurement, and display state.
- Preserved job Timecards behavior across week-date requirement, no lock controls on job pages, job-number cascade, keyboard navigation, immediate totals, note editing, last-name sorting, foreman create/submit permissions, rollover/backfill, duplicate employee cards, submitted read-only weeks, wage formatting, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 post-R273 full-suite checkpoint:

- Full Chromium e2e suite passed after CSS token expansion, Users/Employees form-state extraction, Shop Orders selected-order sync extraction, and job Timecards card-workspace action extraction.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R274`:

- Added `useDailyLogFormState` to own Daily Logs selected date, selected-log ID, payload form ref, today-date helper, and text-field mutation helper while preserving the E2E-controlled clock behavior.
- Migrated `DailyLogsView.vue` off route-local selected-date/form/text mutation setup while preserving subscriptions, selection state, draft save-on-blur, form hydration, date navigation, recipients, attachments, repeaters, create/save/submit/delete actions, and page lifecycle.
- Preserved Daily Logs behavior across intentional draft creation, submitted-log selection, save-on-blur typing stability, validation, submission/email success messaging, attachments, recipient add/remove, read-only submitted logs, and draft deletion.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R275`:

- Added `useTimecardExportSideEffects` to own Timecard Export job-burden redecorate and visible-card selection synchronization watchers.
- Migrated `TimecardExportView.vue` off its remaining route-local watchers while preserving archive subscriptions, filters, card sync, create tray, CSV/PDF exports, print route payloads, lock/edit controls, visible-card summaries, and card selection behavior.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R276`:

- Added `useShopOrderSubscriptionLifecycle` to own Shop Orders route-job, catalog, and order subscription startup/cleanup plus job-change reset/resubscribe behavior.
- Migrated `ShopOrdersView.vue` off route-local subscription lifecycle functions and mount/unmount cleanup while preserving current job context, catalog loading, order loading, selected-order sync, metadata autosave, item note drafts, and route-change reset behavior.
- Preserved Shop Orders behavior across next-Thursday defaults, catalog search collapse/expand, clean item names, catalog/custom item submit, alphabetized added items, comments autosave, item note autosave, quantity inputs, submitted read-only rendering, order number display, and new-order state reset.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-R276 full-suite checkpoint:

- Full Chromium e2e suite passed after Daily Logs form-state extraction, Timecard Export side-effect extraction, and Shop Orders subscription lifecycle extraction.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R277`:

- Added `useJobTimecardSubscriptionLifecycle` to own job Timecards mount/unmount subscription lifecycle, week subscription startup, employee subscription startup, card subscription reset/start behavior, save-queue disposal, and card measurement cleanup.
- Migrated `TimecardsView.vue` off route-local lifecycle and subscription start/stop helpers while keeping raw week/card subscriber factories in the page for now to avoid over-abstracting the selected-week data dependency cycle.
- Preserved job Timecards behavior across week-date requirement, no lock controls on job pages, job-number cascade, keyboard navigation, immediate totals, note editing, last-name sorting, foreman create/submit permissions, rollover/backfill, duplicate employee cards, submitted read-only weeks, wage formatting, and H/P/C row visibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R278`:

- Added `useUserAdminViewSync` to own Users admin selected-user reset/hydration, detail autosave queue watcher, user/job subscription startup, and subscription/timer cleanup.
- Migrated `UsersView.vue` off route-local selection/autosave/lifecycle watchers while preserving directory filtering, create/invite actions, assigned-job editing, detail form hydration, detail autosave, role cleanup, delete confirmation, and mobile panel behavior.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R279`:

- Added `useEmployeeAdminViewSync` to own Employees admin selected-employee form hydration, detail status messaging, employee subscription startup, and subscription cleanup.
- Migrated `EmployeesView.vue` off route-local selection/lifecycle watchers while preserving directory filtering, create/detail form hydration, create/edit/delete actions, blur-save behavior, confirmation dialog wiring, occupation suggestions, status counts, and mobile panel behavior.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-R279 full-suite checkpoint:

- Full Chromium e2e suite passed after job Timecards subscription lifecycle extraction plus Users and Employees admin sync extractions.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R280`:

- Added `useDailyLogSubscriptionLifecycle` to own Daily Logs recipient-default subscription startup, route-job/log subscription startup, and subscription cleanup.
- Migrated `DailyLogsView.vue` off route-local mount/unmount lifecycle while preserving current job context, per-date log subscriptions, recipient defaults, form hydration, date navigation, draft save-on-blur, recipients, attachments, repeaters, create/save/submit/delete actions, and page state.
- Preserved Daily Logs behavior across intentional draft creation, submitted-log selection, save-on-blur typing stability, validation, submission/email success messaging, attachments, recipient add/remove, read-only submitted logs, and draft deletion.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 11/11.

2026-07-13 `R281`:

- Added `useShopCatalogAdminLifecycle` to own Shop Catalog admin layout sync, catalog subscription startup, context-menu disposal, tree auto-scroll cleanup, and catalog subscription cleanup.
- Migrated `ShopCatalogAdminView.vue` off route-local mount/unmount lifecycle while preserving tree filtering, root/category/item selection, inspector hydration, inline create/rename, drag/drop, context menu, archive/restore, delete, and create/save workflows.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R281 full-suite checkpoint:

- Full Chromium e2e suite passed after Daily Logs subscription lifecycle extraction and Shop Catalog admin lifecycle extraction.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R282`:

- Added `useTimecardExportLifecycle` to own Timecard Export subscription startup and unmount cleanup for jobs, saved weeks, archive cards, employees, users, save queue, and card measurements.
- Migrated `TimecardExportView.vue` off route-local mount/unmount lifecycle while preserving workbook filters, saved-week subscriptions, archive card subscriptions, admin create tray, card editing, CSV/PDF export, print-route payloads, draft week deletion, and card deletion.
- Preserved admin route behavior across users, employees, shop catalog, saved timecard weeks, draft week deletion, card deletion, CSV/PDF export, print-route payloads, and lock/edit toggles.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 `R283`:

- Added `useJobsLifecycle` to own Jobs admin subscription startup, global/user recipient subscription startup, detail autosave timer cleanup, and subscription cleanup.
- Added `useJobDashboardLifecycle` to own Job Dashboard route-job subscription startup, route-job resubscription, and subscription cleanup.
- Migrated `JobsView.vue` and `JobDashboardView.vue` off route-local lifecycle hooks while preserving job search, job create/edit autosave, module recipient editing, archive/restore/delete, all-jobs defaults, and module-launcher navigation.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/job-dashboard.spec.ts --project=chromium`: passed, 7/7.

2026-07-13 `R284`:

- Consolidated duplicate Jobs scoped CSS selectors for the detail grid, detail header, and empty-state block so the route has one source of truth for each base layout rule before the broader GUI facelift.
- Preserved the existing split editor layout, mobile detail header override, empty-state styling, passive save/error note styling, and admin job editor behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R285`:

- Removed the accidental root dependency named `22` from `package.json` and `package-lock.json`, including the unused lockfile package entry for `node_modules/22`.
- Updated the refactor gap audit so the resolved package cleanup no longer appears as an open cleanup candidate; remaining cleanup entries still cover stale indexes, generated function artifacts, and legacy compatibility paths.
- `npm run type-check`: passed.
- `npm pkg get dependencies`: confirmed only the intended app dependencies remain.
- `rg -n '"22":|node_modules/22|22-0\.0\.0' package.json package-lock.json`: no matches.

2026-07-13 `R286`:

- Added `src/styles/utilities.css` and imported it from `src/styles/main.css` to match the documented global CSS folder target.
- Moved visually-hidden styling into shared `.sr-only` / `.visually-hidden` utilities and removed duplicate hidden-style definitions from `AppShell.vue` and `DailyLogsView.vue`.
- Updated `design/css-architecture.md` so the current CSS read reflects the utilities layer now in place.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/job-dashboard.spec.ts --project=chromium`: passed, 2/2.

2026-07-13 post-R286 full-suite checkpoint:

- Full Chromium e2e suite passed after Timecard Export lifecycle extraction, Jobs/Job Dashboard lifecycle extraction, Jobs CSS consolidation, package cleanup, and utilities CSS introduction.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R287`:

- Consolidated duplicate Users and Employees directory status-filter select styling so both panels customize `AppSelect` through its CSS custom-property contract instead of duplicating manual width, border, radius, padding, background, and text color rules.
- Preserved Users and Employees directory filtering, create/edit/delete workflows, project-manager job assignment flows, and adjacent admin route behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R288`:

- Moved user-profile Firestore normalization, missing-profile creation, and profile snapshot subscription from `src/stores/auth.ts` into `src/services/auth.ts`.
- Kept the auth store responsible for auth state orchestration, retry behavior, sign-out behavior, active-user enforcement, and E2E auth state while removing direct Firestore SDK imports from stores/views/components/features/composables.
- Updated the refactor gap audit to reflect the improved Auth/Firestore service boundary.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/access-control.spec.ts --project=chromium`: passed, 12/12.
- `rg -n "firebase/firestore|onSnapshot\\(|getDoc\\(|setDoc\\(|serverTimestamp\\(" src/stores src/views src/components src/features src/composables`: no matches.

2026-07-13 `R289`:

- Added `src/__tests__/capabilities.spec.ts` to lock in current frontend capability behavior before the later role/capability expansion.
- Covered current effective-role mapping, workspace access, admin vs field workflow access, profile-assigned job access, visible-job fallback access, the temporary unassigned-timecard route exception, combined job route access, and current role labels.
- Updated `design/testing-strategy.md` to document current unit coverage and near-term unit-test additions for target role work.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 5 files / 20 tests.

2026-07-13 `R290`:

- Added `src/__tests__/authService.spec.ts` to cover auth profile normalization after moving profile Firestore mechanics into `src/services/auth.ts`.
- Covered complete profile records, safe defaults for missing fields, invalid assigned-job ID filtering, unknown-role normalization to `none`, and explicit inactive-user preservation.
- Updated `design/testing-strategy.md` so current unit coverage includes auth service normalization.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 6 files / 23 tests.

2026-07-13 post-R290 build checkpoint:

- Production build passed after auth service-boundary cleanup, capability/auth unit coverage additions, package cleanup, and CSS utility/style cleanup.
- `npm run build`: passed.
- Build emitted a non-failing Vite chunk-size warning for the main bundle; defer bundle splitting/manual chunking to a dedicated performance slice so behavior refactors do not hide bundling changes.

2026-07-13 `R291`:

- Updated `design/refactor-gap-audit.md` to track the non-failing main bundle warning as a dedicated later performance/code-splitting slice.
- Refreshed the large-route-view audit entries with current post-extraction line counts and remaining responsibilities: Shop Catalog admin, Jobs, Timecards, Timecard Export, Daily Logs, and Shop Orders are now hundreds of lines rather than multi-thousand-line route files.
- Documentation-only slice; no app code changed.

2026-07-13 `R292`:

- Added `useShopOrderRecords` to own the current-job shop order record subscription wrapper and `useSubscribedRecords` setup.
- Migrated `ShopOrdersView.vue` off its route-local shop order subscription factory and direct `subscribeShopOrders`/`useSubscribedRecords` imports while preserving catalog loading, draft selection, item editing, metadata autosave, history, submit/delete confirmations, and route subscription lifecycle.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 `R293`:

- Added `useEmployeeAdminRecords` to own Employees admin directory subscription setup and selected-employee reset behavior when records disappear.
- Added `useUserAdminRecords` to own Users admin user subscription setup, assignable-job subscription setup, and selected-user reset behavior when records disappear.
- Migrated `EmployeesView.vue` and `UsersView.vue` off route-local `useSubscribedRecords` setup and direct directory subscription service imports while preserving filters, create/edit/delete flows, pending invite workflows, role changes, and assigned-job editing.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-R293 full-suite checkpoint:

- Full Chromium e2e suite passed after auth service-boundary cleanup, capability/auth unit coverage additions, Shop Orders record subscription extraction, and Users/Employees admin record subscription extraction.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R294`:

- Added `src/__tests__/RecipientEditor.spec.ts` as the first focused shared-component contract test.
- Covered editable recipient input updates, add/remove emits, disabled guard behavior, read-only/default-recipient rendering, hints, counts, placeholders, and empty labels.
- Updated the testing strategy and gap audit so `RecipientEditor` is no longer listed as an unstarted component-test target.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/RecipientEditor.spec.ts`: passed, 1 file / 4 tests.
- `npm run test:unit -- --run`: passed, 7 files / 27 tests.

2026-07-13 `R295`:

- Added `src/utils/recipientEmails.ts` so Jobs and Daily Logs share recipient email normalization, validation, and list de-duplication rules.
- Migrated Jobs notification recipients and Daily Log recipients onto the shared recipient helpers while leaving feature-specific messages, persistence, and recipient scopes unchanged.
- Added `src/__tests__/recipientEmails.spec.ts` for the shared helper contract and updated the testing strategy unit coverage.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 8 files / 30 tests.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 7/7.

2026-07-13 `R296`:

- Extracted the Job Dashboard route presentation into `JobDashboardHeader`, `ModuleLauncherGrid`, and `ModuleLauncherCard`.
- Kept route context/subscription lifecycle in `JobDashboardView.vue` while preserving the module launcher links and existing e2e `data-testid` contracts.
- Replaced the encoded job-title separator artifact with an ASCII ` - ` separator in the dashboard header.
- Updated `design/component-architecture.md` so the Job Dashboard components are listed as implemented.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts --project=chromium`: passed, 1/1.

2026-07-13 `R297`:

- Refreshed CSS architecture/audit docs to match the current implementation: `main.css` is import-only, `utilities.css` exists, and PrimeVue toast overrides live in `src/styles/primevue.css`.
- Reframed remaining CSS debt around the global button-family class contract and verbose feature-local styling instead of stale `main.css` line-number entries.
- Documentation-only slice; no app code changed.

2026-07-13 `R298`:

- Added `useJobTimecardRecords` to own the job timecard employee, week, and card record subscription wrappers.
- Migrated `TimecardsView.vue` off route-local `useSubscribedRecords` setup and direct employee/week/card subscription service imports while keeping card saves, save queue state, dirty remote merge behavior, week creation, rollover, and workbook rendering untouched.
- Used lazy getter callbacks for selected week and burden so subscriptions read current workflow state without forcing the payroll-critical setup order to change.
- Updated the component architecture and gap audit to reflect the new timecard records seam and current route size.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-13 `R299`:

- Moved Jobs notification-recipient persistence wiring into `useJobNotificationRecipients` so `JobsView.vue` no longer imports the recipient update services directly.
- Preserved create-mode recipients, selected-job recipients, all-jobs defaults, duplicate handling, validation messages, and saving state behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-13 `R300`:

- Moved `getRoleBadgeLabel` from the Users persistence service into `features/users/userViewHelpers`, where Users display formatting already lives.
- Updated `UsersView`, `UserDirectoryPanel`, and `UserEditorPanel` to consume the feature helper instead of importing UI text from `services/users`.
- Kept Users service focused on Firestore/callable user persistence and E2E runtime bridging.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-13 post-R300 full-suite checkpoint:

- Full Chromium e2e suite passed after RecipientEditor component coverage, shared recipient email helpers, Job Dashboard component extraction, CSS audit refresh, Timecards record subscription extraction, Jobs recipient service-boundary cleanup, and Users role-badge helper relocation.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-13 `R301`:

- Added `useJobTimecardSaveQueue` and `useTimecardExportSaveQueue` as thin feature wrappers around the generic `useTimecardSaveQueue`.
- Moved `updateTimecardCard` persistence wiring out of `TimecardsView.vue` and `TimecardExportView.vue` while preserving the shared queue behavior, debounce behavior, dirty save/remote merge behavior, and workbook/export edit flows.
- Updated component architecture docs to list the new save-queue wrappers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-13 post-R301 full-suite checkpoint:

- Full Chromium e2e suite passed after the job/export timecard save-queue wrappers were introduced.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.
- `npm run type-check`: passed.
- `npm run build`: passed outside the sandbox after the sandboxed run hit Windows `spawn EPERM`; Vite still reports a non-failing large-chunk warning for future code-splitting work.

2026-07-13 `R302`:

- Added `src/__tests__/JobDashboardComponents.spec.ts` to protect the newly extracted Job Dashboard component seam.
- Covered module card route links/test ids, module grid route construction, selected-job metadata, and missing-job empty state.
- Confirmed the router already lazy-loads route views; deferred bundle/code-splitting changes because the current build warning is not caused by eager route component imports.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/JobDashboardComponents.spec.ts`: passed, 1 file / 4 tests.
- `npm run test:unit -- --run`: passed, 9 files / 34 tests.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts --project=chromium`: passed, 1/1.

2026-07-13 `R303`:

- Added `src/__tests__/AppMobilePanelTabs.spec.ts` to protect the shared responsive admin panel-switching primitive before dashboard and admin UI polish continue.
- Covered tablist labeling, selected tab state/classes, and emitted panel keys without changing runtime behavior.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/AppMobilePanelTabs.spec.ts`: passed, 1 file / 2 tests.
- `npm run test:unit -- --run`: passed, 10 files / 36 tests.
- `npm run test:e2e -- e2e/admin-management.spec.ts --project=chromium`: passed, 3/3.

2026-07-13 `R304`:

- Added `src/utils/routerQuery.ts` with `readFirstQueryParam` and unit coverage for string, repeated, missing, and non-string query values.
- Migrated `LoginView`, `ForgotPasswordView`, and `SetPasswordView` off duplicate local query-param normalization helpers.
- Preserved public auth route behavior while making query parsing a tiny shared utility.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/routerQuery.spec.ts`: passed, 1 file / 3 tests.
- `npm run test:unit -- --run`: passed, 11 files / 39 tests.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.

2026-07-13 `R305`:

- Migrated public auth route note/status blocks from ad-hoc `auth-card__note` markup to the shared `AppStatusMessage` primitive.
- Kept `AuthCard` responsible only for auth-card spacing while `AppStatusMessage` owns status roles, tones, and visual treatment.
- Added `src/__tests__/AppStatusMessage.spec.ts` for default status rendering, error alert rendering, and empty-state non-rendering.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/AppStatusMessage.spec.ts`: passed, 1 file / 3 tests.
- `npm run test:unit -- --run`: passed, 12 files / 42 tests.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.

2026-07-13 post-R305 full-suite checkpoint:

- Full Chromium e2e suite passed after dashboard component coverage, mobile panel tab coverage, public auth query helper extraction, and auth status-message migration.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.
- `npm run build`: passed outside the sandbox; Vite still reports the same non-failing large-chunk warning for later bundle optimization.

2026-07-14 `R306`:

- Migrated Jobs, Employees, and Users editor save/status notes from local dashed-border note markup to the shared `AppStatusMessage` primitive.
- Removed stale local `jobs-workspace__note`, `employees-workspace__note`, and `users-workspace__note` CSS so status tone/role styling is centralized.
- Preserved existing save/progress messages and mapped successful saves to the shared success tone; the self-editing lockout notice now uses the shared warning tone.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 12 files / 42 tests.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 9/9.
