# Phase 2 Auth And User Flow

## Purpose

This document defines how `login`, `user creation`, `password setup`, and `user access management` should work in `v1`.

It follows the parts of the old app that already worked well:

- `Login`
- `Set Password`
- admin-created users
- welcome/setup email flow
- forgot password flow
- user removal workflow

## V1 auth goals

- Keep login simple.
- Do not allow normal public self-signup.
- Let admins create users without manually setting passwords for them.
- Let new users create their own password from a setup link.
- Keep access tied to:
  - `role`
  - `active/inactive`
  - `assigned jobs`
- Make user removal and deactivation safe and predictable.

## Target built-in roles

The refactor target uses these built-in stored roles:

- `Admin`
- `Payroll`
- `Shop Foreman`
- `Project Manager`
- `Foreman`

Notes:

- `Project Manager` should no longer remain foreman-equivalent after the role refactor.
- `Project Manager` gets assigned-job dashboard access plus assigned-job edit rights, but no delete/archive rights.
- `Payroll` gets employee and timecard export access, can create jobs, and gets read-only job lookup after creation unless final company confirmation expands that scope.
- `Shop Foreman` gets shop catalog management access, read-only all-job lookup, and editable workflow access for the `Shop` job.
- `Foreman` gets assigned-job dashboard access.
- do not carry forward any separate timecard review role in `v1`
- keep any `none`/unassigned access state as a no-workspace-access state only
- use `inactive` status when a user should no longer have access

## Target role capabilities

| Role | Job List | Job Editing | Job Dashboard | Admin Areas | Email Defaults |
| --- | --- | --- | --- | --- | --- |
| `admin` | View all | Create/edit/delete/archive all | All jobs | All admin areas | Can be global/job recipient |
| `payroll` | View all | Create jobs; no delete/archive | No workflow dashboard unless later requested | Employees, Timecard Export | Not automatic for field emails |
| `shop-foreman` | View all | No job setup editing | `Shop` job workflow access | Shop Catalog management | Receives Daily Log and Shop Order emails for the `Shop` job and any explicitly assigned workflow jobs |
| `project-manager` | View all | Edit assigned jobs only | Assigned jobs only | None | Receives Daily Log and Shop Order emails for assigned jobs |
| `foreman` | View assigned jobs | None | Assigned jobs only | None | Receives Daily Log and Shop Order emails for assigned jobs |

Permission intent:

- UI permissions should be derived from capabilities such as `canManageEmployees`, `canUseTimecardExport`, `canEditAssignedJobs`, and `canUseShopCatalog`.
- Firestore Rules and Cloud Functions must enforce the same capability boundaries.
- Role dashboards should show modules for the user's role, while job dashboards should remain the shared job workspace.
- Payroll employee create/edit, Timecard Export access, job creation/read-only Jobs behavior, and field-workflow denial now have matching E2E coverage; Shop Foreman `Shop` job dashboard shortcut, Shop Orders, Daily Logs, Timecards, read-only all-job lookup, and non-Shop workflow denial now have E2E proof, while lower-layer Firebase rule proof remains deferred with the rules emulator suite.

Current implementation status:

