# Source checkout and releases

The canonical working checkout is `C:\Users\atlas\Documents\Codex\2026-10-19\task\phase2-main`. Use this same folder in VS Code, GitHub Desktop and task tools. Keep exactly the two project branches, `main` and `test`. Do not routinely create more branches, clones, worktrees or dated working folders. Existing older working folders and their unique files remain preserved; they are not the working source for new changes.

GitHub (`https://github.com/killerseig/Phase2-Web-App`) is the primary source of truth, change history and recovery/portability safety net. Commit and push meaningful source/configuration changes to `test` after the appropriate checks; uncommitted local files are not a backup. Essential source, maintained scripts, lockfiles and nonsecret configuration belong in Git, even when operational evidence and generated outputs do not. Every deployment must be traceable to its exact `main` commit.

Open this repository's root folder in VS Code, or use **File → Add local repository** in GitHub Desktop. The default branch is `main`. The separate local review copy and its emulator recovery exports are not part of this repository.

Install dependencies with `npm ci` and `npm --prefix functions ci`. Copy `.env.example` to `.env.local` and provide the public Firebase web configuration for the intended environment. Keep provider credentials and private documents out of Git. Functions output is generated with `npm --prefix functions run build`; the full build also produces the public renderer.

Before pushing, run the appropriate type, lint, unit and browser checks. The Shop Orders release gate remains `npm run test:shop-order-layout` (47 synthetic browser cases); `npm run verify:shop-order-layout` checks the delivered live CSS. Main pushes enter the guarded deployment workflow described below.

## Recorded live application

The reviewed employee frontend was deployed on October 23, 2026 to `https://phase2-website.web.app`, Hosting version `4722644cb4d8ecad`, release `1792718363175000`. Its tested source was based on commit `18df20e3c041ff6d77cb85a1f9338b166f1ad9d3`. Public website assets, backend services and production business records were preserved. A Git push does not reproduce private content ingestion or change deployed form definitions.

Forms are stored in the database. Recipient controls concern emailed answer summaries. Public additional-recipient verification is an optional notification feature: its source module is not exported/deployed, and no approval has been given to deploy or enable it. Ordinary signed-in Jobs submissions do not require that endpoint. Production authenticated acceptance and real email delivery remain separate verification limits.

## Main and test workflow

`main` is the release branch; `test` is the shared review branch. Make normal changes and run validation on `test`, then push it for review. Identify the exact changes, commit and check results and obtain explicit user approval before deliberately promoting them into `main`, normally through a reviewed pull request. Approval to configure deployment access is not approval to promote later feature or documentation changes. There is no automatic promotion. Keep both branches and update `test` from `main` after merging. Do not force-push or discard unique changes. Direct pushes to `main` also trigger release checks, so use the review path for normal changes. Branch protection has not been changed by this setup.

`.github/workflows/phase2.yml` validates pushes to both branches and pull requests targeting either branch. It installs locked dependencies, runs Forms/Jobs/Library and Hosting release-safety tests, runs the 47-case Shop Orders browser gate, type-checks and builds production source. The employee-only Hosting artifact excludes private local configuration and demo data.

Only a successful **push to main** can enter the Hosting job. It uses the artifact from that exact run; `test` and pull requests never receive cloud authentication. A serialized release checks that its commit is still current main, preserves existing public-site assets and Hosting configuration except the reviewed removal of a shadowing `/sds-file` employee-shell rewrite, records the previous version for rollback, verifies the staged inventory and checks the delivered login shell and Shop Orders CSS. The private document handler remains in place with its existing access checks; unrelated rewrites/headers are preserved. Functions, security rules, IAM, billing, providers and database content are not deployed. Website renderer changes requiring Functions deployment need a separate reviewed release.

**Automatic deployment is blocked until its CI identity is separately approved and configured.** The first deployment step fails before cloud authentication unless all three repository variables exist:

- `PHASE2_DEPLOY_AUTH_APPROVED=true` (set only after specific access approval)
- `PHASE2_WIF_PROVIDER` (approved workload identity provider resource)
- `PHASE2_DEPLOY_SERVICE_ACCOUNT` (approved least-privilege deployment account)

