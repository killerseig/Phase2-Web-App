# Cleanup And Deprecation

## Purpose

This document defines how to remove old code, migration paths, compatibility fields, and unused Firebase functions without breaking the app.

Old code should be removed when it no longer protects production behavior. The app should not keep duplicate systems around forever just because they once helped migration.

## Cleanup Principles

- Remove unused code in small slices.
- Prove a cleanup with searches, type-checks, builds, and targeted tests.
- Do not remove data compatibility and UI refactor code in the same slice.
- Do not remove Firestore fields until reads, writes, rules, indexes, and deployed data are accounted for.
- Keep exact output paths simple. Do not keep alternate clones of timecard PDF/email/shop order templates unless they are actively used.

## Safe To Remove Immediately

These are usually safe when no references remain:

- one-time migration scripts after data has been merged
- stale compiled artifacts for removed functions
- unused helper functions with no imports
- dead e2e helper pages or fake routes
- old preview files that no script references
- duplicate email/template builders that are not used by current send paths
- unused imports, types, and constants

Required checks:

```bash
rg -n "RemovedName|RemovedFunction|RemovedField" src functions e2e design package.json
npm run type-check
npm --prefix functions run build
```

Run targeted e2e or smoke tests when the removed code is near a workflow.

## Requires A Cleanup Plan

These are not simple deletions:

- Firestore document fields
- settings fields
- recipient compatibility fields
- collection names
- Storage paths
- Firestore composite indexes
- Security Rules branches
- callable function exports that may still be deployed
- localStorage/sessionStorage compatibility payloads
- e2e runtime data shape

For these, write down:

- current readers
- current writers
- Security Rules dependencies
- function dependencies
- indexes
- e2e/runtime seed dependencies
- production data cleanup or fallback plan

## Firebase Function Deprecation

When removing a callable or HTTP function:

1. Remove frontend service calls first.
2. Remove backend exports from `functions/src/index.ts`.
3. Remove unused implementation code.
4. Run function build and affected smoke/e2e tests.
5. During deploy, watch for Firebase CLI deleted-function prompts.
6. Confirm old deployed functions are deleted or intentionally left disabled.

Do not leave old callable names documented as active app API.

If a function name changes, prefer a transition period only when existing deployed clients might still call the old name.

## Firestore Field Deprecation

Use this sequence for old Firestore fields:

1. Stop writing the old field.
2. Keep reading the old field only as a fallback if production records still need it.
3. Backfill or clean production data if needed.
4. Remove fallback reads.
5. Remove types, rules, indexes, and tests tied to the old field.
6. Run targeted e2e and rules tests.

Avoid dual-writing indefinitely. Dual-write fields should have a removal issue or cleanup note.

## Recipient Field Cleanup

Recipient fields are a special case because they affect live notifications.

Before removing legacy recipient fields:

- confirm the canonical `notificationRecipients` shape is populated in production
- stop writing old fields from frontend services
- remove fallback reads from frontend services and functions
- update Firestore rules if foremen/admins edit recipients
- run daily log, job, shop order, and timecard notification e2e/smoke tests

This should be its own refactor slice.

## Migration Script Cleanup

One-time scripts should live only as long as they are needed.

After a migration is complete:

- delete migration scripts
- delete restore scripts if backups are no longer needed
- delete stale compiled artifacts
- keep only a short design note if the migration history matters

Do not keep old migration endpoints deployed unless there is a live operations reason.

## Index Cleanup

Firestore indexes should reflect current queries.

Before removing an index:

- search for the query shape in services/functions
- check e2e coverage for the related page
- deploy indexes deliberately
- verify the affected page still loads in production-like data

## Local Compatibility Payloads

Local storage compatibility should be time-limited.

Keep it only when:

- users may have old local payloads that still need to open
- the fallback is small and isolated

Remove it when:

- the payload is regenerated frequently
- the fallback complicates code
- tests and UI no longer depend on it

## Cleanup Checklist

Before cleanup:

- identify the active owner of the behavior
- search all references
- decide whether this is simple deletion or compatibility cleanup
- identify required tests

After cleanup:

- run `npm run type-check`
- run `npm --prefix functions run build` if functions changed
- run targeted e2e or smoke tests
- search removed names again
- update design docs if the deleted code was part of a documented path

## Stop Conditions

Stop and reassess if:

- a removed field still appears in Firestore rules
- a deleted function may still be called by the UI
- notification recipients are affected but email smoke tests are not available
- production data shape is uncertain
- cleanup requires changing unrelated workflow behavior

