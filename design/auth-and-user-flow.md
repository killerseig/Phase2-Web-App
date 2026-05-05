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

## Built-in roles in v1

V1 should use only:

- `Admin`
- `Foreman`

Notes:

- do not carry forward a built-in `Controller` role in `v1`
- do not carry forward a built-in `None` role in `v1`
- use `inactive` status when a user should no longer have access

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
7. The user is routed to `/jobs`.

### 3. Existing user logs in

What happens:

1. User enters email and password on `/login`.
2. Firebase Auth signs the user in.
3. The app loads `users/{uid}`.
4. The app checks:
   - `role`
   - `isActive`
   - `assignedJobIds`
5. If valid, the user is routed to `/jobs`.

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
  roleKey: 'admin' | 'foreman'
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

`Foreman` users can only access jobs in `assignedJobIds`.

`Admin` users can access all jobs, including archived jobs.

## User management actions

### Admin can create

- create new users
- choose `Admin` or `Foreman`

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

### Assign foreman jobs

Inputs:

- selected foreman
- selected jobs

Outputs:

- `users/{uid}.assignedJobIds` updated
- `jobs/{jobId}.assignedForemanIds` updated

This should stay synchronized in both directions.

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

- built-in roles become only `Admin` and `Foreman`
- old controller behavior is handled by `Admin`
- future custom roles can be added later without changing the built-in auth flow
