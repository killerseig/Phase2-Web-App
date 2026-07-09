# Refactor Gap Audit

Date: 2026-07-06

Scope: Actual Vue/Firebase codebase compared against the current refactor design docs. This is a planning artifact, not an implementation slice.

Guardrails:

- Do not start a broad rewrite from this audit.
- Preserve existing `data-testid` contracts.
- Refactor in small, reversible slices.
- Do not mix UI extraction with Firestore Rules, Cloud Functions, PDFs, or email rendering.
- Treat the timecard workbook/PDF visuals as protected output unless the slice is specifically about timecards.

## A. Executive Summary

The app is in a workable but transitional state. E2E coverage is much better than it was, the user-facing draft/view-first regressions are now represented in tests, and the frontend has a service layer instead of Firebase calls scattered through components. That is the good news.

The main gap is that the actual app is still built around the older `admin` / `foreman` / temporary `project-manager-as-foreman` model, while the target docs now describe a capability-based app with Admin, Payroll, Shop Foreman, Project Manager, and Foreman. That role mismatch touches the router, Firestore Rules, Storage Rules, callable functions, users, jobs, employees, shop catalog, timecards, daily logs, and shop orders. It should be handled as a dedicated refactor track, not patched opportunistically.

The second major gap is size and coupling. Several route views are still acting as mini-apps: they own rendering, state orchestration, autosave, validation, confirmation, Firestore calls through services, and workflow rules in one file. That makes the refactor possible, but risky unless we extract seams gradually.

The third major gap is lower-layer verification. E2E is strong, but we do not yet have Firestore Rules emulator tests, function unit tests, composable tests, or targeted component tests. The refactor can start, but only if each slice adds or preserves the test layer appropriate to the behavior being touched.

Verdict: ready for small UI/component/composable extraction slices. Not ready for a broad architecture rewrite or full role implementation until the capability/rules/function plan is isolated and tested.

## B. Top 10 Risks

| Rank | Issue | Files | Problem | Violated Design Rule | Risk | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Role model mismatch | `src/types/domain.ts:1`, `src/router/index.ts:162`, `firestore.rules:27`, `functions/src/constants.ts:8` | Actual roles are `admin`, `foreman`, temporary `project-manager`, and `none`; target roles include Payroll and Shop Foreman with different capabilities. | Roles must be explicit capabilities, not page-name checks or temporary role aliases. | High | Add a capability matrix and migrate UI, rules, functions, and tests together in a dedicated slice. | Later, before dashboard refactor |
| 2 | Firestore Rules do not match target access | `firestore.rules:178`, `firestore.rules:202`, `firestore.rules:238` | Employees are readable by all active users, payroll cannot write employees, PMs cannot read submitted assigned-job timecards for billing, Shop Foreman cannot manage catalog. | Security is enforced at Rules and Functions, not just UI. | High | Add emulator tests first, then update rules by capability. | Later |
| 3 | Large route views are still mini-apps | `src/views/TimecardExportView.vue`, `src/views/ShopOrdersView.vue`, `src/views/TimecardsView.vue`, `src/views/DailyLogsView.vue`, `src/views/JobsView.vue` | Views combine orchestration, rendering, local state, saves, confirmations, and workflow rules. | Pages orchestrate; components render; composables own reusable behavior. | High | Extract components/composables one seam at a time with E2E coverage. | Later, slice-by-slice |
| 4 | Cloud Function authorization/status is uneven | `functions/src/operationsFunctions.ts:882`, `functions/src/operationsFunctions.ts:1830`, `functions/src/timecardWeekFunctions.ts` | Daily log/shop order functions use older role assumptions and do not track email operation status as cleanly as timecards. | Callable functions must enforce the same capability model and expose reliable status. | High | Move auth checks to shared helpers, use `HttpsError`, add status/idempotency metadata. | Later |
| 5 | Broad collection subscriptions | `src/services/timecards.ts:230`, `src/services/users.ts:141`, `src/services/employees.ts:152`, `src/services/shopCatalog.ts:104` | Admin pages subscribe to entire collections without pagination or query limits. | Firebase reads should be scoped and predictable. | Medium | Keep for now if data is small; during refactor add paged/query-specific service APIs. | Later |
| 6 | Workflow invariants live in pages | `src/views/DailyLogsView.vue`, `src/views/TimecardsView.vue`, `src/views/ShopOrdersView.vue` | View-first behavior is protected by E2E, but the implementation is not isolated. | Business workflow rules should be reusable and testable outside large pages. | Medium | Extract workflow composables only after baseline tests are green. | Later |
| 7 | Missing lower-layer tests | `firestore.rules`, `functions/src/*`, `src/composables/*` | E2E covers many regressions, but rules/functions/composables are not directly tested. | Refactor gates need the smallest test that can catch the break. | High | Add rules emulator tests and function/composable tests before changing those layers. | Later |
| 8 | CSS ownership is mixed | `src/styles/main.css:198`, `src/styles/main.css:761`, `src/styles/main.css:878`, `src/styles/main.css:1294` | Global stylesheet contains app shell, shared controls, page-specific jobs CSS, and PrimeVue overrides. | `main.css` is an entry point; tokens/base/utilities/vendor/page styles should be separated. | Medium | Split styles into tokens/base/utilities/primevue and move page styles to components/views. | Later |
| 9 | Output rendering is correct in direction but tightly coupled | `functions/src/emailService.ts`, `functions/src/operationsFunctions.ts` | Timecard email now attaches PDF, shop order PDF exists, but rendering and sending are in very large files with legacy paths. | Output builders should be isolated and smoke-testable. | Medium | Do not rewrite during UI refactor; later split PDF/email builders and add visual smoke assertions. | Later |
| 10 | Cleanup candidates remain | `package.json`, `firestore.indexes.json`, `functions/*.js`, `functions/src/operationsFunctions.ts` | Suspicious dependency `"22"`, stale indexes, compiled JS artifacts, and legacy fallback paths remain. | Remove migrations/compatibility only when replacement is verified. | Low/Medium | Clean in a dedicated cleanup slice with build/test verification. | Later |

