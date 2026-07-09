# Firebase Architecture

## Purpose

This document defines the Firebase guardrails for the refactor.

The app should keep behaving like a Vue application at the UI layer, but Firebase should be treated as a clear backend boundary:

- Firestore stores workflow records.
- Security Rules enforce access.
- Cloud Functions handle privileged work and side effects.
- Storage holds controlled uploads and generated artifacts.
- Hosting serves the built app.
- Emulators support safe local and CI testing.

Official references used for this direction:

- Firestore best practices: https://firebase.google.com/docs/firestore/best-practices
- Firebase Security Rules: https://firebase.google.com/docs/rules
- Cloud Functions tips: https://firebase.google.com/docs/functions/tips
- Emulator Suite: https://firebase.google.com/docs/emulator-suite
- Firebase App Check: https://firebase.google.com/docs/app-check
- Auth custom claims: https://firebase.google.com/docs/auth/admin/custom-claims

## Current Firebase Surface

The app currently uses:

- Firebase Auth for sign-in and user identity.
- Firestore for users, jobs, employees, daily logs, timecard weeks/cards, shop catalog, shop orders, and settings.
- Firebase Storage for daily log attachments.
- Cloud Functions for server-side work such as emails, user setup, exports, and generated artifacts.
- Firebase Hosting for the SPA.
- Firebase Emulator Suite configuration in `firebase.json`.

The current shape is workable. The refactor should improve boundaries and tests before changing the data model.

## Core Principles

### 1. Rules Are the Enforcement Boundary

The UI can hide buttons and routes, but it must not be trusted as the permission system.

Firestore and Storage rules should enforce:

- active app user checks
- role checks
- assigned-job checks
- draft vs submitted edit rules
- role-specific employee/user/export/catalog access
- Project Manager assigned-job edit access without delete/archive access
- Payroll employee, timecard export, and job creation access without delete/archive access
- Shop Foreman shop catalog management and `Shop` job workflow access without job setup delete/archive access
- attachment ownership and metadata checks

Client code should assume a write can fail even if the UI allowed the action.

### 2. Components Do Not Import Firebase

Vue components should not directly import Firestore, Auth, Storage, or Functions.

Preferred boundary:

```text
Page or store
  -> service
  -> Firebase SDK or e2e runtime
```

Shared components and feature components should generally be props/events driven. This keeps components stubbable and lets e2e tests exercise real pages without fake routes.

### 3. Services Own Firebase Details

Services should hide:

- Firestore path names
- query construction
- snapshot-to-domain normalization
- server timestamp handling
- callable function names
- Storage paths
- e2e runtime branching

Views should work with domain concepts such as `createShopOrder`, `subscribeVisibleJobs`, or `submitTimecardWeek`, not raw Firebase calls.

### 4. Cloud Functions Own Privileged Work

Use Cloud Functions for work the browser should not own:

- creating or disabling Auth users
- setting custom claims if custom claims are later used
- sending emails
- generating PDFs and CSVs
- preparing export artifacts
- writing server-authenticated audit records
- any write that must bypass normal user permissions

Functions should be idempotent where practical, await all async work before returning, and avoid background work after the response is sent.

### 5. Data Model Follows Query and Rule Needs

Firestore data should be modeled around the app's actual access patterns.

Good patterns for this app:

- records include `jobId`, `status`, created/submitted metadata, and dates needed for filtering
- submitted records keep snapshots of employee/order data that must not change later
- timecard cards live under their week because cards are usually read with the week
- audit history uses subcollections instead of ever-growing arrays
- human-facing order numbers are fields, not document IDs

Avoid:

- large unbounded arrays for history
- sequential document IDs for high-write collections
- duplicated business rules that only live in the UI
- data layouts that require broad client reads followed by filtering in memory
- list screens that depend on loading entire collections and filtering/sorting on the client

Query rules:

- Prefer queryable fields, compound indexes, and scoped reads over broad collection reads.
- Use cursor-based pagination for large lists; do not use offsets for normal app pagination.
- Use stable sort fields for history lists and admin directories.
- Keep visible counts separate from expensive full reads when a count would otherwise require loading many documents.
- Treat every new query as a schema/rules/index decision, not just a frontend change.

### 6. Indexes Are Intentional

Firestore indexes affect write cost and latency. Keep composite indexes tied to actual queries.

Refactor rule:

- When adding or changing a query, update `firestore.indexes.json` intentionally.
- When removing old query patterns, audit old indexes.
- Consider single-field index exemptions for fields that are never queried, especially large strings, arrays, or sequential timestamp fields.

Current audit item:

- Review `firestore.indexes.json` for legacy indexes tied to old fields or old collections, especially around daily logs and timecards.

### 7. Runtime Validation At Boundaries

TypeScript is not enough once data crosses a runtime boundary.

Validate runtime payloads at:

- frontend service command inputs before writes or callable requests
- Cloud Function request bodies before privileged work
- Firestore snapshot normalization when old/partial documents may exist
- file/upload metadata before Storage writes

Rules:

- Prefer shared schema helpers per domain so the app and functions agree on required fields.
- Convert unknown input into explicit domain types before business logic runs.
- Return user-safe validation errors instead of generic crashes.
- Do not rely on component-level form validation as the only protection before a backend write.

### 8. Emulators Protect Rules and Functions

The Emulator Suite should be used for rules/function validation where e2e browser tests are not enough.

Recommended test layers:

- Playwright e2e for real user workflows.
- Vitest/component tests for extracted Vue pieces.
- Emulator-backed tests for Security Rules and Cloud Functions side effects.

Priority emulator tests:

- foreman can only read assigned-job records
- payroll can read employees, use timecard export data, and create jobs, but cannot delete/archive jobs
- shop foreman can manage/use shop catalog permissions and `Shop` job workflows as designed, but cannot delete/archive jobs
- project manager can edit assigned jobs but cannot delete/archive jobs or access unassigned job dashboards
- project manager can read submitted timecards and daily log history for assigned jobs only
- foreman cannot read employee admin data
- submitted timecard/shop order/daily log records are protected
- admin can perform export/admin operations
- Storage attachments require valid metadata and draft access
- submit functions create the expected emails/artifacts exactly once

### 9. App Check Is a Production Hardening Goal

App Check should be considered for production hardening after the refactor is stable.

It can help reduce abuse from unauthorized clients for supported Firebase services, but it is not a replacement for Auth, Security Rules, or server-side validation.

When added:

- keep debug token support for local development
- document setup for deployed environments
- test that app startup failures are visible and understandable

## Firestore Data Rules

### Document IDs

Use Firestore-generated IDs or random IDs for new workflow records.

Avoid:

- monotonically increasing document IDs
- date-only IDs on hot collections
- user-visible order numbers as document IDs

Shop order numbers, employee numbers, and job numbers should remain fields.

### Timestamps

Use server timestamps for created/updated/submitted metadata where the server value matters.

Client-side dates are still appropriate for user-selected business dates such as:

- timecard week start/end
- daily log date
- requested shop order delivery date

### Submitted Snapshots

Submitted records must be reproducible later.

Snapshot these fields at submission time when they affect output:

- employee name, employee number, occupation, wage
- job number and job name where printed/exported
- timecard rows and totals
- shop order item names, quantities, notes, delivery date, and order number
- daily log payload and recipients

Later edits to employees, jobs, or catalog entries should not silently change historical submitted outputs.

### Audit Trail

Use audit subcollections for post-submit or admin-sensitive changes.

Audit records should include:

- actor user ID
- action
- timestamp
- target record
- changed fields or before/after summary

Do not store growing audit arrays on the main record.

## Security Rules Direction

Rules should stay conservative:

- deny by default
- require signed-in active users
- admins get full operational access
- foremen get assigned-job workflow access
- payroll, project-manager, and shop-foreman roles must be explicit rules, not loose client-only checks
- all-job read-only lookup must not imply job edit or workflow access
- assigned-job dashboard access must not imply access to unassigned workflow records
- submitted-timecard reporting for Project Managers should be assigned-job and submitted-status scoped

The app currently uses role/profile documents in Firestore. That is acceptable for this app as long as rules continue to read the profile directly.

If custom claims are introduced later:

- only privileged server code should set them
- do not store profile data in claims
- keep claims small
- continue enforcing backend access with verified identity, not client-provided values

## Storage Direction

Storage should remain narrow and metadata-validated.

For daily log attachments:

- uploads should include expected metadata
- rules should verify `jobId`, `dailyLogId`, and `uploadedBy`
- submitted logs should not allow normal user attachment changes
- file paths should avoid user-controlled path traversal or ambiguous naming

Generated exports should prefer server-written Storage paths when they need to be retained or downloaded later.

## Cloud Functions Direction

Functions should be split by domain as they grow:

```text
functions/src/
  auth/
  dailyLogs/
  emails/
  exports/
  shopOrders/
  timecards/
  users/
  shared/
```

This is a target structure, not a required immediate move.

Function rules:

- validate caller identity and role server-side
- validate input shape before writing
- use transactions where consistency matters
- avoid duplicate emails/artifacts on retries
- record send/export status where the user needs reliable feedback
- never rely on client-calculated privileged fields
- keep email/PDF renderers covered by preview or smoke tests
- assign a correlation ID or operation ID to submit/email/export workflows
- write enough status metadata for support to answer whether an email/PDF/export was generated, sent, failed, or retried
- clean up temporary files created during PDF/export generation
- prefer stream/pipeline-style artifact generation for large files when practical

Timecard-specific rule:

- Timecard email should attach the same PDF generation output used by admin export.
- Do not keep a second HTML clone of the timecard layout.

