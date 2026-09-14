# Security review — September 12, 2026

This is the historical review before remediation. The findings and line numbers below describe the reviewed version. Local fixes and validation completed September 13, 2026 are recorded in [SECURITY_FIXES.md](SECURITY_FIXES.md). They have not been deployed: this machine has no authenticated Firebase CLI account.

The application has useful authentication and authorization controls, but the issues below should be addressed before treating it as ready for sensitive operational and payroll data.

Scope: source review of Firebase rules, authentication, callable functions, public galleries, browser storage, hosting configuration, and current npm audits of both lockfiles. These are source-level findings, not proof of exploitation. Deployed rules, cloud IAM, enabled sign-in providers, App Check console settings, security headers added outside this repository, and audit logs were not verified. No live records were read or modified, and no security fixes were deployed.

## Priority findings

### 1. High: password-setup tokens are exposed to payroll users

`firestore.rules:286` permits payroll users to get and list full user documents. `functions/src/userFunctions.ts:228` stores the raw setup token and expiry in those documents. `setUserPassword` at line 908 accepts a UID, password, and matching unexpired token without requiring the target user's authenticated session or an administrator.

A payroll account can therefore read another user's valid invite token and set that user's password. An administrator with a pending valid invite is also exposed. This finding requires an existing valid token; it does not mean every account can always be reset.

Move setup credentials into a collection with no client access, store token hashes, and return only necessary profile fields through authorized reads. Prefer the managed Firebase password-action flow where practical. After resolving exposure, invalidate outstanding setup tokens and reissue required invitations. Firestore reads expose the entire allowed document; hiding token fields in the UI does not protect them. [Firebase field-access guidance](https://firebase.google.com/docs/firestore/security/rules-fields).

### 2. High: attachment access does not enforce job permissions

`storage.rules:35` and `storage.rules:45` allow any authenticated identity to read and delete daily-log images and thumbnails. Upload checks validate size, claimed content type, and supplied metadata, but do not verify an active workspace role, the real parent log, assignment to its job, or draft status.

An authenticated user can access or delete another job's photos given their object paths, and upload into another log's path. A profile disabled in Firestore is not rejected by these rules while its Firebase authentication remains valid. Anonymous identities also satisfy the rules if anonymous authentication is enabled. The existing `scripts/verify-storage-rules.mjs:119` explicitly expects a different anonymous identity to read and delete the uploader's files; that test should be reversed when authorization is corrected.

Authorize storage operations against the actual log and active user/job permissions, with deliberate exceptions for public sharing. Firestore and callable checks do not protect direct Storage SDK requests. [Firebase Storage rule conditions](https://firebase.google.com/docs/storage/security/rules-conditions).

### 3. High: field restrictions overlook additions and removals

`firestore.rules:172`, `258`, `269`, and `331` use `changedKeys()` to protect job, profile, and timecard-week fields. That method considers changed values of keys present in both versions, excluding newly added or deleted keys.

For example, the project-manager guard against changing `active` and `archivedAt` does not reject removal of those fields. The foreman's recipient-only update guard can permit deletion or addition of unrelated fields. Other explicit equality checks still apply; this is not an unrestricted ability to change every protected field.

Use `affectedKeys()`, explicit field allowlists, required-field checks, and type validation. Add emulator tests for field creation and deletion as well as ordinary updates. [Firebase MapDiff reference](https://firebase.google.com/docs/reference/rules/rules.MapDiff).

### 4. High: direct workflow writes can forge protected metadata

`firestore.rules:309` and `366` allow assigned workflow users to create daily logs and shop orders without a schema or required draft status. Updates to drafts protect the job ID (and log date for daily logs) but leave submission status, author identifiers, timestamps, and other metadata writable.

A direct Firestore client can write submitted records or impersonated audit metadata without following the intended backend workflow. Timecard-week creation at line 325 similarly lacks draft-status and metadata-shape requirements. Separately, the daily-log and shop-order update callables accept `request.data.actor` for submission attribution instead of always deriving it from authenticated identity.

Choose a consistent write boundary: deny direct writes for operations owned by callables, or enforce equivalent invariants in rules. Derive author and submission identity on the server. Verify that recorded submissions correspond to completed validation and delivery steps.

### 5. Dependency findings need updates and exposure assessment

Initial `npm audit` results, before remediation:

| Dependency tree | Total affected packages | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: | ---: |
| App, including development tools | 40 | 3 | 15 | 20 | 2 |
| App, production dependencies only | 14 | 1 | 5 | 8 | 0 |
| Cloud Functions | 10 | 0 | 2 | 8 | 0 |

The app rows overlap and must not be added together. Findings count affected packages, including transitive and inherited advisories; they are not a count of independently exploitable application bugs. A production dependency classification also does not prove the vulnerable code is shipped in the browser bundle.

Backend high-severity findings included `axios` and `form-data`. App findings included `vite` in development tooling and `websocket-driver` in the production dependency tree. The original cache reports were removed during dependency reinstallation; final audit reports are retained locally under `.security-work/*-audit.json`. Update supported dependencies, inspect dependency paths and actual use, and rerun build/workflow checks. Do not blindly apply `npm audit fix --force`; some suggested fixes change major versions or downgrade tools.

## Additional concerns

- **Public gallery access:** `functions/src/dailyLogGalleryFunctions.ts:268` serves submitted-log photos using only job ID and log ID, without authentication or the random share token used by newer links. This may preserve intended legacy sharing, but it weakens control over which logs are public. Confirm the sharing policy and migrate legacy links to explicit, revocable shares where needed.
- **Password-reset abuse:** `requestPasswordResetEmail` at `functions/src/userFunctions.ts:857` is public and sends email without an application-level throttle. No callable App Check enforcement was found in source. Add per-account and caller abuse controls; verify cloud-side protections. Its generic success message is a useful existing defense against straightforward account enumeration.
- **Password-token robustness:** token redemption updates Auth before clearing the token in Firestore, leaving a concurrent-use window. Invalid expiry dates are not explicitly rejected before comparison. Make redemption single-use and reject missing/invalid expiry values.
- **Payroll exports on shared devices:** `src/features/timecards/pdf-export.ts:41` stores full export payloads in localStorage. The 12-hour pruning is performed when the storage helper is used, rather than automatically deleting data after 12 hours. `src/stores/auth.ts:261` does not clear this data on sign-out. Use shorter-lived transfer storage and explicit cleanup at account changes and sign-out.
- **Browser hardening:** `firebase.json` configures Cache-Control but no explicit CSP, framing protection, or MIME-sniffing protection. Verify effective hosted headers, then add compatible protections. The E2E fixture hook is also not gated to development in `src/testing/e2eRuntime.ts:234`; exclude test substitution code from production. That hook alone does not authorize access to real Firebase data.

## Controls already in place

Firestore and Storage have deny-by-default fallbacks. Backend admin actions check the stored user's active admin role. Many workflow callables check authentication and job access independently of navigation. Gallery URLs are checked against the expected bucket and object path. Setup/share tokens use cryptographic randomness. Email credentials use Firebase secret parameters, and `.env.local` is ignored by Git. These are useful foundations, but they do not compensate for the permission gaps above.

Resolve token exposure and storage authorization first, then rule/write-boundary gaps and dependency updates. Validate fixes using separate synthetic roles and jobs in the emulators before deploying, and confirm that the intended rules and functions actually reach the live project.
