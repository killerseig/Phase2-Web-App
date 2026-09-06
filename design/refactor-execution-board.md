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
- Keep Firebase SDK usage inside services or Cloud Functions; stores should consume service APIs rather than importing Firebase directly.
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
| R07 | Role capability implementation | Done | Add target roles and enforce capabilities across app/rules/functions. | types, auth store, router, rules, functions, e2e runtime, role tests | unrelated UI polish, PDF/email layout | Focused role unit tests, function build, type-check, and later E2E access-control expansion; rules emulator tests remain deferred by user request. | Payroll, Shop Foreman, PM, Foreman, Admin behavior matches `role-capability-matrix.md`; direct rules-emulator proof is deferred under `R08`. |
| R08 | Firestore Rules emulator test suite | Deferred | Add lower-layer security tests before broad role/rules changes. | test config, rules tests, package scripts if needed | app visual code | emulator test command to be defined | Rules behavior is testable without relying only on Playwright. |
| R09 | Function status/idempotency cleanup | Done | Make submit/email functions report reliable status and avoid duplicate sends. | Cloud Functions, function tests | UI extraction, CSS | `npm --prefix functions run build`; `npm run type-check`; `npx vue-tsc --noEmit -p tsconfig.vitest.json`; focused function unit tests | Daily log/shop order/timecard sends have consistent status metadata and same-operation duplicate-send protection. |
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
| R192 | Live role dashboard route | Done | Add the first live role-dashboard route and make workspace redirects land there. | `RoleDashboardView`, dashboard components, router, AppShell navigation, route tests, affected E2E | job workflow internals, Jobs UI permissions, rules/functions, PDF/email output | `npm run type-check`; focused dashboard/navigation unit tests; `npm run test:e2e -- e2e/public-routes.spec.ts e2e/access-control.spec.ts --project=chromium` | Signed-in users land on `/dashboard`, the sidebar exposes Dashboard/Jobs, role modules render from the target module policy, and denied protected routes fall back to the dashboard. |
| R670 | Jobs role-permission bridge | Done | Wire the real Jobs page to granular target job setup capabilities. | `JobsView`, Jobs components/composables, auth capabilities/store, Jobs E2E/unit tests | Firestore Rules, Cloud Functions, PDF/email output, unrelated GUI polish | `npm run type-check`; focused Jobs role unit tests; `npm run test:e2e -- e2e/jobs.spec.ts e2e/access-control.spec.ts --project=chromium` | Admin keeps full Jobs management, Payroll can create jobs and view job setup read-only, PM can edit assigned jobs without archive/delete, unassigned PM jobs render read-only, and assignable job users include target field roles. |
| R671 | Role dashboard job shortcuts | Done | Add live role-dashboard job shortcuts and prove Shop Foremen can open the Shop job workflow from the dashboard. | `RoleDashboardView`, dashboard components/helpers, route access helper, access-control E2E/unit tests | Firestore Rules, Cloud Functions, PDF/email output, Jobs setup editor | `npm run type-check`; focused dashboard/route unit tests; `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium` | Dashboard shows role-filtered job shortcuts, PMs see assigned jobs and submitted-timecard shortcut affordances, Shop Foremen see the Shop job without explicit assignment, and the Shop Orders route opens from that shortcut. |
| R672 | Project Manager submitted-timecard reporting | Done | Let assigned Project Managers open job timecards as read-only submitted reports without draft/edit access. | `TimecardsView`, job timecard composables, timecard service/E2E runtime, access-control E2E/unit tests | Firestore Rules emulator suite, Cloud Functions callable authorization, workbook/PDF output | `npm run type-check`; focused job-timecard unit tests; `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`; `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium` | PMs see assigned-job submitted timecards only, draft weeks stay hidden, edit/create/submit controls stay unavailable, and foreman/admin workbook behavior remains green. |
| R673 | Timecard week callable creation guard | Done | Prevent field users from creating timecard weeks for unrelated jobs through the callable while preserving Admin/Payroll export paths and Shop Foreman Shop-job access. | `functions/src/timecardWeekFunctions.ts`, `functions/src/timecardWeekAccess.ts`, function helper tests | Daily Log/Shop Order callables, Firestore Rules emulator suite, timecard workbook UI, PDF/email output | `npm run type-check`; `npm --prefix functions run build`; focused function unit tests | Timecard week creation uses the target Functions timecard policy: Admin/Payroll allowed, assigned Foremen allowed, Shop Foremen allowed on Shop job, unassigned Foremen denied, and Project Managers remain report-only. |
| R674 | Field workflow callable write guard | Done | Align Daily Log and Shop Order create/edit/submit/delete callables with the target Functions field-workflow write policy. | `functions/src/dailyLogRecordFunctions.ts`, `functions/src/shopOrderRecordFunctions.ts`, `functions/src/fieldWorkflowAccess.ts`, `functions/src/jobIdentity.ts`, function helper tests | Submitted-email callables, Firestore Rules emulator suite, PDF/email output, route UI behavior | `npm run type-check`; `npm --prefix functions run build`; focused function unit tests | Admins, assigned Foremen, and Shop Foremen on Shop/assigned jobs can write field workflow records; unassigned Foremen, Payroll, and Project Managers cannot write through the callables. |
| R675 | Submitted field-email callable guard | Done | Align Daily Log and Shop Order submitted-email callables with the target Functions field-workflow submit policy. | `functions/src/operationsFunctions.ts`, `functions/src/fieldWorkflowAccess.ts`, function helper/status tests | Firestore Rules emulator suite, email rendering/PDF output, legacy shop-order fallback cleanup | `npm run type-check`; `npm --prefix functions run build`; focused function unit tests | Submitted-email callables now authorize Admin, assigned Foreman, and Shop Foreman Shop/assigned job submitters through the same target submit policy while keeping Project Managers/Payroll out of send actions. |
| R676 | Submitted-email operation claim tests | Done | Add focused unit coverage for the transaction helper that prevents duplicate submitted-email sends. | `functions/src/submittedEmailOperations.ts`, submitted-email callables, function helper tests | Firestore Rules emulator suite, email/PDF rendering, full callable transport mocks | `npm run type-check`; `npm --prefix functions run build`; focused function unit tests | Submitted-email operation claims prove `claimed`, `already-sent`, `in-progress`, stale retry, missing-record, existing-document-only updates, and shared short-circuit copy without touching output rendering. |
| R677 | Submitted field-email handler tests | Done | Expose testable submitted-email handlers and cover key mocked callable branches. | `functions/src/operationsFunctions.ts`, `functions/src/emailService.ts`, function handler tests | Firestore Rules emulator suite, visual email/PDF layout changes, legacy shop-order fallback cleanup | `npm run type-check`; `npm --prefix functions run build`; focused function unit tests | Daily Log handler tests cover success, unassigned denial, duplicate/in-progress short-circuit, disabled email, missing recipients, and send failure; Shop Order handler tests cover PDF attachment success and job mismatch denial. |
| R678 | Timecard week submit handler tests | Done | Expose a testable Timecard Week submit handler and cover key submit/email status branches. | `functions/src/timecardWeekFunctions.ts`, function handler tests | Firestore Rules emulator suite, workbook/PDF visual output, timecard card mutation behavior | `npm run type-check`; `npm --prefix functions run build`; focused function unit tests | Submit-week handler tests cover submit success, skipped email status, duplicate/in-progress short-circuit, owner denial before claim, and email failure recovery while keeping the week submitted. |
| R679 | Shop Foreman shop catalog E2E | Done | Prove Shop Foremen can use the real Shop Catalog admin route without broader admin navigation. | `e2e/admin-pages.spec.ts`, refactor docs | Firestore Rules emulator suite, Cloud Functions, PDF/email output, catalog component internals | `npm run type-check`; `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium` | Shop Foremen can open `/settings/shop-catalog`, see only the allowed admin nav surface, create/edit a catalog item, and persist the catalog mutation through the real page. |
| R680 | Shop order PDF header smoke assertion | Done | Strengthen the shop-order smoke script so long PDFs prove continuation table headers are redrawn at the top of each table page. | `functions/src/emailService.ts`, `functions/scripts/smoke-shop-order-email.cjs`, refactor docs | Email/PDF visual layout redesign, Firestore Rules, Cloud Functions authorization, app UI | `npm run type-check`; `npm --prefix functions run smoke:shop-order-email` | Long shop-order PDF smoke output spans multiple pages, observes repeated table-header draws, and asserts continuation headers start at the top page margin in page order. |
| R681 | Timecard PDF header smoke assertion | Done | Strengthen the timecard smoke script so the attached-PDF path proves employee header data reaches the real timecard PDF renderer. | `functions/src/operationsFunctions.ts`, `functions/scripts/smoke-timecard-email.cjs`, refactor docs | Timecard workbook/PDF layout redesign, Firestore Rules, Cloud Functions authorization, app UI | `npm run type-check`; `npm --prefix functions run smoke:timecard-email` | Timecard email smoke still keeps the body PDF-only and now observes the PDF card header renderer receiving employee name, employee number, occupation, wage, and week-ending data. |
| R682 | Payroll employee route E2E | Done | Prove Payroll can use employee management and Timecard Export while non-payroll field roles cannot open employee management. | `e2e/access-control.spec.ts`, role docs | Firestore Rules emulator suite, Cloud Functions, employee service behavior | `npm run type-check`; `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium` | Payroll can create/edit an employee and open Timecard Export without Users/Shop Catalog/Reference Lists navigation; Project Managers are redirected away from `/employees`. |
| R683 | Role route-flow completion E2E hardening | Done | Close browser-level role-matrix gaps for denied admin/workflow routes, Shop Foreman Shop workflows, and direct job-route deep links. | `src/router/index.ts`, `src/stores/jobs.ts`, `e2e/access-control.spec.ts`, refactor docs | Firestore Rules emulator suite, Cloud Functions, PDF/email output, unrelated UI polish | `npm run type-check`; focused route/capability unit tests; `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium` | Direct job routes wait for the first visible-job snapshot before route decisions, Shop Foremen can use Shop Daily Logs/Shop Orders/Timecards without explicit assignment while non-Shop workflow routes stay denied, Shop Foremen can view all jobs read-only, Payroll cannot open field workflow forms, PMs cannot direct-open unassigned job dashboards, and Foremen are denied admin-only surfaces. |
| R684 | Jobs capability seam extraction | Done | Move Jobs page capability derivation out of the route view and into a focused feature composable. | `src/views/JobsView.vue`, `src/features/jobs/useJobsCapabilities.ts`, focused unit test, refactor docs | Firestore Rules emulator suite, Cloud Functions, PDF/email output, Jobs persistence behavior, unrelated UI polish | `npm run type-check`; `npm run test:unit -- --run src/__tests__/useJobsCapabilities.spec.ts`; `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium` | JobsView consumes a tested capability seam for create/edit/delete/archive setup affordances while Admin, Payroll, and Project Manager Jobs workflows remain green through the browser. |
| R685 | Shop order custom-item form seam | Done | Move Shop Orders custom-item form state/reset ownership out of the route view and item-actions internals. | `src/views/ShopOrdersView.vue`, `src/features/shopOrders/useShopOrderCustomItemForm.ts`, `src/features/shopOrders/useShopOrderItemActions.ts`, focused unit tests, refactor docs | Firestore Rules emulator suite, Cloud Functions, PDF/email output, order persistence behavior, unrelated UI polish | `npm run type-check`; `npm run test:unit -- --run src/__tests__/useShopOrderCustomItemForm.spec.ts src/__tests__/useShopOrderItemActions.spec.ts`; `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium` | ShopOrdersView consumes a tested custom-item form seam, successful custom-item saves reset through that seam, failed saves preserve typed input, and the real shop-order workspace remains green. |
| R686 | Daily log payload preparer seam | Done | Move Daily Logs prepared-payload callback assembly out of the route view and into a focused feature composable. | `src/views/DailyLogsView.vue`, `src/features/dailyLogs/useDailyLogPayloadPreparer.ts`, Daily Log focused tests, refactor docs | Firestore Rules emulator suite, Cloud Functions, email/PDF output, Daily Log persistence semantics, unrelated UI polish | `npm run type-check`; focused Daily Log unit tests; `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | DailyLogsView consumes a tested payload-preparer seam shared by draft saves, attachments, and submit actions while typing/save/submit workflows remain green. |
| R687 | Job timecard access seam | Done | Move job Timecards route access and week-subscription-mode derivation out of the route view. | `src/views/TimecardsView.vue`, `src/features/timecards/useJobTimecardAccess.ts`, focused unit tests, refactor docs | Firestore Rules emulator suite, Cloud Functions, workbook/PDF/email output, timecard save/rollover behavior, unrelated UI polish | `npm run type-check`; focused timecard access/unit tests; `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium` | TimecardsView consumes a tested access seam for stale profile-assignment repair, PM submitted-report mode, manager all-week mode, and Shop Foreman Shop-job workflow access while the real workbook route stays green. |
| R688 | Completion audit and final verification | Done | Reconcile closeout evidence and repair stale full-unit coverage before completing the current refactor board. | focused unit tests, small shared helpers, refactor docs | Firestore/Storage Rules emulator suite, feature behavior changes, PDF/email output redesign | `npm run build`; `npm run test:unit -- --run`; `npm run test:pre-refactor` | Board is complete except deferred `R08`; all final gates pass and unit drift is cleaned up. |
| R689 | Shop order compact-laptop catalog usability | Backlog | Keep the real catalog usable on short or scaled laptop screens without requiring browser zoom. | Shop Order explorer/catalog/tree/custom-item components, AppShell responsive CSS only if needed, Shop Order E2E | order persistence, catalog data behavior, rules/functions, email/PDF output | `npm run type-check`; Shop Order E2E at `1366x768`, `1280x720`, `1024x768`, and a Windows-scaling-equivalent viewport | The catalog list has a useful visible height, its scrollbar is easy to operate, long folder/item names wrap without hiding ordering controls, and the page has no horizontal overflow at 100% browser zoom. |
| R690 | Public daily-log gallery scrolling | Backlog | Ensure every photo in a large public Daily Log gallery can be reached and viewed on desktop, tablet, and phone. | public Daily Log gallery view/components/styles, gallery E2E fixture and coverage | authenticated Daily Log workspace controls, upload/storage behavior, email rendering, rules/functions | `npm run type-check`; public gallery E2E with enough photos to exceed each target viewport | A signed-out visitor can scroll from the first through the last photo, images remain contained without clipping, and no authenticated navigation or management controls appear. |
| R691 | Daily-log email attachment section grouping | Backlog | Restore the relationship between each emailed photo group and the Daily Log section where those files were attached. | Daily Log email payload normalization/rendering, function email smoke fixtures/assertions, refactor docs | gallery navigation, upload compression/storage, unrelated email designs, Firestore/Storage Rules | `npm --prefix functions run build`; `npm --prefix functions run smoke:daily-log-email`; focused email-renderer tests | Photo, PTP, QC, and other attachments appear beneath their corresponding labeled Daily Log sections in the email, preserve descriptions, and are not flattened into one unrelated gallery block. |
| R692 | Shop order delivery controls containment | Backlog | Keep the Delivery Date control contained and visually aligned with the Thursday Delivery shortcut at compact and mobile widths. | `ShopOrderMetaForm`, common input sizing only if required, Shop Order responsive E2E | delivery-date behavior, metadata persistence, order submission, email/PDF output | `npm run type-check`; Shop Order E2E at laptop, tablet, and phone viewports | Delivery Date and Thursday Delivery use the same available width, neither extends outside the order card, and the native date picker remains usable without horizontal page overflow. |

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

2026-07-14 `R307`:

- Migrated `DailyLogHistoryList` loading and no-log states from hand-rolled empty blocks to the shared `AppEmptyState` primitive while preserving the existing layout hook.
- Added `src/__tests__/AppEmptyState.spec.ts` for title/message rendering and slot fallback rendering.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 13 files / 44 tests.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 9/9.

2026-07-14 `R308`:

- Migrated `DailyLogSelectedLogCard` no-selection messaging to the shared `AppEmptyState` primitive while keeping the existing card layout hook.
- Preserved selected-log summary rendering and delete-draft behavior.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 13 files / 44 tests.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 9/9.

2026-07-14 `R309`:

- Migrated Shop Orders empty/loading presentation in `ShopOrderItemsEditor`, `ShopOrderHistoryList`, and `ShopOrderCatalogBrowser` to the shared `AppEmptyState` primitive.
- Preserved existing layout hooks and `shoporder-empty` test IDs while reducing hand-rolled empty-state markup.
- Left timecard canvas/tray empty states untouched because workbook and export visuals remain protected surfaces.
- `npm run type-check`: passed.
- `npm run test:unit -- --run`: passed, 13 files / 44 tests.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 post-R309 full-suite checkpoint:

- Full Chromium e2e suite passed after Daily Log and Shop Order `AppEmptyState` adoption slices.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.
- `npm run build`: passed outside the sandbox after the sandboxed run hit Windows `spawn EPERM`; Vite still reports the same non-failing large-chunk warning for later bundle/code-splitting work.

2026-07-14 `R310`:

- Centralized Shop Order display helpers for order timestamps, order status labels, order display labels, and `Order #...` labels in `src/utils/shopOrders.ts`.
- Migrated `ShopOrderHistoryList` and `ShopOrderSelectedOrderPanel` off duplicate local formatting helpers so the workspace header and order history use the same display rules.
- Added `src/__tests__/shopOrders.spec.ts` to cover order-number fallback, Firestore-like timestamp formatting, status/due labels, catalog folder-prefix removal, and alphabetized item ordering.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/shopOrders.spec.ts`: passed, 1 file / 5 tests.
- `npm run test:unit -- --run`: passed, 14 files / 49 tests.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 `R311`:

- Added `getDailyLogStatusLabel` to the daily-log formatting helper so history and selected-log cards share the same submitted/draft label rule.
- Migrated `DailyLogHistoryList` and `DailyLogSelectedLogCard` off local status-label expressions.
- Added `src/__tests__/dailyLogFormat.spec.ts` to cover daily-log status labels, selected-log labels, Firestore-like timestamp formatting, invalid timestamp fallbacks, and timestamp priority.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/dailyLogFormat.spec.ts`: passed, 1 file / 3 tests.
- `npm run test:unit -- --run`: passed, 15 files / 52 tests.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 9/9.

2026-07-14 `R312`:

- Added `src/utils/dateTime.ts` as the shared display-side timestamp adapter for native `Date`, ISO/string/number values, and Firestore-like `toDate`/`toMillis` objects.
- Migrated daily-log and shop-order display formatters to `formatAppTimestamp`/`toAppDate` while preserving their public fallback text (`Unknown time` and `Unknown date`).
- Added `src/__tests__/dateTime.spec.ts` to cover timestamp normalization, invalid fallback behavior, and app timestamp formatting.
- Left service-level sort timestamp helpers untouched for this slice to avoid mixing UI display cleanup with data ordering behavior.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/dateTime.spec.ts src/__tests__/dailyLogFormat.spec.ts src/__tests__/shopOrders.spec.ts`: passed, 3 files / 11 tests.
- `npm run test:unit -- --run`: passed, 16 files / 55 tests.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 25/25.

2026-07-14 post-R312 full-suite checkpoint:

- Full Chromium e2e suite passed after shared shop-order/daily-log formatting and shared display timestamp cleanup.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.
- `npm run build`: passed outside the sandbox after the sandboxed run hit Windows `spawn EPERM`; Vite still reports the same non-failing large-chunk warning for later bundle/code-splitting work.

2026-07-14 `R313`:

- Added `src/auth/roles.ts` as the current-state frontend role helper for editable user role options, stored-role labels, and editable-role normalization.
- Migrated Users role badge/dropdown helpers and the app-shell current-role label to the shared role helper while intentionally keeping the live editable role set limited to `foreman`, `project-manager`, and `admin`.
- Added `src/__tests__/roles.spec.ts` to document the current editable role list and to prevent Payroll/Shop Foreman from appearing before the broader role/rules/functions implementation is ready.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/roles.spec.ts src/__tests__/capabilities.spec.ts`: passed, 2 files / 11 tests.
- `npm run test:unit -- --run`: passed, 17 files / 58 tests.
- `npm run test:e2e -- e2e/admin-management.spec.ts --project=chromium`: passed, 3/3.

2026-07-14 `R314`:

- Added named frontend route capabilities (`manage-users`, `manage-employees`, `manage-reference-lists`, `manage-shop-catalog`, `use-timecard-export`) to `src/auth/capabilities.ts`.
- Migrated protected route metadata from generic `adminOnly` flags to `requiredCapability` and updated the route guard to call `canUseRouteCapability`.
- Updated `AppShell` admin navigation to filter links through the same route-capability helper, while preserving the current admin-only behavior for every protected link.
- Extended capability tests so named route capabilities remain admin-only until the full Payroll/Shop Foreman/Project Manager role implementation is ready.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts src/__tests__/roles.spec.ts`: passed, 2 files / 12 tests.
- `npm run test:unit -- --run`: passed, 17 files / 59 tests.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 23/23.

2026-07-14 `R315`:

- Added `toAppMillis` to `src/utils/dateTime.ts` so service sorting and display formatting can share the same Firestore/native timestamp normalization.
- Migrated Daily Log and Shop Order service sort helpers off duplicate local `toMillis` implementations while preserving submitted/updated/created timestamp priority.
- Extended `src/__tests__/dateTime.spec.ts` to cover `toAppMillis` valid and invalid timestamp behavior.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/dateTime.spec.ts src/__tests__/dailyLogFormat.spec.ts src/__tests__/shopOrders.spec.ts`: passed, 3 files / 11 tests.
- `npm run test:unit -- --run`: passed, 17 files / 59 tests.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 25/25.

2026-07-14 `R316`:

- Migrated the e2e runtime's Daily Log and Shop Order sort paths to the shared `toAppMillis` helper so seeded runtime behavior mirrors production service timestamp normalization.
- Removed the duplicate e2e-only timestamp conversion helper while leaving unrelated timecard test-runtime sorting untouched.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 25/25.

2026-07-14 post-R316 full-suite checkpoint:

- Full Chromium e2e suite passed after current-role helper centralization, named route-capability metadata, service timestamp normalization, and e2e runtime timestamp normalization.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.
- `npm run build`: passed outside the sandbox; Vite still reports the same non-failing large-chunk warning for later bundle/code-splitting work.

2026-07-14 `R317`:

- Updated `design/refactor-gap-audit.md` so the audit reflects completed current-state role helper work, named frontend route capabilities, shared timestamp helper coverage, and the remaining target-role gap across rules/functions/data.
- No runtime code changed in this slice.

2026-07-14 `R318`:

- Added a current-state `canViewAllJobs` frontend capability and exposed it through the auth store.
- Migrated the jobs store's broad-vs-assigned job subscription decision off `auth.isAdmin` and onto `auth.canViewAllJobs`, preserving current admin-only all-job visibility while preparing for Payroll/Shop Foreman read-only all-job access later.
- Extended `src/__tests__/capabilities.spec.ts` to cover current all-jobs visibility behavior.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts`: passed, 1 file / 10 tests.
- `npm run test:unit -- --run`: passed, 17 files / 60 tests.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 13/13.

2026-07-14 `R319`:

- Added a current-state `canManageJobs` frontend capability and exposed it through the auth store.
- Migrated the Jobs workspace, Jobs browser, and Jobs feature composables off direct `isAdmin` checks for job-management edit-mode behavior while preserving current admin-only access.
- Updated the gap audit and testing strategy so the docs reflect current route, all-jobs, and Jobs management capability seams.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts`: passed, 1 file / 11 tests. The first sandboxed run hit the known Windows/Vite `spawn EPERM`, then passed outside the sandbox.
- `npm run test:unit -- --run`: passed, 17 files / 61 tests.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 13/13.

2026-07-14 `R320`:

- Added a current-state `canUseTimecardExport` frontend capability and exposed it through the auth store.
- Wired the `use-timecard-export` route capability through the dedicated export helper so the route guard and export page use the same source.
- Migrated Timecard Export subscriptions, create actions, mutation actions, toolbar controls, saved-week controls, create tray, wage visibility, and cost visibility off direct `isAdmin` checks while preserving current admin-only behavior.
- Updated the gap audit and testing strategy to reflect the Timecard Export capability seam.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts`: passed, 1 file / 12 tests.
- `npm run test:unit -- --run`: passed, 17 files / 62 tests.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-14 `R321`:

- Added a current-state `canViewAllDailyLogs` frontend capability and exposed it through the auth store.
- Migrated Daily Log visibility helpers, subscriptions, selection state, and `DailyLogsView` off direct `isAdmin` checks for all-log visibility while preserving current behavior: admins see all logs, field users see submitted logs plus their own drafts.
- Updated the gap audit and testing strategy to reflect the Daily Log visibility capability seam.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts`: passed, 1 file / 13 tests.
- `npm run test:unit -- --run`: passed, 17 files / 63 tests.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-14 `R322`:

- Added a current-state `canManageJobTimecards` frontend capability and exposed it through the auth store.
- Migrated job-timecard week subscriptions, submitted-week editability, custom-card wage validation, and employee-header lock controls off direct `isAdmin` checks while preserving current behavior: admins can manage job timecards broadly, field users keep normal draft-week creation/editing behavior.
- Updated the gap audit and testing strategy to reflect the Job Timecard management capability seam.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts`: passed, 1 file / 14 tests.
- `npm run test:unit -- --run`: passed, 17 files / 64 tests.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-14 post-R322 full-suite checkpoint:

- Full Chromium e2e suite passed after current-state capabilities were added and wired through all-job visibility, Jobs management, Timecard Export, Daily Log visibility, and Job Timecard management surfaces.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.
- `npm run build`: passed outside the sandbox; Vite still reports the same non-failing large-chunk warning for later bundle/code-splitting work.

2026-07-14 `R323`:

- Removed the public `auth.isAdmin` computed from the auth store now that frontend workflow surfaces consume named capabilities instead.
- Confirmed no `auth.isAdmin`, `getIsAdmin`, or `isAdmin` references remain in `src`, `src/__tests__`, or `e2e`; lower-level `canAccessAdminArea` remains inside the capability helper and tests.
- Updated the gap audit so the frontend capability status no longer describes a legacy `isAdmin` compatibility shortcut.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts`: passed, 1 file / 14 tests.
- `npm run test:unit -- --run`: passed, 17 files / 64 tests.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/jobs.spec.ts e2e/daily-log-draft.spec.ts e2e/timecard-workbook.spec.ts --project=chromium`: passed, 40/40.

2026-07-14 `R324`:

- Added `isAppRouteCapability` to the capability helper so route metadata validation lives beside the `AppRouteCapability` union.
- Migrated the router off its duplicate route-capability string parser while preserving existing route guard behavior.
- Extended `src/__tests__/capabilities.spec.ts` to cover valid and invalid route capability metadata values.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts`: passed, 1 file / 15 tests.
- `npm run test:unit -- --run`: passed, 17 files / 65 tests.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 7/7.

2026-07-14 `R325`:

- Re-checked stale refactor notes against the current source before starting another code slice.
- Confirmed `ShopOrdersView.vue` no longer contains the old HTML-commented legacy fragment that was called out during the R20 extraction history.
- Confirmed app code no longer contains native `window.confirm` calls; destructive/submit confirmations are routed through `ConfirmDialog`.
- Updated the gap audit cleanup table so confirmation work is tracked as optional state-deduplication only, not as an unfinished native-confirm migration.
- `rg -n "window\\.confirm|browser confirm|native confirm|ConfirmDialog|confirm\\(" src e2e design/refactor-gap-audit.md design/testing-strategy.md`: source audit completed.

2026-07-14 `R326`:

- Added shared `useActionConfirmDialog` for action-based confirm-dialog state, derived copy, destructive state, and busy-safe close handling.
- Migrated job timecard, timecard export, and shop catalog confirm-dialog wrappers onto the shared primitive while preserving their existing public wrapper APIs and feature-specific copy/action helpers.
- Left Jobs, Shop Orders, Users, Employees, and Daily Logs confirm flows local because they carry selected-record or target-specific request rules instead of the simple action-state shape.
- Added focused unit coverage for the shared confirm primitive, including derived copy and "do not close while busy" behavior.
- Updated the gap audit and testing strategy to reflect the completed action-confirm primitive.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/useActionConfirmDialog.spec.ts`: passed, 1 file / 3 tests. The first sandboxed run hit the known Windows/Vite `spawn EPERM`, then passed outside the sandbox.
- `npm run test:unit -- --run`: passed, 18 files / 68 tests.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.
- After centralizing the shared `ReadonlyRef` type, `npm run type-check` and `npm run test:unit -- --run src/__tests__/useActionConfirmDialog.spec.ts` still passed.

2026-07-14 `R327`:

- Added explicit `clearPageError` and `clearPageInfo` helpers to `usePageMessages` so callers can clear one message channel without mutating refs directly.
- Migrated Daily Logs recipient and attachment flows off direct `actionError.value = ''` mutation and onto the shared message helper.
- Added focused unit coverage for page-message mutual exclusion, one-channel clearing, and full reset behavior.
- Updated the gap audit and testing strategy to include shared page-message coverage.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/usePageMessages.spec.ts`: blocked by environment. Unsandboxed approval was rejected, and the safer sandboxed run hit the known Windows/Vite `spawn EPERM` startup error.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-14 `R328`:

- Added `src/types/reactivity.ts` as the shared home for the lightweight `ReadonlyRef<T>` structural type used by composables.
- Moved the new action-confirm primitive and its migrated wrappers to that neutral type instead of exporting a generic Vue helper type from `useActionConfirmDialog`.
- Intentionally avoided a broad mechanical sweep across every existing `ReadonlyRef` duplicate; those can migrate gradually when each feature file is touched for real refactor work.
- `npm run type-check`: passed.

2026-07-14 `R329`:

- Migrated Daily Logs feature composables off local `ReadonlyRef<T>` interface declarations and onto the shared `src/types/reactivity.ts` type.
- Left local mutable `Ref<T>` structural types and other feature areas alone to keep the slice narrow and behavior-free.
- Updated the gap audit to track gradual feature-composable `ReadonlyRef` adoption as a low-risk cleanup path instead of a broad mechanical sweep.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-14 `R330`:

- Migrated Shop Orders feature composables off local `ReadonlyRef<T>` interface declarations and onto the shared `src/types/reactivity.ts` type.
- Kept mutable local `Ref<T>` structural types in place so the slice stayed focused on read-only composable contracts.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 `R331`:

- Migrated Jobs feature composables off local `ReadonlyRef<T>` interface declarations and onto the shared `src/types/reactivity.ts` type.
- Confirmed Jobs, Daily Logs, and Shop Orders no longer define local `ReadonlyRef<T>` interfaces; remaining duplicate read-only ref types are outside this workflow trio and can move gradually.
- Updated the gap audit wording to reflect shared `ReadonlyRef<T>` adoption across Jobs, Daily Logs, Shop Orders, and action-confirm wrappers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-14 `R332`:

- Migrated Users and Employees admin action composables off local `ReadonlyRef<T>` interface declarations and onto the shared `src/types/reactivity.ts` type.
- Updated the gap audit wording to include the small Users/Employees action adoption.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 `R333`:

- Migrated Shop Catalog feature composables off local `ReadonlyRef<T>` interface declarations and onto the shared `src/types/reactivity.ts` type.
- Confirmed Shop Catalog no longer defines local `ReadonlyRef<T>` interfaces; remaining duplicates are concentrated in Timecard feature composables.
- Updated the gap audit wording to reflect Shop Catalog adoption and the remaining Timecard-focused cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-14 `R334`:

- Migrated Timecard feature composables off local `ReadonlyRef<T>` interface declarations and onto the shared `src/types/reactivity.ts` type.
- Confirmed no local `ReadonlyRef` type/interface declarations remain in `src/features`, `src/composables`, `src/views`, or `src/components`; writable local `Ref<T>` structural types were intentionally left alone.
- Updated the gap audit so shared read-only ref contracts are tracked as complete/current-state rather than an open cleanup candidate.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84 after the full shared `ReadonlyRef<T>` migration.
- Historical build note for this slice: the sandboxed run hit Windows `spawn EPERM`, and the approval reviewer rejected the unsandboxed rerun request. Superseded by the 2026-07-17 `R688` closeout verification, where the production build passed using the approved elevated path.

2026-07-14 `R335`:

- Added shared `WritableRef<T>` to `src/types/reactivity.ts` so composables can use one neutral mutable-ref contract instead of redefining local `Ref<T>` shapes.
- Migrated Daily Logs writable composable inputs off local `Ref<T>` interface declarations and onto the shared `WritableRef<T>` type.
- Kept the slice behavior-free and Daily Logs focused; other feature writable-ref contracts remain as gradual cleanup candidates.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.

2026-07-14 `R336`:

- Migrated Shop Orders writable composable inputs off local `Ref<T>` interface declarations and onto the shared `WritableRef<T>` type.
- Removed one dead local `Ref<T>` declaration from the shop order item actions composable.
- Confirmed Shop Orders no longer defines local writable `Ref<T>` interfaces.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 `R337`:

- Migrated Jobs, Users, and Employees writable composable inputs off local `Ref<T>` interface declarations and onto the shared `WritableRef<T>` type.
- Confirmed those admin-facing feature folders no longer define local mutable `Ref<T>` interfaces.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 22/22.

2026-07-14 `R338`:

- Migrated Shop Catalog writable composable inputs off local `Ref<T>` interface declarations and onto the shared `WritableRef<T>` type.
- Confirmed the Shop Catalog feature folder no longer defines local mutable `Ref<T>` interfaces.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-14 `R339`:

- Migrated Job Timecard workspace/action/subscription writable composable inputs off local `Ref<T>` interface declarations and onto the shared `WritableRef<T>` type.
- Confirmed the job-timecard composable subset no longer defines local mutable `Ref<T>` interfaces.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-14 `R340`:

