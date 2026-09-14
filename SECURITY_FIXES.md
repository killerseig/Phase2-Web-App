# Security fixes - September 13, 2026

Implemented and tested locally. No live Firebase deployment, user-data migration, or invitation emails have been performed. The Firebase CLI currently has no authenticated account. The main Timecard page body was not changed.

## Changes

- Password setup credentials are stored as SHA-256 hashes in a private `userSetupCredentials` collection. Client access is denied. Expiry is validated, inactive profiles are rejected, and a Firestore transaction consumes the token before changing the Auth password. Concurrent redemption and replay are rejected. New setup passwords require 12-128 characters.
- Existing raw setup tokens on public profile documents are no longer accepted. Sending a fresh invitation removes the old profile token fields. There is no automatic mass migration or email send.
- Password-reset email requests have transactional per-email and per-IP hourly limits (3 and 20 respectively), with generic responses when throttled.
- Storage rules enforce active roles, the actual parent log, job access, draft status for ordinary writes, uploader metadata, and image type/size limits. Administrators retain authorized maintenance access.
- Firestore field restrictions use `affectedKeys()` so additions and deletions are checked. Direct client writes to daily logs, shop orders, timecard weeks, and timecard cards are denied; existing authenticated callables own these changes. Submission and author identity come from authentication.
- Public galleries require the existing random share ID. Older links based only on job/log IDs show a request-for-new-link message.
- Payroll PDF exports use tab-scoped session storage, five-minute expiry on access, and explicit cleanup after transfer, print loading, sign-out, or account change. Old localStorage exports are removed. A real popup browser test verifies rendering and removal from both windows' storage.
- Firebase Hosting configuration includes CSP, framing protection, MIME-sniffing protection, and a no-referrer policy. Production builds replace the E2E fixture runtime with disabled stubs.
- Dependency lockfiles were updated. The root server-only Firebase Functions SDK was moved to development dependencies; the deployed backend retains its own dependency tree.

## Validation

- Application type check and production build; Cloud Functions TypeScript build: passed.
- Production login smoke check with the configured Hosting headers: rendered without CSP violations or page errors. Injected E2E fixture globals did not replace production authentication; fixture hook strings were absent from built JavaScript. Authenticated production workflows and effective live headers remain unverified.
- Unit tests: 300 files, 1,495 tests passed.
- Chromium workflow suite: 129 of 131 initially passed. Both remaining tests were updated for the intended sidebar behavior and real PDF popup storage and passed on targeted rerun.
- Firebase Auth/Firestore/Storage emulator checks: 84 denied operations plus successful authorized operations and concurrent single-use password-token redemption passed. These use synthetic data in `demo-phase2-security`, not the live project.
- Final `npm audit`: application production dependencies 0, Cloud Functions 0, complete application/development tree 7 moderate (0 high or critical). The remaining advisories are in Firebase development tooling dependencies; incompatible forced upgrades/downgrades were not applied.

Local logs and final audits are in the ignored `.security-work/` directory. Re-run security rules tests with `npm run test:security-rules` (Node and Java 21 must be on PATH).

## Deployment and operational follow-up

Authenticate using `npx firebase login`, then deploy to the repository's configured project in this order:

```powershell
npx firebase deploy --project phase2-website --only functions
npx firebase deploy --project phase2-website --only "firestore:rules,storage"
npx firebase deploy --project phase2-website --only hosting
```

Predeploy hooks compile the backend and build the frontend. Confirm each command succeeds before proceeding. Storage rules now read Firestore; Firebase may require enabling the cross-service permission for the Storage service agent. This live IAM permission has not been inspected or changed.

After deployment, verify live sign-in, assigned-job attachment access, submission, and exports with appropriate test accounts. Verify the effective hosted security headers. Reissue needed pending invitations through the administrator UI: all old raw setup links become invalid when the updated functions are deployed. If an Auth password update fails after consuming a new token, issue a fresh invitation. Replace any needed legacy photo-gallery links with current share links.

App Check enrollment/enforcement, project password policy, IAM, Auth providers, existing bearer download URLs, and live audit logs require a separate cloud configuration review. Storage rules do not revoke previously issued bearer download URLs; do not treat these source fixes as proof that previously shared photos have become private. No claim is made that the live deployment or all possible security issues have been verified.
