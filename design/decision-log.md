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