## C. Current Code vs Target Architecture

| File | Exact Problem | Violated Design Rule | Risk | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- |
| `src/views/TimecardExportView.vue` | At roughly 3,459 lines, this view owns export filters, employee/user subscriptions, week/card editing, draft deletion, PDF/CSV flows, and confirmation logic. | Route views should orchestrate, not own entire module behavior. | High | Extract export toolbar, week list, card editor wrappers, and export composables in separate slices. | Later |
| `src/views/ShopOrdersView.vue` | At roughly 2,971 lines, this view owns catalog browsing, search expansion, draft logic, item editing, history, email submit, and layout. | Page shell plus components/composables, not monolithic route implementation. | High | Extract catalog tree/search first, then order header/items/history. Do not touch PDF/email in same slice. | Later |
| `src/views/ShopCatalogAdminView.vue` | At roughly 2,940 lines, catalog admin combines tree editing, item editing, confirmation, ordering, and import-ish logic. | Feature components should isolate complex interaction areas. | Medium | Extract tree/list/editor components after shop order catalog contracts are stable. | Later |
| `src/views/TimecardsView.vue` | At roughly 2,363 lines, it owns save queues, employee selection, week/card creation, timecard workbook coordination, submit flow, sorting, and error states. | Autosave/save behavior should live in composables; page should coordinate. | High | Extract save queue and employee picker only after timecard E2E is green. Do not edit workbook visuals casually. | Later |
| `src/views/DailyLogsView.vue` | At roughly 1,898 lines, it owns selected date, draft creation, submitted-log selection, save-on-blur logic, attachments, and email submission. | View-first workflow should be a composable plus focused components. | High | Extract `useDailyLogWorkspace` and text/attachment sections in small slices. | Later |
| `src/views/JobsView.vue` | At roughly 1,863 lines, it owns jobs list, create/edit form, global/default recipients, assigned foremen, archive/delete, and notification defaults. | Jobs, recipients, and admin controls should be separable components. | Medium | Extract `RecipientEditor` first because it is shared and low-risk. | Later |
| `src/stores/auth.ts:8` | Auth store imports Firebase Auth and Firestore directly. This is a reasonable temporary exception, but it weakens the service boundary. | Firebase SDK access belongs in services unless the store is explicitly the integration boundary. | Low/Medium | Move profile listener/persistence into auth/user service once role refactor starts. | Later |
| `src/components/**`, `src/features/**`, `src/composables/**` | No broad Firebase imports found in shared components/features/composables. This matches the target direction. | Components should be Firebase-free. | Low | Preserve this boundary during extraction. | Now, keep |
| `src/views/*` | Many views use `window.confirm` directly, for example `UsersView.vue:407`, `JobsView.vue:623`, `TimecardsView.vue:783`, `ShopOrdersView.vue:1201`, `ShopCatalogAdminView.vue:1058`. | Common interaction patterns should use shared components/composables. | Low/Medium | Add `ConfirmAction` / `useConfirmAction` and migrate one page at a time. | Later |

