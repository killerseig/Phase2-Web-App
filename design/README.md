# Phase 2 Design Notes

This folder keeps the rebuild planning in a few simple files so we can work through the app one decision at a time.

Files:

- `overall-refactor-plan.md`
  Living master plan for the broad refactor, including goals, tracks, sequencing, guardrails, and documentation protocol.
- `current-understanding.md`
  Working summary of what we believe is true right now.
- `v1-blueprint.md`
  The current build blueprint for app structure, data direction, and implementation order.
- `firestore-schema-and-routes.md`
  Recommended Firestore collections, document fields, routes, pages, indexes, and security direction.
- `auth-and-user-flow.md`
  Login, password setup, user creation, activation, deletion, role handling, and access flow for v1.
- `component-architecture.md`
  Component strategy for the refactor, including shared primitives, feature components, composables, and stubbing boundaries.
- `frontend-architecture.md`
  Target Vue architecture for pages, components, composables, services, stores, styling, and testing.
- `ui-modernization.md`
  Visual direction for a cleaner, more professional, modern operations UI without breaking dense workflows or print output.
- `css-architecture.md`
  CSS ownership, token strategy, global-vs-scoped style rules, PrimeVue styling boundaries, and migration plan.
- `ui-token-rollout.md`
  Practical GUI polish rollout plan for tokens, visual slices, CSS ownership, and stop conditions.
- `future-dashboard-widgets.md`
  Future dashboard customization, widgets, file storage, announcements, analytics, and related backlog ideas outside current scope.
- `firebase-architecture.md`
  Firebase best-practice direction for Firestore, Security Rules, Storage, Functions, Hosting, Emulator Suite, and App Check.
- `testing-strategy.md`
  Test layers, workflow coverage matrix, refactor gates, smoke previews, and future test additions.
- `cleanup-and-deprecation.md`
  Rules for removing migration scripts, legacy fields, old functions, compatibility paths, and unused code.
- `module-contracts.md`
  Ownership boundaries for pages, components, composables, services, stores, Cloud Functions, and each app module.
- `decision-log.md`
  Short record of important refactor and architecture decisions.
- `refactor-playbook.md`
  Step-by-step refactor rules, test gates, phase order, and stop conditions.
- `refactor-gap-audit.md`
  Current codebase audit against the refactor docs, including risks, gaps, no-go conditions, and recommended first slices.
- `refactor-execution-board.md`
  Working board for refactor slices, baseline checks, allowed files, required tests, and exit criteria.
- `role-capability-matrix.md`
  Source-of-truth target permissions for Admin, Payroll, Shop Foreman, Project Manager, Foreman, and no-access users.
- `reference-notes.md`
  Notes from the source materials, old app, Excel tools, and reference app.
- `questions-for-company.md`
  Open questions we should ask Phase 2 before locking implementation details.

Ground rule:

- If something is confirmed by you or the company, move it out of `questions-for-company.md` and into `current-understanding.md`.
