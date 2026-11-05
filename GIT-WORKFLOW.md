# Source checkout and releases

The canonical working checkout is `C:\Users\atlas\OneDrive\Documents\GitHub\Phase2-Web-App`. Use this same folder in VS Code, GitHub Desktop and task tools. Keep exactly the two project branches, `main` and `test`. Do not routinely create more branches, clones, worktrees or dated working folders. Existing older working folders and their unique files remain preserved; they are not the working source for new changes.

GitHub (`https://github.com/killerseig/Phase2-Web-App`) is the primary source of truth, change history and recovery/portability safety net. Commit and push meaningful source/configuration changes to `test` after the appropriate checks; uncommitted local files are not a backup. Essential source, maintained scripts, lockfiles and nonsecret configuration belong in Git, even when operational evidence and generated outputs do not. Every deployment must be traceable to its exact `main` commit.

Open this repository's root folder in VS Code, or use **File → Add local repository** in GitHub Desktop. The default branch is `main`. The separate local review copy and its emulator recovery exports are not part of this repository.

Install dependencies with `npm ci` and `npm --prefix functions ci`. Copy `.env.example` to `.env.local` and provide the public Firebase web configuration for the intended environment. Keep provider credentials and private documents out of Git. Functions output is generated with `npm --prefix functions run build`; the full build also produces the public renderer.

Functions TypeScript now compiles from `functions/src/` to ignored `functions/lib/`, with `functions/package.json` selecting `lib/index.js`. The existing flat handler exports, runtime assets and deployment identities remain the same. Run `npm run build` then `npm run verify:functions-build` to check fresh packaged output offline; scripts/tests must import compiled modules from `functions/lib/`, not legacy generated files beside the package manifest. Older local generated root files are not source and are no longer used by the maintained commands.

Before pushing, run the appropriate type, lint, unit and browser checks. The Shop Orders release gate remains `npm run test:shop-order-layout` (47 synthetic browser cases); `npm run verify:shop-order-layout` checks the delivered live CSS. Git pushes do not build or deploy; releases are performed manually as described below.

## Recorded live application

The current verified employee release is source commit `3873ae543ae50ca743d719e6a7bf40b800f3cebb`, published November 5, 2026 at `https://phase2-website.web.app`, Hosting version `201757cda746bfb2`, release `1793902279849000`. The public website assets and Hosting configuration were preserved. The previous Hosting version `fe92c046f02d775f` is retained as the rollback reference. Later documentation/workflow-only commits do not require another app deployment.

Historical release: The reviewed employee frontend was deployed on October 23, 2026 to `https://phase2-website.web.app`, Hosting version `4722644cb4d8ecad`, release `1792718363175000`. Its tested source was based on commit `18df20e3c041ff6d77cb85a1f9338b166f1ad9d3`. Public website assets, backend services and production business records were preserved. A Git push does not reproduce private content ingestion or change deployed form definitions.

Forms are stored in the database. Recipient controls concern emailed answer summaries. Public additional-recipient verification is an optional notification feature: its source module is not exported/deployed, and no approval has been given to deploy or enable it. Ordinary signed-in Jobs submissions do not require that endpoint. Production authenticated acceptance and real email delivery remain separate verification limits.

## Main and test workflow

`main` is the release branch; `test` is the shared review branch. Make normal changes and run validation on `test`, then push it for review. Identify the exact changes, commit and check results and obtain explicit user approval before deliberately promoting them into `main`, normally through a reviewed pull request. Approval to configure deployment access is not approval to promote later feature or documentation changes. There is no automatic promotion. Keep both branches and update `test` from `main` after merging. Do not force-push or discard unique changes. There are no GitHub Actions checks or deployment triggers; run the appropriate validation locally before promotion. Branch protection has not been changed by this setup.

GitHub Actions was removed at the owner's request on November 5, 2026 because GitHub billing-lock failures prevented its jobs from starting. No workflow files or push, pull-request, scheduled, or manual Actions triggers remain. Do not recreate them without an owner request.

