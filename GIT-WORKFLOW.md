# Source checkout and releases

Open this repository's root folder in VS Code, or use **File → Add local repository** in GitHub Desktop. The default branch is `main`. The separate local review copy and its emulator recovery exports are not part of this repository.

Install dependencies with `npm ci` and `npm --prefix functions ci`. Copy `.env.example` to `.env.local` and provide the public Firebase web configuration for the intended environment. Keep provider credentials and private documents out of Git. Functions output is generated with `npm --prefix functions run build`; the full build also produces the public renderer.

Before pushing, run the appropriate type, lint, unit and browser checks. The Shop Orders release gate remains `npm run test:shop-order-layout` (47 synthetic browser cases); `npm run verify:shop-order-layout` checks the delivered live CSS. Main pushes enter the guarded deployment workflow described below.

## Recorded live application

The reviewed employee frontend was deployed on October 23, 2026 to `https://phase2-website.web.app`, Hosting version `4722644cb4d8ecad`, release `1792718363175000`. Its tested source was based on commit `18df20e3c041ff6d77cb85a1f9338b166f1ad9d3`. Public website assets, backend services and production business records were preserved. A Git push does not reproduce private content ingestion or change deployed form definitions.

Forms are stored in the database. Recipient controls concern emailed answer summaries. Public additional-recipient verification is an optional notification feature: its source module is not exported/deployed, and no approval has been given to deploy or enable it. Ordinary signed-in Jobs submissions do not require that endpoint. Production authenticated acceptance and real email delivery remain separate verification limits.

## Main and test workflow

`main` is the release branch; `test` is the shared review branch. Make changes on `test`, push and review validation results, then review a pull request from `test` into `main`. There is no automatic promotion. Keep both branches and update `test` from `main` after merging. Do not force-push or discard unique changes. Direct pushes to `main` also trigger release checks, so use the review path for normal changes. Branch protection has not been changed by this setup.

`.github/workflows/phase2.yml` validates pushes to both branches and pull requests targeting either branch. It installs locked dependencies, runs Forms/Jobs/Library and Hosting release-safety tests, runs the 47-case Shop Orders browser gate, type-checks and builds production source. The employee-only Hosting artifact excludes private local configuration and demo data.

Only a successful **push to main** can enter the Hosting job. It uses the artifact from that exact run; `test` and pull requests never receive cloud authentication. A serialized release checks that its commit is still current main, preserves existing public-site assets and Hosting configuration, records the previous version for rollback, verifies the staged inventory and checks the delivered login shell and Shop Orders CSS. Functions, security rules, IAM, billing, providers and database content are not deployed. Website renderer changes requiring Functions deployment need a separate reviewed release.

**Automatic deployment is blocked until its CI identity is separately approved and configured.** The first deployment step fails before cloud authentication unless all three repository variables exist:

- `PHASE2_DEPLOY_AUTH_APPROVED=true` (set only after specific access approval)
- `PHASE2_WIF_PROVIDER` (approved workload identity provider resource)
- `PHASE2_DEPLOY_SERVICE_ACCOUNT` (approved least-privilege deployment account)

No credential, IAM binding, trust provider, repository secret or variable is created by this change. The recommended next step is keyless Workload Identity Federation restricted to this repository's `refs/heads/main`, with only the permissions needed for existing Hosting version/file/release operations. Creating or configuring that persistent access requires specific approval. Do not copy a workstation Firebase login or create a long-lived key as a shortcut. Failure at the identity preflight means **not deployed**.

Download the `hosting-receipt-<commit>` artifact after a release. It records the source commit, release/version, file hashes and previous version. After an uncertain release request, inspect the live channel and receipt before retrying. Rollback creates a live release referencing the retained previous finalized Hosting version; it does not revert business records. No automatic rollback or version deletion is performed.

`node scripts/build-hosting-ci.mjs` builds the CI artifact using the production site's public browser SDK configuration, without workstation environment files. It includes full source/type/public-startup checks. Do not substitute a generic full Firebase deployment for this employee-only workflow. Reconciled deployed source remains in commit `3e8b34f28ce668b60d5ab09ad3f614b9a1c94e50`; prior branch heads are reachable from main and also preserved in a private local Git bundle.
