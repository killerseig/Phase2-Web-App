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
- Payroll job creation and Shop Foreman `Shop` job workflow access need matching e2e tests and Firebase rule coverage before the role refactor is considered complete.

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