## D. Firebase And Security Gaps

| File | Exact Problem | Violated Design Rule | Risk | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- |
| `firestore.rules:27` | `roleCanUseApp()` only recognizes the old role set. Payroll and Shop Foreman cannot be represented. | Firestore Rules must enforce the same role/capability matrix as the app. | High | Add emulator tests, then replace role checks with capability-aware helpers. | Later |
| `firestore.rules:178` | `/employees` allows reads for every active app user and writes only for admin. Target says employee data should be locked to Admin/Payroll. | Sensitive employee information must be protected at Rules. | High | Restrict employee reads/writes to Admin/Payroll, then update pages/services/tests. | Later |
| `firestore.rules:185` | Jobs create/update/delete are still admin-heavy with a narrow recipient-update exception. Target says Payroll can create jobs, PM can edit assigned jobs, and PM/Payroll/Shop Foreman can view jobs differently. | UI permissions and Rules permissions must match. | High | Split job read, create, edit, archive, and delete capabilities. | Later |
| `firestore.rules:202` | `/timecardWeeks` reads are admin or owner-focused. PM billing access to submitted timecards for assigned jobs is not modeled. | PMs need assigned-job submitted timecard visibility without gaining payroll/admin powers. | High | Add submitted-week read capability for assigned PMs and emulator tests. | Later |
| `firestore.rules:238` | Shop catalog write access is admin-only. Target says Shop Foreman needs full shop catalog access. | Rules must support target Shop Foreman capability. | Medium/High | Add catalog manage capability for Admin and Shop Foreman. | Later |
| `storage.rules:27` | Storage active-user roles only include `admin` and `foreman`; target roles are missing. | Storage Rules must match Firestore role model. | Medium | Update after Firestore capability model is finalized. | Later |
| `src/services/timecards.ts:230` | `subscribeAllTimecardWeeks()` listens to all `timecardWeeks`. | Firestore reads should be scoped, indexed, and predictable. | Medium | Add date/status/job/foreman filters and pagination for export workflows. | Later |
| `src/services/users.ts:141` | `subscribeUsers()` reads the full users collection. | Admin data should be queried intentionally. | Medium | Keep for admin-only MVP; later add pagination/search server-side if data grows. | Later |
| `src/services/employees.ts:152` | `subscribeEmployees()` reads the full employees collection. | Employee reads should be role-scoped and query-scoped. | Medium | Add active/inactive filters at query layer once rules allow Payroll/Admin only. | Later |
| `src/services/shopCatalog.ts:104` | Shop catalog/category subscriptions read full collections. | Catalog scale should use queryable tree APIs. | Low/Medium | Keep for current size; later introduce paged/category-scoped catalog APIs. | Later |
| `functions/src/operationsFunctions.ts:882` | `sendDailyLogEmail` starts with callable validation inside the function but still uses older role assumptions and does not record email status consistently. | Functions must enforce capabilities and expose reliable operation status. | High | Use shared auth/capability helper, `HttpsError`, idempotency/status metadata. | Later |
| `functions/src/operationsFunctions.ts:1830` | `sendShopOrderEmail` has similar auth/status issues and also retains legacy job-subcollection fallback. | Functions should have explicit current-data paths and observable send status. | Medium/High | Keep fallback until data is verified; remove in cleanup slice. Add status metadata. | Later |
| `firestore.indexes.json` | Indexes still reference older shapes such as `dailyLogs.uid`, old `timecards`, and broad `shopCatalog` fields. | Indexes should match canonical schemas and service queries. | Medium | Audit only after query contracts are finalized. | Later |

