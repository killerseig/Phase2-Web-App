# Coding process

Use the original GitHub repository and keep the current design decisions visible throughout the work. A reliable process depends on verified code, tests and preserved state; this guide cannot repair an application or a broken chat by itself.

## Reusable standards

Use Atlas’s private [Vue/Firebase engineering foundation in ChatGPT Space](https://chatgpt.com/space/page_18e06df51d288191ad9e897e29af574b) for the reusable Vue, Firebase, modular contracts/AI context and optional modules guides. Opening the Space requires Atlas’s authorized ChatGPT access. Keep those universal guides in the Space; do not copy them into this repository, publish their contents or change their sharing as part of project maintenance.

Apply the relevant foundation guidance alongside this repository’s actual versions, product designs and module contracts. The checkout, branch, permission, validation and handoff instructions below are specific to Phase 2.

## Start each coding session

1. Confirm the checkout is `C:\Users\atlas\OneDrive\Documents\GitHub\Phase2-Web-App`, its remote is `https://github.com/killerseig/Phase2-Web-App.git`, and inspect `git status` and the current branch. Preserve existing changes and identify who owns them before editing.
2. Read [GIT-WORKFLOW.md](../../GIT-WORKFLOW.md), the [design index](../next-update/README.md), the affected feature design and its latest dated checkpoint. Read [delivery and decisions](../next-update/05-delivery-and-decisions.md) for unresolved access, rollout and ownership questions. Historical checkpoints are evidence of their date, not current authorization.
3. Use the [contract index](module-contracts.md) to locate the relevant boundaries, then inspect the source and tests necessary for the requested behavior. A contract reduces the context needed; it does not override contradictory source or replace diagnosis.
4. State the intended behavior, affected surfaces and verification. Identify running previews before starting a server. Agree on one writer for overlapping files and one owner of each preview/test runner.

Normal work uses `test`; `main` is the reviewed release branch. The Git workflow requires these two branches and the canonical checkout rather than routine extra branches, clones or worktrees. Meaningful verified changes normally get committed and pushed to `test`. A current instruction such as **no push** takes precedence. Promotion to `main` requires the explicit approval described in the Git workflow; never infer release approval from a request to implement or test.

## Use the existing design

| Change | Required design starting points |
| --- | --- |
| General scope and acceptance | [Requirements](../next-update/01-requirements.md), [delivery and decisions](../next-update/05-delivery-and-decisions.md) |
| Dashboards and role/job workflows | [Workspace design](../next-update/03-workspace-design.md), [widget layouts](../next-update/08-widget-layouts.md) |
| Documents and SDS | [SDS design](../next-update/02-sds-design.md), [first implementation](../next-update/06-first-phase-implementation.md) |
| Website editing/public delivery | [Website milestone](../next-update/07-website-builder.md), [editing guide](../next-update/09-website-builder-guide.md), [quality audit](../next-update/10-website-builder-quality-audit.md) |
| Architecture and visuals | [Technical design](../next-update/04-technical-design.md), [brand guide](../Phase2-Design-Guide.html) |

The technical design includes older proposals alongside newer implementation notes. Reconcile dates with the current source and the latest checkpoint; do not copy an obsolete feature inventory into a new plan. Record a changed decision once in its owning design document and link to it.

## Keep Vue and Firebase boundaries intact

Browser views and components render interactions; feature composables own focused state and lifetimes; stores own shared client state; services provide typed transport. Pure models can be shared with the browser. Firebase Admin clients, secrets, privileged data access and provider delivery stay in `functions/src/`. See [current Phase 2 architecture facts](phase2-adoption.md) and the external [reusable standards](#reusable-standards).

Edit backend TypeScript in `functions/src/`, then compile to ignored `functions/lib/`. Never repair a generated handler beside `functions/package.json` or under `lib/`: the next build replaces it. Preserve named handler exports and runtime assets. The employee app, public website and SSR builds have different entry points and release artifacts; the [README build contracts](../../README.md#project-structure-and-build-contracts) describe them.

Prefer a narrow change through the existing service and model. Extract a module when it owns a coherent capability or dependency boundary, not merely to shorten a file. Avoid unrelated refactors during a production bug fix.

## Develop and verify locally

Use Node 24 for development tooling as specified by the Git workflow. Deployed Functions still declares Node 22; do not change that runtime as a side effect of updating local tools. Install both lockfiles with `npm ci` and `npm --prefix functions ci`. On Windows PowerShell, `npm.cmd` and `npx.cmd` avoid the PowerShell script execution-policy issue.

The managed local demo uses `npm.cmd run dev:forms` and normally serves `http://127.0.0.1:5173/login`. Reuse a running preview. Its emulator state and export lock belong to that runner; do not kill Java, delete locks, prune snapshots or start a competing exporter to obtain a port. Inspect the runner/logs and preserve recovery evidence if startup or export fails. Production credentials, actual employee records and real email are not test fixtures.

| Evidence needed | Maintained command or location |
| --- | --- |
| Frontend types and all build entries | `npm.cmd run build` |
| Fresh Functions packaging without cloud calls | `npm.cmd run verify:functions-build` after build |
| Unit/model regression | `npm.cmd run test:unit -- --run` (frontend, backend source/test and Vite plugin specs) |
| Native script regression | `npm.cmd run test:scripts` (Node test runner; no cloud deployment) |
| Production-built critical journeys | Build with `scripts/vite.critical-built.ts`, then run `scripts/verify-critical-built.mjs` through `firebase.critical-built.json` isolated emulators; exact guarded commands are in the script header. Uses real SDK/rules/compiled handlers and synthetic data, never the saved preview. |
| Dashboard browser workflows | `npm.cmd run test:dashboards` |
| Website editor/browser workflows | `npx.cmd playwright test --config=playwright.builder-regression.config.ts` |
| Read-only source lint | `npm.cmd run lint:check`; use scoped checks to distinguish existing debt from changed-file failures |
| Rules and privileged handlers | Existing emulator verification scripts, with their required demo project/loopback guards |
| Hosting release gate | `npm.cmd run test:shop-order-layout`, plus the approved release's other affected gates |

Choose tests for the behavior: model bounds and invalid input need units; pointer geometry, focus, clipping and device previews need browsers; Rules and Admin handlers need separate authorization checks. Exercise failure, retry, stale response, account/scope change and navigation while dirty where relevant. Inspect screenshots for visual changes. A test passing against mocked callables does not establish deployed IAM or real delivery. Report failures and skipped verification honestly, including a repository-wide lint backlog; do not relabel a scoped pass as a full pass.

The production-built journey harness preserves production fixture exclusion and aliases only Firebase initialization to exact isolated loopback endpoints. Its output is verification-only and must never be deployed. It exposes a limited read/draft-save bridge; email, submissions, invitations and publication are not acceptance actions. Run heavy unit/build jobs separately from browser readiness gates to avoid machine-resource contention. Startup assertions may use a bounded readiness budget, while actual behavior/geometry assertions retain their normal limits.

## Preserve working chats and handoffs

Keep the active coding chat visible and tied to the canonical repository. Use helper agents for read-only research/review or clearly separate work; avoid overlapping writers and source edits during a browser gate. A second chat does not become an authority to change production access.

If a chat stalls or becomes unusable, first inspect Git changes, running commands, preview listeners and retained logs. Preserve its history and local files. Do not delete chats, rewrite Codex metadata, restart the app or discard a worktree as a repair shortcut. Continue through an existing healthy visible chat or an explicitly requested replacement, with a concrete handoff. Platform errors that need an external fix should be reported as such.

A handoff contains: canonical path; branch/base/current commit; dirty files and ownership; accepted requirements and constraints; completed versus remaining work; checks and failures; running process/port ownership; preview URL; data/export state; and the next actionable step. Link the owning design/checkpoint instead of copying the entire conversation. Stop an old writer cleanly before a replacement edits the same files.

## Commit and release

Review `git diff` and generated/untracked files before committing. Keep essential source, tests, scripts and nonsecret configuration tracked; exclude private documents, credentials, emulator exports and generated artifacts. Record test results and real limitations in the handoff.

Follow the [manual release process](../../GIT-WORKFLOW.md#main-and-test-workflow) for promotion, exact-commit verification, scoped backend targets, employee/public artifact boundaries and rollback evidence. A required compatible backend precedes its frontend. GitHub Actions was removed at the owner's request; do not recreate it to bypass a local failure. No release, IAM expansion or live data migration follows automatically from writing these guides.