Use the normal manual entrypoints: `npm run build` validates/builds the configured checkout, and `npm run deploy` invokes this project's Firebase CLI against `.firebaserc`. Select only the approved targets with `-- --only ... --project phase2-website`; never deploy unrelated functions or a public website change as part of an employee-only fix. The existing predeploy build and Shop Orders Hosting gate remain in place. No manual version argument is required.

For an employee-only release, use the existing employee artifact/release helpers to preserve live public assets, rewrites and headers. Record the exact main commit, successful build, artifact hashes, selected existing backend targets, Hosting release and previous version. Deploy a required compatible backend before its frontend, preserve authentication/authorization, and never exercise production writes or email sends as release tests.

Removing workflow source does not change billing, repository permissions, Google IAM, credentials, or the previously configured dormant keyless identity. No new access is needed for the existing authorized operator's manual Firebase CLI workflow.

The historical keyless identity and repository variables are not used by any current repository workflow. They were not revoked or modified as part of disabling Actions.

The existing identity setup source remains in `scripts/configure-hosting-identity.cjs` for history and authorized maintenance. Identity/API/IAM changes still require their own specific approval; they are not a normal build/deploy step.

Keep the manual release receipt in the existing ignored operational evidence location and summarize its source commit, release/version, hashes and previous version in the handoff. After an uncertain release request, inspect the live channel and receipt before retrying. A Hosting rollback references the retained finalized version and does not revert business records; no automatic rollback or deletion is performed.

For a source rollback, use preserved Git history to identify the known-good commit and make a reviewed revert on `test`, validate it, obtain approval and promote normally to `main`. Keep the original commits; do not reset/force-push away history. A Hosting rollback is a distinct operational action and must record both the restored Hosting version and the corresponding source commit. Git is not the backup for private documents or production database records.

The optional `scripts/build-hosting-ci.mjs` build helper and `scripts/hosting-release.mjs` release library remain maintained source; neither runs automatically. They are not a replacement for an authorized environment's normal `npm run build` / `npm run deploy` entrypoints, and a synthetic verification artifact must never be deployed.

## Files and handoff

Use the existing organization: application changes in the relevant `src/` feature/component/view directories, browser tests in `e2e/`, maintained project commands in `scripts/`, and manual release tooling in `scripts/`. Update existing documentation rather than adding overlapping status documents. Do not add temporary copies, backup source trees or private prototype contents to the live app.

Generated builds, test results, emulator exports, credentials and temporary evidence stay out of Git under the existing ignored directories. Reuse the existing private evidence/recovery locations when needed; do not create a new working copy or evidence directory for each small change. Preserve review records and recovery exports, and do not delete older folders as cleanup without reviewing their unique contents.

End each work unit with a concise handoff: canonical checkout, current branch and full commit; clean/dirty and pushed/unpushed state; checks actually run and their results or blockers; review link and local check results; and deployed/not-deployed status with exact Hosting version when verified. Distinguish local fixtures, source inspection and production acceptance. A pushed commit, skipped job or billing-blocked CI run is not a successful deployment.

## Another authorized computer

Clone `https://github.com/killerseig/Phase2-Web-App.git` once into that computer's chosen canonical project folder, fetch and switch to `test`, and use Node 24 with `npm ci` and `npm --prefix functions ci`. The repository contains the application, tests, manual release and historical identity setup source; no private working-copy scripts are required to build the release artifact. Use `npm run build` with the intended local environment configuration for the normal production build/type checks. For ordinary development, supply the intended public browser settings using `.env.example` and keep the resulting local environment file out of Git. Install the test browser with `npx playwright install chromium` (Linux installations also need its system dependencies). Authenticate the operator/deployment identity separately when cloud operations are needed; cloning source does not transfer credentials or grant cloud access. Do not copy `node_modules`, generated builds, private documents or emulator exports as a substitute for the tracked source and lockfiles.