## E. Role And Capability Gaps

| Role | Current Behavior | Target Behavior | Files | Risk | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- | --- |
| Admin | Mostly full access. | Full access. | `src/router/index.ts`, `firestore.rules`, `functions/src/*` | Low | Preserve as explicit capability, not implicit bypass everywhere. | Later |
| Foreman | Effective role can access assigned jobs and workflows; PM temporarily maps into this. | Assigned job dashboards for timecards, daily logs, shop orders; always receives relevant emails. | `src/types/domain.ts:272`, `src/stores/auth.ts:62` | Medium | Keep existing behavior until capability model is introduced. | Later |
| Project Manager | Currently maps to effective foreman. | Assigned jobs only; can edit assigned jobs but not delete/archive; can view submitted timecards for billing; receives daily log/shop order emails. | `src/types/domain.ts:272`, `firestore.rules:55`, `functions/src/timecardWeekFunctions.ts:73` | High | Stop aliasing PM to foreman once capability matrix is implemented. | Later |
| Payroll | Not implemented as a role. | Employees list, timecard export, job creation, all jobs read-only, can lock timecards, no shop orders/job editing. | `src/types/domain.ts:1`, `functions/src/constants.ts:8`, `firestore.rules:27` | High | Add role across types, user admin, routes, rules, storage, functions, and E2E. | Later |
| Shop Foreman | Not implemented as a role. | Shop catalog, Shop job workflows, all jobs read-only, timecard capability like foreman. | Same as above | High | Add role plus explicit Shop job edit scope and catalog management rules. | Later |
| None/inactive | Present. | No app access. | `src/types/domain.ts`, `firestore.rules`, `functions/src/constants.ts` | Low | Preserve and test during role migration. | Later |

Capability model should be the refactor source of truth. The app should stop asking "is this page admin-only?" and start asking "can this user perform this action on this resource?"

## F. Workflow Invariant Risks

| Workflow | Current State | Risk | Files | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- |
| Daily logs do not auto-create drafts on view | E2E and code now protect explicit draft creation. | Medium because logic lives in large page. | `src/views/DailyLogsView.vue` | Extract selected-date/submitted-first behavior into `useDailyLogWorkspace` with tests. | Later |
| Daily log text typing | Save-on-blur/dirty guards exist. | Medium because this is delicate and was a real bug. | `src/views/DailyLogsView.vue` | Keep E2E; extract only with a slow-save test. | Later |
| Timecards default to viewing submitted weeks before draft creation | E2E covers this. | Medium because week/card logic spans page and functions. | `src/views/TimecardsView.vue`, `functions/src/timecardWeekFunctions.ts` | Extract week selection/creation separately from card rendering. | Later |
| Timecard rollover clears hours/production/ACCT and preserves Job # cascade behavior | E2E covers the client requests. | High because this is payroll-critical. | `src/views/TimecardsView.vue`, `functions/src/timecardWeekFunctions.ts` | Do not refactor rollover without targeted tests and real data fixtures. | Later |
| Shop orders do not auto-create drafts | E2E and code comments protect explicit creation. | Medium. | `src/views/ShopOrdersView.vue` | Keep draft creation in a service/composable contract before UI extraction. | Later |
| Shop order normal and custom items share one table/output | E2E covers current visible behavior; PDF/email smoke exists. | Medium. | `src/views/ShopOrdersView.vue`, `functions/src/emailService.ts` | Do not alter PDF/email while extracting UI. | Later |
| Server-side validation of workflow invariants | Some invariants are UI-first and not clearly enforced in callable functions/rules. | High. | `functions/src/dailyLogRecordFunctions.ts`, `functions/src/shopOrderRecordFunctions.ts`, rules | Add server validation where business-critical, especially role/action/date/status transitions. | Later |