The separately approved keyless identity uses `phase2-hosting-deployer@phase2-website.iam.gserviceaccount.com`, pool `phase2-github` and provider `github` in project `phase2-website` (`792793988588`). Its provider restricts the numeric repository/owner IDs, main ref, push event and exact `.github/workflows/phase2.yml` workflow. The custom role grants only `firebasehosting.sites.get` and `firebasehosting.sites.update`; the pool principal can impersonate only that dedicated account. Repository-variable configuration and successful CI/deployment verification are separate activation steps; do not infer readiness from identity creation alone. Any expansion of persistent access needs specific approval. Do not copy a workstation login or create a long-lived key. Failure at the identity preflight means **not deployed**.

The maintained setup/verification source is `scripts/configure-hosting-identity.cjs`. An authorized operator with an existing Firebase CLI login can run `node scripts/configure-hosting-identity.cjs --verify` for read-only cloud verification. The `--apply-approved-scope` mode changes the narrowly specified API/identity/IAM configuration and requires explicit action-time approval; it is not part of normal development or CI deployment. It never configures GitHub variables or creates permanent keys. Its local journal is generated evidence under ignored `.forms-local-data/`, not an essential source dependency.

Download the `hosting-receipt-<commit>` artifact after a release. It records the source commit, release/version, file hashes and previous version. After an uncertain release request, inspect the live channel and receipt before retrying. Rollback creates a live release referencing the retained previous finalized Hosting version; it does not revert business records. No automatic rollback or version deletion is performed.

For a source rollback, use preserved Git history to identify the known-good commit and make a reviewed revert on `test`, validate it, obtain approval and promote normally to `main`. Keep the original commits; do not reset/force-push away history. A Hosting rollback is a distinct operational action and must record both the restored Hosting version and the corresponding source commit. Git is not the backup for private documents or production database records.

`node scripts/build-hosting-ci.mjs` builds the CI artifact using the production site's public browser SDK configuration, without workstation environment files. It includes full source/type/public-startup checks. Do not substitute a generic full Firebase deployment for this employee-only workflow. Reconciled deployed source remains in commit `3e8b34f28ce668b60d5ab09ad3f614b9a1c94e50`; prior branch heads are reachable from main and also preserved in a private local Git bundle.

## Files and handoff

Use the existing organization: application changes in the relevant `src/` feature/component/view directories, browser tests in `e2e/`, maintained project commands in `scripts/`, and repository automation in `.github/workflows/`. Update existing documentation rather than adding overlapping status documents. Do not add temporary copies, backup source trees or private prototype contents to the live app.

Generated builds, test results, emulator exports, credentials and temporary evidence stay out of Git under the existing ignored directories. Reuse the existing private evidence/recovery locations when needed; do not create a new working copy or evidence directory for each small change. Preserve review records and recovery exports, and do not delete older folders as cleanup without reviewing their unique contents.

End each work unit with a concise handoff: canonical checkout, current branch and full commit; clean/dirty and pushed/unpushed state; checks actually run and their results or blockers; review/CI link; and deployed/not-deployed status with exact Hosting version when verified. Distinguish local fixtures, source inspection and production acceptance. A pushed commit, skipped job or billing-blocked CI run is not a successful deployment.

## Another authorized computer

Clone `https://github.com/killerseig/Phase2-Web-App.git` once into that computer's chosen canonical project folder, fetch and switch to `test`, and use Node 24 with `npm ci` and `npm --prefix functions ci`. The repository contains the application, tests, release workflow and identity setup source; no private working-copy scripts are required to build the release artifact. `node scripts/build-hosting-ci.mjs` obtains only public browser SDK configuration and performs the production build/type checks. For ordinary development, supply the intended public browser settings using `.env.example` and keep the resulting local environment file out of Git. Install the test browser with `npx playwright install chromium` (Linux CI also installs its system dependencies). Authenticate the operator/deployment identity separately when cloud operations are needed; cloning source does not transfer credentials or grant cloud access. Do not copy `node_modules`, generated builds, private documents or emulator exports as a substitute for the tracked source and lockfiles.