- Migrated Timecard Export writable composable inputs off local `Ref<T>` interface declarations and onto the shared `WritableRef<T>` type.
- Confirmed no local `interface Ref<T>` or `type Ref<T>` declarations remain in `src/features`, `src/composables`, `src/views`, or `src/components`.
- Updated the gap audit so feature composable ref contracts are tracked as current-state complete instead of an open cleanup item.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-14 `R341`:

- Ran the broad post-cleanup verification after centralizing shared read-only and writable composable ref contracts.
- `rg -n "interface ReadonlyRef|type ReadonlyRef|interface Ref<T>|type Ref<T>" src/features src/composables src/views src/components -g "*.ts" -g "*.vue"`: no matches.
- `npm run type-check`: passed.
- `npm run test:e2e -- --project=chromium --reporter=dot`: passed, 84/84.

2026-07-14 `R342`:

- Added `src/__tests__/ConfirmDialog.spec.ts` to cover the shared confirmation dialog component contract directly: open/closed rendering, accessible dialog labeling, cancel/confirm events, destructive styling, and busy-state action lockout.
- Adjusted the test to interact with teleported dialog DOM through `document.body` so it matches the component's runtime rendering model.
- Updated the testing strategy component coverage list to include the shared confirmation dialog.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/ConfirmDialog.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R343`:

- Added shared `SaveStatusIndicator` as an autosave-specific wrapper around `AppStatusMessage`.
- Migrated Users, Employees, and Jobs detail autosave status displays onto the shared save-status primitive while preserving existing visibility rules and copy.
- Added `src/__tests__/SaveStatusIndicator.spec.ts` for hidden idle state, saving copy, saved success tone, custom copy, and scoped-slot override behavior.
- Updated the component architecture and testing strategy docs so `SaveStatusIndicator` is tracked as implemented/covered rather than an unstarted candidate.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/SaveStatusIndicator.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R344`:

- Added `src/__tests__/DailyLogTextSectionCard.spec.ts` for the extracted daily-log text-section component contract.
- Covered section eyebrow/title copy, field labels, bound values, row counts, placeholders, `update-field` events, `blur-field` events, and disabled textarea state.
- Updated the component architecture and testing strategy docs so Daily Log text sections are tracked as covered instead of a future component-test candidate.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogTextSectionCard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R345`:

- Added `src/__tests__/ShopOrderItemsEditor.spec.ts` for the extracted shop-order items editor contract.
- Covered editable item display, note-draft precedence, quantity/note/remove emitted events, custom item metadata, pending remove disablement, submitted/read-only rendering, and loading/empty states.
- Updated the component architecture and testing strategy docs so the existing `ShopOrderItemsEditor` is tracked as covered instead of a future component-test candidate.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderItemsEditor.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R346`:

- Added shared `AppSplitWorkspace` as the reusable two-pane workspace shell with `tabs`, `primary`, and `secondary` slots, custom panel keys, active mobile-panel classes, and configurable primary pane width.
- Migrated Users and Employees admin pages onto `AppSplitWorkspace`, removing their duplicated grid/mobile shell CSS while preserving the existing directory/editor feature panel classes and behavior.
- Added `src/__tests__/AppSplitWorkspace.spec.ts` for the split-workspace slot/class/style/attrs contract.
- Updated the component architecture and testing strategy docs so `AppSplitWorkspace` is tracked as started/covered and no longer listed as the immediate component-test gap.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/AppSplitWorkspace.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R347`:

- Added `src/__tests__/ShopOrderCatalogTreeNodeRow.spec.ts` for the shop-order catalog tree row contract.
- Covered category rendering, active state, expanded-state toggle behavior, row selection, context-menu event emission, item quantity updates, add events, and disabled item controls.
- Updated the component architecture and testing strategy docs so the existing catalog tree row is tracked as covered and the next catalog component gap is the broader browser/container.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderCatalogTreeNodeRow.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R348`:

- Added `src/__tests__/TimecardCanvasPanel.spec.ts` for the shared job/export timecard canvas shell contract.
- Covered loading and empty states, header/card/action/footer slot rendering, selected and compact card classes, card DOM ids/test ids, shell and scale styles, card selection, compact toggle, and measurement element events.
- Updated the component architecture, frontend architecture, and testing strategy docs to use the actual `TimecardCanvasPanel` name instead of the older planned `TimecardCardCanvas` label.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.
- `npm run test:unit -- --run src/__tests__/TimecardCanvasPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R349`:

- Added `src/__tests__/ShopOrderCatalogBrowser.spec.ts` for the shop-order catalog browser/container contract.
- Covered active folder/item counts, inactive entry filtering, search-time folder collapse and re-expand behavior, selected quantity add calls, quantity reset after successful add, and disabled item controls.
- Updated the component architecture and testing strategy docs so `ShopOrderCatalogBrowser` is tracked as covered and the next component-test candidates moved forward to other workflow panes.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderCatalogBrowser.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R350`:

- Added `src/__tests__/JobBrowserPanel.spec.ts` for the Jobs browser panel contract.
- Covered admin edit controls, active/archived/visible counts, all-jobs row, job row metadata, search/status/create/select emitted events, field-user visibility rules, loading state, and empty state.
- Updated the component architecture and testing strategy docs so `JobBrowserPanel` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 19/19.
- `npm run test:unit -- --run src/__tests__/JobBrowserPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R351`:

- Added `src/__tests__/ShopOrderWorkspacePane.spec.ts` for the shop-order workspace pane orchestration contract.
- Covered job/order summary rendering, create/submit/delete-draft actions, selected-order metadata event forwarding, item editor event forwarding, history selection, submitted/read-only control visibility, and empty workspace/history states.
- Updated the component architecture and testing strategy docs so `ShopOrderWorkspacePane` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderWorkspacePane.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R352`:

- Added `src/__tests__/JobNotificationRecipientsPanel.spec.ts` for the Jobs notification-recipient panel contract.
- Covered panel description rendering, module sections, recipient counts, recipient rows, empty labels, per-module input/add/remove emitted events, and disabled-state pass-through.
- Updated the component architecture and testing strategy docs so `JobNotificationRecipientsPanel` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/JobNotificationRecipientsPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R353`:

- Added `src/__tests__/JobFieldUserAssignmentPanel.spec.ts` for the Jobs field-user assignment panel contract.
- Covered selected-count rendering, search value and update events, row test-id/display/fallback labels, active/inactive metadata, checkbox checked-state binding, toggle events, loading state, empty state, and parent-owned selected-state immutability.
- Updated the component architecture and testing strategy docs so `JobFieldUserAssignmentPanel` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/JobFieldUserAssignmentPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R354`:

- Added `src/__tests__/JobDetailsFormFields.spec.ts` for the Jobs detail form-field component contract.
- Covered AppField label order, current values, create-form test-id prefixing, job type select labels including custom fallback labels, important field attributes for GC/burden/date fields, typed `updateField` events for every form field, and optional test-id omission for edit forms.
- Updated the component architecture and testing strategy docs so `JobDetailsFormFields` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/JobDetailsFormFields.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R355`:

- Added `src/__tests__/AppButton.spec.ts` for the shared button primitive contract.
- Covered default `type="button"` safety, slot rendering, base and variant classes, explicit submit/reset types, attr and custom-class passthrough, disabled behavior, and native click-handler passthrough.
- Updated the component architecture and testing strategy docs so `AppButton` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 26/26.
- `npm run test:unit -- --run src/__tests__/AppButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R356`:

- Added `src/__tests__/AppLoadingButton.spec.ts` for the shared loading button primitive contract.
- Covered normal label rendering, safe default button type, loading label and fallback copy, loading class, disabled and `aria-busy` behavior, primary/success/ghost variants, explicit submit/reset types, attr and custom-class passthrough, disabled click prevention, enabled native click passthrough, and slot override behavior.
- Updated the component architecture and testing strategy docs so `AppLoadingButton` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R357`:

- Added `src/__tests__/AppButtonLink.spec.ts` for the shared button-link primitive contract.
- Covered slot rendering, base and variant button classes, string route targets, route-location object passthrough, attr passthrough, and custom-class merging with button classes.
- Updated the component architecture and testing strategy docs so `AppButtonLink` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/AppButtonLink.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R358`:

- Added `src/__tests__/AppIconButton.spec.ts` for the shared compact icon-button primitive contract.
- Covered slot rendering, accessible `aria-label`, title fallback and override, safe default `type="button"`, success/danger variants, explicit submit/reset types, attr and custom-class passthrough, disabled click prevention, and enabled native click passthrough.
- Updated the component architecture and testing strategy docs so `AppIconButton` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/AppIconButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R359`:

- Added `src/__tests__/AppListButton.spec.ts` for the shared selectable list-row button primitive contract.
- Covered slot rendering, base row class, active and dashed state classes, safe default `type="button"`, explicit submit/reset types, attr and custom-class passthrough, disabled click prevention, and enabled native click passthrough.
- Updated the component architecture and testing strategy docs so `AppListButton` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/AppListButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R360`:

- Added `src/__tests__/AppPaneHeader.spec.ts` for the shared pane-header primitive contract.
- Covered eyebrow rendering, default `h1` title rendering, `h1`/`h2`/`h3` title tag selection, no-eyebrow rendering, optional actions slot rendering, root attr passthrough, and custom class merging.
- Fixed a test-only type assertion after `vue-tsc` caught an invalid `.exists()` call on a guaranteed `.get()` wrapper.
- Updated the component architecture and testing strategy docs so `AppPaneHeader` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 19/19.
- `npm run test:unit -- --run src/__tests__/AppPaneHeader.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R361`:

- Added `src/__tests__/AppSearchInput.spec.ts` for the shared search-input primitive contract.
- Covered search input type rendering, value binding, placeholder binding, default placeholder-backed `aria-label`, explicit `ariaLabel` override, `update:modelValue` events, attr passthrough, disabled state, and custom class merging.
- Updated the component architecture and testing strategy docs so `AppSearchInput` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts e2e/shop-order-workspace.spec.ts e2e/timecard-workbook.spec.ts --project=chromium`: passed, 60/60.
- `npm run test:unit -- --run src/__tests__/AppSearchInput.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R362`:

- Added `src/__tests__/AppTextInput.spec.ts` for the shared text-input primitive contract.
- Covered default `type="text"` rendering, explicit `date`/`email`/`number` types, string and number value binding, `update:modelValue` events, raw native `input` event passthrough, attr passthrough, disabled/read-only state, placeholder passthrough, and custom class merging.
- Updated the component architecture and testing strategy docs so `AppTextInput` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 62/62.
- `npm run test:unit -- --run src/__tests__/AppTextInput.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R363`:

- Added `src/__tests__/AppTextarea.spec.ts` for the shared textarea primitive contract.
- Covered value binding, `update:modelValue` events, raw native `input` event passthrough, attr passthrough, disabled/read-only state, row/placeholder passthrough, and custom class merging.
- Updated the component architecture and testing strategy docs so `AppTextarea` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/AppTextarea.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R364`:

- Added `src/__tests__/AppSelect.spec.ts` for the shared native-select primitive contract.
- Covered option slot rendering, string and number value binding, `update:modelValue` change events, attr passthrough, disabled state, accessible label passthrough, and custom class merging.
- Updated the component architecture and testing strategy docs so `AppSelect` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/AppSelect.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R365`:

- Added `src/__tests__/AppCheckbox.spec.ts` for the shared checkbox primitive contract.
- Covered checkbox type rendering, checked-state binding, boolean `update:modelValue` events, raw native `change` event passthrough, attr passthrough, disabled state, accessible label passthrough, and custom class merging.
- Updated the component architecture and testing strategy docs so `AppCheckbox` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts e2e/timecard-workbook.spec.ts --project=chromium`: passed, 44/44.
- `npm run test:unit -- --run src/__tests__/AppCheckbox.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R366`:

- Added `src/__tests__/AppBadge.spec.ts` for the shared badge primitive contract.
- Covered default slot rendering, default tone class, accent/success/danger/warning tone classes, attr passthrough, title passthrough, and custom class merging.
- Updated the component architecture and testing strategy docs so `AppBadge` is tracked as covered and the next component-test candidate list moves forward.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/AppBadge.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R367`:

- Added `src/__tests__/AppField.spec.ts` for the shared field-wrapper primitive contract.
- Covered label rendering, no-label rendering, default slot rendering, help slot rendering, attr passthrough, `for` passthrough, and custom class merging.
- Updated the component architecture and testing strategy docs so `AppField` is tracked as covered, missing shared primitive coverage entries are listed, and the next test target moves toward composables.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/admin-pages.spec.ts e2e/admin-management.spec.ts e2e/jobs.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 47/47.
- `npm run test:unit -- --run src/__tests__/AppField.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R368`:

- Added `src/composables/useAutosaveQueue.ts` as the first shared single-form autosave queue seam.
- Covered debounce scheduling, rescheduling, `canSave` gating, clearing pending saves, last-saved timestamps, and background error capture in `src/__tests__/useAutosaveQueue.spec.ts`.
- Migrated Jobs detail autosave timer mechanics in `src/features/jobs/useJobDetailForm.ts` onto `useAutosaveQueue` while preserving job-specific dirty-signature checks, validation, messages, and persistence behavior.
- Updated the component architecture and testing strategy docs so `useAutosaveQueue` is tracked as implemented/covered and the next test target moves to dirty snapshot guards.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useAutosaveQueue.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R369`:

- Added `src/utils/dirtySnapshotGuard.ts` as the first shared dirty snapshot hydration decision utility.
- Covered selection-change hydration, local dirty-state protection, incoming saved-echo skips, optional local-mismatch protection, and clean remote update hydration in `src/__tests__/dirtySnapshotGuard.spec.ts`.
- Migrated Jobs detail hydration in `src/features/jobs/jobViewHelpers.ts` to delegate to `shouldHydrateDirtySnapshot` while preserving selection-change behavior, editable dirty guards, and slow-autosave echo protection.
- Updated the component architecture and testing strategy docs so the dirty snapshot guard is tracked as implemented/covered and the next test target moves to optimistic list behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/dirtySnapshotGuard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R370`:

- Added `src/utils/optimisticRecords.ts` as the first shared optimistic record-list utility for immutable replace/upsert/remove operations by record id.
- Covered replace, missing-record copy, upsert append/replace, and remove behavior in `src/__tests__/optimisticRecords.spec.ts`.
- Migrated shop-order item persistence to apply sorted item-list changes locally through `replaceOrderLocally` before awaiting the callable, and to restore the previous order if the save fails.
- Updated the component architecture and testing strategy docs so optimistic list behavior is tracked as implemented/covered and the next test target moves to granular pending-action state.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/optimisticRecords.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R371`:

- Split shop-order custom-item form availability into editable-field disabled state and add-submit disabled state so users can keep typing a custom item while a different item save is pending.
- Added `orderInputDisabled` alongside `orderMutationDisabled` in `useShopOrderWorkspaceState`; catalog/add controls still respect mutation pending state, while the custom item text fields only lock when the job/order input context is unavailable.
- Added `src/__tests__/ShopOrderCustomItemForm.spec.ts` for custom-item form values/events and pending-submit-only disabled behavior.
- Updated the component architecture and testing strategy docs so the custom item form coverage is tracked and granular pending-state work has a first shop-order UI consumer.
- `npm run type-check`: passed after fixing the new spec selectors.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderCustomItemForm.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R372`:

- Added `src/composables/usePendingActionMap.ts` as the first shared keyed pending-action primitive for row/button-level pending state.
- Added `src/__tests__/usePendingActionMap.spec.ts` and extended `src/__tests__/ShopOrderCatalogBrowser.spec.ts` to cover row-level catalog item add pending behavior.
- Migrated `ShopOrderCatalogBrowser.vue` to mark only the clicked catalog item row pending while its add promise is in flight, leaving the rest of the catalog searchable/browsable.
- Changed the shop-order page to pass `orderInputDisabled` instead of `orderMutationDisabled` into the catalog browser, so a normal item save no longer disables the whole catalog.
- Serialized shop-order item writes in `useShopOrderPersistence.ts` so multiple fast item additions reconcile in order instead of letting whole-array callable writes race each other.
- Updated the component architecture and testing strategy docs so keyed pending-action behavior is tracked as implemented/covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/usePendingActionMap.spec.ts src/__tests__/ShopOrderCatalogBrowser.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R373`:

- Added `src/__tests__/shopOrderCatalogTree.spec.ts` for the extracted shop-order catalog tree construction helper.
- Covered active expanded nodes, folder/item summaries, collapsed category behavior outside search, SKU search, folder-path search, and search-time collapsed folders.
- Updated the component architecture and testing strategy docs so shop-order tree construction is tracked as covered before further catalog browser extraction.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/shopOrderCatalogTree.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R374`:

- Added `src/__tests__/timecardWorkbookNavigation.spec.ts` for the extracted timecard workbook keyboard-navigation helper.
- Covered arrow-key direction mapping, navigable input detection, horizontal cursor-edge behavior, focus/select behavior, grid metadata navigation, null guards for invalid metadata/sheets, geometry fallback navigation, and disabled-candidate filtering.
- Updated the component architecture and testing strategy docs so timecard keyboard navigation helpers are tracked as covered before deeper timecard GUI refactoring.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/timecardWorkbookNavigation.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R375`:

- Added `src/components/common/AppDateInput.vue` as the shared native date-input primitive backed by the existing text-input styling.
- Added `src/__tests__/AppDateInput.spec.ts` for fixed date type rendering, value binding, model/input events, attr passthrough, min/max passthrough, native listener passthrough, disabled state, and class merging.
- Migrated Jobs start/end date fields in `JobDetailsFormFields.vue` to `AppDateInput` as the first low-risk consumer.
- Updated the component architecture and testing strategy docs so `AppDateInput` is tracked as started/covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/AppDateInput.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R376`:

- Migrated the remaining Vue date fields to `AppDateInput`: Daily Log calendar search, Shop Order delivery date, Job Timecard week ending, and Timecard Export single/range date filters.
- Confirmed no raw `type="date"` Vue component usage remains outside the shared primitive.
- Updated the component architecture docs so `AppDateInput` lists all current workflow consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 60/60.

2026-07-14 `R377`:

- Added `src/components/common/AppInlineInput.vue` as a shared inline-editing primitive with model updates, native input passthrough, commit on blur/Enter, cancel on Escape, click isolation, and input-ref forwarding.
- Added `src/__tests__/AppInlineInput.spec.ts` for inline input rendering, value updates, commit/cancel events, attr/class passthrough, disabled state, and input-ref forwarding.
- Migrated Shop Catalog inline create/rename fields in `ShopCatalogTreeNodeRow.vue` to `AppInlineInput` while preserving parent-owned persistence and focus/select behavior through `useShopCatalogInlineEditing`.
- Updated the component architecture and testing strategy docs so `AppInlineInput` is tracked as started/covered.
- `npm run type-check`: passed after aligning the Vue ref callback type.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/AppInlineInput.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R378`:

- Extended `src/utils/recipientEmails.ts` with shared recipient add-result classification plus append/remove helpers.
- Expanded `src/__tests__/recipientEmails.spec.ts` to cover empty/invalid/duplicate/ready add decisions, reserved recipient duplicate detection, normalized append behavior, and normalized remove behavior.
- Migrated Jobs notification recipients and Daily Log additional recipients to the shared add/remove helpers while keeping feature-owned persistence, local optimistic updates, and user-facing messages in their existing composables.
- Removed the redundant Daily Log recipient normalizer wrapper from `dailyLogs/viewHelpers.ts`.
- Updated the component architecture and testing strategy docs so recipient helper sharing is tracked separately from the future full `useRecipientEditor` composable.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 7/7.
- `npm run test:unit -- --run src/__tests__/recipientEmails.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R379`:

- Added `src/components/common/AppReadonlyField.vue` as a shared read-only field primitive for submitted/locked record displays.
- Added `src/__tests__/AppReadonlyField.spec.ts` for slot rendering, multiline state, attr/title passthrough, and custom class merging.
- Migrated Shop Order submitted metadata fields in `ShopOrderSelectedOrderPanel.vue` to `AppReadonlyField` while preserving existing `data-testid` hooks and submitted-order plain-value behavior.
- Updated the component architecture and testing strategy docs so `AppReadonlyField` is tracked as started/covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/AppReadonlyField.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R380`:

- Migrated Shop Order submitted item quantity and note values in `ShopOrderItemsEditor.vue` to `AppReadonlyField`.
- Preserved existing submitted-order `data-testid` hooks, compact quantity centering, multiline note display, and read-only text behavior through `AppReadonlyField` CSS-variable customization.
- Updated the component architecture and testing strategy docs so the read-only primitive's shop-order consumers are tracked.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderItemsEditor.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R381`:

- Added `src/composables/useRecipientEditor.ts` for shared recipient input state, add-result classification, and normalized list add/remove preparation.
- Added `src/__tests__/useRecipientEditor.spec.ts` for input-owned classification, value-based keyed-editor classification, and normalized add/remove behavior.
- Migrated Jobs notification recipients and Daily Log additional recipients to consume `useRecipientEditor` while keeping persistence, permissions, and user-facing messages feature-owned.
- Updated the component architecture and testing strategy docs so `useRecipientEditor` is tracked as started/covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 7/7.
- `npm run test:unit -- --run src/__tests__/useRecipientEditor.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R382`:

- Added `src/components/common/AppPane.vue` as the shared pane shell primitive for bordered panel layout, grid rows, padding, background, and shadow.
- Added `src/__tests__/AppPane.spec.ts` for default section rendering, alternate root tags, slot content, attrs, accessible labels, and custom class passthrough.
- Migrated `JobBrowserPanel.vue` to render through `AppPane` while preserving the existing `jobs-browser` class and all browser/list/test selectors.
- Removed the duplicated Jobs browser root shell CSS now owned by `AppPane`.
- Updated the component architecture and testing strategy docs so `AppPane` is tracked as started/covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/AppPane.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R383`:

- Migrated `EmployeeDirectoryPanel.vue` and `EmployeeEditorPanel.vue` to render their pane roots through `AppPane`.
- Removed the duplicate Employees pane shell CSS from `EmployeesView.vue`; employee directory/detail internal layout styles remain owned by their components.
- Updated the component architecture docs so `AppPane` lists the Employees panes as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 `R384`:

- Migrated `UserDirectoryPanel.vue` and `UserEditorPanel.vue` to render their pane roots through `AppPane`.
- Removed the duplicate Users pane shell CSS from `UsersView.vue`; user directory/detail internal layout styles remain owned by their components.
- Updated the component architecture docs so `AppPane` lists the Users panes as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 `R385`:

- Migrated `ShopCatalogInspectorPane.vue` to render its root through `AppPane`.
- Preserved the inspector's denser spacing and mobile-hidden behavior through `AppPane` CSS-variable overrides.
- Removed the duplicated inspector pane shell CSS for display, border, background, radius, padding, overflow, and shadow.
- Updated the component architecture docs so `AppPane` lists the Shop Catalog inspector as a current consumer.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-14 `R386`:

- Migrated `ShopCatalogTreePane.vue` to render its root through `AppPane`.
- Preserved the tree pane's compact spacing, id/class selectors, catalog tree events, and responsive mobile overflow behavior through `AppPane` CSS-variable overrides.
- Removed the duplicated tree pane shell CSS for grid rows, gap, height, overflow, padding, border, background, radius, and shadow.
- Updated the component architecture docs so `AppPane` lists both Shop Catalog tree and inspector panes as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-14 `R387`:

- Migrated the Jobs edit/detail pane in `JobsView.vue` to render through `AppPane`.
- Preserved create-job, all-jobs default recipients, selected-job editing, autosave status, archive/restore/delete, and empty-state markup while moving the duplicated detail shell CSS into `AppPane` CSS-variable overrides.
- Updated the component architecture docs so `AppPane` lists Jobs browser/detail panels as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-14 `R388`:

- Migrated the Jobs create, all-jobs defaults, and selected-job detail headers to `AppPaneHeader`.
- Preserved the existing heading text, heading level, status/default badges, and Jobs route behavior while removing duplicate Jobs-only eyebrow/title/header CSS.
- Updated the component architecture docs so `AppPaneHeader` tracks the Jobs detail headers as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.

2026-07-14 `R389`:

- Migrated the Users create, selected-user, and empty-state detail headers to `AppPaneHeader`.
- Preserved user status badges, role badges, delete action placement, self-edit lockout behavior, and empty-state copy while removing duplicate Users-only eyebrow/title/header CSS.
- Updated the component architecture docs so `AppPaneHeader` tracks Users detail headers as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 `R390`:

- Extended `AppPaneHeader` with a `copy-prefix` slot for controls that need to render before the eyebrow/title copy.
- Added unit coverage for the `copy-prefix` slot in `src/__tests__/AppPaneHeader.spec.ts`.
- Migrated the Employees create and selected-employee detail headers to `AppPaneHeader`, preserving the mobile Back to Directory control through the new prefix slot and preserving employee status/type badges through the actions slot.
- Removed duplicate Employees-only eyebrow/title/header CSS while keeping the existing responsive header breakpoint for the Employee editor.
- Updated the component architecture docs so `AppPaneHeader` tracks the prefix slot and Employees detail headers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/AppPaneHeader.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the approval reviewer rejected the unsandboxed rerun request.

2026-07-14 `R391`:

- Added `src/components/common/AppCard.vue` as the shared feature-card shell primitive for bordered card surfaces, gap, padding, background, and shadow.
- Added `src/__tests__/AppCard.spec.ts` for default article rendering, alternate root tags, slot content, attrs, accessible labels, and custom class passthrough.
- Migrated Daily Log site info, history, recipients, text section, attachment, selected log, manpower, and indoor climate cards to render through `AppCard`.
- Migrated those Daily Log card headers to `AppPaneHeader`, preserving existing heading text, heading levels, selected-log delete action placement, and the previous `920px` stacked-header responsive behavior.
- Removed duplicated Daily Log card shell and eyebrow/title CSS from the migrated cards while keeping each card's feature-owned fields, tables, upload picker, recipient editor, events, and test hooks intact.
- Updated the component architecture and testing strategy docs so `AppCard` is tracked as started/covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/AppCard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R392`:

- Migrated `ShopOrderWorkspacePane.vue` and `ShopOrderCatalogBrowser.vue` to render their outer pane shells through `AppPane`.
- Preserved the shop-order-specific pane colors, compact spacing, borders, soft shadows, grid rows, scroll behavior, and catalog max-height behavior through `AppPane` CSS-variable overrides.
- Migrated the Shop Order workspace and catalog title/action headers to `AppPaneHeader`, preserving job/catalog titles, New Order and Submit Order actions, catalog folder/item counts, `data-testid` hooks, title ellipsis, and existing mobile stacked-header breakpoints.
- Removed duplicated Shop Order catalog/workspace shell and main pane eyebrow/title CSS while keeping catalog tree, context menu, selected-order, item editor, history, draft delete, and event behavior feature-owned.
- Updated the component architecture docs so `AppPane` and `AppPaneHeader` track the Shop Order catalog/workspace consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-14 `R393`:

- Migrated `ShopOrderCustomItemForm.vue` to render its Custom Item/Add Custom Item header through `AppPaneHeader`.
- Preserved the `h3` heading level, compact shop-order header sizing, title letter spacing, form layout, editable fields, submit behavior, pending-submit-only disabled behavior, and existing custom item E2E flow.
- Removed duplicate custom-item-only eyebrow/title/header CSS while keeping the form controls and events feature-owned.
- Updated the component architecture docs so `AppPaneHeader` tracks the Shop Order custom-item header as a current consumer.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderCustomItemForm.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R394`:

- Added `src/components/common/AppEntityHeader.vue` as the shared selected-record header primitive for compact eyebrow/title/action layouts.
- Added `src/__tests__/AppEntityHeader.spec.ts` for default strong title rendering, h2/h3 title tag selection, action slot rendering, identity class passthrough, root attrs, and custom class passthrough.
- Migrated `ShopOrderSelectedOrderPanel.vue` to render its selected order identity/status header through `AppEntityHeader`.
- Preserved the submitted-order number selector used by E2E through `identityClass`, order display label, status/item/total-quantity badges, compact shop-order sizing, and selected-order controls/meta behavior.
- Updated the component architecture and testing strategy docs so `AppEntityHeader` is tracked as started/covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/AppEntityHeader.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R395`:

- Added `src/components/common/AppSectionHeader.vue` as the shared compact section title/action primitive.
- Added `src/__tests__/AppSectionHeader.spec.ts` for default span title rendering, title tag selection, action slot rendering, root attrs, and custom class passthrough.
- Migrated the Shop Order Added Items and Order History section headers in `ShopOrderWorkspacePane.vue` to render through `AppSectionHeader`.
- Preserved the visible Added Items/Order History copy, item/quantity summaries, draft/submitted summary, Delete Draft action placement, compact spacing, responsive stacked behavior, and all Shop Order workspace events.
- Removed the old one-off `shop-orders-workspace-card__header` CSS from `ShopOrderWorkspacePane.vue`.
- Updated the component architecture and testing strategy docs so `AppSectionHeader` is tracked as started/covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/AppSectionHeader.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R396`:

- Migrated `JobFieldUserAssignmentPanel.vue` to render its Assigned Field Users/selected-count header through `AppSectionHeader`.
- Migrated `UserAssignedJobsPanel.vue` to render its Assigned Jobs/selected-count header through `AppSectionHeader`.
- Preserved the existing white panel-title weight, selected-count copy, responsive stacked behavior, assignment search controls, checkbox rows, empty/loading states, and parent-owned emit contracts through CSS-variable overrides.
- Updated the component architecture docs so `AppSectionHeader` tracks the Jobs assigned-field-users and Users assigned-jobs headers as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/JobFieldUserAssignmentPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R397`:

- Extended `AppSectionHeader.vue` with optional description prop/slot support so compact section headers can own title, helper text, and action layout together.
- Added `AppSectionHeader` unit coverage for description prop and description slot rendering in `src/__tests__/AppSectionHeader.spec.ts`.
- Migrated `JobNotificationRecipientsPanel.vue` to render its Email Recipients title/description header through `AppSectionHeader`.
- Preserved the existing panel title weight, helper text copy, recipient editor sections, disabled recipient behavior, module add/remove/input events, and Jobs route notification-recipient flows through CSS-variable overrides.
- Updated the component architecture and testing strategy docs so `AppSectionHeader` tracks description support and the Jobs notification recipients header as a current consumer.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 19/19.
- `npm run test:unit -- --run src/__tests__/AppSectionHeader.spec.ts src/__tests__/JobNotificationRecipientsPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-14 `R398`:

- Migrated the create and selected employee settings headers in `EmployeeEditorPanel.vue` to render through `AppSectionHeader`.
- Preserved the Directory Settings/Employee Settings titles, active/inactive and employee-number meta copy, responsive stacked behavior, employee create/edit/delete fields, toggle behavior, and save-status behavior through CSS-variable overrides.
- Updated the component architecture docs so `AppSectionHeader` tracks Employees settings headers as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/EmployeeEditorPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R399`:

- Migrated the shared `RecipientEditor.vue` title/hint/count header to render through `AppSectionHeader`.
- Preserved recipient titles, optional hint copy, recipient counts, editable input behavior, Enter-to-add behavior, add/remove events, disabled behavior, read-only/default recipient rows, empty labels, and mobile stacked header behavior through CSS-variable overrides.
- Removed the old one-off `recipient-editor__title` CSS while keeping recipient input/list/row styling feature-owned.
- Updated the component architecture and testing strategy docs so `AppSectionHeader` tracks shared RecipientEditor headers and `RecipientEditor` coverage notes reflect the shared header primitive.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 7/7.
- `npm run test:unit -- --run src/__tests__/RecipientEditor.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R400`:

- Extended `AppPaneHeader.vue` with optional description prop/slot support for pane-level eyebrow/title/helper text layouts.
- Added `AppPaneHeader` unit coverage for description prop and description slot rendering in `src/__tests__/AppPaneHeader.spec.ts`.
- Migrated `PagePanel.vue` to render its eyebrow/title/description header through `AppPaneHeader`.
- Preserved the PagePanel shell, body padding, panel background/border/shadow, job dashboard header behavior, reference-list panel behavior, and existing route copy through CSS-variable overrides.
- Updated the component architecture and testing strategy docs so `AppPaneHeader` tracks description support and PagePanel as a current consumer.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 14/14.
- `npm run test:unit -- --run src/__tests__/AppPaneHeader.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R401`:

- Added `src/components/common/AppLinkCard.vue` as the shared card-styled `RouterLink` primitive for dashboard/module/widget-style navigation cards.
- Added `src/__tests__/AppLinkCard.spec.ts` for slot rendering, RouterLink target passthrough, route-location object passthrough, root attrs, and custom class passthrough.
- Migrated `ModuleLauncherCard.vue` to render its linked card shell through `AppLinkCard`.
- Preserved Job Dashboard module labels, detail copy, route destinations, `data-testid` values, hover styling, and real module-launch navigation through CSS-variable overrides.
- Updated the component architecture and testing strategy docs so `AppLinkCard` is tracked as started/covered and `ModuleLauncherCard` is documented as using it.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts --project=chromium`: passed, 1/1.
- `npm run test:unit -- --run src/__tests__/AppLinkCard.spec.ts src/__tests__/JobDashboardComponents.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-14 `R402`:

- Migrated uploaded attachment tiles in `ImageUploadPicker.vue` to render through `AppCard`.
- Preserved photo upload, preview, saved-file name/meta, description editing/blur commit, delete action, empty upload state, and daily-log attachment persistence through CSS-variable overrides.
- Updated the component architecture docs so `AppCard` tracks ImageUploadPicker uploaded attachment cards as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts --project=chromium`: passed, 4/4.
- `npm run test:unit -- --run src/__tests__/AppCard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R403`:

- Extended `AppSectionHeader.vue` with optional eyebrow rendering so compact card/section headers can share the same primitive without borrowing the larger pane header.
- Added `AppSectionHeader` unit coverage for eyebrow rendering.
- Migrated Daily Log card headers in `DailyLogSiteInfoCard.vue`, `DailyLogTextSectionCard.vue`, `DailyLogManpowerCard.vue`, `DailyLogIndoorClimateCard.vue`, `DailyLogAttachmentCard.vue`, `DailyLogRecipientsCard.vue`, `DailyLogHistoryList.vue`, and `DailyLogSelectedLogCard.vue` from `AppPaneHeader` to `AppSectionHeader`.
- Preserved Daily Log card eyebrow/title copy, delete-draft action placement, upload/description/delete behavior, recipient behavior, history selection, text entry, manpower rows, indoor climate rows, and mobile stacked header behavior through CSS-variable overrides.
- Updated the component architecture and testing strategy docs so `AppSectionHeader` tracks eyebrow support and Daily Log card headers as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/AppSectionHeader.spec.ts src/__tests__/DailyLogTextSectionCard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-14 `R404`:

- Migrated the Daily Log page-level header in `DailyLogPageHeader.vue` to render through `AppPaneHeader`.
- Preserved the Daily Logs eyebrow/title copy, Save Draft and Create Draft/New Draft button visibility, disabled-state logic, action placement, toolbar badges, past-date view-only notice, and mobile stacked behavior through CSS-variable overrides.
- Updated the component architecture docs so `AppPaneHeader` tracks the Daily Log page header as a current consumer.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/AppPaneHeader.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R405`:

- Extended `AppBadge.vue` with CSS-variable hooks for width, sizing, padding, typography, border radius, base colors, and tone-specific colors so feature badges can preserve existing visual contracts while using the shared primitive.
- Migrated Daily Log toolbar badges in `DailyLogPageHeader.vue` and history status badges in `DailyLogHistoryList.vue` to render through `AppBadge`.
- Preserved selected-log label, log-count/date label, saving-draft label, unsaved-changes warning label, history status labels, compact badge spacing, accent coloring, and warning coloring through CSS-variable overrides.
- Updated the component architecture and testing strategy docs so `AppBadge` tracks CSS-variable override support and Daily Log badge consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/AppBadge.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R406`:

- Extended `AppBadge.vue` with CSS-variable hooks for flex behavior and white-space so no-wrap feature badges can preserve existing layout contracts.
- Migrated Shop Order history status badges in `ShopOrderHistoryList.vue` and selected-order status/count badges in `ShopOrderSelectedOrderPanel.vue` to render through `AppBadge`.
- Preserved shop order status labels, item-count label, total-quantity label, compact pill sizing, no-wrap behavior, accent coloring, selected-order action layout, and history-row layout through CSS-variable overrides.
- Updated the component architecture and testing strategy docs so `AppBadge` tracks no-wrap/flex override support and Shop Order badge consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/AppBadge.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R407`:

- Migrated the Shop Catalog tree loading and no-match states in `ShopCatalogTreePane.vue` from raw one-off divs to `AppEmptyState`.
- Preserved the visible `Loading catalog...` and `No folders or items match your search.` copy, existing `catalog-pane__empty` styling, catalog search behavior, tree rendering, root-row behavior, context menus, inline create/rename behavior, and archive/delete workflows.
- Updated the component architecture docs so `AppEmptyState` tracks Shop Catalog empty/loading states as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium -g "shop catalog"`: passed, 2/2.
- `npm run test:unit -- --run src/__tests__/AppEmptyState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R408`:

- Extended `AppLoadingButton.vue` to support the `danger` variant so loading buttons can cover destructive pending actions with the same visual language as `AppButton`.
- Added `AppLoadingButton` unit coverage intent for the `danger` variant.
- Migrated Shop Catalog create-folder/create-item, folder/item save, and folder/item delete actions to render through `AppLoadingButton` in the create/detail panels.
- Preserved all visible create/save/delete labels, loading labels, submit button types, archive/restore plain button behavior, delete-disabled behavior, and the real create/edit/archive/delete shop catalog workflows.
- Updated the component architecture and testing strategy docs so `AppLoadingButton` tracks danger support and Shop Catalog loading-action consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium -g "shop catalog"`: passed, 2/2.
- `npm run test:unit -- --run src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R409`:

- Migrated Daily Log Save Draft, Create/Another Daily Log, and Delete Draft actions in `DailyLogPageHeader.vue` and `DailyLogSelectedLogCard.vue` to render through `AppLoadingButton`.
- Preserved all visible labels, loading labels, primary/danger variants, Save Draft disabled-state logic, create-draft pending behavior, delete-draft pending behavior, selected-log action placement, and the real Daily Log save/submit/new-draft workflows.
- Updated the component architecture docs so `AppLoadingButton` tracks Daily Log save/create/delete actions as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R410`:

- Migrated the Shop Order New Order action in `ShopOrderWorkspacePane.vue` to render through `AppLoadingButton`.
- Preserved the New Order label, `Creating...` loading label, primary variant, `shoporder-new-order` test id, create-order disabled behavior, create-order event, Submit Order plain-button behavior, and the real shop-order create/reset/submit workflows.
- Updated the component architecture docs so `AppLoadingButton` tracks the Shop Order create-order action as a current consumer.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R411`:

- Migrated the Daily Log Submit Daily Log action in `DailyLogsView.vue` to render through `AppLoadingButton`.
- Preserved the Submit Daily Log label, `Submitting...` loading label, success variant, submit-row styling, disabled behavior while the selected log cannot be edited/saving/submitting, and the real Daily Log submit validation/email/read-only workflows.
- Updated the component architecture docs so `AppLoadingButton` tracks the Daily Log submit action as a current consumer.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R412`:

- Migrated the Users and Employees delete actions in `UserEditorPanel.vue` and `EmployeeEditorPanel.vue` to render through `AppLoadingButton`.
- Preserved the Delete User/Delete Employee labels, `Deleting...` loading labels, danger variant, existing danger button classes, disabled behavior while saving/deleting, self-delete visibility guard, delete events, and the real admin delete confirmation workflows.
- Removed stale `AppButton` imports from both editor panels.
- Updated the component architecture docs so `AppLoadingButton` tracks Users and Employees delete actions as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts --project=chromium`: passed, 3/3.
- `npm run test:unit -- --run src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R413`:

- Migrated the Jobs archive/restore and delete actions in `JobsView.vue` to render through `AppLoadingButton`.
- Preserved the Archive Job/Restore Job dynamic label, `Updating...` loading label, Delete Job label, `Deleting...` loading label, danger variant for delete, disabled behavior while the archive/delete action is pending, confirmation dialog flow, and the real archive/restore/delete admin workflows.
- Updated the component architecture docs so `AppLoadingButton` tracks Jobs create/archive/delete actions as current consumers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R414`:

- Migrated the confirm action in `ConfirmDialog.vue` to render through `AppLoadingButton`.
- Preserved the configurable confirm label, `Working...` busy label, destructive danger variant, non-destructive primary variant, busy disabled behavior, cancel button behavior, backdrop/escape busy guard, and existing confirm event flow.
- Updated the component architecture docs so `AppLoadingButton` tracks `ConfirmDialog` confirm actions as a current consumer.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 9/9.
- `npm run test:unit -- --run src/__tests__/ConfirmDialog.spec.ts src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-14 `R415`:

- Moved the shared button-family stylesheet from `src/styles/button-family.css` to `src/components/common/button-family.css`.
- Imported the button-family stylesheet from `AppButton.vue`, `AppButtonLink.vue`, and `AppLoadingButton.vue`, then removed the global `button-family.css` import from `src/styles/main.css`.
- Preserved the existing `.app-button`, variant, disabled, hover, focus, and `.app-loading-button--loading` class contract so feature-level sizing overrides continue to work.
- Updated the component architecture, CSS architecture, and refactor gap audit docs so button-family ownership is tracked as component-owned instead of global.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/jobs.spec.ts e2e/admin-management.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 34/34.
- `npm run build`: blocked by environment. The run hit `spawn EPERM` in the `run-p` wrapper before the production build could start.
- `npm run build-only`: blocked by environment. The direct Vite build hit the known Windows/Vite `spawn EPERM` startup error while loading `vite.config.ts`; the unsandboxed rerun request was rejected.
- `npm run test:unit -- --run src/__tests__/AppButton.spec.ts src/__tests__/AppButtonLink.spec.ts src/__tests__/AppLoadingButton.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-14 `R416`:

- Extracted the remove-item, delete-draft, and submit confirmation dialog rendering from `ShopOrdersView.vue` into `ShopOrderConfirmDialogs.vue`.
- Preserved all dialog titles, messages, confirm labels, destructive flags, shared busy state, `v-model` open-state updates, and confirm event wiring while keeping parent-owned refs/actions in the route and existing shop-order composables.
- Added `src/__tests__/ShopOrderConfirmDialogs.spec.ts` for the grouped dialog contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderConfirmDialogs.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R417`:

- Extracted the Jobs archive/restore and delete confirmation dialog rendering from `JobsView.vue` into `JobConfirmDialogs.vue`.
- Preserved archive/restore title/message/confirm-label copy from the parent helper, Delete job copy, destructive delete intent, independent archive/delete busy states, parent-owned close guards, and confirm event wiring.
- Added `src/__tests__/JobConfirmDialogs.spec.ts` for the grouped dialog contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/JobConfirmDialogs.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R418`:

- Extracted the Jobs admin detail pane rendering from `JobsView.vue` into `JobAdminDetailPane.vue`.
- Preserved create-job form submission, create/edit field forwarding, assigned field-user search/toggle forwarding, all-jobs/global recipient editing, selected-job recipient editing, archive/restore/delete request buttons, save-status display, empty editor state, and parent-owned persistence/autosave/navigation behavior.
- Added `src/__tests__/JobAdminDetailPane.spec.ts` for the pane contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/JobAdminDetailPane.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R419`:

- Extracted the Daily Log delete-draft confirmation dialog rendering from `DailyLogsView.vue` into `DailyLogConfirmDialogs.vue`.
- Preserved delete-draft title, message, confirm label, destructive intent, busy state, close/open update event, and confirm event while keeping delete state and deletion logic in `useDailyLogActions` and the route.
- Added `src/__tests__/DailyLogConfirmDialogs.spec.ts` for the dialog grouping contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogConfirmDialogs.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R420`:

- Extracted the Users delete confirmation dialog rendering from `UsersView.vue` into `UserConfirmDialogs.vue`.
- Preserved delete-user title, parent-computed message, confirm label, destructive intent, busy state, close/open update event, and confirm event while keeping delete state and deletion logic in `useUserDetailActions` and the route.
- Added `src/__tests__/UserConfirmDialogs.spec.ts` for the dialog grouping contract and updated the component architecture and testing strategy docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/UserConfirmDialogs.spec.ts src/__tests__/EmployeeConfirmDialogs.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-14 `R421`:

- Extracted the Employees delete confirmation dialog rendering from `EmployeesView.vue` into `EmployeeConfirmDialogs.vue`.
- Preserved delete-employee title, parent-computed message, confirm label, destructive intent, busy state, close/open update event, and confirm event while keeping delete state and deletion logic in `useEmployeeActions` and the route.
- Added `src/__tests__/EmployeeConfirmDialogs.spec.ts` for the dialog grouping contract and updated the component architecture and testing strategy docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/UserConfirmDialogs.spec.ts src/__tests__/EmployeeConfirmDialogs.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-14 `R422`:

- Extracted the Shop Catalog dynamic confirmation dialog rendering from `ShopCatalogAdminView.vue` into `ShopCatalogConfirmDialog.vue`.
- Preserved dynamic title, message, confirm label, destructive/non-destructive state, busy state, close/open update event, and confirm event while keeping selected action state and archive/delete dispatch logic in the existing Shop Catalog composables and route.
- Added `src/__tests__/ShopCatalogConfirmDialog.spec.ts` for the dialog contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/ShopCatalogConfirmDialog.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R423`:

- Extracted the job Timecards and Timecard Export confirmation dialog rendering from `TimecardsView.vue` and `TimecardExportView.vue` into the shared `TimecardConfirmDialog.vue`.
- Preserved dynamic title, message, confirm label, destructive/non-destructive state, busy state, close/open update events, and confirm events while keeping selected action state and submit/delete dispatch logic in the existing timecard composables and routes.
- Added `src/__tests__/TimecardConfirmDialog.spec.ts` for the shared dialog contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardConfirmDialog.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R424`:

- Extracted the repeated job Timecards and Timecard Export page/workbook wrapper from `TimecardsView.vue` and `TimecardExportView.vue` into `TimecardWorkspaceShell.vue`.
- Preserved the existing page `data-testid` hooks, wrapper DOM shape, green-sheet background, spacing, border, and shared timecard toolbar CSS variables while keeping all workflow state, subscriptions, save queues, workbook rendering, and export actions in the existing routes/composables.
- Added `src/__tests__/TimecardWorkspaceShell.spec.ts` for the shell contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardWorkspaceShell.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R425`:

- Extracted the Daily Logs main form-column composition from `DailyLogsView.vue` into `DailyLogMainColumn.vue`.
- Preserved site-info, manpower, text sections, photo/PTP/QC attachments, submit button copy/disabled behavior, and the `dailylog-saved-*` E2E hooks while keeping draft save, save-on-blur, attachment upload/delete, repeater mutation, submit/email, selection, and recipient workflows in the existing route/composables.
- Added `src/__tests__/DailyLogMainColumn.spec.ts` for the main-column contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogMainColumn.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R426`:

- Extracted the Shop Orders two-pane explorer shell from `ShopOrdersView.vue` into `ShopOrderExplorerShell.vue`.
- Preserved the `shop-orders-page` test id, catalog/workspace pane placement, shop-order CSS variables, responsive grid sizing, pane min-size guards, and no-overflow page behavior while keeping catalog records, order records, draft creation, item mutation, autosave, selection, submission, and confirmation state in the existing route/composables.
- Added `src/__tests__/ShopOrderExplorerShell.spec.ts` for the shell contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderExplorerShell.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R427`:

- Extracted the Shop Catalog admin outer explorer shell from `ShopCatalogAdminView.vue` into `ShopCatalogExplorerShell.vue`.
- Preserved the `shop-catalog-page` test id, desktop two-pane grid, responsive mobile catalog/inspector state classes, mobile-nav slot, catalog/inspector pane placement, context-menu slot placement, and pane min-size guards while keeping catalog records, tree expansion, selection, drag/drop, inline create/rename, create/save/archive/delete, and confirmation state in the existing route/composables.
- Added `src/__tests__/ShopCatalogExplorerShell.spec.ts` for the shell contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/ShopCatalogExplorerShell.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R428`:

- Extracted the duplicated job Timecards and Timecard Export page-feedback rendering into `TimecardPageMessages.vue`.
- Preserved the route-level rule that errors render before informational messages, errors use alert tone/role through `TimecardPageMessage`, informational messages use status tone/role, and empty feedback renders nothing.
- Added `src/__tests__/TimecardPageMessages.spec.ts` for the shared feedback contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardPageMessages.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R429`:

- Extracted the duplicated custom-card field grid from `JobTimecardCreateTray.vue` and `TimecardExportCreateTray.vue` into `TimecardCustomCardFields.vue`.
- Preserved first name, last name, employee number, occupation, wage, contractor fields, disabled state, wage input attributes, and update events while keeping employee directory search/add, export job/foreman targeting, and add-card actions parent-owned.
- Added `src/__tests__/TimecardCustomCardFields.spec.ts` for the shared field-grid contract and updated the component architecture and testing strategy docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardCustomCardFields.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-14 `R430`:

- Extracted the duplicated employee search/list picker from `JobTimecardCreateTray.vue` and `TimecardExportCreateTray.vue` into `TimecardEmployeePicker.vue`.
- Preserved employee search updates, employee add events, loading and empty states, the job timecard `timecards-add-employee-*` E2E hooks, and separate search vs row disabled rules while keeping job/export create-card eligibility logic parent-owned.
- Added `src/__tests__/TimecardEmployeePicker.spec.ts` for the shared picker contract and updated the component architecture and testing strategy docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardEmployeePicker.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R431`:

- Extracted the repeated job Timecards and Timecard Export toolbar fieldset/legend/mobile panel wrapper into `TimecardToolbarPanel.vue`.
- Preserved toolbar panel ids, tabpanel roles, `aria-labelledby` wiring, mobile-active classes, route-specific collapse breakpoints, grid-area modifier classes, and the job toolbar status panel's mobile always-visible behavior while keeping every toolbar control and workflow event parent-owned.
- Added `src/__tests__/TimecardToolbarPanel.spec.ts` for the shared panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardToolbarPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R432`:

- Migrated the Timecard Export saved-weeks and status panels onto `TimecardToolbarPanel.vue`, then removed duplicated generic toolbar group/legend/desktop/mobile wrapper CSS from `JobTimecardToolbar.vue` and `TimecardExportToolbar.vue`.
- Preserved the export saved-weeks panel id, tabpanel role/label wiring, mobile active behavior, delete-draft workflow, status signal carousel behavior, status-panel mobile always-visible behavior, and parent-owned toolbar grid placement while making `TimecardToolbarPanel` the single owner of the shared wrapper styles.
- Extended `src/__tests__/TimecardToolbarPanel.spec.ts` so the panel contract includes custom root class passthrough used by specialized child panels, and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardToolbarPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R433`:

- Extracted the duplicated job Timecards and Timecard Export toolbar root shell into `TimecardToolbarShell.vue`.
- Preserved the job toolbar `header` semantic root, the export toolbar `section` semantic root, common toolbar surface styling, common base grid/padding, shared input/search CSS-variable contract, route-specific desktop stretch breakpoints, and parent-owned responsive grid-template/grid-area placement.
- Added `src/__tests__/TimecardToolbarShell.spec.ts` for the shared shell contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardToolbarShell.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R434`:

- Extracted the repeated inner toolbar utility styles from `JobTimecardToolbar.vue` and `TimecardExportToolbar.vue` into `src/components/timecards/timecard-toolbar-content.css`.
- Preserved lead-spacer sizing, label/search layout, stack/control spacing, matrix base layout, sort-stack spacing, status-grid placement, and each parent toolbar's route-specific responsive overrides, history/status display, and PrimeVue export control styling.
- Updated the component architecture, CSS architecture, and gap audit docs so the shared timecard toolbar content class contract is tracked as feature-owned instead of duplicated or global.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R435`:

- Extracted the repeated job Timecards and Timecard Export toolbar status pill styling into `src/components/timecards/TimecardToolbarSignal.vue`.
- Migrated `JobTimecardToolbar.vue` and `TimecardExportStatusBar.vue` to render status pills through the shared signal component while keeping parent-owned status text, tone decisions, mobile layout behavior, and the legacy `.timecards-signal` compatibility class used by current E2E contracts.
- Added `src/__tests__/TimecardToolbarSignal.spec.ts` for the shared signal contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardToolbarSignal.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R436`:

- Extracted the repeated Timecard Export PrimeVue `Select` control and overlay styling from `TimecardExportToolbar.vue` and `TimecardExportCreateTray.vue` into `src/components/timecards/timecard-primevue-select.css`.
- Preserved the existing select class names, overlay class names, placeholder styling, focus ring, disabled create-tray overrides, and parent-owned filter/create-target behavior while leaving `MultiSelect`-specific styling local to the export toolbar.
- Updated the component architecture, CSS architecture, and gap audit docs so shared Timecard Export select styling is tracked as feature-owned instead of duplicated in both export components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R437`:

- Extracted the repeated job Timecards and Timecard Export create-card tray shell styling into `src/components/timecards/timecard-create-tray.css`.
- Migrated `JobTimecardCreateTray.vue` and `TimecardExportCreateTray.vue` to import the shared tray stylesheet while preserving each tray's existing surface layout, panel sizing, input/search CSS variable contract, custom-card spacing, mobile one-column behavior, export-specific target fields, warnings, disabled select overrides, and parent-owned create-card workflows.
- Updated the component architecture, CSS architecture, and gap audit docs so create-tray shell styling is tracked as feature-owned instead of duplicated in both tray components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R438`:

- Migrated `TimecardCustomCardFields.vue` to import `src/components/timecards/timecard-toolbar-content.css` for the shared `timecards-toolbar__search` label/search layout instead of carrying a private duplicate.
- Preserved custom-card field props/events, disabled-state behavior, contractor checkbox styling, grid layout, and the shared job Timecards / Timecard Export create-card workflows.
- Updated the component architecture, CSS architecture, and gap audit docs so custom-card field label/search styling is tracked under the shared timecard toolbar content stylesheet.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardCustomCardFields.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R439`:

- Migrated `TimecardExportCreateTray.vue` to import `src/components/timecards/timecard-toolbar-content.css` for its shared `timecards-toolbar__search` target-field label layout instead of carrying another private duplicate.
- Preserved the export create-tray fieldset/panel semantics, Week Target job/foreman selectors, create-ready guards, warning/hint copy, PrimeVue `Select` styling, employee directory, custom-card fields, and parent-owned create-card workflow.
- Updated the component architecture, CSS architecture, and gap audit docs so export create-tray target-field styling is tracked under the shared timecard toolbar content stylesheet.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R440`:

- Moved the Timecard Export create-tray `timecards-toolbar__group` fieldset reset and `timecards-toolbar__legend` styling into `src/components/timecards/timecard-create-tray.css`.
- Preserved the existing export create-tray fieldset markup, panel sizing, Week Target/Employee Directory/Custom Card headings, target selectors, warning/hint copy, employee picker, custom-card form, and parent-owned create-card behavior.
- Updated the component architecture, CSS architecture, and gap audit docs so create-tray fieldset/legend styling is tracked under the shared create-tray stylesheet instead of a private component block.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R441`:

- Moved job/export create-tray heading, eyebrow, title, empty-state, and notice layout styling into `src/components/timecards/timecard-create-tray.css`.
- Removed the now-empty private style block from `JobTimecardCreateTray.vue` and preserved the existing export tray message/title markup, employee directory panel, custom-card panel, selectors, warnings, hints, and create-card events.
- Updated the component architecture and CSS architecture docs so create-tray headings and notices are tracked as shared feature stylesheet responsibilities.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R442`:

- Removed stale `timecards-create__field` disabled-state selectors from `TimecardExportCreateTray.vue` after confirming that class is no longer used in timecard components.
- Preserved the active PrimeVue `Select` disabled styling for the export create-tray job and foreman selectors.
- `rg -n "timecards-create__field" src\components\timecards`: no matches.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R443`:

- Extracted the Timecard Export create-tray Week Target selector markup into `src/components/timecards/TimecardExportTargetPanel.vue`.
- Preserved linked-job and foreman select options/values, target update events, disabled foreman select behavior, no-foreman warning copy, hint copy, shared PrimeVue `Select` styling, and parent-owned create-card readiness/action dispatch in `TimecardExportCreateTray.vue`.
- Added `src/__tests__/TimecardExportTargetPanel.spec.ts` for the target selector contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardExportTargetPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R444`:

- Hardened `src/components/timecards/timecard-create-tray.css` so shared create-tray panel and legend styles also apply inside extracted child panel components such as `TimecardExportTargetPanel.vue`, not only descendants directly inside a parent `.timecards-create` root.
- Preserved existing job create-tray and Timecard Export create-tray behavior while making the shared stylesheet safer for continued component extraction.
- Updated the component architecture and CSS architecture docs to record child-panel fieldset/legend support as a shared create-tray stylesheet responsibility.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-15 `R445`:

- Extracted the Timecard Export create-tray Employee Directory panel into `src/components/timecards/TimecardExportEmployeePanel.vue`.
- Preserved employee search state, employee list/loading state, search disabled behavior, add-employee disabled behavior, selected-employee add events, and parent-owned create-card readiness in `TimecardExportCreateTray.vue`.
- Added `src/__tests__/TimecardExportEmployeePanel.spec.ts` for the employee-directory panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardExportEmployeePanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R446`:

- Extracted the Timecard Export create-tray Custom Card panel into `src/components/timecards/TimecardExportCustomCardPanel.vue`.
- Preserved custom card field values, field update events, contractor toggle updates, disabled field state, primary add-button disabled state, add-card events, and parent-owned target readiness in `TimecardExportCreateTray.vue`.
- Added `src/__tests__/TimecardExportCustomCardPanel.spec.ts` for the custom-card panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardExportCustomCardPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R447`:

- Extracted the job Timecards create-tray Employee Directory panel into `src/components/timecards/JobTimecardEmployeePanel.vue`.
- Preserved employee search state, employee list/loading state, the job-page `timecards-add-employee-` row test-id prefix, shared disabled behavior, selected-employee add events, and parent-owned week edit state in `JobTimecardCreateTray.vue`.
- Extended `src/components/timecards/timecard-create-tray.css` so simple extracted child panels using only `timecards-create__panel` keep the shared tray panel surface.
- Added `src/__tests__/JobTimecardEmployeePanel.spec.ts` for the job employee-directory panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardEmployeePanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R448`:

- Extracted the job Timecards create-tray Custom Card panel into `src/components/timecards/JobTimecardCustomCardPanel.vue`.
- Preserved custom card field values, field update events, contractor toggle updates, disabled field/add-button state, primary add action, and parent-owned week edit state in `JobTimecardCreateTray.vue`.
- Added `src/__tests__/JobTimecardCustomCardPanel.spec.ts` for the job custom-card panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardCustomCardPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R449`:

- Extracted the Timecard Export toolbar Archive Filters panel into `src/components/timecards/TimecardExportArchiveFiltersPanel.vue`.
- Preserved job multi-select options/values, foreman and status select options/values, filter update events, mobile tabpanel state, and archive-specific `MultiSelect` styling while `TimecardExportToolbar.vue` keeps overall toolbar composition and filter state ownership.
- Added `src/__tests__/TimecardExportArchiveFiltersPanel.spec.ts` for the archive-filter panel contract and updated the component architecture, CSS architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardExportArchiveFiltersPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R450`:

- Extracted the Timecard Export toolbar Week Filters panel into `src/components/timecards/TimecardExportWeekFiltersPanel.vue`.
- Preserved week search, single/range date mode, week-ending/range date inputs, date picker open behavior, filter update events, mobile tabpanel state, and date-row layout while `TimecardExportToolbar.vue` keeps overall toolbar composition and filter state ownership.
- Added `src/__tests__/TimecardExportWeekFiltersPanel.spec.ts` for the week-filter panel contract and updated the component architecture, CSS architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardExportWeekFiltersPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R451`:

- Extracted the Timecard Export toolbar Sort Cards panel into `src/components/timecards/TimecardExportSortPanel.vue`.
- Preserved sort mode picker values/events, employee search values/events, mobile tabpanel state, and sort-panel spacing while `TimecardExportToolbar.vue` keeps overall toolbar composition and filter state ownership.
- Added `src/__tests__/TimecardExportSortPanel.spec.ts` for the sort-panel contract and updated the component architecture, CSS architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardExportSortPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R452`:

- Extracted the Timecard Export toolbar Workspace Actions panel into `src/components/timecards/TimecardExportActionsPanel.vue`.
- Preserved expand/compact all events, PDF/CSV export events, create-tray toggle copy/visibility/disabled state, mobile tabpanel state, and action button layout while `TimecardExportToolbar.vue` keeps overall toolbar composition and workflow dispatch ownership.
- Moved child-panel mobile matrix/spacer behavior into `src/components/timecards/timecard-toolbar-content.css` so extracted panels own the responsive layout they render.
- Added `src/__tests__/TimecardExportActionsPanel.spec.ts` for the actions-panel contract and updated the component architecture, CSS architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardExportActionsPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R453`:

- Extracted the job Timecards toolbar Week Filters panel into `src/components/timecards/JobTimecardWeekPanel.vue`.
- Preserved job number/name display fields, selected week-ending date value, week date input/picker events, mobile tabpanel state, and display-field styling while `JobTimecardToolbar.vue` keeps overall toolbar composition and week workflow ownership.
- Added `src/__tests__/JobTimecardWeekPanel.spec.ts` for the week-panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardWeekPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R454`:

- Extracted the job Timecards toolbar Card Filters panel into `src/components/timecards/JobTimecardSearchPanel.vue`.
- Preserved employee-search copy, current search value, search update events, mobile tabpanel state, and shared toolbar search styling while `JobTimecardToolbar.vue` keeps overall toolbar composition and filter state ownership.
- Added `src/__tests__/JobTimecardSearchPanel.spec.ts` for the search-panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardSearchPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R455`:

- Extracted the job Timecards toolbar Sort Cards panel into `src/components/timecards/JobTimecardSortPanel.vue`.
- Preserved selected sort mode, sort mode update events, sort action disabled rules, mobile tabpanel state, and sort action events while `JobTimecardToolbar.vue` keeps overall toolbar composition and sorting workflow ownership.
- Added `src/__tests__/JobTimecardSortPanel.spec.ts` for the sort-panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardSortPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R456`:

- Extracted the job Timecards toolbar Workspace Actions panel into `src/components/timecards/JobTimecardActionsPanel.vue`.
- Preserved create-week visibility/copy, create-card copy, submit/expand/compact actions, action disabled rules, mobile tabpanel state, and action events while `JobTimecardToolbar.vue` keeps overall toolbar composition and workflow dispatch ownership.
- Added `src/__tests__/JobTimecardActionsPanel.spec.ts` for the actions-panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardActionsPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R457`:

- Extracted the job Timecards toolbar Saved Weeks panel into `src/components/timecards/JobTimecardSavedWeeksPanel.vue`.
- Preserved recent-week date/status rows, active week styling, no-saved-weeks empty state, row test ids, mobile tabpanel state, and week-selection events while `JobTimecardToolbar.vue` keeps overall toolbar composition and selected-week ownership.
- Added `src/__tests__/JobTimecardSavedWeeksPanel.spec.ts` for the saved-weeks panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardSavedWeeksPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R458`:

- Extracted the job Timecards toolbar Status panel into `src/components/timecards/JobTimecardStatusBar.vue`.
- Preserved week-range, week-status, card-count, and save-state signals plus submitted success tone, save-error error tone, and mobile status-strip layout while `JobTimecardToolbar.vue` keeps overall toolbar composition and status value ownership.
- Added `src/__tests__/JobTimecardStatusBar.spec.ts` for the status-panel contract and updated the component architecture, testing strategy, and gap audit docs.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardStatusBar.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R459`:

- Moved job-toolbar child-panel responsive ownership into the extracted panels: `JobTimecardActionsPanel.vue` now owns the job-specific two-column action matrix between tablet and phone widths, and `JobTimecardSearchPanel.vue` owns its compact search-label gap.
- Removed stale child-internal responsive selectors from `JobTimecardToolbar.vue`, leaving the parent toolbar responsible for route-level grid placement while child panels own the internals they render.
- Updated the component architecture and CSS architecture docs to clarify the split between shared timecard toolbar content utilities, child-panel internal responsive overrides, and parent toolbar grid placement.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-15 `R460`:

- Added focused component coverage for the job Timecards and Timecard Export create-tray composer components: `src/__tests__/JobTimecardCreateTray.spec.ts` and `src/__tests__/TimecardExportCreateTray.spec.ts`.
- Protected child-panel prop forwarding, disabled/read-only/loading forwarding, employee/custom-card event forwarding, Timecard Export notice-only rendering, and Timecard Export target readiness/add-disabled rules while keeping workflow ownership in the route components.
- Updated the component architecture, testing strategy, and gap audit docs so the create-tray composer contracts are tracked alongside their child panels.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/JobTimecardCreateTray.spec.ts src/__tests__/TimecardExportCreateTray.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R461`:

- Added focused component coverage for the Timecard Export saved-weeks and status panels: `src/__tests__/TimecardExportSavedWeeksPanel.spec.ts` and `src/__tests__/TimecardExportStatusBar.spec.ts`.
- Protected saved-week row formatting, subtitles, draft/submitted labels, delete-draft permission/loading rules, delete events, empty/loading copy, status signal tone passthrough, and mobile carousel control disabled state.
- Updated the component architecture, testing strategy, and gap audit docs so Timecard Export saved-week/status panel contracts are tracked alongside the other extracted toolbar panels.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardExportSavedWeeksPanel.spec.ts src/__tests__/TimecardExportStatusBar.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R462`:

- Added focused component coverage for shared timecard primitives: `src/__tests__/TimecardButton.spec.ts`, `src/__tests__/TimecardToolbarTabs.spec.ts`, and `src/__tests__/TimecardSortModePicker.spec.ts`.
- Protected timecard action button type/variant/attribute passthrough, mobile tablist ARIA id/control wiring and selected-tab events, and Employee#/Name sort-mode radio checked/update behavior.
- Updated the component architecture and testing strategy docs so these shared primitives are tracked as directly covered contracts instead of only through parent panel tests.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardButton.spec.ts src/__tests__/TimecardToolbarTabs.spec.ts src/__tests__/TimecardSortModePicker.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R463`:

- Added focused component coverage for the shared `TimecardSummaryPanel` used by job Timecards and Timecard Export: `src/__tests__/TimecardSummaryPanel.spec.ts`.
- Protected parent-owned total rendering with one-decimal formatting, account summary table headers/rows, missing job/area/account dash fallbacks, and the empty account-total row.
- Updated the component architecture and testing strategy docs so the shared summary panel is tracked as a directly covered contract.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardSummaryPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R464`:

- Added focused component coverage for the job Timecards and Timecard Export canvas composers: `src/__tests__/JobTimecardCanvasPanel.spec.ts` and `src/__tests__/TimecardExportCanvasPanel.spec.ts`.
- Protected route-specific canvas header metadata, card id/test-id/style/footer rules, workbook prop forwarding, employee-header lock/read-only rules, edit/lock/delete controls, workbook change events, delete events, and measurement event/callback wiring while leaving the shared canvas shell and workbook grid untouched.
- Updated the component architecture and testing strategy docs so the route-specific canvas composer contracts are tracked alongside the shared `TimecardCanvasPanel`.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/JobTimecardCanvasPanel.spec.ts src/__tests__/TimecardExportCanvasPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R465`:

- Added focused component coverage for the shared `TimecardPageMessage` primitive: `src/__tests__/TimecardPageMessage.spec.ts`.
- Protected default status rendering, error alert rendering, error tone class behavior, and empty-message no-markup behavior while `TimecardPageMessages` and the route views keep message priority/state ownership.
- Updated the component architecture and testing strategy docs so the message primitive is tracked separately from the wrapper component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/TimecardPageMessage.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R466`:

- Added focused component coverage for the Daily Log history/date-search list: `src/__tests__/DailyLogHistoryList.spec.ts`.
- Protected loading and empty states, submitted/draft row labels, active selected-log styling, unknown-foreman fallback copy, date-search update events, Today navigation events, Today disabled state, and selected-log events while the route keeps selected-date/log and intentional draft-creation ownership.
- Updated the component architecture and testing strategy docs so `DailyLogHistoryList` is tracked as an extracted, covered component instead of future work.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogHistoryList.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R467`:

- Added focused component coverage for the Daily Log selected-log/sidebar seam: `src/__tests__/DailyLogSelectedLogCard.spec.ts` and `src/__tests__/DailyLogSidebar.spec.ts`.
- Protected selected-log summary metadata, draft delete visibility/events, delete busy-state copy/locking, no-selection empty copy, missing foreman/timestamp fallbacks, sidebar selected-log/recipient/history composition, recipient visibility only when a log is selected, and parent-owned event forwarding for delete, recipients, history selection, Today navigation, and date changes.
- Updated the component architecture and testing strategy docs so `DailyLogSidebar`, `DailyLogSelectedLogCard`, and `DailyLogRecipientsCard` are tracked as current extracted components with covered sidebar behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogHistoryList.spec.ts src/__tests__/DailyLogSelectedLogCard.spec.ts src/__tests__/DailyLogSidebar.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R468`:

- Added focused component coverage for the Daily Log editable table cards: `src/__tests__/DailyLogManpowerCard.spec.ts` and `src/__tests__/DailyLogIndoorClimateCard.spec.ts`.
- Protected schema-driven table headers/placeholders, current row values, add/remove row events, field update events, manpower count numeric conversion including blank input preservation, and parent-owned read-only disabled-state propagation across inputs and row actions.
- Updated the testing strategy docs so the Daily Log manpower and indoor-climate table-card contracts are tracked as directly covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogManpowerCard.spec.ts src/__tests__/DailyLogIndoorClimateCard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R469`:

- Added focused component coverage for the Daily Log site-info and recipient cards: `src/__tests__/DailyLogSiteInfoCard.spec.ts` and `src/__tests__/DailyLogRecipientsCard.spec.ts`.
- Protected schema-driven site-info label/value rendering, blank-value dash fallback, parent-owned field-list narrowing, admin-default recipient read-only wiring, additional-recipient disabled rules when read-only/saving, and additional-recipient input/add/remove event forwarding.
- Updated the testing strategy docs so the Daily Log display/recipient card contracts are tracked as directly covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogSiteInfoCard.spec.ts src/__tests__/DailyLogRecipientsCard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R470`:

- Added focused component coverage for the Daily Log attachment card wrappers: `src/__tests__/DailyLogAttachmentCard.spec.ts` and `src/__tests__/DailyLogAttachmentSections.spec.ts`.
- Protected upload-picker configuration/state passthrough, upload-handler passthrough, description update/commit/remove event forwarding, Photos/PTP title/label/helper copy, attachment count forwarding, disabled-state forwarding, and independent Photos/PTP busy-state wiring.
- Updated the testing strategy docs so the Daily Log attachment card contracts are tracked as directly covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogAttachmentCard.spec.ts src/__tests__/DailyLogAttachmentSections.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R471`:

- Added focused component coverage for the Daily Log page header: `src/__tests__/DailyLogPageHeader.spec.ts`.
- Protected title and toolbar badge rendering, Save Draft/Create Draft action visibility and events, save-button disabled rules while submitting/deleting/no unsaved changes, loading labels and `aria-busy` states, saving-badge priority over unsaved-copy, log-count selected-date copy, and past/future date view-only guidance.
- Updated the testing strategy docs so the Daily Log page-header contract is tracked as directly covered.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/DailyLogPageHeader.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R472`:

- Added focused component coverage for the Shop Order history/selected-order display seam: `src/__tests__/ShopOrderHistoryList.spec.ts` and `src/__tests__/ShopOrderSelectedOrderPanel.spec.ts`.
- Protected history empty state, order number fallbacks, draft/submitted display labels, item counts, delivery-date/no-delivery metadata, active history selection, selected-order badges, editable delivery/comments/Thursday shortcut events, read-only submitted controls, submitted metadata, and missing delivery/comment/owner fallbacks.
- Updated the component architecture and testing strategy docs so `ShopOrderHistoryList` and `ShopOrderSelectedOrderPanel` are tracked as directly covered components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/ShopOrderHistoryList.spec.ts src/__tests__/ShopOrderSelectedOrderPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R473`:

- Added focused component coverage for user-management admin panels: `src/__tests__/UserDirectoryPanel.spec.ts` and `src/__tests__/UserAssignedJobsPanel.spec.ts`.
- Protected pending-invite summary/actions, user search/status filters, role/status/invite badges, selected-row state, create/invite/selection events, invite loading/disabled states, assigned-job selected counts, assigned-job search/toggle events, checked-state binding, job name/code fallbacks, disabled-state propagation, and loading/empty states.
- Updated the component architecture and testing strategy docs so `UserDirectoryPanel` and `UserAssignedJobsPanel` are tracked as directly covered user-management components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/UserDirectoryPanel.spec.ts src/__tests__/UserAssignedJobsPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R474`:

- Added focused component coverage for the Users editor panel: `src/__tests__/UserEditorPanel.spec.ts`.
- Protected create/edit/no-selection rendering, create text/role/assigned-job/input actions, create-without-invite and create-with-invite events, create-action loading locks, selected-user badges, detail text/role/active/assigned-job/delete/submit events, self-edit lockout for role/active/delete, save-loading disabled behavior, non-assignable role hiding for assigned jobs, save-status rendering, and no-selection guidance.
- Updated the component architecture and testing strategy docs so `UserEditorPanel` is tracked as a directly covered user-management component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/UserEditorPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R475`:

- Added focused component coverage for employee-management admin panels: `src/__tests__/EmployeeDirectoryPanel.spec.ts` and `src/__tests__/EmployeeEditorPanel.spec.ts`.
- Protected employee search/status filters, create-mode selection, employee row display fallbacks, type/status badges, create/select events, create/detail form field events, active/contractor toggle events, blur-save signaling, delete/submit/back events, create/save/delete loading locks, save-status rendering, and loading/empty states.
- Updated the component architecture and testing strategy docs so `EmployeeDirectoryPanel` and `EmployeeEditorPanel` are tracked as directly covered employee-management components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/EmployeeDirectoryPanel.spec.ts src/__tests__/EmployeeEditorPanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R476`:

- Added focused component coverage for Shop Catalog admin navigation and filtering: `src/__tests__/ShopCatalogNavigation.spec.ts`.
- Protected catalog search value/update events, archived visibility toggle state/events, mobile Catalog/Inspector tab active state and navigation events, tablist accessibility labels, and the shared Shop Catalog admin heading.
- Updated the component architecture and testing strategy docs so `ShopCatalogMobileNav`, `ShopCatalogTreeFilters`, and `ShopCatalogTreeHeader` are tracked as directly covered Shop Catalog admin components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/ShopCatalogNavigation.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R477`:

- Added focused component coverage for Shop Catalog admin root/create inspector panels: `src/__tests__/ShopCatalogInspectorPanels.spec.ts`.
- Protected root overview counts/action guidance, create-folder name/parent/active/submit events, create-item description/folder/SKU/price/active/submit events, top-level parent/category null conversion, price input/focus/blur forwarding, and create-loading action locks.
- Updated the component architecture and testing strategy docs so `ShopCatalogRootInspector`, `ShopCatalogCreateCategoryPanel`, and `ShopCatalogCreateItemPanel` are tracked as directly covered Shop Catalog admin components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/ShopCatalogInspectorPanels.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R478`:

- Extended Shop Catalog inspector coverage to the selected folder/item detail panels in `src/__tests__/ShopCatalogInspectorPanels.spec.ts`.
- Protected selected-folder name/parent/active/summary rendering, save/archive/delete events, archive-vs-restore folder labels, save/delete loading locks, child-protected delete disabling, selected-item description/SKU/price/active/path metadata, price input/focus/blur forwarding, item save/archive/delete events, archive-vs-restore item labels, and item save/delete loading locks.
- Updated the component architecture and testing strategy docs so `ShopCatalogCategoryDetailPanel` and `ShopCatalogItemDetailPanel` are tracked as directly covered Shop Catalog admin components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/ShopCatalogInspectorPanels.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R479`:

- Added focused component coverage for Shop Catalog tree rows and context-menu primitives: `src/__tests__/ShopCatalogTreeComponents.spec.ts`.
- Protected context-menu visibility, fixed positioning, enabled/danger/disabled action behavior, root Top Level row active/drop-target/summary/toggle/event forwarding, category row active/drag/drop/archive/summary/toggle state, item row non-category behavior, and inline create/rename update/commit/cancel event forwarding.
- Updated the component architecture and testing strategy docs so `ShopCatalogContextMenu`, `ShopCatalogTreeRootRow`, and `ShopCatalogTreeNodeRow` are tracked as directly covered Shop Catalog admin components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/ShopCatalogTreeComponents.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R480`:

- Added focused component coverage for the Shop Catalog inspector switchboard: `src/__tests__/ShopCatalogInspectorPane.spec.ts`.
- Protected root/create-folder/create-item/selected-folder/selected-item branch selection, mobile hidden class, child prop forwarding, create/detail field events, price input/focus/blur events, archive/delete events, and submit event forwarding.
- Updated the component architecture and testing strategy docs so `ShopCatalogInspectorPane` is tracked as a directly covered Shop Catalog admin component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/ShopCatalogInspectorPane.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R481`:

- Added focused component coverage for the Shop Catalog tree-pane composition layer: `src/__tests__/ShopCatalogTreePane.spec.ts`.
- Protected heading/filter rendering, filter update events, list-ref wiring, loading/drop-target/empty states, root row prop derivation, node row active/drag/drop/create/rename/draggable prop derivation, root surface/list/root-bucket event forwarding, and node event forwarding with owning node payloads.
- Updated the component architecture and testing strategy docs so `ShopCatalogTreePane` is tracked as a directly covered Shop Catalog admin component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/ShopCatalogTreePane.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R482`:

- Added focused component coverage for the interactive timecard workbook header/footer seam: `src/__tests__/TimecardWorkbookHeaderFooter.spec.ts`.
- Protected locked employee header rendering, editable employee identity field events, wage key filtering/update/commit events, read-only header locking, footer job/account/office/amount/notes rendering, OT/REG display, footer field update events, and read-only footer locking.
- Updated the component architecture and testing strategy docs so `TimecardWorkbookHeader` and `TimecardWorkbookFooter` are tracked as directly covered timecard components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/TimecardWorkbookHeaderFooter.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R483`:

- Added focused component coverage for the job Timecards toolbar composition seam: `src/__tests__/JobTimecardToolbar.spec.ts`.
- Protected mobile tab definitions/state, child-panel mobile-active derivation, route-owned week/search/action/sort/history/status state forwarding, and week/search/action/sort/history event forwarding.
- Updated the component architecture and testing strategy docs so `JobTimecardToolbar` is tracked as a directly covered timecard composition component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/JobTimecardToolbar.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R484`:

- Added focused component coverage for the Timecard Export toolbar composition seam: `src/__tests__/TimecardExportToolbar.spec.ts`.
- Protected tab definitions/state, child-panel mobile-active derivation, route-owned filter/action/saved-week/status state forwarding, saved-week formatter forwarding, and filter/sort/export/create/delete event forwarding.
- Updated the component architecture and testing strategy docs so `TimecardExportToolbar` is tracked as a directly covered timecard composition component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.
- `npm run test:unit -- --run src/__tests__/TimecardExportToolbar.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R485`:

- Added focused component coverage for the shared Daily Log image upload primitive: `src/__tests__/ImageUploadPicker.spec.ts`.
- Protected PrimeVue upload prop wiring, choose callback behavior, upload-handler entry normalization, disabled/busy upload suppression, uploader clearing, local upload error display/clear, saved attachment description/commit/remove events, preview lightbox behavior, and busy-state control locking.
- Updated the component architecture and testing strategy docs so `ImageUploadPicker` is tracked as a directly covered shared component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/ImageUploadPicker.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R486`:

- Added focused component coverage for remaining foundational presentation primitives: `src/__tests__/FoundationalComponents.spec.ts`.
- Protected `AuthCard` accessible heading/copy/slot rendering, optional auth copy suppression, `PagePanel` `AppPaneHeader` prop forwarding/body slot rendering, and `ModulePlaceholder` hero/highlight rendering.
- Updated the component architecture and testing strategy docs so `AuthCard`, `PagePanel`, and `ModulePlaceholder` are tracked as directly covered foundational components.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/job-dashboard.spec.ts --project=chromium`: passed, 7/7.
- `npm run test:unit -- --run src/__tests__/FoundationalComponents.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R487`:

- Added focused component coverage for the exact-print timecard card: `src/__tests__/TimecardPrintCard.spec.ts`.
- Protected printable employee header/week-ending rendering, workbook column headers, H/P/C row values, calculated line and total hours, footer account rows, notes, regular/overtime values, and blank zero-only production/off cells.
- Updated the component architecture and testing strategy docs so `TimecardPrintCard` is tracked as a directly covered exact-print component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.
- `npm run test:unit -- --run src/__tests__/TimecardPrintCard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R488`:

- Added focused component coverage for the interactive timecard workbook card: `src/__tests__/TimecardWorkbookCard.spec.ts`.
- Protected employee header/grid/footer rendering, workbook column headers, H/P/C row labels, line/account/day/off field updates, job-number cascade behavior, numeric draft preservation through blur, read-only input locking, and compact header-only mode.
- Updated the component architecture and testing strategy docs so `TimecardWorkbookCard` is tracked as a directly covered exact-workbook component.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/TimecardWorkbookCard.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R489`:

- Added focused composable coverage for Daily Log draft saving: `src/__tests__/useDailyLogDraftSave.spec.ts`.
- Protected dirty snapshot tracking, explicit full-draft saves, text-field save-on-blur payloads, unchanged/read-only/missing-log no-op guards, QC legacy snapshot alignment, and failed-save preservation of local typed text.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogDraftSave` is tracked as the covered owner of Daily Log dirty/save-on-blur behavior instead of an open extraction target.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 10/10.
- `npm run test:unit -- --run src/__tests__/useDailyLogDraftSave.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R490`:

- Added focused composable/helper coverage for Daily Log view-first selection state: `src/__tests__/dailyLogSelectionState.spec.ts`.
- Protected user-visible log filtering, preferred-log fallback order, today-only draft edit permissions, explicit create-another-log permission, "Another Daily Log" labeling, Daily Logs title derivation, and job/form/selected-log site-info fallback rules.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogSelectionState` is tracked as the covered owner of Daily Log selection/view-first derivations while the route still owns remaining workspace orchestration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 9/9.
- `npm run test:unit -- --run src/__tests__/dailyLogSelectionState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R491`:

- Added focused composable coverage for Shop Order workspace derived state: `src/__tests__/useShopOrderWorkspaceState.spec.ts`.
- Protected selected-order lookup, draft/submitted grouping, submitted/read-only state, missing-selection empty state, job-context and action-loading disabled rules, category lookup, item counts, total quantity, and alphabetized selected-order item derivation.
- Updated the component architecture, testing strategy, and gap-audit docs so `useShopOrderWorkspaceState` is tracked as the covered owner of Shop Order workspace derived state while the route still owns persistence and submit orchestration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderWorkspaceState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R492`:

- Added focused composable coverage for Shop Order selected-order metadata state: `src/__tests__/useShopOrderMetaForm.spec.ts`.
- Protected selected-order metadata hydration, empty/default reset behavior, stale remote echo protection while local comments/delivery date are dirty, delivery-date validation, successful-save signature updates, debounced metadata saves, read-only queue suppression, and next-Thursday shortcut behavior.
- Updated the component architecture, testing strategy, and gap-audit docs so `useShopOrderMetaForm` is tracked as the covered owner of Shop Order selected-order metadata/autosave behavior while the route still owns draft creation, item persistence, history selection, and submit orchestration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderMetaForm.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R493`:

- Added focused composable coverage for Shop Order item mutation behavior: `src/__tests__/useShopOrderItemActions.spec.ts`.
- Protected catalog item add/merge behavior, category-path descriptions, quantity normalization, custom item validation/trimming/reset, failed-save preservation of custom item input, draft-only quantity edits, and remove-confirm item filtering/close behavior.
- Updated the component architecture, testing strategy, and gap-audit docs so `useShopOrderItemActions` is tracked as the covered owner of catalog/custom item mutation behavior while the route still owns draft creation, the item persistence callback, history selection, and submit orchestration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderItemActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R494`:

- Added focused composable coverage for Shop Order draft create/target behavior: `src/__tests__/useShopOrderDraftActions.spec.ts`.
- Protected job/date validation before draft creation, create payloads with job and foreman context, selection of newly created drafts, selected draft target reuse, existing draft target fallback from submitted history, clone-before-mutate item targets, no-target messaging, duplicate draft prevention, and next-Thursday defaults.
- Updated the component architecture, testing strategy, and gap-audit docs so `useShopOrderDraftActions` is tracked as the covered owner of draft creation/targeting behavior while the route still owns the item persistence callback, history selection, and submit orchestration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderDraftActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R495`:

- Added focused composable coverage for Shop Order persistence behavior: `src/__tests__/useShopOrderPersistence.spec.ts`.
- Protected metadata update payloads and actor forwarding, metadata failure messaging/loading cleanup, sorted selected-item cloning, optimistic item replacement, rollback on failed item persistence, serialized item-save queueing, loading state while queued saves are active, and no-order guard messaging.
- Updated the component architecture, testing strategy, and gap-audit docs so `useShopOrderPersistence` is tracked as the covered owner of metadata/item persistence behavior while the route still owns history selection and submit orchestration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderPersistence.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R496`:

- Added focused composable coverage for Shop Order submit/delete orchestration: `src/__tests__/useShopOrderSubmissionActions.spec.ts`.
- Protected delete-button delegation, draft delete confirmation behavior, delete failure handling, submit precondition validation, metadata-save-before-confirm behavior, read-only guards, submitted status update payloads, email send calls, partial email-failure reporting, dialog close behavior, and loading-state cleanup.
- Updated the component architecture, testing strategy, and gap-audit docs so `useShopOrderSubmissionActions` is tracked as the covered owner of submit/delete orchestration while the route still owns history selection and composable wiring.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderSubmissionActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R497`:

- Added focused composable coverage for Shop Order selection/history synchronization: `src/__tests__/useShopOrderSelectionSync.spec.ts`.
- Protected first-order fallback selection, preserving current selections while they still exist, fallback/null reset when selections disappear, selected-order change resets for metadata timers and note drafts, forced note-draft sync on order changes, same-order remote hydration decisions, dirty metadata hydration skips, and metadata form save queueing.
- Updated the component architecture, testing strategy, and gap-audit docs so `useShopOrderSelectionSync` is tracked as the covered owner of Shop Order selection/history synchronization while the route mostly wires composables and renders the page shell.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderSelectionSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R498`:

- Added focused composable coverage for Shop Order subscription lifecycle behavior: `src/__tests__/useShopOrderSubscriptionLifecycle.spec.ts`.
- Protected mount-time route-job/catalog/order subscription starts, null-job order-subscription guards, route-job change resubscription with metadata timer and item-note draft cleanup, null route-change no-ops, and unmount cleanup for catalog, order, and route-job subscriptions.
- Updated the component architecture, testing strategy, and gap-audit docs so `useShopOrderSubscriptionLifecycle` is tracked as the covered owner of Shop Order subscription lifecycle behavior while the route mostly wires composables and renders the page shell.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderSubscriptionLifecycle.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R499`:

- Added focused composable coverage for Daily Log create/save/submit/delete workflows: `src/__tests__/useDailyLogActions.spec.ts`.
- Protected explicit draft creation with job/user/date guards, existing user-draft reuse, draft save status messages, submit permission and required-field validation, submitted status update payloads, saved-payload snapshots, email success/skip/failure reporting, delete-confirm opening, attachment cleanup before draft deletion, draft selection clearing, delete failure handling, and loading flag cleanup.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogActions` is tracked as the covered owner of Daily Log action workflows while the route still wires date navigation, attachments, recipients, subscriptions, and form hydration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R500`:

- Added focused composable coverage for Daily Log date/job navigation behavior: `src/__tests__/useDailyLogDateNavigation.spec.ts`.
- Protected selected-log/log-list/form reset on date changes, reset-to-today action behavior, job-change log subscription cleanup and route/log resubscription, empty/unchanged job guards, and the duplicate-subscription prevention path when a job change also resets the selected date to today.
- Tightened `useDailyLogDateNavigation` so the job-change watcher does not allow the selected-date watcher to perform a duplicate log reset/subscription for the same job-change date reset.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogDateNavigation` is tracked as the covered owner of Daily Log date/job navigation while the route still wires attachments, recipients, subscriptions, and form hydration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogDateNavigation.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R501`:

- Added focused composable coverage for Daily Log manpower and indoor-climate repeater behavior: `src/__tests__/useDailyLogRepeaters.spec.ts`.
- Protected manpower row add/remove/update behavior, current-user attribution on new manpower rows, blank count draft preservation while typing, added-by reset semantics, last-row reset behavior, indoor-climate row add/remove/update behavior, read-only guards, and missing-index no-ops.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogRepeaters` is tracked as the covered owner of Daily Log repeater behavior while the route still wires attachments, recipients, subscriptions, and form hydration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogRepeaters.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R502`:

- Added focused composable coverage for Daily Log recipient persistence behavior: `src/__tests__/useDailyLogRecipients.spec.ts`.
- Protected admin/default recipient derivation from global, job, and legacy job recipients; additional-recipient filtering; empty/invalid/duplicate add validation; normalized add/remove persistence payloads; local selected-log recipient updates; read-only/no-selection guards; and failed-save busy-state cleanup.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogRecipients` is tracked as the covered owner of Daily Log recipient persistence while the route still wires attachments, subscriptions, and form hydration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogRecipients.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R503`:

- Added focused composable coverage for Daily Log attachment persistence behavior: `src/__tests__/useDailyLogAttachments.spec.ts`.
- Protected attachment section grouping, local description updates, upload guards for missing/read-only drafts, empty upload no-ops, image/type and 10 MB validation, photo/PTP/QC upload wrapper payloads, Storage upload/delete coordination, prepared draft payload persistence, saved-payload snapshot refreshes, section busy flags, delete no-op guards, and failed-delete preservation of local attachments.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogAttachments` is tracked as the covered owner of Daily Log attachment persistence while the route still wires attachment UI events, subscriptions, and form hydration.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogAttachments.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R504`:

- Added focused composable coverage for Daily Log form hydration behavior: `src/__tests__/useDailyLogFormHydration.spec.ts`.
- Protected selected-log mount hydration, empty-form reset when no log is selected, recipient input clearing on selection changes, selected-log change hydration, clean same-log remote update hydration, unsaved local edit protection, saved-echo skips, and editable-only job/user snapshot field refreshes.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogFormHydration` is tracked as the covered owner of Daily Log form hydration while the route still wires attachment UI events and subscriptions.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogFormHydration.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R505`:

- Added focused composable coverage for Daily Log subscription behavior: `src/__tests__/useDailyLogSubscriptions.spec.ts`.
- Protected global recipient default subscription start/stop behavior, recipient default update/error handling, selected job/date log subscription calls, no-job subscription guards, visible-log selection recovery for foremen, all-log viewer selection preservation, empty visible-log selection clearing, and log subscription error state.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogSubscriptions` is tracked as the covered owner of Daily Log subscription behavior while the route still wires attachment UI events and subscription lifecycle startup/cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogSubscriptions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R506`:

- Added focused composable coverage for Daily Log subscription lifecycle behavior: `src/__tests__/useDailyLogSubscriptionLifecycle.spec.ts`.
- Protected mount-time recipient default startup, route-job and selected-date log startup when a job id is present, no-job startup guards, the non-watch behavior that leaves later route-job changes to date navigation, and unmount cleanup for log, recipient-default, and route-job subscriptions.
- Updated the component architecture, testing strategy, and gap-audit docs so `useDailyLogSubscriptionLifecycle` is tracked as the covered owner of Daily Log subscription lifecycle while the route mostly wires page composition and attachment UI events.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogSubscriptionLifecycle.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R507`:

- Added focused composable coverage for job Timecard week-selection behavior: `src/__tests__/useJobTimecardWeekSelectionActions.spec.ts`.
- Protected selected-week switching after pending saves flush, same-week no-op behavior, typed week-ending normalization to Saturday, explicit selected-week clearing for typed dates, blank date clearing, create-tray closing, and safe native date-picker opening for supported and unsupported browser targets.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardWeekSelectionActions` is tracked as the covered owner of job Timecard week selection/input behavior while the route still coordinates week/card creation, workbook coordination, submit flow, sorting, and error states.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardWeekSelectionActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R508`:

- Added focused composable coverage for job Timecard card-creation behavior: `src/__tests__/useJobTimecardCreateActions.spec.ts`.
- Protected employee-card creation even when the same employee already has a card for the week, selected-week/edit guards, employee-card payloads, next sort-index selection, success-side effects for card selection/search reset/create-tray close/scrolling, employee-create failures, custom-card required-field validation, manager-only wage validation, custom-card payloads and wage parsing, custom-card reset/close/select/scroll success behavior, and custom-create failures.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardCreateActions` is tracked as the covered owner of job Timecard employee/custom card creation while the route still coordinates week lifecycle, workbook coordination, submit flow, sorting, and error states.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardCreateActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R509`:

- Added focused composable coverage for job Timecard week lifecycle behavior: `src/__tests__/useJobTimecardWeekActions.spec.ts`.
- Protected create-week validation, existing-week selection without duplicate creates, pending-save flush before new week creation, create-tray closing, ensure payload construction, duplicate in-flight guards, create failure retry cleanup, automatic empty-draft backfill, and submitted/populated/loading/unselected backfill no-ops.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardWeekActions` is tracked as the covered owner of job Timecard create/open week orchestration and empty-draft backfill while the route still coordinates workbook coordination, submit flow, sorting, and error states.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardWeekActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R510`:

- Added focused composable coverage for job Timecard card action behavior: `src/__tests__/useJobTimecardCardActions.spec.ts`.
- Protected delete confirmation payloads, delete persistence after selecting the card and flushing pending saves, delete failure cleanup, last-name sort persistence and sort-index mutation, sort no-op guards, sort failure cleanup, submit confirmation payloads, submit actor/email-result handling, fallback submit success copy, submit failure cleanup, and shared confirmation dispatch.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardCardActions` is tracked as the covered owner of job Timecard delete/sort/submit action orchestration while the route still coordinates workbook coordination, subscriptions, save queue wiring, and page-level composition.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardCardActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R511`:

- Added focused composable coverage for job Timecard card workspace behavior: `src/__tests__/useJobTimecardCardWorkspaceActions.spec.ts`.
- Protected workspace reset cleanup, page/save message reset, visible-card id pruning for save queues and measurements, read-only derivation, scroll-to-card scheduling and missing-card tolerance, workbook-change card selection, total recalculation, and save scheduling.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardCardWorkspaceActions` is tracked as the covered owner of job Timecard workbook-change workspace cleanup/save scheduling while the route still coordinates subscriptions, save queue wiring, and page-level composition.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardCardWorkspaceActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R512`:

- Added focused composable coverage for job Timecard workspace sync watcher behavior: `src/__tests__/useJobTimecardWorkspaceSync.spec.ts`.
- Protected selected-week card workspace reset/resubscription, selected-date reset/backfill behavior, route-job page/workspace reset and job/week resubscription, subscribed-job backfill triggers, burden refresh guards, visible-card selection synchronization, and no-op behavior when visible cards change without an id signature change.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardWorkspaceSync` is tracked as the covered owner of job Timecard watcher-based workspace synchronization while the route still coordinates subscription adapters, save queue wiring, and page-level composition.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardWorkspaceSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R513`:

- Added focused composable coverage for job Timecard subscription lifecycle behavior: `src/__tests__/useJobTimecardSubscriptionLifecycle.spec.ts`.
- Protected mount-time route-job/week/employee subscription startup, no-job week guards, non-watch behavior for later route job changes, exposed route-job/week/card subscription helpers, card-loading state transitions, empty-week card clearing, and unmount cleanup for save queue, measurements, week/card/employee subscriptions, and route-job subscription.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardSubscriptionLifecycle` is tracked as the covered owner of job Timecard subscription lifecycle startup/cleanup while the route still coordinates subscription adapter construction, save queue wiring, and page-level composition.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardSubscriptionLifecycle.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R514`:

- Added focused composable coverage for job Timecard save queue wiring: `src/__tests__/useJobTimecardSaveQueue.spec.ts`.
- Protected editable selected-week save gating, read-only/no-week no-save behavior, no-save scheduling guards, `updateTimecardCard` payloads with week id, selected week start date, card payload, and burden value, scheduled current-card flushing without waiting for debounce, last-saved state updates, and service failure propagation through shared save-error state.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardSaveQueue` is tracked as the covered job-specific adapter around the shared timecard save queue while the route still coordinates subscription adapter construction and page-level composition.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardSaveQueue.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R515`:

- Added focused composable coverage for job Timecard records adapter behavior: `src/__tests__/useJobTimecardRecords.spec.ts`.
- Protected employee subscription state, foreman-vs-manager week subscription scoping, no-job week subscription guards, selected-week card subscription context with week id/start date/burden, remote-card merge forwarding before card update publication, no-week card subscription guards, unsubscribe behavior, and feature-specific fallback error forwarding for employee/week/card subscriptions.
- Updated the component architecture, testing strategy, and gap-audit docs so `useJobTimecardRecords` is tracked as the covered job-specific adapter around employee/week/card subscription services while the route still coordinates page-level composition and auth/job context wiring.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardRecords.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R516`:

- Added focused composable coverage for job Timecard workspace derived state: `src/__tests__/useJobTimecardWorkspaceState.spec.ts`.
- Protected explicit selected-week/date matching, preferred submitted/populated week fallback, selected-week-start fallback from week ending date, card and active employee filtering, submitted-week edit permissions for managers, create-week readiness guards, burden fallback, and recent-week slicing.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobTimecardWorkspaceState` is tracked as the covered owner of job Timecard workspace derived state while the route still coordinates page-level composition and auth/job context wiring.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardWorkspaceState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed; the required unsandboxed retry was rejected by the approval layer, so no workaround was attempted.

2026-07-15 `R517`:

- Added focused composable coverage for Timecard Export filter and visible-card derived state: `src/__tests__/useTimecardExportFilters.spec.ts` and `src/__tests__/useTimecardExportVisibleCards.spec.ts`.
- Protected current-week export filter defaults, toolbar filter normalization, Saturday date snapping, reversed range-bound normalization, selected-job/status/foreman/search filtering, active create-week card lookup, missing target guards, card search by display fields, and filtered-card ordering by name or employee number.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportFilters` and `useTimecardExportVisibleCards` are tracked as covered owners of Timecard Export browsing/visible-card derivation while the route still coordinates week/card editing, draft deletion, PDF/CSV flows, and confirmation action state.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportFilters.spec.ts src/__tests__/useTimecardExportVisibleCards.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed; an unsandboxed retry was not re-requested because the approval layer had already rejected the same Vitest startup retry in this turn.

2026-07-15 `R518`:

- Added focused composable coverage for Timecard Export summary/status derivation: `src/__tests__/useTimecardExportSummary.spec.ts`.
- Protected export total hours/production calculations, workbook account-summary aggregation, visible week/package/job/foreman/status labels, save-status priority, status signals, empty-canvas messages, PDF subtitle text, and CSV filename derivation.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportSummary` is tracked as the covered owner of Timecard Export totals/status/summary state while the route still coordinates week/card editing, draft deletion, PDF/CSV flows, and confirmation action state.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportSummary.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed; an unsandboxed retry was not re-requested because the approval layer had already rejected the same Vitest startup retry in this turn.

2026-07-15 `R519`:

- Added focused composable coverage for Timecard Export create-context and create-default selection behavior: `src/__tests__/useTimecardExportCreateContext.spec.ts` and `src/__tests__/useTimecardExportCreateDefaults.spec.ts`.
- Protected sorted create job options, foreman filter options, active foreman/project-manager user filtering, assignable foreman options, employee search, existing and synthetic target create-week resolution, owner context, create-tray guidance, stable job selection defaults, target-week job defaults, selected foreman-filter defaults, single-option fallbacks, valid selection preservation, and no-option clearing.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportCreateContext` and `useTimecardExportCreateDefaults` are tracked as covered owners of Timecard Export create setup/defaulting while the route still coordinates create/mutation actions, draft deletion, PDF/CSV flows, and confirmation action state.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportCreateContext.spec.ts src/__tests__/useTimecardExportCreateDefaults.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed; an unsandboxed retry was not re-requested because the approval layer had already rejected the same Vitest startup retry in this turn.

2026-07-15 `R520`:

- Added focused composable coverage for Timecard Export mutation actions: `src/__tests__/useTimecardExportMutationActions.spec.ts`.
- Protected remove-card and delete-draft confirmation payloads, editable/export-capability guards, pending-save flush ordering, selected-card preservation before delete, card/week delete service calls, archive cache cleanup, success messages, error fallbacks, loading cleanup, confirmation cleanup, and confirm-dispatch behavior.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportMutationActions` is tracked as the covered owner of Timecard Export remove-card/delete-draft workflows while the route still coordinates create-card actions, PDF/CSV flows, and lifecycle/subscription action state.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportMutationActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed; an unsandboxed retry was not re-requested because the approval layer had already rejected the same Vitest startup retry in this turn.