## G. Testing Gaps

Current strengths:

- E2E specs cover access control, admin pages, daily logs, shop orders, timecards, public routes, job dashboard, and management pages.
- The fake E2E runtime now tests actual app routes instead of custom fake pages.
- Timecard/shop order/daily log regressions from client reports are represented better than before.

Remaining gaps:

| Gap | Files | Problem | Violated Design Rule | Risk | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- | --- |
| Firestore Rules tests | `firestore.rules`, `storage.rules` | No emulator test suite proves role/capability behavior. | Security behavior needs the smallest direct test. | High | Add rules tests before changing roles/rules. | Later |
| Cloud Function unit tests | `functions/src/*` | Email/PDF/send/status behavior relies on smoke scripts and E2E-ish paths. | Functions need isolated verification. | High | Add function unit tests with mocked Firestore/email transport. | Later |
| Component tests | `src/components/*` | Shared components are not broadly tested. | Extracted components need local tests. | Medium | Add tests as components are extracted. | Later |
| Composable tests | `src/composables/*`, future workflow composables | Save queues, dirty guards, and workflow selection are not isolated. | Workflow invariants should survive UI refactors. | Medium/High | Add Vitest tests when extracting composables. | Later |
| Visual/output smoke assertions | `functions/scripts/smoke-*.cjs` | Scripts generate/preview output, but do not assert headers/pagination/attachments deeply. | Print/email output should be regression-tested. | Medium | Add smoke assertions for PDF presence, page count, and repeated table headers where feasible. | Later |
| Accessibility/keyboard tests | E2E specs | Timecard arrow navigation is covered, but broader accessibility is not. | Modern UI should preserve keyboard usability. | Medium | Add targeted keyboard/focus tests for extracted common controls. | Later |

## H. CSS And UI Structure Gaps

| File | Exact Problem | Violated Design Rule | Risk | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- |
| `src/styles/main.css:198` | App shell styles live in main CSS. | Main CSS should become an entry point, with app shell styles in a dedicated file/component. | Low/Medium | Move shell styles to `styles/app-shell.css` or `AppShell.vue` scoped styles. | Later |
| `src/styles/main.css:761` | Shared `.app-button` and related controls are global CSS instead of component-owned primitives. | Shared UI primitives should have clear ownership. | Medium | Create `BaseButton`/primitive styles or a `components.css` layer. | Later |
| `src/styles/main.css:878` | Jobs-specific styles live in global main CSS. | Feature/page styles should be scoped to feature/page files. | Medium | Move jobs workspace styles into `JobsView.vue` or feature stylesheet during jobs refactor. | Later |
| `src/styles/main.css:1294` | PrimeVue toast overrides live in main CSS. | Vendor overrides should live in a PrimeVue-specific layer. | Low | Move to `styles/primevue.css`. | Later |
| `src/views/TimecardExportView.vue:2453` | Many deep PrimeVue overrides are local and verbose. | PrimeVue styling should be wrapper- or vendor-layer based where shared. | Medium | Extract toolbar/select styling into reusable wrapper or vendor stylesheet. | Later |
| `src/components/timecards/TimecardWorkbookCard.vue:1500` and `src/components/timecards/TimecardPrintCard.vue:578` | `!important` is used for exact workbook/print alignment. | Avoid `!important`, except for protected print/workbook fidelity. | Low | Do not "clean up" these casually; they are visual fidelity exceptions. | Not now |

UI polish direction is sound, but the refactor should establish design tokens, primitive components, and scoped feature styles before redesigning every screen.

## I. Output Rendering Risks