- `src/auth/roles.ts` now names the runtime stored-role catalog, stored-role normalization, legacy effective-role compatibility mapping, assignable-job policy, editable user-role options, labels, and default editable role separately from the target role plan.
- Users service payload sanitization, user admin form-state hydration/defaults, current foreman option filters, timecard export foreman filters, and the E2E runtime now consume the shared current role helpers instead of local/domain role-name branches.
- The Users admin flow now exposes the full target role set in editable controls: `admin`, `payroll`, `shop-foreman`, `project-manager`, and `foreman`.
- `src/auth/capabilities.ts` now bridges live frontend capabilities to the target role matrix for route/admin navigation, workspace access, all-job visibility, timecard export access, field-workflow access, and admin-area links while legacy `EffectiveRoleKey` remains a compatibility seam for older callers during the rollout.
- The live Jobs page now consumes granular target-backed job setup capabilities: Admin keeps full create/edit/delete/archive and global-default controls, Payroll can create jobs and view job setup read-only, Project Managers can edit assigned jobs without delete/archive, and unassigned PM jobs render read-only.
- Firestore Rules and Cloud Functions enforce target-role access for app records and field workflows. Daily-log Storage uploads use an authenticated, metadata-bound attachment rule rather than cross-product Firestore lookups; the parent Daily Log authorization remains enforced before the app reaches the attachment operation.
- Cloud Functions stored-role validation now preserves the same live role catalog as the frontend, including `payroll`, `shop-foreman`, and `project-manager`, and the Daily Log, Shop Order, Timecard Week, and submitted-email operations have initial callable authorization updates for those roles.
- `functions/src/roleAccess.ts` now centralizes Cloud Functions stored-role validation, callable current-user shaping, assigned-job ID cleanup, display-name fallback, current role checks, assigned-job checks, and pending-invite role eligibility so callable functions no longer duplicate role parsing or authorized-user object shape locally.
- `functions/src/targetRoleCapabilities.ts` mirrors the frontend target role capability matrix as a Functions-local policy seam, with parity tests so backend callable/rules work cannot silently drift from frontend target role policy.
- `functions/src/targetJobAssignments.ts` and `functions/src/targetJobAccess.ts` mirror the frontend target assigned-job membership and job-scoped access policies as Functions-local policy seams for callable/rules enforcement.
- `functions/src/targetFieldWorkflowAccess.ts` mirrors the frontend target Daily Log and Shop Order module/view/create/edit/submit policy as a Functions-local policy seam for callable/rules enforcement.
- `functions/src/fieldWorkflowAccess.ts` applies the Functions-local target field-workflow policy to live Daily Log and Shop Order record writes so Admin, assigned Foreman, Shop Foreman Shop-job, Project Manager view-only, and Payroll exclusion boundaries stay explicit at the callable layer.
- `functions/src/targetFieldEmailRecipients.ts` mirrors the frontend target automatic Daily Log and Shop Order field-email recipient policy as a Functions-local policy seam for callable delivery wiring.
- Submitted Daily Log and Shop Order email callables now reuse the same Functions-local field-workflow submit policy before sending, while keeping Daily Log owner checks, Shop Order job mismatch checks, and submitted-email idempotency/status handling in place.
- `sendDailyLogEmail` and `sendShopOrderEmail` now wrap exported handler functions so branch behavior can be tested with mocked dependencies while the Firebase `onCall` exports stay stable. Focused tests cover submitted Daily Log success/denial/disabled-email/no-recipient/send-failure paths and Shop Order PDF attachment success plus job mismatch denial.
- `submitTimecardWeekRecord` now wraps exported `handleSubmitTimecardWeekRecord` so submit/email branch behavior can be tested with mocked dependencies while the Firebase `onCall` export stays stable. Focused tests cover submit success/status recording, skipped notifications, duplicate/in-progress short-circuiting, owner denial before claim, and notification failure recovery while keeping the week submitted.
- `functions/src/targetTimecardAccess.ts` mirrors the frontend target timecard export/lock/delete-draft, job-entry, submit, submitted-view, and Project Manager submitted-reporting policy as a Functions-local policy seam for callable/rules enforcement.
- `functions/src/timecardWeekAccess.ts` applies the Functions-local target timecard policy to live timecard week creation so Admin/Payroll management paths, assigned Foreman job workflows, Shop Foreman Shop-job workflows, and Project Manager report-only boundaries stay explicit.
- `functions/src/emailStatus.ts` and `functions/src/submittedEmailOperations.ts` now centralize submitted-email operation IDs, status metadata payloads, and atomic in-progress claims. Daily Log, Shop Order, and Timecard Week submission paths stamp best-effort operation/attempted/in-progress/sent/error fields for disabled email, missing recipients, send/build failures, and successful sends; same-operation successful retries return without sending duplicate emails, and concurrent same-operation retries are held behind a bounded in-progress claim instead of sending twice. The operation/status helper seams have focused unit coverage, including direct transaction-helper tests for claim, already-sent, in-progress, stale retry, and missing-record behavior.
- `src/auth/capabilities.ts` now centralizes the current live frontend compatibility capability shape in `getCurrentRoleCapabilities()` while deriving its decisions from the target role capability helpers.
- `src/auth/targetRoleCapabilities.ts` defines the target Admin / Payroll / Shop Foreman / Project Manager / Foreman capability matrix as the source of truth for live capability bridging and future role changes, with unit coverage to keep the requested role boundaries stable.
- `src/auth/targetRouteCapabilities.ts` defines target protected-route capability metadata and target workspace-access gating; live admin navigation, router guards, dashboard redirects, and denied-route fallbacks now consume this capability direction.
- `src/router/targetRouteAccess.ts` documents target Vue Router redirect decisions for public entry routes, protected workspace access, protected route capabilities, and job-scoped target dashboard access; the live router has been migrated to the target role-dashboard/access flow with focused route and browser coverage.
- `src/features/navigation/targetAppShellNavigation.ts` documents target AppShell Dashboard/Jobs workspace links, admin/sidebar links, and role-label copy; live AppShell navigation now exposes the Dashboard/Jobs flow and role-specific admin surfaces through the current capability matrix.
- `src/auth/targetJobAssignments.ts` centralizes the target assigned-job membership check reused by target job access, target field-email recipients, and target timecard access so assigned-job policies do not drift.
- `src/auth/targetJobAccess.ts` documents target job-scoped behavior for list visibility, dashboard entry, setup editing, job creation, and delete/archive rights; live Jobs UI/dashboard behavior now follows this model, with direct rules-emulator proof deferred under `R08`.
- `src/auth/targetFieldWorkflowAccess.ts` documents target Daily Log and Shop Order module access separately from create/edit/submit rights so Project Manager assigned-job viewing does not accidentally imply field-entry permissions; frontend routes and Cloud Function field-workflow callables now use matching target-policy seams.
- `src/auth/targetFieldEmailRecipients.ts` documents target automatic Daily Log and Shop Order field-email recipient policy for assigned Foremen, Shop Foremen, and Project Managers as the source of truth for submitted field-email delivery policy.
- `src/auth/targetTimecardAccess.ts` documents target timecard export/lock/delete-draft access, job timecard workflow edit/submit access, and Project Manager submitted-timecard reporting as separate policies now reflected in the live dashboard, route, UI, and function access seams, with direct rules-emulator proof deferred under `R08`.
- `project-manager` is no longer collapsed inside Cloud Functions role parsing, and the live Jobs page now supports assigned-job setup editing without delete/archive rights. The role dashboard now shows assigned-job shortcuts and submitted-timecard shortcut affordances for Project Managers, assigned Project Managers can open job timecards in read-only submitted-report mode without draft/edit/submit access, and Project Managers are browser-proven to be redirected away from employee management and direct unassigned job dashboards. `R07` role-matrix evidence is documented; direct rules-emulator coverage remains deferred under `R08`.
- `Payroll` and `Shop Foreman` are now selectable user roles with live route/rules/functions enforcement. Payroll employee create/edit, Timecard Export access, job creation/read-only Jobs UI, and field-workflow denial are wired and tested. Shop Foreman dashboard shortcuts can open the `Shop` job workflow from `/dashboard`; direct Shop-job deep links wait for the first visible-job snapshot before access decisions; Shop Orders, Daily Logs, Timecards, read-only all-job lookup, non-Shop workflow denial, allowed admin navigation, and real Shop Catalog create/edit behavior now have focused E2E coverage. `R07` is complete at the app/function/policy-test layer; direct rules-emulator coverage remains deferred under `R08`.

