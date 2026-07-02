# Decision Log

## Purpose

This file records important design and refactor decisions as they are made.

Use it for decisions that future-us might otherwise have to rediscover by reading code history, Slack/email notes, or several design docs.

Keep entries short. This is not a second architecture document.

## Entry Format

```text
## YYYY-MM-DD - Decision title

Decision:

- what we decided

Why:

- the main reason

Implications:

- what this affects
```

## 2026-06-10 - E2E Tests Use Real App Pages

Decision:

- Playwright e2e tests should test the same pages users use.
- Do not create fake e2e-only pages for workflows.

Why:

- The tests are meant to protect real behavior during refactors.
- Fake pages can pass while the actual app page is broken.

Implications:

- Use seeded e2e runtime data instead of fake test routes.
- Preserve useful `data-testid` values during component extraction.
- Add real-page coverage before refactoring uncovered workflows.

## 2026-06-10 - Services Own Firebase Access

Decision:

- Vue components should not call Firebase SDKs or callable functions directly.
- Frontend services own Firebase, Cloud Function, Storage, and e2e-runtime details.

Why:

- Components stay easier to extract, stub, and test.
- Firebase implementation details remain centralized.

Implications:

- Shared components emit user intent through events.
- Pages/composables coordinate workflow behavior.
- Services normalize raw Firebase data into domain types.

## 2026-06-10 - Timecard Email Uses PDF Attachment

Decision:

- Timecard submission emails should rely on the same PDF generation path used by admin export.
- Do not maintain a second HTML clone of the timecard layout.

Why:

- The PDF creator is the source of truth for exact timecard layout.
- Maintaining a separate HTML clone caused visual mismatch and wasted effort.

Implications:

- Timecard email smoke tests must protect the attachment path.
- PDF/export changes should be isolated and previewed carefully.
- Timecard UI refactors should not be bundled with PDF/email layout changes.

## 2026-06-10 - Cleanup Old Migration Code After Data Merge

Decision:

- One-time migration scripts and unused legacy function surfaces can be removed after the old data has been merged.

Why:

- Keeping old migration paths increases confusion and refactor risk.
- Dead code makes it harder to see the active app architecture.

Implications:

- Cleanup should still be done in small slices.
- Compatibility fields that are still read/written require their own cleanup plan.
- Deleted Firebase function exports need deploy-time attention so old deployed functions are removed intentionally.

## 2026-06-17 - Shop Order PDF Is The Reliable Print Artifact

Decision:

- Shop order emails may keep an HTML body for quick viewing, but the attached PDF is the reliable print artifact.
- The shop order PDF generator must manually repeat the table column header at the top of continuation pages.

Why:

- Email clients do not consistently honor print CSS, repeated table headers, or fixed-width layout behavior.
- The shop needs printed orders to remain readable across page breaks.

Implications:

- Do not rely on the email body alone for exact printed shop order output.
- Keep shop order email HTML, PDF generation, and send orchestration isolated enough to test independently.
- Preview/smoke tests must cover long orders that span multiple PDF pages.

## 2026-06-17 - Overall Refactor Needs A Living Master Plan

Decision:

- Maintain `overall-refactor-plan.md` as the umbrella plan for the broad app refactor.
- Keep specialized docs for detailed rules, but use the master plan to coordinate sequencing and cross-cutting guardrails.

Why:

- The refactor affects nearly every part of the app: Vue structure, Firebase boundaries, tests, output rendering, cleanup, and GUI modernization.
- Without one high-level map, it is too easy to optimize one module while accidentally breaking another.

Implications:

- Update the master plan when refactor sequencing, guardrails, or major themes change.
- Record durable decisions in this decision log.
- Keep detailed implementation rules in the focused design docs.

## 2026-06-17 - Normal Workflow Actions Should Feel Local-First

Decision:

- Create/add/edit interactions should update the UI immediately where it is safe.
- Firebase writes should usually happen in the background with localized pending state.
- Avoid greying out full panes or blocking unrelated controls during normal saves.

Why:

- Field users need the app to feel fast and predictable.
- Waiting for remote writes or subscription echoes makes workflows feel clunky even when the backend is working correctly.

Implications:

- Refactors should introduce optimistic workflow helpers and pending-action components.
- Tests should protect typing, add-item, and create-draft behavior under pending/slow-save conditions.
- Final actions such as submit/delete can still use stronger pending states because they intentionally change workflow status.

## 2026-06-17 - Reuse Similar Patterns Intentionally

Decision:

- Before adding new components, composables, services, or style patterns, perform a reuse review.
- Share stable visual patterns and repeated behavior, but avoid over-generalized mega-components.

Why:

- The refactor should make the app smaller and more consistent, not create parallel versions of the same idea.
- Forced reuse can be just as harmful as duplication when workflows have different permissions or business rules.

Implications:

- Prefer shared primitives plus feature-specific wrappers when workflows are similar but not identical.
- Add checklist items to catch duplication during component/composable extraction.
- Document intentionally separate components when the reason may not be obvious later.

## 2026-06-24 - Project Manager Is Temporarily Foreman-Equivalent

Decision:

- Add `Project Manager` as a stored user role.
- Treat Project Manager as foreman-equivalent for assigned-job workflows until the broader role refactor.
- Show assignable Foremen and Project Managers together in job assignment UI as assigned field users.

Why:

- The client needs Project Managers available in user setup now.
- Final Project Manager permissions are still being refined and should not be rushed into bug-fix work.

Implications:

- Firebase rules and Cloud Functions should keep mapping Project Manager to field/foreman-equivalent access for now.
- E2E coverage should protect Project Manager access to assigned job workflows.
- The role refactor should revisit the stored role, effective role, UI wording, and final permission boundaries before training/live rollout.