| Output | Current State | Risk | Files | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- |
| Timecard email | Function attaches a PDF generated through the timecard PDF builder path instead of relying on HTML clone. This matches the final client direction. | Medium because PDF builder and email send live in large function/service files. | `functions/src/timecardWeekFunctions.ts`, `functions/src/emailService.ts` | Preserve behavior. Split only in an output-specific slice. | Later |
| Timecard HTML preview | `functions/tmp/timecard-email-preview.html` is generated/temporary and should not be treated as source of truth. | Low | `functions/tmp/timecard-email-preview.html` | Do not refactor against preview HTML; validate PDF/email source paths. | Not now |
| Shop order PDF/email | PDF builder exists and smoke preview scripts exist. | Medium because pagination/header behavior is critical and client-visible. | `functions/src/emailService.ts`, `functions/scripts/smoke-shop-order-email.cjs` | Add smoke assertion/fixture for long order table headers on continuation pages. | Later |
| Shop order legacy path | `sendShopOrderEmail` still includes a legacy `jobs/{jobId}/shop_orders/{shopOrderId}` fallback. | Low/Medium | `functions/src/operationsFunctions.ts:1830` | Remove only after confirming all data has migrated to top-level `shopOrders`. | Later |
| Email/PDF source coupling | `emailService.ts` is very large and mixes daily log, shop order, timecard, and send helpers. | Medium | `functions/src/emailService.ts` | Split builders from delivery in a later output refactor. | Later |

## J. Cleanup And Deprecation Candidates

| Candidate | File | Problem | Risk | Recommended Fix | Timing |
| --- | --- | --- | --- | --- | --- |
| Suspicious dependency | `package.json` | Dependency named `"22"` appears accidental from Node upgrade work. | Low | Verify it is unused, remove, run install/build/typecheck. | Later |
| Stale indexes | `firestore.indexes.json` | Some indexes reference old fields/collections such as `dailyLogs.uid` and old `timecards`. | Medium | Audit after final query contracts are known. | Later |
| Legacy shop order subcollection fallback | `functions/src/operationsFunctions.ts` | Keeps compatibility with old `jobs/{jobId}/shop_orders` data. | Low/Medium | Remove after data verification. | Later |
| Old role constants | `src/types/domain.ts`, `functions/src/constants.ts`, rules | Old role set blocks Payroll/Shop Foreman and aliases PM. | High | Replace during capability refactor. | Later |
| Compiled function JS artifacts | `functions/*.js`, `functions/*.d.ts`, `functions/*.map` | Build outputs appear alongside TS source. Manual edits here would drift from source. | Medium | Do not edit generated files manually; decide in cleanup whether they remain tracked. | Later |
| Generated preview HTML | `functions/tmp/*` | Temporary previews should not drive architecture. | Low | Keep as tooling artifacts or gitignore if appropriate. | Later |
| Direct browser confirms | Multiple views | Repeated native confirms make UI inconsistent. | Low | Replace with shared confirm primitive over time. | Later |

## K. Open Product And Company Questions

These should stay in `questions-for-company.md` or be moved to `current-understanding.md` once answered.

- Should Project Managers be allowed to export/download assigned-job timecards, or only view submitted cards for billing?
- Can Payroll edit jobs after creating them, or only create and view?
- Can Shop Foreman manage the entire shop catalog, or only submit/manage Shop job shop orders?
- Should Shop Foreman see all job dashboards read-only or only the jobs list read-only?
- Should Project Managers receive timecard emails too, or only Daily Logs and Shop Orders?
- Are custom timecard employee entries temporary only, or should they become employee creation requests?
- When a submitted daily log exists for a date, should "create another" clone job/weather metadata or start fully blank?
- At what data volume should employee/user/job lists move from full subscription to server-side paging/search?
- What exact fields are considered sensitive employee data for non-payroll roles?
- Should deleted users/employees/jobs ever hard-delete, or only deactivate/archive?

## L. Recommended First 5 Refactor Slices

These are intentionally narrow. The goal is to build refactor muscles without disturbing payroll, PDFs, email delivery, or security rules.

1. Capability helper scaffold, current behavior only

   - Add a frontend capability helper that reproduces current behavior without adding new roles yet.
   - Replace one or two route/page checks with the helper.
   - Do not change Firestore Rules or Cloud Functions in this slice.

2. Shared `RecipientEditor`

   - Extract recipient add/remove/list UI from Jobs/Daily Log notification sections.
   - Preserve current data shape and service calls.
   - This is a good first reusable component because it is visible, repeated, and not payroll/PDF-critical.