2026-07-15 `R521`:

- Added focused composable coverage for Timecard Export create-card actions: `src/__tests__/useTimecardExportCreateActions.spec.ts`.
- Protected read-only guards, linked job/job-number validation, existing-week card creation, synthetic week creation through `ensureTimecardWeek`, employee-card payloads, custom-card validation/trimming/wage rules, export filter synchronization, create-tray cleanup, edit-mode selection, scroll side effects, loading cleanup, and create failure handling.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportCreateActions` is tracked as the covered owner of Timecard Export employee/custom card creation while the route still coordinates PDF/CSV flows and lifecycle/subscription action state.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportCreateActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed; an unsandboxed retry was not re-requested because the approval layer had already rejected the same Vitest startup retry in this turn.

2026-07-15 `R522`:

- Added focused composable coverage for Timecard Export download/output actions: `src/__tests__/useTimecardExportDownloadActions.spec.ts`.
- Protected empty-filter guards, popup-blocked PDF messaging, pending-save flush ordering, PDF payload normalization/storage, print-route handoff, CSV build/download orchestration, no-detail-row messaging, success messages, and PDF/CSV failure fallbacks.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportDownloadActions` is tracked as the covered owner of Timecard Export PDF/CSV output orchestration while the route still coordinates route-level print navigation wiring and lifecycle/subscription action state.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportDownloadActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R523`:

- Added focused composable coverage for Timecard Export filtered-week synchronization: `src/__tests__/useTimecardExportFilteredWeekSync.spec.ts`.
- Protected immediate sync with no pending work, pending-save flush ordering before archive card-set changes, queued-work flushing without loaded cards, tracked week-signature reruns, ignored display-only week field changes, page/workspace reset ordering, archive-card sync startup, and stale async sync cancellation when filters change mid-flush.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportFilteredWeekSync` is tracked as the covered owner of Timecard Export filtered-week card-set synchronization while the route still coordinates route-level print navigation wiring and lifecycle/subscription wiring.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportFilteredWeekSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R524`:

- Added focused composable coverage for Timecard Export watcher side effects: `src/__tests__/useTimecardExportSideEffects.spec.ts`.
- Protected job production-burden signature watching, archive card redecorating, display-only job edit no-op behavior, ordered-card id signature watching, visible-card selection synchronization, and same-card content edit no-op behavior.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportSideEffects` is tracked as the covered owner of Timecard Export job-burden redecorating and ordered-card selection synchronization while the route still coordinates route-level print navigation wiring and lifecycle/subscription wiring.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportSideEffects.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R525`:

- Added focused composable coverage for Timecard Export lifecycle startup/cleanup: `src/__tests__/useTimecardExportLifecycle.spec.ts`.
- Protected mount-time subscription startup order for jobs, saved weeks, employees, and users, plus unmount cleanup order for the save queue, card measurements, saved weeks, archive cards, employees, and users.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportLifecycle` is tracked as the covered owner of Timecard Export mount/unmount lifecycle ordering while the route still coordinates route-level print navigation wiring and subscription adapter wiring.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportLifecycle.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R526`:

- Added focused composable coverage for Timecard Export subscription adapters: `src/__tests__/useTimecardExportSubscriptions.spec.ts`.
- Protected saved-week, employee, and foreman subscription wiring, feature-specific error forwarding, permission-independent archive week start/stop helpers, Timecard Export permission-gated employee/user subscription startup, denied-record clearing, loading-state cleanup, and latest-permission checks.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportSubscriptions` is tracked as the covered owner of Timecard Export saved-week/employee/foreman subscription adapter behavior while the route still coordinates route-level print navigation wiring and job-store subscription injection.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportSubscriptions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R527`:

- Added focused composable coverage for Timecard Export card-workspace actions: `src/__tests__/useTimecardExportCardWorkspaceActions.spec.ts`.
- Protected workspace reset cleanup, page/save message reset, valid-card UI pruning, sorted selection synchronization, workbook-change total recalculation and save scheduling, smooth card scrolling, and employee-header lock rules.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportCardWorkspaceActions` is tracked as the covered owner of Timecard Export card-workspace behavior while the route still coordinates route-level print navigation wiring and job-store subscription injection.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportCardWorkspaceActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R528`:

- Added focused composable coverage for Timecard Export archive-card subscriptions/cache: `src/__tests__/useTimecardExportArchiveCards.spec.ts`.
- Protected per-week card listener setup with burden resolution, loading state, archive card decoration, stale-week subscription cleanup, empty result resets, pending-local-state merge protection, burden redecorating without resubscription, week-specific error forwarding, delete-week cache cleanup, sort-index derivation, and full subscription cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportArchiveCards` is tracked as the covered owner of Timecard Export archive-card subscription/cache behavior while the route still coordinates route-level print navigation wiring and job-store subscription injection.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportArchiveCards.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R529`:

- Added focused composable coverage for Timecard Export save persistence: `src/__tests__/useTimecardExportSaveQueue.spec.ts`.
- Protected editable export-week save gating, no-save scheduling/persistence guards, `updateTimecardCard` payloads with archive week id, archive week start date, archive card payload, and archive burden, scheduled-save flushing, last-saved state updates, and service failure propagation through shared save-error state.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportSaveQueue` is tracked as the covered owner of Timecard Export save persistence while the route still coordinates route-level print navigation wiring and job-store subscription injection.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportSaveQueue.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R530`:

- Added focused composable coverage for the remaining Timecard Export UI-state adapters: `src/__tests__/useTimecardExportUiAdapters.spec.ts`.
- Protected mobile toolbar tab validation, admin card edit-mode permission gating, edit-state reset/pruning, create-tray visibility and target/search/custom-card state, custom-card form reset behavior, and Timecard Export confirmation-dialog remove-card/delete-week copy plus busy close behavior.
- Updated component architecture, testing strategy, and gap-audit docs so `useTimecardExportUiState`, `useTimecardExportCreateTray`, and `useTimecardExportConfirmDialog` are tracked as covered owners of the remaining Timecard Export UI adapter state while the route still coordinates route-level print navigation wiring and job-store subscription injection.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportUiAdapters.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R531`:

- Extracted Daily Log submit validation into `src/features/dailyLogs/validation.ts` and kept a compatibility re-export from `viewHelpers`.
- Added focused validation coverage in `src/__tests__/dailyLogValidation.spec.ts` for required text-field messages, manpower-row completeness, indoor-climate-row completeness, row-specific error messages, and complete-payload acceptance.
- Updated `useDailyLogActions` to consume the dedicated validation helper so the action composable keeps submit orchestration while validation rules live in a focused module.
- Updated component architecture, frontend architecture, testing strategy, and gap-audit docs so Daily Log submit validation is tracked as an isolated, covered helper and stale candidate entries for shop-order tree/timecard save queue are clarified as already-covered helpers.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts --project=chromium`: passed, 4/4.
- `npm run test:unit -- --run src/__tests__/dailyLogValidation.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R532`:

- Added focused shared-composable coverage for Firebase-style subscription helpers: `src/__tests__/subscribedHelpers.spec.ts`.
- Protected `useSubscribedRecords` and `useSubscribedValue` initial loading state, update callbacks, restart cleanup, explicit stop cleanup, normalized callback errors, synchronous subscriber failures, restart error resets, and existing value preservation on listener errors.
- Updated component architecture, testing strategy, and gap-audit docs so the shared subscription helpers used by Jobs, Daily Logs, Shop Orders, Employees, Users, and Timecards are tracked as directly covered reliability primitives.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/subscribedHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R533`:

- Fixed the shared app toast wrapper so caller-provided summaries such as Jobs, Daily Logs, Shop Orders, and admin editor labels are preserved instead of being replaced by generic severity summaries.
- Added focused composable coverage in `src/__tests__/useAppToast.spec.ts` for PrimeVue toast payloads, default severity summaries, custom summaries/lifetimes, blank-message suppression, severity convenience helpers, watched message refs, clear-on-consume behavior, filtered messages, unchanged-message suppression, and non-clearing message mode.
- Updated component architecture, testing strategy, and gap-audit docs so `useAppToast` and `useToastMessages` are tracked as shared feedback primitives for the UI refactor.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useAppToast.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R534`:

- Added focused shared-DOM composable coverage for card scaling and global listener cleanup: `src/__tests__/useMeasuredCardScale.spec.ts` and `src/__tests__/useWindowEventListener.spec.ts`.
- Protected default unmeasured card styles, shell/content measurement, ResizeObserver width/size updates, max-scale clamping, shell-height calculation, observer cleanup when elements are replaced or removed, invalid-card pruning, full measurement clearing, observed-element filtering, window listener registration, option passthrough, unmount cleanup, and native event dispatch while mounted.
- Updated component architecture, testing strategy, and gap-audit docs so `useMeasuredCardScale` and `useWindowEventListener` are tracked as covered shared DOM lifecycle primitives for Timecards, Timecard Export, Shop Catalog admin, and Shop Order catalog browser.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useMeasuredCardScale.spec.ts src/__tests__/useWindowEventListener.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R535`:

- Added focused shared-route coverage for the job-scoped route context helper: `src/__tests__/useRouteJobContext.spec.ts`.
- Protected route job-id resolution, current-job priority over visible-list copies, visible-job fallback when the current subscription is for another job, route-param/store reactivity, subscribe guards for routes without a job id, route-job subscription forwarding, and route-job cleanup delegation.
- Updated component architecture, testing strategy, and gap-audit docs so `useRouteJobContext` is tracked as the covered shared route/job-store convention for Job Dashboard, Daily Logs, Shop Orders, and job Timecards.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts --project=chromium`: passed, 1/1.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts --project=chromium`: passed, 4/4.
- `npm run test:unit -- --run src/__tests__/useRouteJobContext.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R536`:

- Added focused Shop Catalog tree-expansion coverage: `src/__tests__/useShopCatalogTreeExpansion.spec.ts`.
- Protected root category initialization, explicit initialization inputs, ancestor expansion for selected categories, missing-category no-ops, individual category toggles, root bucket toggles, archive-aware visible-category ids, expand-all behavior, collapse-all behavior, and context-menu cleanup for expand/collapse actions.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogTreeExpansion` is tracked as the covered owner of Shop Catalog admin root/category expansion behavior ahead of future catalog UI and Shop Foreman role work.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogTreeExpansion.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R537`:

- Added focused Shop Catalog tree-display coverage: `src/__tests__/useShopCatalogTreeDisplayState.spec.ts`.
- Protected root visible category/item counts, root summary copy, top-level draft row visibility, expansion-driven active tree rows, SKU summaries, collapsed-branch search behavior, archived category/item visibility, selected-folder parent option descendant blocking, root expansion reactivity, and create-state draft node reactivity.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogTreeDisplayState` is tracked as the covered owner of Shop Catalog admin root summaries, parent options, and search/archive/create-aware tree rows ahead of future catalog UI and Shop Foreman role work.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogTreeDisplayState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R538`:

- Added focused Shop Catalog tree-interaction coverage: `src/__tests__/useShopCatalogTreeInteractions.spec.ts`.
- Protected category open behavior, item inspector open behavior, draft-node no-ops, missing-item no-ops, suppressed long-press click handling, root/root-bucket click behavior, tree-node click behavior, global pointer menu cleanup, Escape drag/menu cleanup, root/category/item context-menu target mapping, draft context-menu prevention, and root/category/item long-press target forwarding.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogTreeInteractions` and `useShopCatalogContextMenuTargets` are tracked as covered owners of Shop Catalog admin click/open and context-menu target behavior ahead of future catalog tree UI work.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogTreeInteractions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R539`:

- Added focused Shop Catalog context-menu coverage: `src/__tests__/useShopCatalogContextMenu.spec.ts`.
- Protected viewport-aware menu positioning, browser context-menu suppression, close behavior, touch long-press delayed opening, pointer capture release, drag-blocking state, suppressed-click consumption and timeout clearing, movement cancellation, mouse/pen pointer handling, and dispose-time timer/capture cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogContextMenu` is tracked as the covered shared owner of Shop Catalog admin and Shop Order catalog browser context-menu positioning, long-press, drag-blocking, and cleanup behavior.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopCatalogContextMenu.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R540`:

- Added focused Shop Catalog context-menu action coverage: `src/__tests__/useShopCatalogContextMenuActions.spec.ts`.
- Protected root/folder/item menu action lists, single-pane inspect actions, create item/folder action wiring, rename action wiring, archive-vs-restore labels, archive action payloads, child-aware folder delete disabling, expand/collapse disabled-state derivation, category delete context selection, item delete context selection, and missing-item delete fallback behavior.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogContextMenuActions` and `useShopCatalogContextDeleteActions` are tracked as covered owners of Shop Catalog admin menu action derivation and context-delete target selection ahead of future catalog tree/inspector UI work.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogContextMenuActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R541`:

- Added focused Shop Catalog confirm-flow coverage: `src/__tests__/useShopCatalogConfirmFlow.spec.ts`.
- Protected catalog-specific archive/restore/delete confirmation titles, messages, labels, destructive-state derivation, busy close protection, safe fallback copy, no-action confirm no-op behavior, and archive-category/archive-item/delete-category/delete-item confirm dispatch routing.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogConfirmDialog` and `useShopCatalogConfirmDispatcher` are tracked as covered owners of Shop Catalog admin confirmation copy/state and archive/delete dispatch routing ahead of future inspector/menu refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogConfirmFlow.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R542`:

- Added focused Shop Catalog archive/delete workflow coverage: `src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts`.
- Protected folder archive confirmation creation, folder archive cascading to descendant folders and nested items, update service payloads, hidden archived selection fallback, restore reselection, item archive confirmation creation, hidden item archive fallback, item restore inspector behavior, archive failure cleanup, child-folder delete blocking, category/item delete confirmation creation, delete service calls, post-delete selection fallback, and delete failure cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogArchiveActions` and `useShopCatalogDeleteActions` are tracked as covered owners of Shop Catalog admin archive/restore/delete workflow behavior ahead of future inspector/tree refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R543`:

- Added focused Shop Catalog form workflow coverage: `src/__tests__/useShopCatalogFormWorkflows.spec.ts`.
- Protected create/detail form resets, selected category/item hydration, create item parent preparation, price input/focus/blur normalization, create validation blocking, create folder/item service payloads, create expansion/selection updates, save folder/item service payloads, item-save folder preservation, success messaging, and service failure cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogForms` and `useShopCatalogFormActions` are tracked as covered owners of Shop Catalog admin form state, price normalization, create/save validation, create/save service payloads, and inspector selection behavior ahead of future inspector component refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogFormWorkflows.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R544`:

- Added focused Shop Catalog drag/drop and move workflow coverage: `src/__tests__/useShopCatalogDragDropMoveActions.spec.ts`.
- Protected drag-start blocking, draft/create/rename drag suppression, serialized drag payloads, category/item drop-target validation, root/folder hover state, duplicate drop prevention, drag-state cleanup, move-error forwarding, folder/item reparenting service payloads, post-move expansion/selection updates, top-level success copy, and missing-target no-ops.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogDragDrop` and `useShopCatalogMoveActions` are tracked as covered owners of Shop Catalog admin drag source/drop target validation, hover/drop cleanup, category/item reparenting payloads, moved-record selection behavior, and move error messaging ahead of future catalog tree UI refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogDragDropMoveActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R545`:

- Added focused Shop Catalog inline edit workflow coverage: `src/__tests__/useShopCatalogInlineActions.spec.ts`.
- Protected inline create/rename state mutual exclusion, create-item inspector routing, inline create parent expansion and focus, inline rename target selection and selected-text focus, blank create/rename cancellation, inline folder/item create payloads, pending item-id fallback selection, create failure recovery, unchanged rename no-ops, category rename payloads, item rename payloads, and rename failure recovery.
- Fixed inline item rename persistence so `useShopCatalogInlineActions` now sends the edited item description instead of the previous description while preserving category, SKU, price, and active fields.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogInlineEditing` and `useShopCatalogInlineActions` are tracked as covered owners of Shop Catalog admin inline create/rename state, focus behavior, create/rename service payloads, no-op guards, pending selection fallback, and failure recovery ahead of future catalog tree UI refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogInlineActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R546`:

- Added focused Shop Catalog selection and synchronization coverage: `src/__tests__/useShopCatalogSelection.spec.ts`.
- Protected root defaults, root/folder/item selection behavior, optional inspector/expansion suppression, top-level item inspection, selected folder/item form hydration, create-mode form resets, one-time root tree initialization, stale active-folder cleanup, stale selected-folder cleanup, and selected-item fallback to the active folder or root as live catalog records change.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogSelection` and `useShopCatalogSelectionSync` are tracked as covered owners of Shop Catalog admin active-folder/inspector state, selected record lookup, form hydration, create-mode reset behavior, root tree initialization, and stale record cleanup ahead of future catalog inspector/tree refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogSelection.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R547`:

- Added focused Shop Catalog derived-data and inspector-summary coverage: `src/__tests__/useShopCatalogDerivedData.spec.ts`.
- Protected category/id indexes, sorted child category/item maps, archive-aware visible counts, direct and visible child counts, category path fallback behavior, category option labels, live record reactivity, selected-folder title/path/summary/child-state labels, selected-item title/path/SKU/price labels, and empty-selection fallbacks.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogDerivedData` and `useShopCatalogInspectorSummary` are tracked as covered owners of Shop Catalog admin path/count/option derivation and inspector metadata labels ahead of future catalog inspector/tree refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogDerivedData.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R548`:

- Added focused Shop Catalog records subscription coverage: `src/__tests__/useShopCatalogRecords.spec.ts`.
- Protected category/item listener startup, default all-record loading behavior, category-or-items loading behavior, replacement subscription cleanup, idempotent listener cleanup, listener error normalization with custom fallback copy, and synchronous subscription startup failure recovery.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogRecords` is tracked as the covered shared owner of Shop Catalog category/item subscription state, loading-mode semantics, listener cleanup, and normalized listener/startup errors for Shop Catalog Admin and Shop Orders ahead of future Firebase/query refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopCatalogRecords.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R549`:

- Added focused Shop Catalog tree auto-scroll coverage: `src/__tests__/useShopCatalogTreeAutoScroll.spec.ts`.
- Protected bottom-threshold auto-scroll, top-threshold auto-scroll and clamping, animation-frame scheduling, safe-zone cancellation, no-drag no-op behavior, and non-scrollable list cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogTreeAutoScroll` is tracked as the covered owner of Shop Catalog admin drag auto-scroll thresholds, frame lifecycle, scroll clamping, and cancellation behavior ahead of future catalog tree UX refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogTreeAutoScroll.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R550`:

- Added focused Shop Catalog responsive panel coverage: `src/__tests__/useShopCatalogResponsivePanel.spec.ts`.
- Protected catalog-first defaults, default breakpoint sync, custom breakpoint sync, catalog/inspector mobile panel switching, inspector shortcut behavior, and no-window fallback behavior.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogResponsivePanel` is tracked as the covered owner of Shop Catalog admin mobile panel state and breakpoint-driven single-pane layout behavior ahead of future GUI polish and responsive-layout refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogResponsivePanel.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R551`:

- Added focused Shop Catalog admin lifecycle coverage: `src/__tests__/useShopCatalogAdminLifecycle.spec.ts`.
- Protected mount-time layout sync before catalog subscription startup, no premature cleanup, context-menu disposal, tree auto-scroll cleanup, catalog listener cleanup, and cleanup ordering on unmount.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopCatalogAdminLifecycle` is tracked as the covered owner of Shop Catalog admin startup/cleanup orchestration ahead of future Firebase subscription and responsive-layout refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogAdminLifecycle.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R552`:

- Added focused Jobs view-state coverage: `src/__tests__/useJobsViewState.spec.ts`.
- Protected admin all-job visibility with status/search filters, field-user active-job visibility, selected-job lookup, create/all-jobs mode flags, all-jobs entry visibility, active/archive counts, job type options, GC suggestions, and current field-user option filtering/sorting.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobsViewState` is tracked as the covered owner of Jobs page derived state ahead of future role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobsViewState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R553`:

- Added focused Jobs selection synchronization coverage: `src/__tests__/useJobsSelectionSync.spec.ts`.
- Protected no-selection form reset, selected-job hydration, hydration guard blocking, previous-job handoff, field-user first-visible selection, manager fallback to empty/all-jobs modes, create/all-jobs preservation, edit-drawer all-jobs defaulting, and drawer-close autosave cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobsSelectionSync` is tracked as the covered owner of Jobs page selected-job watcher behavior ahead of future role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobsSelectionSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R554`:

- Added focused Jobs navigation-actions coverage: `src/__tests__/useJobsNavigationActions.spec.ts`.
- Protected create-mode permission gating, create-form reset, edit-drawer opening to selected jobs or all-jobs defaults, create-mode preservation, close behavior, edit-mode row selection, and dashboard routing outside edit mode.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobsNavigationActions` is tracked as the covered owner of Jobs page create/edit drawer navigation behavior ahead of future role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobsNavigationActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R555`:

- Added focused Jobs detail-form coverage: `src/__tests__/useJobDetailForm.spec.ts`.
- Protected selected-job hydration, null-selection reset, notification recipient/input resets, field updates, validation blocking, explicit save handoff, autosave scheduling for changed editable forms, autosave permission gating, success/status copy, and dirty local field protection against same-job remote echoes.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobDetailForm` is tracked as the covered owner of Jobs page detail form hydration, saves, autosave, and stale-remote-echo protection ahead of future role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobDetailForm.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R556`:

- Added focused Jobs create-form coverage: `src/__tests__/useJobCreateForm.spec.ts`.
- Protected default create-job field values, empty notification recipients, empty recipient inputs, typed field updates, full reset behavior, recipient/input cleanup, assigned-foreman cleanup, and create-message clearing.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobCreateForm` is tracked as the covered owner of Jobs page create-form state ahead of future role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobCreateForm.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R557`:

- Added focused Jobs CRUD-action coverage: `src/__tests__/useJobCrudActions.spec.ts`.
- Protected create validation, create payload normalization, create service error forwarding, detail persistence payload normalization, detail save errors, archive/restore service calls, delete service calls, post-delete selection fallback, and busy-state cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobCrudActions` is tracked as the covered owner of Jobs page create/save/archive/restore/delete persistence ahead of future target-role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobCrudActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R558`:

- Added focused Jobs notification-recipient workflow coverage: `src/__tests__/useJobNotificationRecipients.spec.ts`.
- Protected create-recipient validation and local edits, selected-job recipient persistence, all-jobs recipient default persistence, add/remove behavior, duplicate handling, pending input preservation on persistence failure, and recipient-saving cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobNotificationRecipients` is tracked as the covered owner of Jobs page create/job/all-jobs recipient workflows ahead of future target-role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobNotificationRecipients.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R559`:

- Added focused Jobs admin-subscription coverage: `src/__tests__/useJobsAdminSubscriptions.spec.ts`.
- Protected admin-only subscription startup, user/all-jobs-recipient listener updates, replacement cleanup on restart, explicit stop cleanup, user listener error normalization, all-jobs recipient error forwarding, and default recipient fallback state on listener failure.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobsAdminSubscriptions` is tracked as the covered owner of Jobs page admin-only user/all-jobs-recipient Firebase listener orchestration ahead of future target-role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobsAdminSubscriptions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R560`:

- Added focused Jobs lifecycle coverage: `src/__tests__/useJobsLifecycle.spec.ts`.
- Protected mount-time jobs subscription startup before admin-only subscription startup, no premature cleanup, and unmount cleanup order for detail autosave timers, jobs subscriptions, and admin subscriptions.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobsLifecycle` is tracked as the covered owner of Jobs page subscription/autosave lifecycle orchestration ahead of future target-role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobsLifecycle.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R561`:

- Added focused Jobs side-effect coverage: `src/__tests__/useJobsSideEffects.spec.ts`.
- Protected detail-form autosave scheduling from top-level and nested edits, ignored empty jobs subscription errors, unchanged error suppression, and forwarding of new jobs subscription errors to the page error/toast adapter.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobsSideEffects` is tracked as the covered owner of Jobs page autosave/error side effects ahead of future target-role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobsSideEffects.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R562`:

- Added focused Jobs confirm-dialog composable coverage: `src/__tests__/useJobConfirmDialogs.spec.ts`.
- Protected archive/restore/delete no-selection guards, selected-job dialog copy, archive/restore/delete open state, manual close helpers, and busy-state close prevention.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobConfirmDialogs` is tracked as the covered owner of Jobs page archive/restore/delete confirmation state ahead of future target-role, dashboard, and Jobs page refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobConfirmDialogs.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R563`:

- Added focused Job Dashboard lifecycle coverage: `src/__tests__/useJobDashboardLifecycle.spec.ts`.
- Protected mount-time route-job subscription startup, route-job id resubscription, same-id no-op behavior, and route-job subscription cleanup on unmount.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobDashboardLifecycle` is tracked as the covered owner of Job Dashboard route-job subscription lifecycle ahead of future role-dashboard, widget-shell, and job-dashboard refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts --project=chromium`: passed, 1/1.
- `npm run test:unit -- --run src/__tests__/useJobDashboardLifecycle.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R564`:

- Added focused Daily Log form-state coverage: `src/__tests__/useDailyLogFormState.spec.ts`.
- Protected E2E-runtime and real-clock today formatting, selected-date initialization, selected-log id defaults, empty payload initialization, and text-field updates without disturbing unrelated payload state.
- Updated component architecture, testing strategy, and gap-audit docs so `useDailyLogFormState` is tracked as the covered owner of Daily Log selected date/log defaults and text-field mutation ahead of future Daily Log workspace and dashboard refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useDailyLogFormState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R565`:

- Added focused Shop Order records subscription coverage: `src/__tests__/useShopOrderRecords.spec.ts`.
- Protected current-job shop order listener startup, explicit restart cleanup when the route job changes, idempotent stop behavior, listener/startup error normalization, and local record replacement without appending missing records.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopOrderRecords` is tracked as the covered owner of Shop Orders current-job record subscription behavior ahead of future Shop Orders page-shell and Firebase subscription refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderRecords.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R566`:

- Added focused Shop Order item-note coverage: `src/__tests__/useShopOrderItemNotes.spec.ts`.
- Protected selected-order note draft synchronization, no-order cleanup, debounced note saves, blur flushes that cancel the old debounce, unchanged/read-only save suppression, and queued follow-up saves when the user keeps typing while a prior note save is pending.
- Updated component architecture, testing strategy, and gap-audit docs so `useShopOrderItemNotes` is tracked as the covered owner of Shop Orders note draft/save behavior ahead of future Shop Orders workspace and save-queue refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderItemNotes.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R567`:

- Added focused job Timecard summary coverage: `src/__tests__/useJobTimecardSummary.spec.ts`.
- Protected account-summary aggregation, total hours/production derivation, week range/status labels, job/week fallback labels, linked job number fallback behavior, save-state priority, and empty-canvas guidance.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobTimecardSummary` is tracked as the covered owner of job Timecard summary derivation ahead of future timecard workspace and dashboard refactors.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardSummary.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R568`:

- Added focused job Timecard UI-adapter coverage: `src/__tests__/useJobTimecardUiAdapters.spec.ts`.
- Protected create-tray visibility, employee-search persistence, custom-card form reset behavior, remove-card confirmation copy/destructive state, submit-week confirmation copy, and busy-state close prevention.
- Updated component architecture, testing strategy, and gap-audit docs so `useJobTimecardCreateTray` and `useJobTimecardConfirmDialog` are tracked as covered owners of job Timecard UI adapter state ahead of future timecard route-shell cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardUiAdapters.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R569`:

- Added focused Users/Employees admin form-state coverage: `src/__tests__/useAdminFormState.spec.ts`.
- Protected Users create/detail defaults, role updates, assigned-job toggles, role-based assignment cleanup, selected-user hydration, syncing flags, detail dirty-snapshot detection, search reset behavior, and create-message reset callbacks.
- Protected Employees create/detail defaults, text and boolean field updates, selected-employee hydration, syncing flags, create reset callbacks, and detail-error clearing behavior.
- Updated component architecture, testing strategy, and gap-audit docs so `useUserFormState` and `useEmployeeFormState` are tracked as covered owners of admin form-state behavior ahead of future Users/Employees route cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminFormState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R570`:

- Added focused Users/Employees admin action coverage: `src/__tests__/useAdminActions.spec.ts`.
- Protected Users create validation, create payload role/assignment behavior, pending-invite sending, invite error forwarding, detail autosave gating, validation/error forwarding, queued autosave scheduling, self-delete guards, delete confirmation, selection reset, and busy-state cleanup.
- Protected Employees create validation, create payloads, selected-employee handoff, detail autosave sync/validation guards, update payloads, delete confirmation, selection reset, and busy-state cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so `useUserCreateActions`, `useUserDetailActions`, and `useEmployeeActions` are tracked as covered owners of admin action behavior ahead of future Users/Employees route cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R571`:

- Added focused Users/Employees admin records/sync coverage: `src/__tests__/useAdminRecordsSync.spec.ts`.
- Protected Users user/job listener startup, feature-specific listener error fallback copy, listener restart cleanup, stale selected-user fallback, mount/unmount subscription cleanup, selected-user message reset, selected-user form hydration, create-mode reset, detail snapshot save scheduling, and save-timer cleanup.
- Protected Employees listener startup, feature-specific listener error fallback copy, listener cleanup, stale selected-employee fallback, mount/unmount subscription cleanup, selected-employee message reset, selected-employee form hydration, and create-mode reset.
- Updated component architecture, testing strategy, and gap-audit docs so `useUserAdminRecords`, `useEmployeeAdminRecords`, `useUserAdminViewSync`, and `useEmployeeAdminViewSync` are tracked as covered owners of admin records/sync behavior ahead of future Users/Employees route cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminRecordsSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R572`:

- Extracted Users/Employees admin derived view state into `src/features/users/useUserAdminViewState.ts` and `src/features/employees/useEmployeeAdminViewState.ts`.
- Added focused coverage in `src/__tests__/useAdminViewState.spec.ts` for directory filtering, selected-record lookup, create-mode flags, self-edit detection, active assignment-job filtering, pending invite counts, employee status counts, occupation suggestions, passive-save message sets, and delete-confirmation copy.
- Updated `src/views/UsersView.vue` and `src/views/EmployeesView.vue` to consume the derived-state composables so the route shells own less filtering/selection/counting logic while preserving real page behavior.
- Updated component architecture, testing strategy, and gap-audit docs so the admin derived-state seam is tracked ahead of future Users/Employees route cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminViewState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R573`:

- Extracted public auth route helper behavior into `src/features/auth/authViewHelpers.ts`.
- Updated `src/views/LoginView.vue`, `src/views/ForgotPasswordView.vue`, and `src/views/SetPasswordView.vue` to consume shared helpers for forgot-password route targets, password-created login info, login/reset validation copy, setup-password validation ordering, invalid setup-link copy, and setup-link query parsing.
- Added focused coverage in `src/__tests__/authViewHelpers.spec.ts` for those public auth route helper contracts.
- Updated component architecture, testing strategy, and gap-audit docs so public auth route helpers are tracked as a covered route-cleanup seam.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/authViewHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R574`:

- Extracted Timecard Export print-route helper behavior into `src/features/timecards/printViewHelpers.ts`.
- Updated `src/views/TimecardExportPrintView.vue` to consume shared helpers for export-id query parsing, two-card page chunking, generated timestamp formatting, and missing-payload copy while leaving `TimecardPrintCard` visual fidelity untouched.
- Added focused coverage in `src/__tests__/timecardPrintViewHelpers.spec.ts` for export-id parsing, default and custom page chunking, invalid page-size guarding, generated timestamp formatting, and missing-payload copy.
- Updated component architecture, testing strategy, and gap-audit docs so the Timecard Export print-route helper seam is tracked ahead of future print-route cleanup.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/timecardPrintViewHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R575`:

- Extracted Reference List route helper behavior into `src/features/referenceLists/viewHelpers.ts`.
- Updated `src/views/ReferenceListView.vue` to consume shared helpers for route-key normalization and admin reference-list title copy.
- Added focused coverage in `src/__tests__/referenceListViewHelpers.spec.ts` for known route keys, unknown/empty/array fallback behavior, and display titles.
- Updated component architecture, testing strategy, and gap-audit docs so the Reference List route helper seam is tracked ahead of future reference-list management work.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/referenceListViewHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R576`:

- Moved Shop Catalog selected folder/item archive-vs-restore request glue into `useShopCatalogArchiveActions`.
- Updated `src/views/ShopCatalogAdminView.vue` to consume the selected archive request handlers from the feature composable instead of owning route-local handler functions.
- Extended `src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts` to cover active-record archive requests, inactive-record restore requests, and no-selection no-ops for both folders and items.
- Updated component architecture, testing strategy, and gap-audit docs so selected-record Shop Catalog archive request adapters are tracked with the rest of the archive/delete workflow seam.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogArchiveDeleteActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R577`:

- Moved job Timecard remote-card merge protection into `useJobTimecardRecords`, so the subscription adapter now preserves locally pending card state when remote echoes arrive.
- Updated `src/views/TimecardsView.vue` to provide pending save-state maps to the records adapter instead of owning a route-local remote-card merge wrapper.
- Extended `src/__tests__/useJobTimecardRecords.spec.ts` to cover pending local card preservation and clean remote-card updates inside the records adapter.
- Updated component architecture, testing strategy, and gap-audit docs so job Timecard records remote-merge protection is tracked with the records/subscription seam.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobTimecardRecords.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R578`:

- Replaced the Timecard Export route-level card-change callback placeholder with explicit late handler registration in `useTimecardExportArchiveCards`.
- Updated `src/views/TimecardExportView.vue` to call `setCardsChangedHandler(cardWorkspaceActions.syncCardUiState)` instead of routing card changes through a mutable local no-op wrapper.
- Extended `src/__tests__/useTimecardExportArchiveCards.spec.ts` to cover registering the card-change handler after archive-card state is created and receiving loaded card updates through that handler.
- Updated component architecture, testing strategy, and gap-audit docs so Timecard Export archive-card callback registration is tracked with the subscription/cache seam.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportArchiveCards.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R579`:

- Extracted repeated current-user actor derivation into `src/composables/useCurrentActor.ts`.
- Updated `src/views/DailyLogsView.vue` and `src/views/ShopOrdersView.vue` to consume the shared actor helper for actor payloads and shop-order foreman defaults instead of duplicating auth display-name/email fallback logic.
- Added focused coverage in `src/__tests__/useCurrentActor.spec.ts` for user-id derivation, display-name priority, email fallback, null fallback, and reactive source changes.
- Updated component architecture, testing strategy, and gap-audit docs so current actor derivation is tracked as a shared route-shell seam.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useCurrentActor.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R580`:

- Moved Shop Orders success-toast filtering into `shouldShowShopOrderSuccessToast` in `src/features/shopOrders/viewHelpers.ts`.
- Updated `src/views/ShopOrdersView.vue` to use the feature helper instead of owning the quiet background-save/item-added message set in the route shell.
- Added focused coverage in `src/__tests__/shopOrderViewHelpers.spec.ts` for suppressed background-save/item-added messages and allowed user-action success messages.
- Updated component architecture, testing strategy, and gap-audit docs so Shop Orders route-adjacent toast filtering is tracked as a covered helper seam.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/shopOrderViewHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R581`:

- Moved Jobs detail autosave success-toast filtering into `shouldShowJobDetailSuccessToast` in `src/features/jobs/jobViewHelpers.ts`.
- Updated `src/views/JobsView.vue` to use the feature helper instead of owning the passive autosave message set in the route shell.
- Added focused coverage in `src/__tests__/jobViewHelpers.spec.ts` for suppressed passive autosave messages and allowed actionable job success messages.
- Updated component architecture, testing strategy, and gap-audit docs so Jobs route-adjacent toast filtering is tracked as a covered helper seam.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 19/19.
- `npm run test:unit -- --run src/__tests__/jobViewHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R582`:

- Extracted shared Users/Employees directory/editor mobile-panel navigation into `src/composables/useDirectoryEditorPanels.ts`.
- Updated `src/views/UsersView.vue` and `src/views/EmployeesView.vue` to consume the shared helper for create-mode, record selection, and mobile tab panel transitions instead of duplicating route-local panel glue.
- Added focused coverage in `src/__tests__/useDirectoryEditorPanels.spec.ts` for default directory state, valid tab switching, invalid key ignores, create-mode cleanup, and record selection into the editor panel.
- Updated component architecture, testing strategy, and gap-audit docs so directory/editor mobile-panel navigation is tracked as a shared admin-page seam.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useDirectoryEditorPanels.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R583`:

- Replaced exported Users/Employees passive detail-message sets with `shouldShowUserDetailSuccessToast` and `shouldShowEmployeeDetailSuccessToast` feature predicates.
- Updated `src/views/UsersView.vue` and `src/views/EmployeesView.vue` to use the feature predicates instead of route-local anonymous toast-filter lambdas.
- Extended `src/__tests__/useAdminViewState.spec.ts` to cover suppressed passive autosave messages and allowed actionable success messages for both admin detail editors.
- Updated component architecture, testing strategy, and gap-audit docs so Users/Employees passive-save success-toast filtering is tracked with admin derived view-state coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminViewState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R584`:

- Extracted Timecard Export print-route stored-payload loading and print scheduling into `src/features/timecards/useTimecardPrintRoute.ts`.
- Updated `src/views/TimecardExportPrintView.vue` to consume the print-route composable while keeping `TimecardPrintCard` and print CSS untouched.
- Added focused coverage in `src/__tests__/useTimecardPrintRoute.spec.ts` for export-id payload loading, paged-card derivation, missing-payload messaging, print scheduling, and duplicate-print guards.
- Updated component architecture, testing strategy, and gap-audit docs so Timecard Export print-route orchestration is tracked separately from print-card visual fidelity.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardPrintRoute.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R585`:

- Extended public auth route helpers in `src/features/auth/authViewHelpers.ts` with shared auth email query prefill and workspace redirect gating.
- Updated `src/views/LoginView.vue` and `src/views/ForgotPasswordView.vue` to use the shared helpers instead of route-local query parsing / workspace redirect policy.
- Extended `src/__tests__/authViewHelpers.spec.ts` to cover scalar/repeated email query prefill, access-gated workspace redirects, and custom redirect targets.
- Updated component architecture, testing strategy, and gap-audit docs so public auth route query/redirect policy is tracked with auth route helper coverage.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/authViewHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R586`:

- Moved Users assigned-job toggle/autosave orchestration into `useUserDetailActions`, so `src/views/UsersView.vue` no longer owns the guard for create-mode/syncing/no-selection assignment changes.
- Updated `src/__tests__/useAdminActions.spec.ts` with focused coverage for assigned-job toggles autosaving only for editable selected users while still allowing create-mode/syncing toggles to update local form state without persistence.
- Updated component architecture, testing strategy, and gap-audit docs so Users assigned-job autosave behavior is tracked with admin action composable coverage.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R587`:

- Added `collectTimecardPendingStateMaps` to `src/features/timecards/stateMapHelpers.ts` so job Timecards and Timecard Export share the pending save-state map adapter used by subscription merge protection.
- Updated `src/views/TimecardsView.vue` and `src/views/TimecardExportView.vue` to use the shared helper instead of route-local/inline pending-map tuple construction.
- Added `src/__tests__/timecardStateMapHelpers.spec.ts` coverage for state-map clearing, pruning, and pending save-state map collection order/reference preservation.
- Updated component architecture, testing strategy, and gap-audit docs so shared timecard state-map helpers are tracked with route/composable coverage.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.
- `npm run test:unit -- --run src/__tests__/timecardStateMapHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R588`:

- Moved Timecard Export route-owned toolbar options and shared collator into `src/features/timecards/exportViewHelpers.ts`.
- Updated `src/views/TimecardExportView.vue` to consume `timecardExportDateModeOptions`, `timecardExportWeekStatusOptions`, and `timecardExportCollator` instead of constructing feature policy in the route shell.
- Added `src/__tests__/timecardExportViewHelpers.spec.ts` coverage for date-mode options, week-status options, and the numeric/base collator contract.
- Updated component architecture, testing strategy, and gap-audit docs so Timecard Export route helper constants are tracked with helper coverage.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/timecardExportViewHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R589`:

- Added `createDailyLogPayloadPreparer` to `src/features/dailyLogs/viewHelpers.ts` so Daily Logs share one route-adjacent adapter for preparing the current form with current site info.
- Updated `src/views/DailyLogsView.vue` to consume the payload preparer helper instead of defining `clonePreparedPayload` in the route shell.
- Added `src/__tests__/dailyLogViewHelpers.spec.ts` coverage for default current-form preparation, explicit payload preparation, site-info stamping, manpower/QC derived fields, and no-mutation cloning.
- Updated component architecture, testing strategy, and gap-audit docs so Daily Log view-helper payload preparation is tracked with helper coverage.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/daily-log-submit.spec.ts e2e/daily-log-typing.spec.ts --project=chromium`: passed, 5/5.
- `npm run test:unit -- --run src/__tests__/dailyLogViewHelpers.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R590`:

- Added `buildDirectoryEditorMobilePanelTabs` to `src/composables/useDirectoryEditorPanels.ts` so Users and Employees share the same mobile directory/editor tab definitions.
- Updated `src/views/UsersView.vue` and `src/views/EmployeesView.vue` to consume the shared tab builder instead of owning duplicate route-local arrays.
- Extended `src/__tests__/useDirectoryEditorPanels.spec.ts` coverage for default and custom directory tab labels.
- Updated component architecture, testing strategy, and gap-audit docs so directory/editor tab definitions are tracked with the shared mobile-panel helper.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useDirectoryEditorPanels.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R591`:

- Moved Shop Orders history-row selection into `useShopOrderSelectionSync` by returning a shared `selectOrder` action from the selection synchronization composable.
- Updated `src/views/ShopOrdersView.vue` to consume the composable action instead of owning a route-local `selectOrder` wrapper.
- Extended `src/__tests__/useShopOrderSelectionSync.spec.ts` coverage for explicit history-order selection through the shared action.
- Updated component architecture, testing strategy, and gap-audit docs so Shop Orders history selection is tracked with selection-sync coverage.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderSelectionSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R592`:

- Removed two pass-through autosave handlers from `src/views/EmployeesView.vue`.
- Wired `EmployeeEditorPanel` detail blur/toggle events directly to `handleAutoSaveEmployee`, preserving the same employee detail autosave path while trimming route-shell glue.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminActions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R593`:

- Added `src/composables/useTemplateElementRef.ts` with `useTemplateElementRef` and `isHtmlDivElement` for shared Vue template-ref normalization.
- Updated `src/views/ShopCatalogAdminView.vue` to consume the shared helper instead of owning route-local `Element | ComponentPublicInstance` tree-list ref normalization.
- Added `src/__tests__/useTemplateElementRef.spec.ts` coverage for matching DOM element retention plus non-matching element, component instance, and null clearing.
- Updated component architecture, testing strategy, and gap-audit docs so template element refs are tracked with shared helper coverage.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTemplateElementRef.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R594`:

- Added `isHtmlInputElement` to `src/composables/useTemplateElementRef.ts` so shared template-ref normalization covers common input refs as well as div refs.
- Updated `src/components/common/AppInlineInput.vue` to use `useTemplateElementRef` for input-ref forwarding instead of owning a bespoke `Element | ComponentPublicInstance` adapter.
- Extended `src/__tests__/useTemplateElementRef.spec.ts` coverage for the shared input-element guard and non-matching element clearing.
- Updated component architecture, testing strategy, and gap-audit docs so shared element guards and `AppInlineInput` adoption are tracked with template-ref coverage.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTemplateElementRef.spec.ts src/__tests__/AppInlineInput.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R595`:

- Added `resolveTemplateElementRef` to `src/composables/useTemplateElementRef.ts` so indexed/array template refs can reuse the same DOM-only normalization without storing state in the helper.
- Updated `src/components/timecards/TimecardExportStatusBar.vue` to use the shared resolver for the status scroller and per-signal carousel refs instead of owning local `Element | ComponentPublicInstance` checks.
- Extended `src/__tests__/useTemplateElementRef.spec.ts` coverage for stateless ref resolution across matching DOM elements, non-matching DOM elements, component instances, and null refs.
- Updated component architecture, testing strategy, and gap-audit docs so Timecard Export status-bar ref normalization is tracked with the shared template-ref helper.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTemplateElementRef.spec.ts src/__tests__/TimecardExportStatusBar.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R596`:

- Added a generic `isElement` guard to `src/composables/useTemplateElementRef.ts`.
- Updated `src/composables/useMeasuredCardScale.ts` so its existing `asObservedElement` compatibility adapter delegates to the shared template-ref resolver instead of owning local `ComponentPublicInstance` normalization.
- Updated `src/components/timecards/TimecardCanvasPanel.vue` to use the same shared resolver for card shell/content refs before emitting measurement elements to parent views.
- Extended `src/__tests__/useTemplateElementRef.spec.ts` coverage for generic DOM element resolution, including HTML and SVG elements, while still rejecting component instances.
- Updated component architecture, testing strategy, and gap-audit docs so measured-card ref normalization is tracked with shared template-ref coverage.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.
- `npm run test:unit -- --run src/__tests__/useTemplateElementRef.spec.ts src/__tests__/useMeasuredCardScale.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R597`:

- Updated `src/components/shopCatalog/ShopCatalogTreePane.vue` to import the shared `TemplateElementRefValue` type for its list-ref callback contract instead of importing Vue `ComponentPublicInstance` directly.
- Kept the parent-owned `setListRef` behavior unchanged while centralizing template-ref value typing in `useTemplateElementRef`.
- Updated component architecture and testing strategy docs so Shop Catalog tree-pane list refs are tracked with the shared template-ref helper.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTemplateElementRef.spec.ts src/__tests__/ShopCatalogTreeComponents.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R598`:

- Moved Users selected-record clear-before-hydrate behavior into `src/features/users/useUserAdminViewSync.ts` so the route no longer wraps `applyUserToDetailForm` just to cancel pending saves.
- Updated `src/features/users/useUserDetailActions.ts` so autosave gating calls the provided dirty-check with the current selected user, letting `src/views/UsersView.vue` pass `useUserFormState().hasUnsavedDetailChanges` directly.
- Removed the route-local `applySelectedUserToForm` and `hasUnsavedDetailChanges` wrappers from `src/views/UsersView.vue`.
- Updated `src/__tests__/useAdminRecordsSync.spec.ts` and `src/__tests__/useAdminActions.spec.ts` expectations so selected-user hydration clears pending timers inside the sync composable and dirty checks receive the selected user inside the action composable.
- Updated component architecture, testing strategy, and gap-audit docs so Users selected-user dirty checks and clear-before-hydrate behavior are tracked with the admin composables.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminActions.spec.ts src/__tests__/useAdminRecordsSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R599`:

- Moved Employee detail snapshot/dirty-check ownership into `src/features/employees/useEmployeeFormState.ts`, matching the Users form-state boundary.
- Updated `src/features/employees/useEmployeeActions.ts` to receive `hasUnsavedDetailChanges(employee)` from form state instead of owning snapshot comparison helpers.
- Updated `src/views/EmployeesView.vue` to pass the form-state dirty checker into the employee action composable.
- Extended `src/__tests__/useAdminFormState.spec.ts` and `src/__tests__/useAdminActions.spec.ts` expectations for Employee detail snapshots and selected-employee dirty checks.
- Updated component architecture, testing strategy, and gap-audit docs so Employee selected-record dirty checks are tracked with admin form/action composables.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminActions.spec.ts src/__tests__/useAdminFormState.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R600`:

- Updated `src/features/users/useUserAdminRecords.ts` and `src/features/employees/useEmployeeAdminRecords.ts` so selected-record ids use the shared `WritableRef` contract instead of importing Vue's concrete `Ref` type.
- Updated `src/features/users/useUserAdminViewSync.ts` and `src/features/employees/useEmployeeAdminViewSync.ts` so selected records use shared `ReadonlyRef` inputs and selected ids use shared `WritableRef` inputs.
- Switched the sync composables' Vue watchers to getter sources for the neutral ref contracts, preserving the same selection/hydration behavior without requiring Vue-specific ref types in the public options.
- Updated component architecture, testing strategy, and gap-audit docs so admin records/sync neutral ref contracts are tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useAdminRecordsSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R601`:

- Updated `src/features/jobs/useJobConfirmDialogs.ts` so the selected job input uses the shared `ReadonlyRef` contract instead of Vue's concrete `ComputedRef` type.
- Updated `src/features/shopOrders/useShopOrderConfirmDialogs.ts` so the selected order input uses the shared `ReadonlyRef` contract instead of Vue's concrete `ComputedRef` type.
- Preserved all confirmation open/close/copy behavior while making Jobs and Shop Orders confirm-dialog adapters consistent with the neutral ref boundary used elsewhere.
- Updated component architecture and gap-audit docs so Jobs/Shop Orders neutral selected-record confirm-dialog contracts are tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 22/22.
- `npm run test:unit -- --run src/__tests__/useJobConfirmDialogs.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R602`:

- Updated `src/features/shopOrders/useShopOrderRecords.ts` so the current job id uses the shared `ReadonlyRef` contract instead of Vue's concrete `ComputedRef` type.
- Updated `src/features/shopOrders/useShopOrderMetaForm.ts` so selected-order/editability inputs use shared `ReadonlyRef` contracts.
- Updated `src/features/shopOrders/useShopOrderItemNotes.ts` so selected order uses the shared `ReadonlyRef` contract.
- Updated `src/features/shopOrders/useShopOrderSelectionSync.ts` so order-list and selection inputs use shared `ReadonlyRef` / `WritableRef` contracts, with getter-based watchers preserving the same hydration and fallback behavior.
- Updated component architecture, testing strategy, and gap-audit docs so Shop Orders records/selection/meta/item-note neutral ref contracts are tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderRecords.spec.ts src/__tests__/useShopOrderSelectionSync.spec.ts src/__tests__/useShopOrderMetaForm.spec.ts src/__tests__/useShopOrderItemNotes.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R603`:

- Updated `src/features/jobs/useJobDashboardLifecycle.ts` so the route job id uses the shared `ReadonlyRef` contract instead of Vue's concrete `ComputedRef` type.
- Switched the lifecycle watcher to a getter source, preserving mount-time subscribe, same-id no-op behavior, route-id resubscription, and unmount cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so Job Dashboard lifecycle neutral ref input is tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts --project=chromium`: passed, 1/1.
- `npm run test:unit -- --run src/__tests__/useJobDashboardLifecycle.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R604`:

- Updated `src/composables/useToastMessages.ts` so toast message sources use the shared `WritableRef<string>` contract instead of Vue's concrete `Ref<string>` type.
- Switched toast message watchers to getter sources, preserving severity defaults, feature summaries, filter predicates, duplicate-message suppression, and microtask clearing behavior.
- Updated component architecture, testing strategy, and gap-audit docs so shared toast-message neutral writable ref inputs are tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 18/18.
- `npm run test:unit -- --run src/__tests__/useAppToast.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R605`:

- Updated `src/composables/useActionConfirmDialog.ts` so the mutable `confirmAction` output uses the shared `WritableRef<TAction | null>` contract instead of Vue's concrete `ShallowRef` type.
- Preserved Vue `ComputedRef` return types for `confirmTitle`, `confirmMessage`, `confirmLabel`, and `confirmDestructive` after type-check proved plain structural readonly refs do not unwrap correctly in Vue templates.
- Preserved shared confirmation copy, destructive-state derivation, and busy-safe close behavior for Shop Catalog, job Timecards, and Timecard Export consumers.
- Updated component architecture, testing strategy, and gap-audit docs so the action-confirm neutral action ref plus intentional computed template outputs are tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/timecard-workbook.spec.ts --project=chromium`: passed, 35/35.
- `npm run test:unit -- --run src/__tests__/useActionConfirmDialog.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R606`:

- Updated `src/features/jobs/useJobNotificationRecipients.ts` so mutable message targets and global notification recipients use shared `WritableRef` contracts instead of Vue's concrete `Ref` type.
- Updated the same composable so the selected job input uses the shared `ReadonlyRef` contract instead of Vue's concrete `ComputedRef` type.
- Preserved create/job/all-jobs recipient validation, duplicate handling, selected-job/global persistence, failure input preservation, and save-state cleanup.
- Updated component architecture, testing strategy, and gap-audit docs so Jobs notification recipient neutral ref inputs are tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:unit -- --run src/__tests__/useJobNotificationRecipients.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R607`:

- Updated `src/features/timecards/useTimecardExportSideEffects.ts` so the ordered-card input uses the shared `ReadonlyRef` contract instead of Vue's concrete `ComputedRef` type.
- Widened the side-effect card list contract to readonly arrays, preserving job-burden redecorating and visible-card selection synchronization without allowing mutation through the watcher seam.
- Updated component architecture, testing strategy, and gap-audit docs so the Timecard Export side-effect neutral ref contract is tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportSideEffects.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R608`:

- Updated `src/features/shopCatalog/useShopCatalogTreeExpansion.ts` so the archive-filter input uses the shared `ReadonlyRef` contract instead of Vue's concrete `Ref` type.
- Updated `src/features/shopCatalog/useShopCatalogSelection.ts` so catalog map/item inputs use shared `ReadonlyRef` contracts instead of Vue `ComputedRef`/`Ref` contracts.
- Updated `src/features/shopCatalog/useShopCatalogForms.ts` so the active-folder input uses `ReadonlyRef` and message targets use `WritableRef` instead of Vue concrete `Ref` contracts.
- Updated `src/features/shopCatalog/useShopCatalogContextMenuActions.ts` so the root expansion state input uses the shared `ReadonlyRef` contract.
- Preserved Shop Catalog tree expansion, selection, form reset/hydration, context-menu action derivation, and real-route create/edit/archive/delete workflows.
- Updated component architecture, testing strategy, and gap-audit docs so Shop Catalog neutral ref input contracts are tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useShopCatalogTreeExpansion.spec.ts src/__tests__/useShopCatalogSelection.spec.ts src/__tests__/useShopCatalogContextMenuActions.spec.ts src/__tests__/useShopCatalogFormWorkflows.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R609`:

- Updated `src/features/timecards/useTimecardExportUiState.ts` so the edit-permission input uses the shared `ReadonlyRef` contract instead of Vue's concrete `Ref` type.
- Preserved Timecard Export mobile toolbar tab behavior, admin card edit-mode gating, edit-state reset/pruning, and the real export locked/editable mode workflow.
- Updated component architecture, testing strategy, and gap-audit docs so the Timecard Export UI-state neutral ref input is tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/useTimecardExportUiAdapters.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R610`:

- Updated `src/features/dailyLogs/useDailyLogDraftSave.ts` so editability, form, and selected-log inputs use shared neutral `ReadonlyRef` contracts instead of Vue concrete `ComputedRef`/`Ref` contracts.
- Updated `src/features/dailyLogs/useDailyLogRecipients.ts` so job/global-recipient/selected-log inputs use `ReadonlyRef` and the mutable log-list input uses `WritableRef`.
- Updated `src/features/dailyLogs/useDailyLogAttachments.ts` so editability/job/selected-log inputs use `ReadonlyRef` and the mutable form input uses `WritableRef`.
- Preserved Daily Log save-on-blur typing behavior, recipient add/remove persistence, attachment upload/delete persistence, submitted read-only state, and intentional draft creation/deletion workflows.
- Updated component architecture, testing strategy, and gap-audit docs so Daily Log neutral ref input contracts are tracked; also corrected the older Daily Log needed-composable note from `useDailyLogDraftAutosave` to the implemented `useDailyLogDraftSave`.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/useDailyLogDraftSave.spec.ts src/__tests__/useDailyLogRecipients.spec.ts src/__tests__/useDailyLogAttachments.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R611`:

- Audited the remaining concrete Vue ref-type imports after the neutral-ref cleanup pass.
- Confirmed `src/composables/useActionConfirmDialog.ts` should retain Vue `ComputedRef` outputs because route/component templates rely on computed ref unwrapping for dialog copy/destructive props.
- Confirmed `src/composables/useSubscribedValue.ts` should retain its Vue `Ref<TValue>` value output because Jobs and Daily Logs pass subscribed values directly into Vue templates; a structural `WritableRef` replacement failed `npm run type-check` with template prop unwrapping errors and was reverted.
- Updated component architecture, testing strategy, and gap-audit docs to record these intentional Vue-native output exceptions so future neutral-ref cleanup stays targeted at input contracts and non-template-facing seams.
- `npm run type-check`: passed after preserving the Vue-native `useSubscribedValue` output.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.

2026-07-15 `R612`:

- Refactored `src/auth/capabilities.ts` so current `admin` / `foreman` / `none` behavior is centralized in `CURRENT_ROLE_CAPABILITIES` plus a route-capability map instead of repeated hard-coded role checks.
- Added `getCurrentRoleCapabilities()` as the current-state role capability profile seam, preserving temporary `project-manager`-as-foreman behavior without exposing Payroll or Shop Foreman before rules/functions/UI are ready.
- Extended `src/__tests__/capabilities.spec.ts` to lock the centralized current capability matrix.
- Updated auth, gap-audit, testing-strategy, and execution-board docs so the current capability-matrix seam is tracked ahead of the later target-role implementation.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 7/7.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts src/__tests__/roles.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed, and the requested unsandboxed rerun was rejected by the environment.

2026-07-15 `R613`:

- Added `getNextDailyLogSelectionId()` to `src/features/dailyLogs/viewHelpers.ts` so Daily Log subscription updates use one pure helper for preserving visible selections and falling back to the preferred submitted/draft log without creating drafts implicitly.
- Updated `useDailyLogSubscriptions` to delegate visible-log filtering and fallback selection to that helper instead of duplicating the rule inline.
- Extended `src/__tests__/dailyLogSelectionState.spec.ts` to cover next-selection preservation, hidden draft fallback, all-log viewer preservation, own submitted fallback, and empty-result clearing.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so Daily Log view-first selection fallback is tracked as an isolated helper/composable seam.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 11/11.
- `npm run test:unit -- --run src/__tests__/dailyLogSelectionState.spec.ts src/__tests__/useDailyLogSubscriptions.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed.

2026-07-15 `R614`:

- Added `getNextShopOrderSelectionId()` to `src/features/shopOrders/viewHelpers.ts` so Shop Order record updates use one pure helper for preserving the current order selection, falling back to the first available order, or clearing selection.
- Updated `useShopOrderSelectionSync` to delegate its order-list watcher fallback decision to that helper instead of duplicating the rule inline.
- Extended `src/__tests__/useShopOrderSelectionSync.spec.ts` to cover the pure fallback helper without creating or mutating orders.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so Shop Order selection fallback is tracked as an isolated helper/composable seam.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.
- `npm run test:unit -- --run src/__tests__/useShopOrderSelectionSync.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed.

2026-07-15 `R615`:

- Extended `src/components/common/AppSplitWorkspace.vue` with behavior-preserving `fixed`, `equal`, and `single` layout modes while keeping `fixed` as the default for existing Users/Employees consumers.
- Guarded the medium-screen primary-pane max-height rule so single-pane consumers such as the normal Jobs browser do not inherit the two-pane directory/editor height cap.
- Migrated `src/views/JobsView.vue` off route-local split/single workspace CSS and onto the shared `AppSplitWorkspace` primitive, using `single` mode for the normal browser-only page and `equal` mode for admin edit mode.
- Extended `src/__tests__/AppSplitWorkspace.spec.ts` to pin the new mode classes while preserving the existing slot, active-panel, custom-key, width, and attrs contract.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so Jobs workspace layout ownership is tracked as a shared primitive seam.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:unit -- --run src/__tests__/AppSplitWorkspace.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the spec executed, and the requested unsandboxed rerun was rejected by the environment.

2026-07-15 `R616`:

- Added `src/components/dailyLogs/DailyLogWorkspaceShell.vue` to own the Daily Log page header/main/sidebar layout and responsive two-column grid.
- Migrated `src/views/DailyLogsView.vue` off route-local page/grid CSS and onto the feature workspace shell while keeping draft save, submit, recipients, attachments, date navigation, subscriptions, and route job context owned by existing composables.
- Added `src/__tests__/DailyLogWorkspaceShell.spec.ts` to pin the shell slot and test-id contract.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so Daily Log page layout ownership is tracked as a feature component seam.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/DailyLogWorkspaceShell.spec.ts`: passed, 1/1, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-recipients.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 11/11.

2026-07-15 `R617`:

- Added `src/components/jobs/JobDashboardWorkspaceShell.vue` to own the Job Dashboard page test-id, header/module slots, and route-level grid spacing.
- Migrated `src/views/JobDashboardView.vue` off route-local workspace CSS and onto the feature workspace shell while keeping route job context, subscription lifecycle, and module definitions in the route container.
- Extended `src/__tests__/JobDashboardComponents.spec.ts` to pin the dashboard workspace shell slot/test-id contract alongside the existing header/module launcher contracts.
- Updated component architecture, testing strategy, and execution-board docs so Job Dashboard page layout ownership is tracked as a feature component seam.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/JobDashboardComponents.spec.ts`: passed, 5/5, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts --project=chromium`: passed, 1/1.

2026-07-15 `R618`:

- Added `src/features/jobs/jobDashboardModules.ts` as the pure feature helper that owns the current Job Dashboard module launcher definitions and returns fresh module records for callers.
- Migrated `src/views/JobDashboardView.vue` off inline module definition data so the route shell asks the feature helper for dashboard modules while keeping route job context and lifecycle wiring unchanged.
- Added `src/__tests__/jobDashboardModules.spec.ts` to pin current module order/copy/routes and fresh-copy behavior ahead of later role-aware dashboard filtering.
- Updated component architecture, testing strategy, and execution-board docs so the Job Dashboard module-definition seam is tracked separately from route rendering.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/jobDashboardModules.spec.ts src/__tests__/JobDashboardComponents.spec.ts`: passed, 7/7, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts --project=chromium`: passed, 1/1.

2026-07-15 `R619`:

- Added `src/components/timecards/TimecardPrintRouteContent.vue` to own the Timecard Export print-route screen toolbar, missing-payload state, document/page shells, one-card empty slot, and copied route print CSS while leaving `TimecardPrintCard` as the protected exact card renderer.
- Migrated `src/views/TimecardExportPrintView.vue` off route-local print markup/CSS so it now only loads the stored export payload through `useTimecardPrintRoute` and composes `TimecardPrintRouteContent`.
- Added `src/__tests__/TimecardPrintRouteContent.spec.ts` to pin the print-route shell contract without depending on the inner exact-card renderer.
- Fixed the print-card zero-production display flag so zero-only production/off cells stay blank in `TimecardPrintCard`, matching the protected component test and prior user-facing print requirement.
- Updated `src/__tests__/useTimecardPrintRoute.spec.ts` to assert loaded payload equality by value instead of brittle reactive identity.
- Updated component architecture, testing strategy, and execution-board docs so Timecard Export print-route rendering ownership is tracked separately from print-route orchestration and exact-card visual fidelity.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/TimecardPrintRouteContent.spec.ts src/__tests__/useTimecardPrintRoute.spec.ts src/__tests__/TimecardPrintCard.spec.ts`: passed, 9/9, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R620`:

- Migrated the scaffold-only `src/views/ReferenceListView.vue` placeholder from route-local `catalog-tree-preview` markup/CSS to the existing shared `ModulePlaceholder` primitive.
- Removed the route's bespoke scoped placeholder styles while preserving the real admin route, page test id, PagePanel shell, and visible "List management scaffold" copy.
- Updated component architecture docs to make the Reference List boundary explicit: the page remains scaffold-level and should not grow fake CRUD components before the actual feature is implemented.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/FoundationalComponents.spec.ts`: passed, 4/4, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-15 `R621`:

- Added `src/components/auth/AuthFirebaseConfigWarning.vue` to own the shared missing-Firebase-configuration warning copy and warning tone used by public auth routes.
- Migrated `src/views/LoginView.vue` and `src/views/ForgotPasswordView.vue` off duplicated warning markup while preserving their existing `hasFirebaseConfig` display and disabled-submit behavior.
- Extended `src/__tests__/FoundationalComponents.spec.ts` to pin the shared auth warning copy and warning status styling alongside the foundational `AuthCard`, `PagePanel`, and `ModulePlaceholder` contracts.
- Updated component architecture and testing strategy docs so shared auth warning ownership is tracked separately from public auth route behavior.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/FoundationalComponents.spec.ts`: passed, 5/5, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.

2026-07-15 `R622`:

- Added `src/components/auth/AuthStatusMessage.vue` as the shared auth-page wrapper around `AppStatusMessage`, preserving the auth-card status chrome while letting each route own its loading or verification copy.
- Migrated `src/views/LoginView.vue`, `src/views/ForgotPasswordView.vue`, and `src/views/SetPasswordView.vue` off duplicated `AppStatusMessage class="auth-card__status"` markup.
- Updated `src/components/auth/AuthFirebaseConfigWarning.vue` to compose through the shared auth status wrapper so warning tone/copy stays centralized without duplicating auth-card status markup.
- Extended `src/__tests__/FoundationalComponents.spec.ts` to pin the auth status chrome and inherited status/tone behavior.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so auth status-message ownership is tracked as a public auth primitive.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/FoundationalComponents.spec.ts`: passed, 6/6, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.

2026-07-15 `R623`:

- Added `src/components/auth/AuthSubmitButton.vue` as the shared auth-page wrapper around `AppLoadingButton`, preserving auth-card button chrome and default primary submit behavior while routes keep labels and pending state.
- Added `src/components/auth/AuthTextLink.vue` as the shared auth-page wrapper around `RouterLink`, preserving auth-card link chrome while routes keep destination and copy.
- Migrated `src/views/LoginView.vue`, `src/views/ForgotPasswordView.vue`, and `src/views/SetPasswordView.vue` off duplicated auth-card button/link markup without changing route-owned login/reset/setup behavior.
- Extended `src/__tests__/FoundationalComponents.spec.ts` to pin auth submit-button loading/default-submit behavior and auth text-link route target/chrome behavior.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so auth form action ownership is tracked with the rest of the public auth primitives.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/FoundationalComponents.spec.ts`: passed, 8/8, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.

2026-07-15 `R624`:

- Added `src/components/common/DirectoryEditorWorkspaceShell.vue` as the shared Users/Employees admin directory-editor shell, composing `AppShell`, `AppSplitWorkspace`, and `AppMobilePanelTabs` while preserving route-owned subscriptions, filtering, saves, datalists, and confirmation workflows through slots.
- Migrated `src/views/UsersView.vue` and `src/views/EmployeesView.vue` off repeated app-shell/split-workspace/mobile-tabs markup without changing their feature panels, create/edit/delete actions, or existing `data-testid` contracts.
- Added `src/__tests__/DirectoryEditorWorkspaceShell.spec.ts` to pin app-shell composition, split-workspace attr forwarding, directory/editor panel keys, mobile tab copy/state, primary/secondary/default slot rendering, and tab-selection emits.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so the shared directory-editor shell is tracked as a reusable layout primitive.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/DirectoryEditorWorkspaceShell.spec.ts src/__tests__/AppSplitWorkspace.spec.ts src/__tests__/AppMobilePanelTabs.spec.ts`: passed, 7/7, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.
- `npm run test:e2e -- e2e/admin-management.spec.ts --project=chromium`: passed, 3/3.