## Calling Functions From The Vue App

Default to callable HTTPS functions for app-to-backend actions.

Use:

```text
Vue service
  -> httpsCallable<Request, Response>(functions, 'functionName')
  -> backend onCall handler
```

Why:

- Firebase client SDKs call functions directly from the app.
- Callable requests automatically include Firebase Auth tokens, FCM tokens, and App Check tokens when available.
- Callable triggers automatically deserialize the request body and validate auth tokens.
- Callable functions return structured `HttpsError` values to the client when we throw them correctly.

Use callable functions for:

- creating/updating/deleting privileged records
- submitting daily logs, timecards, and shop orders
- sending emails
- generating or preparing exports
- admin-only actions such as user setup/deletion

Use plain HTTP `onRequest` functions only when the endpoint is intentionally HTTP-shaped:

- external webhooks
- public or semi-public REST endpoints
- custom endpoints proxied through Firebase Hosting
- migration/admin endpoints not called by normal app UI

Client rules:

- Components should not call `httpsCallable` directly.
- Services may call `httpsCallable`; shared components should emit intent to pages/services.
- Keep `getFunctions(app, 'us-central1')` centralized in `src/firebase.ts` unless the deployed function region changes.
- If a function is deployed outside `us-central1`, initialize/call it with the matching region.
- Prefer a small typed helper later if repeated callable boilerplate becomes noisy.

Backend rules:

- Validate `request.auth` for authenticated actions.
- Validate request data before writing.
- Throw `HttpsError` with useful codes/messages for user-facing failures.
- Await all async work before returning.
- Make submit/email/export functions idempotent where retries could duplicate side effects.
- Do not start timers, callbacks, or background work that can continue after the function response.
- If a function writes temporary files, delete them before returning even on failure paths where practical.
- For production hardening, consider `enforceAppCheck: true` on sensitive callable functions after App Check is configured.

## Observability And Support Direction

Operational workflows should be diagnosable without asking users to reproduce the issue repeatedly.

For submit/email/export workflows, record:

- workflow type
- source record ID
- job ID
- acting user ID
- operation/correlation ID
- started/completed/failed timestamps
- email recipient summary where appropriate
- generated artifact path where appropriate
- retry count or duplicate-prevention key where appropriate
- user-safe failure reason

Logging rules:

- Logs should include correlation IDs for matching frontend errors to function work.
- Logs should avoid sensitive payload dumps.
- User-facing errors should be plain language, while detailed errors stay in logs/status metadata.

## Release And Rollback Direction

Firebase releases can involve frontend code, rules, indexes, functions, and data shape changes. Treat those as coordinated releases.

Before deploying a Firebase-sensitive change:

- identify affected Firestore paths, rules, indexes, functions, and frontend routes
- deploy required indexes before frontend code depends on them
- deploy backward-compatible rules/functions before frontend code sends new payloads where possible
- keep old fields readable until deployed data and code no longer need them
- have a rollback note for frontend Hosting, Functions exports, Rules, and indexes
- verify smoke tests for email/PDF/CSV outputs after deploy

Stop and split the release if:

- frontend code requires rules that are not deployed yet
- functions expect a payload shape the old frontend cannot send
- a data migration and workflow refactor are bundled together
- rollback would leave users unable to submit field workflows

## Client Firebase Direction

`src/firebase.ts` should remain the single Firebase initialization boundary.

Client rules:

- no Firebase Admin concepts in browser code
- no secrets in browser env variables
- no direct SDK imports in components
- no hard-coded production-only behavior that breaks local/e2e tests
- emulator or e2e runtime behavior should be explicit

If the app begins using real emulators in local dev, keep connection logic centralized and gated by environment variables.

## Refactor Implications

During refactor slices:

- Extract components first; keep services stable.
- Extract composables for autosave, filtering, recipients, and dirty snapshot protection.
- Do not redesign Firestore access while moving large UI sections.
- Preserve `data-testid` values.
- Add emulator tests before broad Security Rules changes.
- Keep output generators isolated and protected.
- Keep runtime validation close to service/function boundaries.
- Keep release order explicit when rules, indexes, functions, and frontend code all change.

## Immediate Firebase Checklist

Before or during the next refactor phase:

- Audit `firestore.indexes.json` against current query usage.
- Add a first Security Rules emulator test suite for roles and assigned-job access.
- Add shared runtime validation helpers for callable/function payloads.
- Confirm all email/PDF functions await async work and record enough status for support.
- Confirm submit functions avoid duplicate side effects on retries.
- Confirm PDF/export functions clean up temporary files and do not leave background work after return.
- Document the deployment order for any slice that changes rules, indexes, functions, and frontend behavior together.
- Decide whether App Check belongs in the first production hardening pass.
- Keep the timecard email PDF path unified with the admin PDF export path.