3. Shared confirmation primitive

   - Add `ConfirmAction` or `useConfirmAction`.
   - Migrate one admin page first, such as Employees or Users.
   - Preserve exact copy and behavior unless explicitly improving UX.

4. Shop order catalog browser extraction

   - Extract catalog tree/search/expand/collapse behavior from `ShopOrdersView.vue`.
   - Do not touch order submission, PDF, email, or Firestore Rules.
   - Preserve search collapse behavior and item name behavior.

5. Daily log save-on-blur composable

   - Extract the dirty guard/save-on-blur behavior into a composable.
   - Preserve the "do not overwrite the field being typed in" behavior.
   - Do not change attachment/email behavior in the same slice.

## M. Exact Test Commands For Each Slice

Run `npm run type-check` for every slice. Add the targeted E2E set below based on what changed.

| Slice | Commands |
| --- | --- |
| Capability helper scaffold | `npm run type-check` then `npx playwright test e2e/access-control.spec.ts e2e/job-dashboard.spec.ts --project=chromium` |
| Shared `RecipientEditor` | `npm run type-check` then `npx playwright test e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` |
| Shared confirmation primitive | `npm run type-check` then `npx playwright test e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium` |
| Shop order catalog browser extraction | `npm run type-check` then `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` |
| Daily log save-on-blur composable | `npm run type-check` then `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` |

When a slice touches functions, also run the relevant function smoke command:

- `npm --prefix functions run smoke:daily-log-email`
- `npm --prefix functions run smoke:shop-order-email`
- `npm --prefix functions run smoke:timecard-email`

When a slice touches all workflows or shared shell/routing:

- `npm run test:e2e`

## N. No-Go Conditions

Do not continue a refactor slice if any of these are true:

- A touched workflow does not have a targeted E2E test.
- A component extraction requires changing Firestore Rules, Cloud Functions, and UI in the same PR/slice.
- A shared component imports Firebase SDK directly.
- A view-first workflow starts creating drafts/items during navigation.
- A timecard PDF/workbook visual changes outside a dedicated timecard output slice.
- A shop order PDF/email change cannot be previewed or smoke-tested with a long multi-page order.
- A role/rules change is made without emulator tests or a written rollback path.
- A query change broadens access or reads without checking rules and indexes.
- `data-testid` values used by E2E are removed or renamed without updating tests in the same slice.
- The app becomes slower or disables typing while a save is pending.

## O. Files Not To Touch Yet

These files are not forbidden forever. They are just high-blast-radius files that should only be touched in a matching dedicated slice.

| File | Reason |
| --- | --- |
| `src/components/timecards/TimecardWorkbookCard.vue` | Exact user-facing workbook behavior and visual fidelity. Touch only for timecard-specific bugs with E2E coverage. |
| `src/components/timecards/TimecardPrintCard.vue` | Exact print/PDF visual fidelity. Touch only in output-specific work. |
| `functions/src/emailService.ts` | Huge output/delivery surface. Do not mix with UI refactors. |
| `functions/src/operationsFunctions.ts` | Huge callable/email surface. Do not mix with UI or component extraction. |
| `functions/src/timecardWeekFunctions.ts` | Payroll-critical. Touch only with targeted timecard tests and smoke verification. |
| `firestore.rules` | Security-critical. Touch only with role/rules emulator tests. |
| `storage.rules` | Security-critical. Touch only with role/storage emulator tests. |
| `firestore.indexes.json` | Query/index behavior. Touch only when service query contracts are being changed. |
| `src/testing/e2eRuntime.ts` | E2E backbone. Touch only when tests need new seeded behavior and keep routes realistic. |
| `functions/*.js`, `functions/*.d.ts`, `functions/*.map` | Treat as generated/build artifacts. Edit TypeScript source instead. |
| `functions/tmp/*` | Preview artifacts, not source of truth. |

## Final Assessment

The refactor docs are strong enough to guide the work, and the app has enough E2E coverage to start careful extraction. The part that is not ready for casual refactor is roles/security/functions. That area needs its own implementation plan, emulator tests, and capability matrix before changing behavior.

Recommended next move: start with one low-risk UI/component slice, then add the capability helper scaffold before touching dashboards or role-specific navigation.