## Core routes

- `/login`
- `/set-password`
- `/jobs`

Optional admin/support route:

- `/users`
  - admin-only user management surface

## User lifecycle

### 1. Admin creates a user

Admin enters:

- `Email`
- `First Name`
- `Last Name`
- `Role`

Role options in `v1`:

- `Admin`
- `Payroll`
- `Shop Foreman`
- `Project Manager`
- `Foreman`

What happens:

1. Admin submits the create-user form.
2. A Cloud Function creates the Firebase Auth user.
3. A Firestore user document is created.
4. A password setup email is sent to the new user.

Important:

- users should not be able to create their own accounts through a normal sign-up page
- the only account creation flow in `v1` should be:
  - admin adds the user
  - app sends the setup email
  - user opens the link
  - user creates their password/account from that link

### 2. New user opens setup link

The setup link should include:

- `uid`
- `setupToken`

What happens:

1. `/set-password` reads the link values.
2. The app calls a Cloud Function to verify the token.
3. If valid, the screen shows the user email and password fields.
4. The user creates a password.
5. The app completes password setup.
6. The app signs the user in automatically.
7. The user is routed to the role dashboard or jobs landing page.

### 3. Existing user logs in

What happens:

1. User enters email and password on `/login`.
2. Firebase Auth signs the user in.
3. The app loads `users/{uid}`.
4. The app checks:
   - `role`
   - `isActive`
   - `assignedJobIds`
5. If valid, the user is routed to the role dashboard or jobs landing page.

### 4. Existing user forgets password

What happens:

1. User clicks `Forgot password?`
2. User enters email.
3. Firebase reset email is sent.

This should stay very close to the old app behavior.

## Email system direction

