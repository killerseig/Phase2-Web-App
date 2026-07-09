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
| R00 | Baseline checkpoint | Ready | Establish known test/build state before refactor work. | none, unless docs need status notes | app code | `npm run type-check`, `npm run test:e2e`, function smoke scripts | Baseline result is recorded in this file or a dated note. |
| R01 | Capability helper scaffold, current behavior only | Ready | Introduce a frontend capability helper that reproduces current permissions without changing behavior. | `src/types`, `src/stores/auth.ts`, route/page checks as needed, tests | `firestore.rules`, `storage.rules`, functions | `npm run type-check`; `npx playwright test e2e/access-control.spec.ts e2e/job-dashboard.spec.ts --project=chromium` | Existing admin/foreman/project-manager behavior is unchanged and route checks use helper in at least one real path. |
| R02 | Shared `RecipientEditor` | Ready | Extract repeated recipient add/remove/list UI. | Jobs/daily log recipient sections, new shared component, focused tests | Rules, functions, email delivery | `npm run type-check`; `npx playwright test e2e/jobs.spec.ts e2e/daily-log-recipients.spec.ts --project=chromium` | Recipient behavior and saved data are unchanged; parent view gets smaller. |
| R03 | Shared confirmation primitive | Ready | Replace direct `window.confirm` in one low-risk admin page. | new confirm component/composable, one admin page | destructive behavior semantics, rules/functions | `npm run type-check`; `npx playwright test e2e/admin-management.spec.ts e2e/admin-pages.spec.ts --project=chromium` | User-facing copy and confirmation behavior are preserved or intentionally improved. |
| R04 | Shop order catalog browser extraction | Ready | Extract catalog tree/search/expand/collapse from `ShopOrdersView`. | shop order catalog browser component/composable, `ShopOrdersView.vue` integration | shop order PDF/email, submit callable, rules | `npm run type-check`; `npx playwright test e2e/shop-order-workspace.spec.ts --project=chromium` | Search can still expand/collapse folders and item names remain clean. |
| R05 | Daily log save-on-blur composable | Ready | Isolate dirty guard/save-on-blur behavior. | daily log page, new composable, focused tests | attachments/email/rules/functions | `npm run type-check`; `npx playwright test e2e/daily-log-draft.spec.ts e2e/daily-log-typing.spec.ts e2e/daily-log-submit.spec.ts --project=chromium` | Typing spaces and unsaved edits are not overwritten while persistence is pending. |
| R06 | First visual token pass | Ready | Normalize the smallest useful set of color/space/radius/type tokens before GUI polish. | `src/styles/main.css` or new imported token file, one low-risk component/page if needed | print/email/PDF CSS, timecard print/workbook dimensions | `npm run type-check`; targeted E2E for touched route | New visual work uses tokens instead of new one-off values. |
| R07 | Role capability implementation | Backlog | Add target roles and enforce capabilities across app/rules/functions. | types, auth store, router, rules, functions, e2e runtime, role tests | unrelated UI polish, PDF/email layout | Requires rules emulator tests before rules changes; E2E access-control expansion | Payroll, Shop Foreman, PM, Foreman, Admin behavior matches `role-capability-matrix.md`. |
| R08 | Firestore Rules emulator test suite | Backlog | Add lower-layer security tests before broad role/rules changes. | test config, rules tests, package scripts if needed | app visual code | emulator test command to be defined | Rules behavior is testable without relying only on Playwright. |
| R09 | Function status/idempotency cleanup | Backlog | Make submit/email functions report reliable status and avoid duplicate sends. | Cloud Functions, function tests | UI extraction, CSS | function unit tests/smoke scripts | Daily log/shop order/timecard sends have consistent status metadata. |
| R10 | CSS ownership split | Backlog | Move global CSS toward tokens/base/components/vendor/page ownership. | styles and touched components | workflow behavior, print/PDF output | targeted E2E for each moved page | `main.css` gets smaller or more foundational. |

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

No baseline run has been recorded yet.
