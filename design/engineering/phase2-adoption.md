# Phase 2 architecture facts

These facts apply specifically to this repository, checked November 6, 2026. The external [reusable engineering standards](coding-process.md#reusable-standards) live in Atlas’s private ChatGPT Space and require authorized ChatGPT access. These project choices are not defaults for every future product.

| Area | Current Phase 2 choice |
| --- | --- |
| Source and branches | Original `Phase2-Web-App` checkout; `test`/`main` policy in [GIT-WORKFLOW.md](../../GIT-WORKFLOW.md) |
| Browser versions | Vue 3.5.32, Router 5.0.4, Pinia 3.0.4, Vite 8.3.0, TypeScript 6.0.3 in the root lockfile |
| Firebase versions | Web 12.18.0, Admin 14.4.0, Functions 7.3.2; backend TypeScript 5.9.3 |
| Runtime/tooling | Local Node 24 tooling; Functions configuration declares Node 22 |
| Source layout | Browser `src/`; backend `functions/src/` compiles to ignored `functions/lib/`; separate employee/public/SSR builds |
| SDK owners | [Browser initialization](../../src/firebase.ts), [server runtime](../../functions/src/runtime.ts), [secret bindings](../../functions/src/functionConfig.ts) |
| Access | Active Firestore profiles, roles, ownership and job assignments; private employee Forms; no general company-entitlement model |
| Tenant/product status | Single configured Firebase project and business collections; commercial module packaging/tenancy remains design work |
| App Check | No initialization/enforcement found in the inspected current integration; proposed separately, not assumed active |
| Local verification | Vitest, Playwright, SDK Rules tests and privileged-handler emulator scripts; no production writes or actual email as test fixtures |

Use the [coding process](coding-process.md) for design reading order, commands, preview retention, safe chat handoffs and release boundaries. Use [module contracts](module-contracts.md) for current interfaces. The [next-update design index](../next-update/README.md) owns product requirements and current checkpoints.

The Forms delivery adapter, authoring/persistence separation, authorized document fetch and shared dashboard transport are existing examples of clear module boundaries. They are not a claim that all application modules have already been refactored. Future company membership, entitlements, migration and billing require scoped design and implementation; the research documents do not enable them.