- The rebuild should keep using the same working email system from `v1` for user setup emails.
- Do not replace that email delivery approach during the rebuild unless we explicitly choose to later.
- This applies to:
  - the initial user setup email
  - the setup-link flow
  - related auth emails that already work in `v1`

## Firestore user document

Recommended shape:

```ts
type UserDoc = {
  email: string
  displayName: string
  firstName: string
  lastName: string
  roleKey: 'admin' | 'payroll' | 'shop-foreman' | 'project-manager' | 'foreman' | 'none'
  customRoleId: string | null
  isActive: boolean
  assignedJobIds: string[]
  lastLoginAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

## Access rules

### Login gate

A signed-in user only gets into the app if:

- the user profile exists
- `isActive === true`
- the user has a valid built-in role

If any of those fail:

- sign the user out
- send them back to `/login`

### Job access gate

`Foreman` users can only see and access jobs in `assignedJobIds`.

`Project Manager` users can see all active jobs, edit assigned jobs, and open job dashboard workflows only for jobs in `assignedJobIds`.

`Shop Foreman` users can see all active jobs, manage the shop catalog, and open job dashboard workflows for the `Shop` job unless additional workflow jobs are explicitly assigned/confirmed later.

`Payroll` users can see all active jobs as read-only lookup context, create jobs, and use employee/timecard export areas. They should not delete/archive jobs or open field workflow dashboards unless that is explicitly added later.

`Admin` users can access all jobs, including archived jobs, and can create/edit/delete/archive jobs.

## User management actions

### Admin can create

- create new users
- choose one of the built-in target roles

### Admin can edit

- first name
- last name
- role
- active status
- assigned jobs

### Admin can deactivate

Deactivation should:

- immediately block access
- sign the user out on their next realtime profile update
- keep the user record for history

### Admin can delete

Deletion should:

- remove the user from Firebase Auth
- remove the Firestore user document
- remove them from recipient lists
- clean up job assignment references

This follows the old app's removal philosophy and keeps the system clean.

## Recommended admin user flow

### Create user

Inputs:

- email
- first name
- last name
- role

Outputs:

- auth account exists
- firestore user exists
- setup email sent

### Edit user

Inputs:

- first name
- last name
- role
- active status

Outputs:

- profile updates saved
- access changes take effect in realtime
- profile edits should auto-save on simple commit events like role changes, job assignment clicks, or when the admin leaves a text field

### Assign field users to jobs

Inputs:

- selected Foreman, Shop Foreman, or Project Manager
- selected jobs

Outputs:

- `users/{uid}.assignedJobIds` updated
- `jobs/{jobId}.assignedForemanIds` updated

This should stay synchronized in both directions.

Assigned-job records should support automatic notification behavior:

- assigned Foremen receive Daily Log and Shop Order emails for assigned jobs
- assigned Shop Foremen receive Daily Log and Shop Order emails for assigned jobs
- assigned Project Managers receive Daily Log and Shop Order emails for assigned jobs
- manual/global recipient lists can still add additional recipients

## Recommended Cloud Functions

These should exist in `v1`:

- `createUserByAdmin`
  - create auth user
  - create firestore user record
  - generate/send setup link
- `verifySetupToken`
  - validate setup link
- `setUserPassword`
  - set initial password from setup flow
- `deleteUser`
  - delete auth user
  - delete/firestore cleanup

## Recommended UI pieces

### `LoginPage`

- email
- password
- sign in
- forgot password

### `SetPasswordPage`

- readonly email
- password
- confirm password
- token validation state

### `UsersPage`

Admin-only page or edit-mode surface that supports:

- create user
- edit user
- assign jobs
- deactivate/reactivate
- delete user

## Recommended defaults

- new users should default to `isActive = true`
- new foremen should start with `assignedJobIds = []`
- `customRoleId = null` in `v1`

## Security direction

- do not trust role changes from the client alone
- enforce admin-only user creation and deletion in Cloud Functions
- enforce profile access and job assignment rules in Firestore rules
- use realtime profile subscription so access changes take effect quickly

## Relationship to the old app

These `v1` behaviors should stay close to the old app:

- simple email/password login
- forgot password modal
- setup-link password creation
- admin-created users
- no public sign-up flow
- same working email-based setup process
- user deletion with cleanup

These parts should change:

- built-in roles become `Admin`, `Payroll`, `Shop Foreman`, `Project Manager`, and `Foreman`
- old timecard review behavior is handled by `Admin` and `Payroll` timecard export permissions
- Project Manager becomes an assigned-job billing/reporting/edit role rather than a foreman-equivalent placeholder
- future custom roles can still be added later without changing the built-in auth flow