2026-07-15 `R625`:

- Added `src/components/jobs/JobsWorkspaceShell.vue` as the feature-level Jobs page shell, composing `AppShell` and `AppSplitWorkspace` while owning the Jobs edit-mode topbar action, single/equal workspace mode selection, and primary/secondary/default slot layout.
- Migrated `src/views/JobsView.vue` off direct `AppShell`, topbar edit button, and `AppSplitWorkspace` markup while preserving route-owned auth checks, subscriptions, job selection, create/detail forms, recipient persistence, archive/delete actions, datalist rendering, and confirmation workflow.
- Added `src/__tests__/JobsWorkspaceShell.spec.ts` to pin admin edit action copy/events, field-user edit-control hiding, workspace mode selection, attr forwarding, and slot rendering.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so Jobs shell ownership is tracked separately from Jobs route orchestration.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/JobsWorkspaceShell.spec.ts src/__tests__/AppSplitWorkspace.spec.ts`: blocked by environment. The sandboxed run hit the known Windows/Vite `spawn EPERM` startup error before the specs executed, and the requested escalated rerun was rejected because the environment reported the Codex usage limit had been hit.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 7/7.

2026-07-16 `R626`:

- Added `src/components/dailyLogs/DailyLogPageShell.vue` as the Daily Logs feature page shell, composing `AppShell` and `DailyLogWorkspaceShell` while preserving route-owned header/main/sidebar/default dialog slots.
- Added `src/components/shopOrders/ShopOrderPageShell.vue` as the Shop Orders feature page shell, composing `AppShell` and `ShopOrderExplorerShell` while preserving route-owned catalog/workspace/default dialog slots.
- Migrated `src/views/DailyLogsView.vue` and `src/views/ShopOrdersView.vue` off direct `AppShell` composition without changing subscriptions, save behavior, draft/view-first workflow, catalog/custom item actions, attachment flows, submit flows, or confirmation handling.
- Added `src/__tests__/DailyLogPageShell.spec.ts` and `src/__tests__/ShopOrderPageShell.spec.ts` to pin app-shell composition, inner shell composition, attr forwarding, named slots, and default dialog-slot rendering.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so Daily Log and Shop Order page-shell ownership is tracked separately from their inner workspace/explorer shells.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/DailyLogPageShell.spec.ts src/__tests__/ShopOrderPageShell.spec.ts src/__tests__/DailyLogWorkspaceShell.spec.ts src/__tests__/ShopOrderExplorerShell.spec.ts`: passed, 4/4, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 26/26.

2026-07-16 `R627`:

- Added `src/components/timecards/TimecardPageShell.vue` as the shared Timecard page shell for job Timecards and Timecard Export, composing `AppShell` and `TimecardWorkspaceShell` while preserving route-owned workspace/default dialog slots.
- Migrated `src/views/TimecardsView.vue` and `src/views/TimecardExportView.vue` off direct `AppShell` and `TimecardWorkspaceShell` composition without changing workbook rendering, save queues, week/card workflows, export filters, PDF/CSV actions, or confirmation handling.
- Added `src/__tests__/TimecardPageShell.spec.ts` to pin app-shell composition, workspace-shell composition, attr forwarding, workspace slot rendering, and default dialog-slot rendering.
- Hardened the empty-state assertion in `src/__tests__/TimecardPageMessages.spec.ts` so it checks the user-visible no-message contract instead of Vue's internal empty `v-if` comment markup.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so Timecard page-shell ownership is tracked separately from the protected workbook/workspace shell.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/TimecardPageShell.spec.ts src/__tests__/TimecardWorkspaceShell.spec.ts src/__tests__/TimecardPageMessages.spec.ts`: passed, 5/5, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 35/35.

2026-07-16 `R628`:

- Added `src/components/shopCatalog/ShopCatalogPageShell.vue` as the Shop Catalog admin page shell, composing `AppShell` and `ShopCatalogExplorerShell` while preserving route-owned mobile-nav, catalog, inspector, context-menu, and default dialog slots.
- Migrated `src/views/ShopCatalogAdminView.vue` off direct `AppShell` and `ShopCatalogExplorerShell` composition without changing catalog subscriptions, tree filtering, responsive panel state, inline create/rename, drag/drop, context menus, archive/restore/delete, form save behavior, or confirmation handling.
- Added `src/__tests__/ShopCatalogPageShell.spec.ts` to pin app-shell composition, explorer-shell composition, active panel forwarding, attr forwarding, feature slots, and default dialog-slot rendering.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so Shop Catalog page-shell ownership is tracked separately from explorer/tree/inspector workflow ownership.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/ShopCatalogPageShell.spec.ts src/__tests__/ShopCatalogExplorerShell.spec.ts`: passed, 3/3, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-16 `R629`:

- Added `src/components/jobs/JobDashboardPageShell.vue` as the Job Dashboard page shell, composing `AppShell` and `JobDashboardWorkspaceShell` while preserving route-owned job context, lifecycle, dashboard header, module grid, and future widget extension points through slots.
- Added `src/components/referenceLists/ReferenceListPageShell.vue` as the Reference List scaffold page shell, composing `AppShell`, `PagePanel`, and `ModulePlaceholder` so `ReferenceListView` stays helper-only until real reference-list CRUD work begins.
- Migrated `src/views/JobDashboardView.vue` and `src/views/ReferenceListView.vue` off direct `AppShell` usage; `rg "import AppShell|<AppShell|</AppShell" src/views -n` now returns no matches.
- Added `src/__tests__/JobDashboardPageShell.spec.ts` and `src/__tests__/ReferenceListPageShell.spec.ts` to pin app-shell composition, inner-shell/page-panel composition, attr forwarding, slot rendering, and scaffold copy.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so the final direct route-view `AppShell` boundary is closed and tracked.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/JobDashboardPageShell.spec.ts src/__tests__/JobDashboardComponents.spec.ts src/__tests__/ReferenceListPageShell.spec.ts src/__tests__/referenceListViewHelpers.spec.ts`: passed, 10/10, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/job-dashboard.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 14/14.

2026-07-16 `R630`:

- Closed the earlier `R625` Jobs shell unit-test evidence gap now that the Windows/Vite unit-test escalation path is available again.
- `npm run test:unit -- --run src/__tests__/JobsWorkspaceShell.spec.ts src/__tests__/AppSplitWorkspace.spec.ts`: passed, 6/6, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R631`:

- Extended the shared `readInputValue` DOM helper to support `HTMLTextAreaElement` values in addition to text inputs, preserving empty-string fallback for non-text-entry events.
- Migrated `AppTextarea` to the shared text-entry DOM helper and brought its styling contract up to the other input primitives with color, color-scheme, font, placeholder, focus-border, focus-background, focus-outline, and focus-shadow CSS-variable hooks.
- Added `src/__tests__/domEvents.spec.ts` to cover input value reads, textarea value reads, and non-text-entry fallback behavior.
- Updated component architecture, testing strategy, and execution-board docs so textarea/event-helper polish is tracked as a shared design-system slice.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/AppTextarea.spec.ts src/__tests__/AppTextInput.spec.ts src/__tests__/AppSearchInput.spec.ts src/__tests__/domEvents.spec.ts`: passed, 16/16, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/daily-log-typing.spec.ts e2e/daily-log-draft.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 10/10.

2026-07-16 `R632`:

- Added `src/auth/targetRoleCapabilities.ts` as a non-runtime target capability matrix for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users.
- Documented the requested target boundaries without exposing Payroll or Shop Foreman in current editable user controls and without changing the live `project-manager`-as-field-workflow behavior.
- Added `src/__tests__/targetRoleCapabilities.spec.ts` to pin target role labels, normalization, assignable job roles, and capability expectations ahead of the later runtime role/rules/functions migration.
- Updated auth, component architecture, testing strategy, gap-audit, and execution-board docs so the target matrix is tracked as a tested planning seam rather than implied live enforcement.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/roles.spec.ts src/__tests__/capabilities.spec.ts`: passed, 28/28, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/admin-pages.spec.ts --project=chromium`: passed, 20/20.

2026-07-16 `R633`:

- Added `src/services/firebaseConfig.ts` as the service-owned Firebase configuration flag used by public auth routes.
- Migrated `LoginView`, `ForgotPasswordView`, and `SetPasswordView` off direct `@/firebase` imports while preserving existing warning, disabled-submit, and setup-link behavior.
- Added `src/__tests__/architectureBoundaries.spec.ts` to fail if route views, components, features, or composables import `@/firebase` or Firebase SDK packages directly.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so the frontend Firebase boundary is test-backed.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/architectureBoundaries.spec.ts src/__tests__/FoundationalComponents.spec.ts src/__tests__/authViewHelpers.spec.ts`: passed, 18/18, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/public-routes.spec.ts --project=chromium`: passed, 5/5.

2026-07-16 `R634`:

- Added `AuthSessionUser`, `normalizeAuthSessionUser`, `subscribeAuthSession`, `signInWithPassword`, and `signOutOfAuthSession` to `src/services/auth.ts` so Firebase Auth session mechanics live behind the auth service boundary.
- Migrated `src/stores/auth.ts` off direct Firebase Auth and `@/firebase` imports while preserving Pinia auth-state orchestration, profile hydration retry behavior, E2E auth state, sign-out cleanup, active-user enforcement, and capability derivation.
- Expanded `src/__tests__/architectureBoundaries.spec.ts` to guard stores alongside views, components, features, and composables, and extended `src/__tests__/authService.spec.ts` to cover auth-session user normalization.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so services are now the explicit frontend Firebase/Auth SDK boundary.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `rg -n '@/firebase' src/views src/components src/features src/composables src/stores`: no matches.
- `rg -n "from 'firebase/" src/views src/components src/features src/composables src/stores`: no matches.
- `npm run test:unit -- --run src/__tests__/architectureBoundaries.spec.ts src/__tests__/authService.spec.ts src/__tests__/authViewHelpers.spec.ts`: passed, 14/14, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/access-control.spec.ts --project=chromium`: passed, 12/12.

2026-07-16 `R635`:

- Expanded `src/__tests__/architectureBoundaries.spec.ts` with a component dependency boundary that fails if `src/components/**` imports `@/services/*` or `@/stores/*` directly, and extended the Firebase import guard to include layouts and router guards.
- Documented the component dependency rule in component architecture, testing strategy, and gap-audit docs so components stay focused on props/events while persistence and cross-page state remain in views, stores, feature composables, or services.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `rg -n "@/firebase" src/views src/components src/layouts src/router src/features src/composables src/stores`: no matches.
- `rg -n "firebase/" src/views src/components src/layouts src/router src/features src/composables src/stores`: no matches.
- `npm run test:unit -- --run src/__tests__/architectureBoundaries.spec.ts`: passed, 3/3, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R636`:

- Added `src/features/navigation/appShellNavigation.ts` as the pure policy seam for AppShell workspace navigation, admin navigation, route-capability filtering, and role-label copy.
- Migrated `src/layouts/AppShell.vue` off inline navigation item arrays and direct capability/role-label imports while preserving mobile-nav state, sign-out orchestration, and rendered sidebar/topbar layout.
- Added `src/__tests__/appShellNavigation.spec.ts` to pin current Jobs workspace navigation, admin-only sidebar links, and role-label copy ahead of future role-dashboard navigation work.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so AppShell navigation policy is tracked separately from app chrome rendering.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/appShellNavigation.spec.ts src/__tests__/capabilities.spec.ts`: passed, 19/19, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/access-control.spec.ts --project=chromium`: passed, 12/12.

2026-07-16 `R637`:

- Added `src/features/dashboard/roleDashboardModules.ts` as a non-runtime target role-dashboard module policy derived from `targetRoleCapabilities`.
- Captured target modules for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users without wiring a live `/dashboard` route or exposing target roles before rules/functions/runtime roles are ready.
- Added `src/__tests__/roleDashboardModules.spec.ts` to pin role-dashboard module keys, priority order, role-specific module visibility, and fresh module record behavior.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so target role dashboards are tracked as a tested planning seam beside the target role capability matrix.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/roleDashboardModules.spec.ts src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/jobDashboardModules.spec.ts`: passed, 18/18, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R638`:

- Added `src/router/routeAccess.ts` as the pure router access decision seam for public-route redirects, workspace access, route capability metadata, assigned-job route access, visible-job fallback access, and the temporary unassigned-timecard route exception.
- Migrated `src/router/index.ts` so the Vue Router guard initializes auth/job store state, normalizes route params/meta, and delegates access decisions to the helper while preserving route metadata and redirects.
- Added `src/__tests__/routeAccess.spec.ts` to pin current router guard behavior ahead of the target role/rules/dashboard migration.
- Updated component architecture, testing strategy, gap-audit, and execution-board docs so route access policy is tracked separately from Vue Router wiring.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/routeAccess.spec.ts src/__tests__/capabilities.spec.ts`: passed, 25/25, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/access-control.spec.ts --project=chromium`: passed, 12/12.

2026-07-16 `R639`:

- Added `src/auth/targetJobAccess.ts` as a non-runtime target job-access policy seam for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users.
- Captured target behavior for job-list visibility, job-dashboard entry, job setup editing, job creation, and job delete/archive rights without wiring the target roles into live routes or Firestore Rules yet.
- Added `src/__tests__/targetJobAccess.spec.ts` to pin target job-scoped access policy beside the existing target role capability and role-dashboard planning tests.
- Updated component architecture, testing strategy, auth/user-flow, gap-audit, and execution-board docs so target job access is tracked separately from current runtime route access.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetJobAccess.spec.ts src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/roleDashboardModules.spec.ts`: passed, 22/22, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R640`:

- Added explicit `density`, `elevation`, and `tone` visual variant props to `AppCard` and `AppPane` so future GUI polish can use shared surface APIs instead of page-specific card/pane styling.
- Kept default rendering backward-compatible and preserved existing CSS-variable override paths for dense feature sections.
- Updated `AppCard` and `AppPane` default styles to use normalized color, radius, spacing, and shadow tokens where the existing visual contract already matched those token categories.
- Extended `src/__tests__/AppCard.spec.ts` and `src/__tests__/AppPane.spec.ts` to pin the shared surface variant class contracts.
- Updated component architecture, testing strategy, CSS architecture, and execution-board docs so shared surface variants are tracked as part of the visual-system refactor.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/AppCard.spec.ts src/__tests__/AppPane.spec.ts src/__tests__/FoundationalComponents.spec.ts`: passed, 20/20, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/admin-pages.spec.ts e2e/daily-log-draft.spec.ts --project=chromium`: passed, 18/18.

2026-07-16 `R641`:

- Added an explicit compact/default/spacious `density` prop to `AppSplitWorkspace` so shared two-pane workspaces can opt into token-backed spacing without route-local split-grid CSS.
- Kept default rendering backward-compatible while replacing the hard-coded split-workspace gap with a normalized spacing-token fallback.
- Extended `src/__tests__/AppSplitWorkspace.spec.ts` to pin compact/spacious density classes and default density behavior.
- Updated component architecture, testing strategy, CSS architecture, and execution-board docs so split-workspace density is tracked as part of the visual-system refactor.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/AppSplitWorkspace.spec.ts src/__tests__/DirectoryEditorWorkspaceShell.spec.ts src/__tests__/JobsWorkspaceShell.spec.ts`: passed, 9/9, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 6/6.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-16 `R642`:

- Named the current runtime role catalog in `src/auth/roles.ts`, including stored role keys, editable user-role keys, current labels, and the default editable role.
- Kept live behavior unchanged: editable user controls still expose only Foreman, Project Manager, and Admin, while Payroll and Shop Foreman remain target-only until rules/functions/routes are migrated together.
- Updated `src/__tests__/roles.spec.ts` to pin the current runtime role catalog separately from the target role capability plan.
- Updated auth/user-flow and testing-strategy docs so the current-vs-target role boundary is explicit before runtime role implementation begins.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/roles.spec.ts src/__tests__/capabilities.spec.ts src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/roleDashboardModules.spec.ts`: passed, 42/42, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 10/10.

2026-07-16 `R643`:

- Reused the shared current editable-role helper in `src/services/users.ts` so user create/update payload sanitization no longer carries a separate role-name branch.
- Reused the shared current default editable role and editable-role normalizer in `useUserFormState`, including selected-user hydration and assignment cleanup based on assignable-role policy instead of a direct admin-only branch.
- Updated `UserEditorPanel` unit copy assertion to match the current saved-status text rendered by the component.
- Updated auth/user-flow and testing-strategy docs so the user admin role workflow is tracked as a consumer of the shared current role catalog.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/roles.spec.ts src/__tests__/useAdminFormState.spec.ts src/__tests__/useAdminActions.spec.ts src/__tests__/UserEditorPanel.spec.ts`: passed, 25/25, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/admin-management.spec.ts --project=chromium`: passed, 3/3.

2026-07-16 `R644`:

- Moved current runtime role normalization, effective-role mapping, and assignable-job policy into `src/auth/roles.ts`.
- Removed runtime role-policy helpers from `src/types/domain.ts` so shared domain types no longer own auth behavior.
- Migrated auth/profile normalization, capability derivation, Users service/form/actions/components, Jobs foreman filtering, Timecard Export foreman filtering, and the E2E runtime to consume the auth-owned current role helpers.
- Extended `src/__tests__/roles.spec.ts` to pin stored-role normalization, current effective-role behavior, and assignable-job policy directly from the auth layer.
- Updated auth/user-flow and testing-strategy docs so the role boundary reflects auth-owned current role behavior.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/roles.spec.ts src/__tests__/capabilities.spec.ts src/__tests__/authService.spec.ts src/__tests__/useAdminFormState.spec.ts src/__tests__/useAdminActions.spec.ts src/__tests__/UserEditorPanel.spec.ts src/__tests__/jobViewHelpers.spec.ts src/__tests__/timecardExportViewHelpers.spec.ts`: passed, 51/51, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/access-control.spec.ts e2e/admin-management.spec.ts --project=chromium`: passed, 10/10.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 13/13.

2026-07-16 `R645`:

- Added `src/auth/targetFieldEmailRecipients.ts` as a non-runtime target field-email recipient policy seam for Daily Log and Shop Order recipient resolution.
- Captured target behavior for assigned Foremen, assigned Project Managers, Shop Foremen on the Shop job, Shop Foremen on assigned non-Shop jobs, inactive users, missing emails, unassigned users, and Admin/Payroll/no-access users without wiring live email delivery yet.
- Added `src/__tests__/targetFieldEmailRecipients.spec.ts` to pin the target automatic field-email recipient policy beside the existing target role capability and target job-access planning tests.
- Updated auth/user-flow, component architecture, testing strategy, role-capability matrix, and execution-board docs so automatic field-email recipient policy is tracked separately from the later Cloud Functions/rules implementation.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetFieldEmailRecipients.spec.ts src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/targetJobAccess.spec.ts`: passed, 21/21, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- No runtime E2E was required because the helper is a non-runtime target policy seam and is not wired into live routes or Cloud Functions yet.

2026-07-16 `R646`:

- Added explicit target timecard capability flags for timecard locking, draft-week deletion, assigned-job timecard editing, and Shop job timecard editing.
- Added `src/auth/targetTimecardAccess.ts` as a non-runtime target timecard policy seam for separating Timecard Export/locking, job timecard workflow edit/submit access, submitted-timecard viewing, and Project Manager assigned-job submitted-timecard reporting.
- Added `src/__tests__/targetTimecardAccess.spec.ts` and extended `src/__tests__/targetRoleCapabilities.spec.ts` so the target Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access timecard boundaries are pinned before live role/rules/dashboard wiring.
- Updated auth/user-flow, component architecture, testing strategy, role-capability matrix, and execution-board docs so target timecard policy is tracked separately from runtime route/rules/function changes.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetTimecardAccess.spec.ts src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/roleDashboardModules.spec.ts`: passed, 28/28, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- No runtime E2E was required because the helper is a non-runtime target policy seam and is not wired into live routes, rules, or Cloud Functions yet.

2026-07-16 `R647`:

- Added `src/auth/targetJobAssignments.ts` as the shared assigned-job membership helper for target role planning seams.
- Migrated `targetJobAccess`, `targetFieldEmailRecipients`, and `targetTimecardAccess` off duplicate local assigned-job checks so future route/dashboard/email/timecard policy wiring shares one job-id guard.
- Added `src/__tests__/targetJobAssignments.spec.ts` to pin concrete job matching and missing-job/list behavior.
- Updated auth/user-flow, component architecture, testing strategy, role-capability matrix, and execution-board docs so target assigned-job membership is tracked as a reusable policy primitive.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetJobAssignments.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/targetFieldEmailRecipients.spec.ts src/__tests__/targetTimecardAccess.spec.ts src/__tests__/targetRoleCapabilities.spec.ts`: passed, 29/29, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- No runtime E2E was required because the helper is a non-runtime target policy primitive and is not wired into live routes, rules, or Cloud Functions yet.

2026-07-16 `R648`:

- Added explicit target field-workflow edit flags for assigned field workflows and Shop job field workflows.
- Added `src/auth/targetFieldWorkflowAccess.ts` as a non-runtime target policy seam for Daily Log and Shop Order module viewing, submitted-record viewing, draft creation/editing, and submission rights.
- Captured the view-first Project Manager target behavior: assigned Project Managers can open/view assigned Daily Log and Shop Order modules, but cannot create/edit/submit until the company explicitly confirms PM field entry.
- Added `src/__tests__/targetFieldWorkflowAccess.spec.ts` and extended `src/__tests__/targetRoleCapabilities.spec.ts` so Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access Daily Log/Shop Order boundaries are pinned before live route/rules/function wiring.
- Updated auth/user-flow, component architecture, testing strategy, role-capability matrix, and execution-board docs so target field-workflow policy is tracked separately from runtime route/rules/function changes.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetFieldWorkflowAccess.spec.ts src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/targetJobAssignments.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/targetFieldEmailRecipients.spec.ts`: passed, 29/29, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- No runtime E2E was required because the helper is a non-runtime target policy seam and is not wired into live routes, rules, or Cloud Functions yet.

2026-07-16 `R649`:

- Added `src/auth/targetRouteCapabilities.ts` as a non-runtime target route/workspace capability seam for the future Vue Router and AppShell navigation migration.
- Captured target protected-route behavior for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users without changing current runtime route guards.
- Added `src/__tests__/targetRouteCapabilities.spec.ts` to pin target route metadata recognition, workspace access gating, Admin full protected-route access, Payroll Employees/Timecard Export access, Shop Foreman Shop Catalog access, and PM/Foreman/no-access protected-route denials.
- Updated auth/user-flow, component architecture, testing strategy, role-capability matrix, and execution-board docs so target route capability policy is tracked separately from the current runtime route access helper.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetRouteCapabilities.spec.ts src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/roleDashboardModules.spec.ts src/__tests__/capabilities.spec.ts src/__tests__/routeAccess.spec.ts`: passed, 47/47, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- No runtime E2E was required because the helper is a non-runtime target policy seam and is not wired into live Vue Router, AppShell navigation, rules, or Cloud Functions yet.

2026-07-16 `R650`:

- Added `src/features/navigation/targetAppShellNavigation.ts` as a non-runtime target AppShell navigation policy seam for the future role-dashboard/sidebar migration.
- Captured target workspace navigation for Dashboard/Jobs, target admin/sidebar route links filtered through target route capabilities, and target role-label copy for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users without changing the current live AppShell.
- Added `src/__tests__/targetAppShellNavigation.spec.ts` to pin target workspace links, no-access navigation blocking, admin/payroll/shop-foreman protected-link visibility, PM/Foreman protected-link denials, centralized role labels, and fresh returned navigation records.
- Updated auth/user-flow, component architecture, testing strategy, role-capability matrix, and execution-board docs so target AppShell navigation is tracked separately from the current runtime sidebar helper.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetAppShellNavigation.spec.ts src/__tests__/targetRouteCapabilities.spec.ts src/__tests__/appShellNavigation.spec.ts src/__tests__/roleDashboardModules.spec.ts`: passed, 24/24, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- No runtime E2E was required because the helper is a non-runtime target policy seam and is not wired into the live AppShell, Vue Router, rules, or Cloud Functions yet.

2026-07-16 `R651`:

- Added `src/router/targetRouteAccess.ts` as a non-runtime target Vue Router access decision seam for the future target-role route guard migration.
- Captured target public-entry redirects to the role dashboard, protected workspace gating, protected admin route capability checks, assigned-job dashboard routing, Shop job routing for Shop Foremen, and Project Manager assigned-job view-first routing without changing the current live router.
- Added `src/__tests__/targetRouteAccess.spec.ts` to pin target redirect behavior, unauthenticated/inactive/no-access blocking, Payroll/Shop Foreman protected-route access, unknown capability metadata tolerance, job-scoped route denials, and route metadata normalization helpers.
- Updated auth/user-flow, component architecture, testing strategy, role-capability matrix, and execution-board docs so target route access is tracked separately from the current runtime route guard.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/targetRouteAccess.spec.ts src/__tests__/targetRouteCapabilities.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/targetAppShellNavigation.spec.ts src/__tests__/routeAccess.spec.ts`: passed, 39/39, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- No runtime E2E was required because the helper is a non-runtime target policy seam and is not wired into the live Vue Router, AppShell, rules, or Cloud Functions yet.

2026-07-16 `R652`:

- Widened current stored-role recognition safely so existing `payroll` and `shop-foreman` user records are preserved through auth/profile normalization, Users autosave, and the E2E runtime without granting live runtime permissions before the full target role rollout.
- Kept current editable user-role controls limited to Foreman, Project Manager, and Admin; saved target-only roles render read-only in the Users editor and do not show assigned-job controls.
- Added `getUserDetailUpdateRole()` and `shouldShowUserDetailAssignedJobs()` helper coverage paths so form hydration, dirty checks, autosave payloads, and component rendering all preserve locked target-only roles instead of silently normalizing them to Foreman.
- Updated auth/user-flow, component architecture, testing strategy, and execution-board docs to record the recognized-but-locked target-role bridge before R07 live enforcement.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/roles.spec.ts src/__tests__/capabilities.spec.ts src/__tests__/authService.spec.ts src/__tests__/useAdminFormState.spec.ts src/__tests__/useAdminActions.spec.ts src/__tests__/UserEditorPanel.spec.ts`: passed, 51/51, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/admin-management.spec.ts e2e/access-control.spec.ts --project=chromium`: passed, 10/10.

2026-07-16 `R653`:

- Aligned Cloud Functions stored-role validation with the frontend stored-role catalog by adding `payroll` and `shop-foreman` to `functions/src/constants.ts` `VALID_ROLES`.
- Kept the change scoped to stored-role recognition only: live Payroll and Shop Foreman workflow access remains pending the coordinated R07 route, Firestore Rules, Storage Rules, Cloud Functions, and E2E rollout.
- Added `src/__tests__/backendRoleCatalog.spec.ts` so the frontend `CURRENT_STORED_ROLE_KEYS` and Functions `VALID_ROLES` cannot silently drift again.
- Updated auth/user-flow and testing-strategy docs to record the Functions role-catalog bridge separately from live capability enforcement.
- `npm --prefix functions run build`: passed and regenerated `functions/constants.js` / `functions/constants.d.ts`.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/backendRoleCatalog.spec.ts src/__tests__/roles.spec.ts src/__tests__/authService.spec.ts src/__tests__/capabilities.spec.ts`: passed, 28/28, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R654`:

- Added `functions/src/roleAccess.ts` as the shared Cloud Functions current-role seam for stored-role recognition, temporary effective-role mapping, assigned-job cleanup, display-name fallback, and pending-invite role eligibility.
- Migrated user invite validation plus Daily Log, Shop Order, Timecard Week, and older email-operation function role checks away from duplicated local `project-manager` alias logic and onto the shared helper.
- Kept live behavior unchanged: `project-manager` remains effective `foreman`, while `payroll` and `shop-foreman` remain valid stored roles with effective `none` until the coordinated R07 rollout.
- Added `src/__tests__/functionRoleAccess.spec.ts` to pin the backend helper contract before live role/rules/function enforcement changes.
- Updated auth/user-flow, testing-strategy, refactor-gap-audit, and execution-board docs so the backend role-helper seam is explicit.
- `npm --prefix functions run build`: passed and generated `functions/roleAccess.js` / `functions/roleAccess.d.ts`.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionRoleAccess.spec.ts src/__tests__/backendRoleCatalog.spec.ts src/__tests__/roles.spec.ts src/__tests__/authService.spec.ts src/__tests__/capabilities.spec.ts`: passed, 32/32, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R655`:

- Extended `functions/src/roleAccess.ts` with the shared `CurrentFunctionUser` shape plus `buildCurrentFunctionUser()`, `currentFunctionUserHasAnyRole()`, and `currentFunctionUserCanAccessAssignedJob()` predicates.
- Migrated Daily Log, Shop Order, Timecard Week, and older email-operation authorization helpers away from local authorized-user interfaces and repeated assigned-job checks.
- Kept live behavior unchanged: workflow callables still allow only current effective Admin/Foreman access, Timecard Week still uses its owner-week check, and Payroll/Shop Foreman remain recognized-but-locked until the coordinated R07 rollout.
- Expanded `src/__tests__/functionRoleAccess.spec.ts` to pin callable current-user shaping and assigned-job access predicates in addition to stored/effective role normalization.
- Updated auth/user-flow, testing-strategy, and execution-board docs so the callable current-user shape is recorded as part of the backend role seam.
- `npm --prefix functions run build`: passed and regenerated `functions/roleAccess.js` / `functions/roleAccess.d.ts`.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionRoleAccess.spec.ts src/__tests__/backendRoleCatalog.spec.ts src/__tests__/roles.spec.ts src/__tests__/authService.spec.ts src/__tests__/capabilities.spec.ts`: passed, 34/34, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R656`:

- Added `functions/src/emailStatus.ts` as the shared submitted-email status payload builder for attempted/sent/error metadata.
- Wired Daily Log and Shop Order email callables to stamp best-effort `submittedEmailAttemptedAt`, `submittedEmailSentAt`, and `submittedEmailError` fields for disabled email, missing recipients, email/PDF/build/send failures, and successful sends.
- Kept callable response contracts stable and made status writes non-blocking/logged so a successful email is not reported as failed solely because a metadata write failed.
- Added `src/__tests__/functionEmailStatus.spec.ts` to pin the submitted-email status payload contract.
- Updated auth/user-flow, testing-strategy, refactor-gap-audit, and execution-board docs so the remaining R09 gap is now idempotency/operation IDs rather than basic status metadata.
- `npm --prefix functions run build`: passed and generated `functions/emailStatus.js` / `functions/emailStatus.d.ts`.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionEmailStatus.spec.ts src/__tests__/functionRoleAccess.spec.ts src/__tests__/backendRoleCatalog.spec.ts`: passed, 9/9, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R657`:

- Extended `functions/src/emailStatus.ts` from status-only payloads into the shared submitted-email operation/status seam, including stable operation IDs and a pure same-operation sent-record detector.
- Wired Daily Log, Shop Order, and Timecard Week submitted-email paths to stamp `submittedEmailOperationId` along with attempted/sent/error metadata.
- Added same-operation duplicate suppression for submitted-email retries: if the same operation ID already has a sent timestamp, the callable returns success without sending another email.
- Kept failed/skipped attempts retryable because duplicate suppression only applies when the exact operation already has `submittedEmailSentAt`.
- Extended `src/__tests__/functionEmailStatus.spec.ts` to pin operation ID creation, status payload stamping, optional operation IDs, and same-operation sent detection.
- Updated auth/user-flow, testing-strategy, refactor-gap-audit, and execution-board docs so the remaining Functions gap is target capability enforcement/deeper callable tests rather than missing submitted-email operation metadata.
- `npm --prefix functions run build`: passed and regenerated Functions build artifacts.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionEmailStatus.spec.ts src/__tests__/functionRoleAccess.spec.ts src/__tests__/backendRoleCatalog.spec.ts`: passed, 12/12, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R658`:

- Added `functions/src/targetRoleCapabilities.ts` as the Functions-local non-runtime target-role capability seam for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users.
- Mirrored the frontend target capability matrix without changing live callable enforcement; Payroll and Shop Foreman still remain recognized-but-locked until the coordinated route/rules/functions rollout.
- Added `src/__tests__/functionTargetRoleCapabilities.spec.ts` to guard backend/frontend target-role parity for built-in role ordering, role normalization, the full capability matrix, and assigned-job eligibility.
- Updated auth/user-flow, testing-strategy, refactor-gap-audit, and execution-board docs so backend target capability policy is tracked separately from current runtime role helpers.
- `npm --prefix functions run build`: passed and generated `functions/targetRoleCapabilities.js` / `functions/targetRoleCapabilities.d.ts`.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionTargetRoleCapabilities.spec.ts src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/backendRoleCatalog.spec.ts src/__tests__/functionRoleAccess.spec.ts`: passed, 21/21, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R659`:

- Added `functions/src/targetJobAssignments.ts` and `functions/src/targetJobAccess.ts` as Functions-local non-runtime target job-scope policy seams.
- Mirrored the frontend target assigned-job membership and job access policy for job creation, delete/archive rights, job list visibility, job dashboard entry, and job setup editing without changing live callable enforcement.
- Added `src/__tests__/functionTargetJobAccess.spec.ts` to guard backend/frontend target job-policy parity for assignment matching, create/delete job capabilities, list/dashboard/setup-edit decisions, Payroll job creation/read-only boundaries, and Project Manager assigned-job scoping.
- Updated auth/user-flow, testing-strategy, refactor-gap-audit, and execution-board docs so backend target job access is tracked separately from current runtime role helpers.
- `npm --prefix functions run build`: passed and generated `functions/targetJobAssignments.js` / `functions/targetJobAccess.js` plus declarations.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionTargetJobAccess.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/targetJobAssignments.spec.ts src/__tests__/functionTargetRoleCapabilities.spec.ts`: passed, 18/18, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R660`:

- Added `functions/src/targetFieldWorkflowAccess.ts` as the Functions-local non-runtime target Daily Log / Shop Order field-workflow policy seam.
- Mirrored the frontend target field-workflow policy for module opening, submitted-record viewing, draft creation/editing, and submission without changing live callable enforcement.
- Added `src/__tests__/functionTargetFieldWorkflowAccess.spec.ts` to guard backend/frontend target field-workflow parity, including Project Manager assigned-job view-only access, Payroll exclusion, Foreman assigned-job editing, and Shop Foreman Shop-job editing.
- Updated auth/user-flow, testing-strategy, refactor-gap-audit, and execution-board docs so backend target field-workflow policy is tracked separately from current runtime role helpers.
- `npm --prefix functions run build`: passed and generated `functions/targetFieldWorkflowAccess.js` plus declarations.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionTargetFieldWorkflowAccess.spec.ts src/__tests__/targetFieldWorkflowAccess.spec.ts src/__tests__/functionTargetJobAccess.spec.ts src/__tests__/functionTargetRoleCapabilities.spec.ts`: passed, 20/20, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R661`:

- Added `functions/src/targetFieldEmailRecipients.ts` as the Functions-local non-runtime target automatic Daily Log / Shop Order field-email recipient policy seam.
- Mirrored the frontend target recipient policy for assigned Foremen, assigned Project Managers, Shop Foremen on Shop jobs, inactive users, blank emails, deduping, normalization, and sorted recipient output without changing live email delivery.
- Added `src/__tests__/functionTargetFieldEmailRecipients.spec.ts` to guard backend/frontend target recipient parity and explicit Shop Foreman Shop-job recipient behavior.
- Updated auth/user-flow, testing-strategy, refactor-gap-audit, and execution-board docs so backend target field-email recipient policy is tracked separately from current runtime email recipient collection.
- `npm --prefix functions run build`: passed and generated `functions/targetFieldEmailRecipients.js` plus declarations.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionTargetFieldEmailRecipients.spec.ts src/__tests__/targetFieldEmailRecipients.spec.ts src/__tests__/functionTargetFieldWorkflowAccess.spec.ts src/__tests__/functionTargetRoleCapabilities.spec.ts`: passed, 19/19, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R662`:

- Added `functions/src/targetTimecardAccess.ts` as the Functions-local non-runtime target timecard access policy seam.
- Mirrored the frontend target timecard policy for Payroll export/lock/delete-draft access, Shop Foreman Shop-job entry, assigned Foreman entry, Project Manager assigned submitted-timecard reporting, submitted-timecard viewing, missing job IDs, and no-access users without changing live callable enforcement.
- Added `src/__tests__/functionTargetTimecardAccess.spec.ts` to guard backend/frontend target timecard parity and explicit Payroll, Project Manager, and Shop Foreman boundaries.
- Updated auth/user-flow, testing-strategy, refactor-gap-audit, and execution-board docs so backend target timecard policy is tracked separately from current runtime role helpers.
- `npm --prefix functions run build`: passed and generated `functions/targetTimecardAccess.js` plus declarations.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionTargetTimecardAccess.spec.ts src/__tests__/targetTimecardAccess.spec.ts src/__tests__/functionTargetRoleCapabilities.spec.ts src/__tests__/functionTargetJobAccess.spec.ts`: passed, 21/21, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.

2026-07-16 `R663`:

- Added `src/components/shopOrders/ShopOrderCatalogTree.vue` as the Shop Order catalog tree renderer for root/category/item rows, loading and empty states, row-level pending disablement, and context-menu markup.
- Updated `ShopOrderCatalogBrowser.vue` to keep search, expansion, selection, quantity state, context-menu action derivation, and add-item persistence while delegating tree/list/context-menu rendering to `ShopOrderCatalogTree`.
- Moved shared Shop Order catalog root/browser node types into `src/features/shopOrders/catalogBrowserHelpers.ts` so row/tree/browser components share one tree-node contract.
- Added `src/__tests__/ShopOrderCatalogTreeComponent.spec.ts` to pin the new component's public props/events and pending-row behavior without colliding with the existing `shopOrderCatalogTree.spec.ts` helper test on Windows.
- Updated component architecture, testing-strategy, refactor-gap-audit, and execution-board docs so `ShopOrderCatalogTree` is tracked as extracted and covered rather than a future-needed component.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/ShopOrderCatalogTreeComponent.spec.ts src/__tests__/ShopOrderCatalogBrowser.spec.ts src/__tests__/ShopOrderCatalogTreeNodeRow.spec.ts src/__tests__/shopOrderCatalogTree.spec.ts src/__tests__/useShopOrderItemActions.spec.ts`: passed, 22/22, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-17 `R664`:

- Added `src/components/shopOrders/ShopOrderMetaForm.vue` as the selected-order metadata form for delivery date, Thursday shortcut, comments, editable events, and read-only submitted fallbacks.
- Updated `ShopOrderSelectedOrderPanel.vue` to compose `ShopOrderMetaForm` so the selected panel owns order identity/status/timestamps while the form owns metadata rendering.
- Added `src/__tests__/ShopOrderMetaForm.spec.ts` and refreshed Shop Order item/workspace test helpers so the component contracts match the current input/change behavior.
- Updated component architecture and testing-strategy docs so `ShopOrderMetaForm` is tracked as extracted and covered rather than future-needed.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/ShopOrderMetaForm.spec.ts src/__tests__/ShopOrderSelectedOrderPanel.spec.ts src/__tests__/ShopOrderWorkspacePane.spec.ts src/__tests__/ShopOrderItemsEditor.spec.ts src/__tests__/shopOrders.spec.ts`: passed, 20/20, after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup error and the escalated rerun was approved.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-17 `R665`:

- Added `src/components/shopOrders/ShopOrderWorkspaceHeader.vue` as the Shop Order workspace header for job title fallback copy, New Order loading/disabled state, Submit Order visibility/disablement, and action event forwarding.
- Updated `ShopOrderWorkspacePane.vue` to compose `ShopOrderWorkspaceHeader` so the workspace pane owns section layout while the header owns its presentation and button chrome.
- Added `src/__tests__/ShopOrderWorkspaceHeader.spec.ts` to pin the extracted header contract.
- Updated component architecture and testing-strategy docs so `ShopOrderWorkspaceHeader` is tracked as extracted and covered rather than future-needed.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/ShopOrderWorkspaceHeader.spec.ts src/__tests__/ShopOrderWorkspacePane.spec.ts src/__tests__/ShopOrderMetaForm.spec.ts src/__tests__/ShopOrderSelectedOrderPanel.spec.ts`: passed, 15/15, using the approved elevated Vitest path for the known Windows/Vite `spawn EPERM` sandbox startup issue.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-17 `R666`:

- Added `src/components/shopOrders/ShopOrderWorkspaceSection.vue` as the shared Shop Order workspace section shell for title rendering, optional action slots, body slots, and section layout chrome.
- Updated `ShopOrderWorkspacePane.vue` so Added Items and Order History share the same section wrapper while keeping item editing, history selection, delete-draft, and workflow events in the existing parent/component contracts.
- Added `src/__tests__/ShopOrderWorkspaceSection.spec.ts` to pin title/action/body slot rendering and root attribute forwarding.
- Updated component architecture and testing-strategy docs so `ShopOrderWorkspaceSection` is tracked as an extracted and covered feature shell.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/ShopOrderWorkspaceSection.spec.ts src/__tests__/ShopOrderWorkspacePane.spec.ts src/__tests__/ShopOrderWorkspaceHeader.spec.ts`: passed, 11/11, using the approved elevated Vitest path for the known Windows/Vite `spawn EPERM` sandbox startup issue.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-17 `R667`:

- Extended `functions/src/emailStatus.ts` with submitted-email claim metadata, active/stale in-progress detection, and cleanup of in-progress state when submitted-email status is finalized.
- Added `functions/src/submittedEmailOperations.ts` as the shared Cloud Functions transaction helper that claims submitted-email operations before sending, returns `already-sent` for completed same-operation retries, returns `in-progress` for concurrent same-operation retries, and allows stale claims to be retried.
- Wired Daily Log, Shop Order, and Timecard Week submitted-email callables to claim the operation before sending so duplicate user retries cannot send a second email while the first send is still in progress.
- Extended `src/__tests__/functionEmailStatus.spec.ts` to cover claim payloads, in-progress detection, failure/success cleanup behavior, and stale claim retry behavior.
- Marked `R09` done and updated auth/user-flow, testing-strategy, and refactor-gap-audit docs so the remaining function work is target capability enforcement and deeper callable tests rather than missing submitted-email status/idempotency protection.
- `npm --prefix functions run build`: passed and generated `functions/submittedEmailOperations.js` plus declarations alongside updated function outputs.
- `npm run type-check`: passed.
- `npx vue-tsc --noEmit -p tsconfig.vitest.json`: passed.
- `npm run test:unit -- --run src/__tests__/functionEmailStatus.spec.ts src/__tests__/functionRoleAccess.spec.ts src/__tests__/backendRoleCatalog.spec.ts`: passed, 15/15, using the approved elevated Vitest path for the known Windows/Vite `spawn EPERM` sandbox startup issue.

2026-07-17 `R668`:

- Started the live `R07` target-role bridge instead of leaving Payroll and Shop Foreman as recognized-but-locked planning roles.
- Updated `src/auth/roles.ts` so user role controls can assign the full target role set: Admin, Payroll, Shop Foreman, Project Manager, and Foreman.
- Updated `src/auth/capabilities.ts` and `src/features/navigation/appShellNavigation.ts` so live route/admin navigation now derives from the target route capability policy: Payroll gets Employees and Timecard Export, Shop Foreman gets Shop Catalog, and Admin keeps all admin links.
- Updated `firestore.rules` and `storage.rules` with initial target-role helpers for active app access, employee management, job read/create/update/delete boundaries, shop catalog management, timecard week read/delete access, assigned Project Manager submitted-timecard viewing, field workflow access, and daily-log attachment read access.
- Updated Cloud Functions role helpers and Daily Log, Shop Order, Timecard Week, and operations callable authorization so runtime roles preserve `payroll`, `shop-foreman`, and `project-manager` instead of collapsing them into the old temporary catalog.
- Updated role/capability/navigation/function tests so the current live bridge and target policy seams agree.
- Remaining `R07` work at that point: granular Jobs UI controls for Payroll create-only and Project Manager assigned edit-only behavior, role dashboard route wiring, E2E role-flow expansion, deeper callable authorization tests, and rules emulator coverage if/when that deferred test layer is reintroduced.
- `npm run type-check`: passed.
- `npm --prefix functions run build`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts src/__tests__/roles.spec.ts src/__tests__/appShellNavigation.spec.ts src/__tests__/functionRoleAccess.spec.ts src/__tests__/backendRoleCatalog.spec.ts`: passed, 32/32, using the approved elevated Vitest path for the known Windows/Vite `spawn EPERM` sandbox startup issue.
- `npm run test:unit -- --run src/__tests__/targetRoleCapabilities.spec.ts src/__tests__/targetRouteCapabilities.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/targetFieldWorkflowAccess.spec.ts src/__tests__/targetTimecardAccess.spec.ts src/__tests__/targetAppShellNavigation.spec.ts src/__tests__/functionTargetRoleCapabilities.spec.ts src/__tests__/functionTargetJobAccess.spec.ts src/__tests__/functionTargetFieldWorkflowAccess.spec.ts src/__tests__/functionTargetTimecardAccess.spec.ts`: passed, 60/60, using the approved elevated Vitest path for the known Windows/Vite `spawn EPERM` sandbox startup issue.

2026-07-17 `R669`:

- Added the live `/dashboard` route through `src/views/RoleDashboardView.vue`.
- Added `src/components/dashboard/RoleDashboardModuleGrid.vue` so role-dashboard module cards render through a focused props-only component using absolute target routes from `roleDashboardModules`.
- Updated AppShell workspace navigation to expose `Dashboard` before `Jobs`.
- Updated the live route access helper so signed-in users leaving public entry routes, denied protected admin routes, and denied job routes fall back to the role dashboard instead of the Jobs list.
- Updated public-route and access-control E2E expectations to prove authenticated redirects and denied-route fallbacks land on the real dashboard page.
- Remaining `R07` work at that point: granular Jobs UI permissions, role-specific job dashboard entry behavior, Project Manager assigned-job edit UX, Payroll create-job UX, Shop Foreman Shop-job workflow proof, and deeper callable/rules verification.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/RoleDashboardView.spec.ts src/__tests__/routeAccess.spec.ts src/__tests__/appShellNavigation.spec.ts src/__tests__/roleDashboardModules.spec.ts`: passed, 22/22, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/public-routes.spec.ts e2e/access-control.spec.ts --project=chromium`: passed, 12/12.

2026-07-17 `R670`:

- Extended `src/auth/capabilities.ts` and `src/stores/auth.ts` with granular live job setup capabilities for create, use setup editor, edit selected job setup, and delete/archive rights.
- Updated the real Jobs page and extracted Jobs components/composables so Admin keeps full management, Payroll gets create-job plus read-only job setup lookup, and Project Managers can edit assigned jobs while unassigned jobs render read-only.
- Kept global all-jobs recipient defaults and archive/delete controls Admin-only.
- Updated assignable job-user filtering to use the target assignable-role policy so Foremen, Shop Foremen, and Project Managers can be assigned to jobs.
- Added Jobs E2E coverage for Payroll create-only/read-only behavior and Project Manager assigned-edit/no-delete/unassigned-read-only behavior.
- Remaining `R07` work at that point: role-specific job dashboard shortcuts/widgets, Shop Foreman Shop-job workflow proof, PM reporting follow-up, deeper callable authorization tests, and rules emulator coverage if/when `R08` is reintroduced.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/capabilities.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/JobsWorkspaceShell.spec.ts src/__tests__/JobBrowserPanel.spec.ts src/__tests__/JobAdminDetailPane.spec.ts src/__tests__/useJobsAdminSubscriptions.spec.ts src/__tests__/useJobsNavigationActions.spec.ts src/__tests__/useJobsViewState.spec.ts src/__tests__/useJobsSelectionSync.spec.ts src/__tests__/useJobDetailForm.spec.ts`: passed, 72/72, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 8/8.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 7/7.

2026-07-17 `R671`:

- Added `src/auth/jobIdentity.ts` as the frontend helper for recognizing the target Shop job by job number `736` or exact job name `Shop`.
- Added `src/features/dashboard/roleDashboardJobShortcuts.ts` and `src/components/dashboard/RoleDashboardJobShortcuts.vue` so the live role dashboard shows role-filtered job shortcuts using the same target job/timecard access helpers as the rest of the role plan.
- Updated `RoleDashboardView.vue` to subscribe to visible jobs through the existing jobs store and render quick links for job dashboards, Timecards, Daily Logs, Shop Orders, and submitted-timecard reporting affordances when the role policy allows them.
- Extended the live route access helper so visible Shop jobs can be opened by Shop Foremen without explicit assignment while preserving the existing visible-job fallback and temporary timecard exception.
- Added unit coverage for Shop-job identity, role-dashboard shortcut filtering, route access, and dashboard rendering; added E2E coverage for Project Manager assigned-job shortcuts and Shop Foreman Shop Orders navigation from the dashboard.
- Remaining `R07` work after the follow-up PM submitted-timecard reporting slice: deeper callable authorization tests and rules emulator coverage if/when `R08` is reintroduced.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/roleDashboardJobShortcuts.spec.ts src/__tests__/RoleDashboardView.spec.ts src/__tests__/routeAccess.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/targetTimecardAccess.spec.ts src/__tests__/roleDashboardModules.spec.ts`: passed, 37/37, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 9/9.

2026-07-17 `R672`:

- Added a submitted-report subscription mode for job timecard records so assigned Project Managers can load submitted weeks for their jobs without subscribing to draft weeks.
- Updated the timecard workspace state and week/card actions so reporting-only users cannot create weeks, backfill draft weeks, edit cards, or submit weeks.
- Kept current foreman/admin behavior intact by preserving the existing owner-scoped workflow mode and the temporary unassigned-foreman timecard exception.
- Updated the E2E runtime to mirror submitted-report filtering and added a `jobId + status` Firestore index for the live submitted-week query.
- Added unit coverage for the reporting subscription mode, create/edit guards, submit guards, week-selection fallback, and capability split between Project Manager reporting and Foreman workflow access.
- Added access-control E2E coverage proving a Project Manager sees assigned-job submitted timecards, does not see draft weeks, cannot create/edit/submit, and does not hit a missing-permissions error.
- Remaining `R07` work: deeper callable authorization tests and rules emulator coverage if/when `R08` is reintroduced.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/useJobTimecardRecords.spec.ts src/__tests__/useJobTimecardWorkspaceState.spec.ts src/__tests__/useJobTimecardWeekActions.spec.ts src/__tests__/useJobTimecardCardActions.spec.ts src/__tests__/useJobTimecardWorkspaceSync.spec.ts src/__tests__/capabilities.spec.ts src/__tests__/targetTimecardAccess.spec.ts`: passed, 68/68, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 10/10.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-17 `R673`:

- Added `functions/src/timecardWeekAccess.ts` as a pure Functions-side helper for recognizing the Shop job and authorizing timecard week creation with the existing target timecard policy.
- Updated `ensureTimecardWeekRecord` to load job details once, deny unrelated field-user week creation, preserve Admin/Payroll management/export paths, preserve assigned Foreman/Shop Foreman workflows, and allow Shop Foremen on the Shop job without explicit assignment.
- Added `src/__tests__/functionTimecardWeekAccess.spec.ts` to pin Admin/Payroll, assigned Foreman, Shop Foreman Shop-job, unassigned Foreman denial, and Project Manager report-only behavior before deeper callable work continues.
- Remaining `R07` work after the follow-up field-workflow callable slice: deeper submitted-email callable authorization tests and rules emulator coverage if/when `R08` is reintroduced.
- `npm run type-check`: passed.
- `npm --prefix functions run build`: passed.
- `npm run test:unit -- --run src/__tests__/functionTimecardWeekAccess.spec.ts src/__tests__/functionTargetTimecardAccess.spec.ts src/__tests__/functionRoleAccess.spec.ts`: passed, 16/16, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.

2026-07-17 `R674`:

- Added `functions/src/jobIdentity.ts` so Functions-side Shop-job recognition is shared instead of duplicated across timecard and field-workflow helpers.
- Added `functions/src/fieldWorkflowAccess.ts` as the live Functions helper for Daily Log and Shop Order create/edit/submit write authorization using the existing target field-workflow policy.
- Updated `createDailyLogRecordCallable`, `updateDailyLogRecordCallable`, `deleteDailyLogRecordCallable`, `createShopOrderRecordCallable`, `updateShopOrderRecordCallable`, and `deleteShopOrderRecordCallable` to load authoritative job details and use the field-workflow helper while preserving existing submitted-record protections.
- Kept Project Managers view-only for field workflows and kept Payroll out of Daily Log/Shop Order writes while allowing Admin, assigned Foreman, and Shop Foreman Shop/assigned job writes.
- Added `src/__tests__/functionFieldWorkflowAccess.spec.ts` to pin Admin, assigned Foreman, unassigned Foreman denial, Shop Foreman Shop-job access, Project Manager denial, and Payroll denial.
- Remaining `R07` work: submitted-email callable authorization tests, any remaining direct callable mocks, and rules emulator coverage if/when `R08` is reintroduced.
- `npm run type-check`: passed.
- `npm --prefix functions run build`: passed.
- `npm run test:unit -- --run src/__tests__/functionFieldWorkflowAccess.spec.ts src/__tests__/functionTimecardWeekAccess.spec.ts src/__tests__/functionTargetFieldWorkflowAccess.spec.ts src/__tests__/functionTargetTimecardAccess.spec.ts`: passed, 19/19, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.

2026-07-17 `R675`:

- Replaced the old submitted-email `assertAdminOrAssignedForeman` path in `operationsFunctions.ts` with `assertCanSendSubmittedFieldWorkflowEmail`, which delegates Daily Log and Shop Order send authorization to the shared `fieldWorkflowAccess` submit policy.
- Updated `sendDailyLogEmail` and `sendShopOrderEmail` to load authoritative job details before send authorization so Shop Foremen can send submitted Shop-job field emails without explicit assignment while unassigned non-Shop field users remain denied.
- Preserved existing submitted-email behavior: Daily Log field users can still only email their own logs, Shop Order job mismatch checks still run, submitted-email idempotency/status metadata stays unchanged, and rendering/PDF output was not touched.
- Remaining `R07` work: direct mocked callable tests around submitted-email success/denial branches and rules emulator coverage if/when `R08` is reintroduced.
- `npm run type-check`: passed.
- `npm --prefix functions run build`: passed.
- `npm run test:unit -- --run src/__tests__/functionFieldWorkflowAccess.spec.ts src/__tests__/functionTargetFieldWorkflowAccess.spec.ts src/__tests__/functionEmailStatus.spec.ts`: passed, 17/17, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.

2026-07-17 `R676`:

- Added `src/__tests__/functionSubmittedEmailOperations.spec.ts` to cover the shared submitted-email operation transaction helper directly.
- Pinned duplicate-send protection behavior at the helper layer: existing successful operation returns `already-sent`, active same-operation claims return `in-progress`, stale in-progress claims can be reclaimed, missing status documents return `missing-record`, and only existing status documents receive claim updates.
- Centralized the submitted-email claim short-circuit copy in `functions/src/submittedEmailOperations.ts` and wired Daily Log, Shop Order, and Timecard Week submitted-email callables to use the shared helper.
- Kept the slice intentionally below the full callable/mock layer so email rendering, PDF output, recipient collection, and transport behavior were not touched.
- Remaining `R07` work: full mocked callable branch tests around submitted-email success/denial/no-recipient/disabled-email/send-failure paths and rules emulator coverage if/when `R08` is reintroduced.
- `npm run type-check`: passed.
- `npm --prefix functions run build`: passed.
- `npm run test:unit -- --run src/__tests__/functionSubmittedEmailOperations.spec.ts src/__tests__/functionEmailStatus.spec.ts`: passed, 15/15, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.

2026-07-17 `R677`:

- Extracted `handleSendDailyLogEmail` and `handleSendShopOrderEmail` from the inline Firebase `onCall` exports so submitted-email behavior can be tested with injected dependencies while the public callable exports remain unchanged.
- Added `src/__tests__/functionSubmittedFieldEmailHandlers.spec.ts` with mocked branch coverage for Daily Log submitted-email success, unassigned-Foreman denial, already-sent/in-progress short-circuiting, disabled email, missing recipients, send failure status recording, Shop Order PDF attachment success, and Shop Order job mismatch denial.
- Kept PDF/email rendering behavior unchanged; the only output-source cleanup was TypeScript hygiene in `functions/src/emailService.ts` required once the app test project began type-checking the imported Functions source.
- Remaining `R07` work: rules emulator coverage if/when `R08` is reintroduced, plus any deeper full-transport/output smoke assertions that should stay in output-specific slices.
- `npm run type-check`: passed.
- `npm --prefix functions run build`: passed.
- `npm run test:unit -- --run src/__tests__/functionSubmittedFieldEmailHandlers.spec.ts src/__tests__/functionSubmittedEmailOperations.spec.ts src/__tests__/functionEmailStatus.spec.ts`: passed, 23/23, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.

2026-07-17 `R678`:

- Extracted `handleSubmitTimecardWeekRecord` from the inline Firebase `onCall` export so submit-week behavior can be tested with injected dependencies while the public callable export remains unchanged.
- Added `src/__tests__/functionTimecardWeekSubmitHandler.spec.ts` with mocked branch coverage for successful submit/email status recording, skipped notification status, already-sent/in-progress short-circuiting, owner denial before email-operation claim, and notification-send failure recovery.
- Kept workbook/PDF rendering behavior unchanged; the handler tests inject the email sender path and assert status/update decisions rather than rendering timecard output.
- Remaining `R07` work: rules emulator coverage if/when `R08` is reintroduced, plus output-specific smoke assertions that should stay in timecard output slices.
- `npm run type-check`: passed.
- `npm --prefix functions run build`: passed.
- `npm run test:unit -- --run src/__tests__/functionTimecardWeekSubmitHandler.spec.ts src/__tests__/functionSubmittedEmailOperations.spec.ts src/__tests__/functionEmailStatus.spec.ts`: passed, 20/20, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.

2026-07-17 `R679`:

- Added focused E2E coverage proving a Shop Foreman can open the real `/settings/shop-catalog` route, while Users and Timecard Export stay absent from the admin navigation for that role.
- The new test creates and edits a catalog item through the live Shop Catalog page and verifies the mutation in the E2E runtime state, giving the role rollout concrete browser coverage for the requested Shop Foreman catalog capability.
- Kept this slice intentionally above the rules/function layer; Firestore Rules emulator proof remains deferred under `R08`.
- Remaining `R07` work: rules emulator coverage if/when `R08` is reintroduced, plus output-specific smoke assertions for rendered PDFs/emails where visual fidelity matters.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/admin-pages.spec.ts --project=chromium`: passed, 14/14.

2026-07-17 `R680`:

- Added an optional Shop Order PDF render observer to `buildShopOrderPdfBuffer` so smoke tests can assert table-header pagination without parsing fragile PDF text streams or changing normal email/PDF behavior.
- Strengthened `smoke-shop-order-email.cjs` to prove a long shop-order PDF spans multiple pages, draws continuation table headers, starts each continuation header at the top page margin, and draws headers once per table page in page order.
- This directly guards the client-reported print failure where table headers could appear missing or offset on continuation pages.
- Remaining output work: add similar targeted smoke assertions only when another rendered PDF/email behavior is important enough to pin.
- `npm run type-check`: passed.
- `npm --prefix functions run smoke:shop-order-email`: passed.

2026-07-17 `R681`:

- Added an optional Timecard PDF card-header render observer to `buildTimecardPdfBuffer` so smoke tests can prove critical employee header values reach the real PDF renderer without parsing brittle PDF internals or reviving the old HTML-preview approach.
- Strengthened `smoke-timecard-email.cjs` to assert the PDF-only email body still points recipients to the attachment and the attached-card renderer receives employee name, employee number, occupation, wage, and week-ending data.
- This directly guards the client-reported failure where the emailed timecard PDF could miss employee name/number details even though the app/export card data was correct.
- Remaining output work: add targeted rendered-output smoke assertions only when another PDF/email fidelity requirement becomes important enough to pin.
- `npm run type-check`: passed.
- `npm --prefix functions run smoke:timecard-email`: passed.

2026-07-17 `R682`:

- Added `createPayrollAdminFixture()` and focused access-control E2E coverage proving Payroll can open the real `/employees` route, create/edit an employee, and navigate to the real Timecard Export route while Users, Shop Catalog, and Reference Lists stay absent from Payroll admin navigation.
- Added a negative Project Manager route check proving non-payroll field roles are redirected away from employee management and do not render the Employees page or navigation link.
- Kept this slice intentionally above the rules/function layer; direct Firestore Rules emulator proof remains deferred under `R08`.
- Follow-up `R683` completed the role-matrix evidence audit and remaining browser role-flow gaps; rules emulator coverage remains deferred unless `R08` is reintroduced.
- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 12/12.

2026-07-17 `R683`:

- Expanded `e2e/access-control.spec.ts` to cover the remaining browser-level role-flow gaps from `role-capability-matrix.md`: Foremen are denied Users, Employees, Timecard Export, and Shop Catalog; Project Managers cannot direct-open unassigned job dashboards; Payroll cannot open field workflow forms; Shop Foremen can use Shop Orders, Daily Logs, and Timecards for the Shop job without explicit assignment; and Shop Foremen can view all jobs read-only while non-Shop workflow drill-in stays denied.
- Hardened `src/router/index.ts` and `src/stores/jobs.ts` so job-scoped route decisions wait for the first visible-job snapshot when the job list is empty. This fixes direct/deep-linked Shop Foreman access where the guard needed the loaded job record to recognize the Shop job identity, without relaxing non-Shop job access.
- Kept this slice in the frontend route/store/E2E layer; Firestore Rules emulator proof remains deferred under `R08`, and Cloud Function authorization was not touched.
- Added completion evidence to `design/role-capability-matrix.md` mapping every required role-matrix test item to browser/unit evidence. `R07` is complete at the app/function/policy-test layer; direct rules emulator coverage remains deferred under `R08`.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/routeAccess.spec.ts src/__tests__/targetRouteAccess.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/capabilities.spec.ts src/__tests__/useJobsLifecycle.spec.ts`: passed, 47/47, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 17/17.
- `npm run build`: passed using the approved elevated path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue. Vite still reports the non-failing large chunk warning tracked in `refactor-gap-audit.md`.
- `npm run test:pre-refactor`: passed using the approved elevated path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue. This covered the full E2E suite plus the shop-order and timecard email smoke checks.

2026-07-17 `R684`:

- Added `src/features/jobs/useJobsCapabilities.ts` so Jobs setup affordance derivation lives behind a focused feature composable instead of route-local computed values.
- Updated `src/views/JobsView.vue` to consume the composable while preserving the same `auth.canCreateJobs`, `auth.canUseJobSetupEditor`, `auth.canDeleteOrArchiveJobs`, and selected-job `auth.canEditJobSetup(jobId)` behavior.
- Added `src/__tests__/useJobsCapabilities.spec.ts` to prove the route-level flags stay reactive and selected-job edit access follows the selected job id.
- Kept this slice above the Firebase/rules/functions layer and away from protected output rendering.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/useJobsCapabilities.spec.ts`: passed, 2/2, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/jobs.spec.ts --project=chromium`: passed, 8/8.

2026-07-17 `R685`:

- Added `src/features/shopOrders/useShopOrderCustomItemForm.ts` so the Shop Orders custom-item form owns its default state and same-object reset behavior outside the route view.
- Updated `src/views/ShopOrdersView.vue` to consume the custom-item form composable instead of creating the form directly.
- Updated `src/features/shopOrders/useShopOrderItemActions.ts` so successful custom-item saves call the injected reset seam, while failed saves keep the user's typed custom-item input untouched.
- Added `src/__tests__/useShopOrderCustomItemForm.spec.ts` and expanded `src/__tests__/useShopOrderItemActions.spec.ts` coverage for the reset handoff.
- Kept this slice in the UI/composable layer; Firestore Rules, Cloud Functions, and shop-order PDF/email output were not touched.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/useShopOrderCustomItemForm.spec.ts src/__tests__/useShopOrderItemActions.spec.ts`: passed, 8/8, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/shop-order-workspace.spec.ts --project=chromium`: passed, 16/16.

2026-07-17 `R686`:

- Added `src/features/dailyLogs/useDailyLogPayloadPreparer.ts` so the prepared Daily Log payload callback used by draft saves, attachment persistence, and submit actions is assembled in the feature layer instead of `DailyLogsView.vue`.
- Updated `src/views/DailyLogsView.vue` to consume the payload-preparer composable while preserving the same `form` and `siteInfo` behavior.
- Added `src/__tests__/useDailyLogPayloadPreparer.spec.ts` to prove the composable uses the latest site-info ref, prepares explicit payloads, and avoids mutating the source payloads.
- Tightened `src/__tests__/useDailyLogDraftSave.spec.ts` so explicit `selectedLog: null` is honored by the test harness; this now directly proves the missing-log no-op guard.
- Kept this slice in the Daily Log UI/composable layer; Firestore Rules, Cloud Functions, and Daily Log email/output paths were not touched.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/useDailyLogPayloadPreparer.spec.ts src/__tests__/dailyLogViewHelpers.spec.ts src/__tests__/useDailyLogDraftSave.spec.ts src/__tests__/useDailyLogAttachments.spec.ts src/__tests__/useDailyLogActions.spec.ts`: passed, 27/27, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium`: passed, 10/10.

2026-07-17 `R687`:

- Added `src/features/timecards/useJobTimecardAccess.ts` so job Timecards route-level access derivation and week-subscription mode selection live in a focused feature composable instead of `TimecardsView.vue`.
- Updated `src/views/TimecardsView.vue` to consume the composable while preserving the existing stale-profile assignment repair, route fallback for field workflow users, Project Manager submitted-report week mode, and manager all-week mode.
- Added `src/__tests__/useJobTimecardAccess.spec.ts` to prove job-record assignments feed the access policy, assigned Project Managers remain report-only, timecard managers subscribe to all weeks, and Shop Foremen can use the Shop job workflow without explicit assignment.
- Kept this slice above the Firebase/rules/functions/output layers and away from protected workbook/PDF/email behavior.
- `npm run type-check`: passed.
- `npm run test:unit -- --run src/__tests__/useJobTimecardAccess.spec.ts src/__tests__/targetTimecardAccess.spec.ts src/__tests__/useJobTimecardRecords.spec.ts`: passed, 17/17, using the approved elevated Vitest path after the sandboxed run hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:e2e -- e2e/timecard-workbook.spec.ts --project=chromium`: passed, 22/22.

2026-07-17 `R688`:

- Final completion audit found the current board had 210 done slices and one intentionally deferred slice (`R08`) before this closeout slice.
- Repaired stale full-unit coverage and two small helper issues found by the full suite: Firebase-like plain-object error normalization, shop-catalog root archive expansion, and display-name sorting for catalog siblings.
- `npm run test:unit -- --run`: passed, 281 files / 1340 tests.
- `npm run build`: passed; Vite still reports the known non-failing large chunk-size warning tracked as a later bundle-splitting item.
- `npm run test:pre-refactor`: passed, 97 Playwright tests plus Daily Log, Shop Order, and Timecard email smoke tests.
- Current board status after this slice: 211 Done, 1 Deferred (`R08`), 212 Total. No `Backlog`, `Ready`, `In Progress`, or `Blocked` slices remain in the current board.
