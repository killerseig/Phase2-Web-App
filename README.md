# Phase2 Web Application

Phase 2 uses Vue 3 and Vite for the browser app and a separate TypeScript package for Firebase Functions. See [GIT-WORKFLOW.md](GIT-WORKFLOW.md) for the canonical checkout, `test`/`main` workflow and reviewed release process.

## Project structure and build contracts

- Root HTML files are Vite entry points. `src/` contains the browser app: views, components, features, services, stores and the router. These folder names are project conventions, not a Firebase/Vite requirement.
- `src/firebase.ts` owns lazy initialization of the modular browser SDK and the existing development-only emulator connections. `VITE_*` values are public browser configuration, never server secrets.
- `src/services/workspaceServer.ts` shares the configured/synthetic workspace availability check without coupling dashboards to the Forms service. This client-side check is not authorization; Firebase handlers still enforce access.
- Library staging lifetime is shared by `src/features/sds/useLibraryMutation.ts`. The explorer owns validation, metadata commands and navigation; the helper owns upload progress, error reporting and final staging cleanup for each single-file mutation. Keep file authorization, byte-range loading and viewer-session lifetime in the existing document modules.
- Form Builder separates authoring history/dirty baselines (`src/features/forms/useFormAuthoring.ts`) from device/server draft persistence and confirmed save-then-publish sequencing (`src/features/forms/useFormPersistence.ts`). The view retains navigation, selection, account-reset handling and confirmation dialogs; preserve the distinct device-version and server-revision contracts.
- Website Builder delegates widget selection, inspector context and geometry changes to `useWebsiteWidgetEditing`, and explicit load/save/publication coordination to `useWebsiteCommands`. These compose the existing history, autosave and draft-sync modules; they do not introduce a second editor state or change Website publication semantics.
- Workspace command contracts infer responses from the action and constrain authoring payloads: Forms template commands, Website commands, Library editing commands and shared dashboards. Client types do not replace backend validation or authorization; public respondent/email transports retain their separate existing interfaces.
- Root Vite configurations select the employee, public and server-renderer builds. Reusable build plugins live in `scripts/`; they retain production fixture exclusion and iframe isolation. Imported assets go through Vite; files in `public/` are copied directly when that build enables `publicDir`.
- `functions/src/` contains backend TypeScript. Its own package and compiler build generated JavaScript/declarations into ignored `functions/lib/`; `functions/package.json` points to `lib/index.js`. Keep the named exports in `functions/src/index.ts` stable, because they identify deployed handlers. Shared pure model modules are imported as source by the browser; server runtime modules stay on the backend.
- `functions/assets/` contains packaged fonts. `functions/generated/` contains the generated public HTML template and SSR renderer. Both locations are runtime inputs to Functions; they are not frontend document storage.
- The normal frontend build writes `dist/`, matching `firebase.json` Hosting's `public` directory. The reviewed employee-only release build writes `hosting-dist/` and preserves the live public website through the existing release script. Do not substitute one artifact for the other or reorder the private-file/API rewrites behind the application fallback.
- Tests live in `e2e/`, source-adjacent specs and maintained verification scripts. Temporary evidence, emulator state and generated builds remain ignored by Git. Essential source, configuration, tests and lockfiles are tracked.

`npm run build` type-checks the frontend, builds the browser entries/public template, compiles Functions and builds its SSR renderer. Vite transpilation does not replace `vue-tsc` or the Functions compiler. After that build, `npm run verify:functions-build` checks the compiled entry/handler names, Firebase package inclusion, packaged fonts and public rendering using only synthetic local data; it makes no cloud calls.

The Node/tooling TypeScript project includes all named Vite, Vitest and Playwright configurations, so specialized build/review configurations receive the same type-checking as their base configuration.

`npm run dev:forms` and `npm run test:forms:browser` retain local demo records in `.forms-local-data/emulator-state/current`, with exactly one `previous` recovery generation. Firebase CLI staging runs inside that managed folder and is cleared after a verified export; a failed first export is preserved and blocks another run rather than accumulating more copies. Concurrent runners are blocked. A designated legacy `latest.json` seed can be copied without deleting it; unassigned root exports and historical backups are never pruned automatically. Normal `npm run dev`, builds and the GitHub push workflow do not invoke this exporter. Run `npm run test:emulator-state` for synthetic repeated-run, interrupted-export and retention checks. This is local emulator state, not production database backup management.

`npm run test:emulator-state:integration` uses cached local emulators, random loopback ports and disposable synthetic accounts/documents/files to check real export/import persistence across two cycles. It does not use the normal review server or production data. Temporary fixtures are removed; failure logs overwrite one fixed ignored file.

For credential-free production-mode compilation checks, run `npm run type-check` and `npm run verify:frontend-build`. The latter builds employee/public/SSR entries with explicit synthetic browser configuration, disables environment-file loading and checks test-runtime/development-bridge exclusion. It never reads local Hosting SDK settings. Its three fixed output directories under `.forms-local-data/frontend-verification/` are overwritten on repeat runs and are **not deployable release artifacts**. The existing reviewed release workflow is unchanged. Website browser fixtures share callable transport in `e2e/helpers/websiteCallableFixture.ts`, keeping their distinct conflict/history/publication models; `playwright.builder-regression.config.ts` covers those related journeys together.

This follows the supported [Vite entry/assets model](https://vite.dev/guide/), [Vue TypeScript tooling](https://vuejs.org/guide/typescript/overview), [Firebase Functions TypeScript layout](https://firebase.google.com/docs/functions/typescript) and [Hosting configuration contracts](https://firebase.google.com/docs/hosting/full-config). Multiple entry points and separate server rendering are supported project requirements, not reasons to replace the framework.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

Use Node.js 22 (with npm) to match the Firebase Functions runtime. Install both
the frontend and backend dependencies from their lockfiles:

```sh
npm ci
npm ci --prefix functions
```

Copy `.env.example` to `.env.local` and fill in the `VITE_FIREBASE_*` values
from the Firebase project's web app configuration. Sign-in and data access
require these values. `.env.local` is ignored by Git.

On Windows PowerShell, use `npm.cmd` and `npx.cmd` if execution policy blocks
the corresponding PowerShell scripts. Restart your terminal after installing
Node.js so it picks up the updated PATH.

The Firebase CLI is included in the frontend dependencies; use `npx firebase`.
Local Firebase emulators require Java 21 or newer. Backend email functionality
also requires the Microsoft Graph secrets declared in
`functions/src/functionConfig.ts`; dependency installation does not configure
those credentials.

### Compile and Hot-Reload for Development

```sh
npm run dev
```

Run this in the canonical checkout and use the local URL printed by Vite. Vite may choose another port if the default is occupied. Browser template/CSS changes use Vite/Vue HMR; script changes can remount components. Backend Functions changes require rebuilding/running the backend, rather than browser HMR.

`npm run test:hmr` starts an isolated `npm run dev` server with synthetic data, checks repeated template/CSS edits and WebSocket delivery, verifies an unsaved dashboard edit survives individual updates, then restores the files. Run it when nobody is editing `SharedDashboardView.vue` or `shared-dashboards.css`; it does not reuse the operator's preview server. It does not guarantee component state retention for batched multi-file updates.

Development watching waits for a short stable write so rapid editor/formatter saves do not lose the final CSS/template update. The sandboxed website code preview receives relevant HMR refreshes through its parent; its `connect-src 'none'` policy stays intact, and that bridge is excluded from production. The opt-in HMR check also exercises/restores the Form Builder, form preview and WebsiteCanvas source files, including iframe listener cleanup and draft/answer retention. Do not run it concurrently with edits to those files.

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

This checks the frontend types, compiles Firebase Functions, and builds the production
website. Backend compilation errors now fail this command before deployment. Use
`npm run build-only` when you only need the frontend bundle.

### Deploy to Firebase

```sh
npm run deploy
```

This uses the project's Firebase CLI and deploys to the default project in
`.firebaserc` (`phase2-website`). Firebase's predeploy hooks build both the app
and Functions. The deployment script allows 120 seconds for Functions discovery
to avoid the `Cannot determine backend specification. Timeout after 10000`
error when dependencies load slowly. You can override this with the
`FUNCTIONS_DISCOVERY_TIMEOUT` environment variable (seconds).

The wrapper prints the active discovery timeout before starting Firebase. Both
`npm run deploy` and `npm --prefix functions run deploy` use it. Running
`firebase deploy` directly bypasses the wrapper. If an error still says
`Timeout after 10000`, explicitly set the timeout in the same PowerShell window:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '120'
npm.cmd run deploy
```

On Windows PowerShell, use `npm.cmd run deploy`. If Node.js is installed but
the terminal cannot find npm, update the current terminal's PATH first:

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm.cmd run deploy
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Regression standard

Every feature or fix must add or update meaningful Playwright coverage for the changed owner workflow. Include negative, interrupted/recovery and repeated flows when relevant, and rerun affected existing workflows before completion. Protect daily logs, shop orders, timecards and user management whenever shared code or a website release could affect them. Report exact passing/failing counts and checks not run; do not replace browser workflow coverage with implementation-mirroring unit tests.

All browser writes, email requests and publication checks must use synthetic fixtures or local emulators. Never exercise production-backed write UI or use production records as test data. A production bundle must also be checked for boot/public fallback/login behavior with external requests blocked. The build excludes the fixture runtime, so fixture browser results verify the selected source, not production-service availability.

Hosting's Firebase predeploy hook requires `npm run test:shop-order-layout` before
the build, including deployments started through `npm run deploy` or the Firebase
CLI. Install the locked dependencies and Chromium with `npm ci` and
`npx playwright install chromium` first. The gate starts this checkout on its own
port with Firebase configuration blank, and runs the catalog, responsive and
workspace fixture tests. A failure blocks the Hosting deployment.
The gate also fails if any required Shop Orders regression suite is missing,
so a release cannot silently omit the new catalog tests while running older tests.

The October 7 catalog fix and its tests were absent from the October 13 release
baseline. Builds and unit tests alone did not detect the narrow desktop pane.
Preserve this fix, its browser tests and the predeploy hook when preparing future
release branches. An older checkout that lacks the hook cannot enforce it.

After a separately approved Hosting deployment, run `npm run verify:shop-order-layout`
from the exact built release checkout. This read-only command fetches public HTML,
the entry bundle and Shop Orders CSS, checks the catalog container/compact query,
and requires the delivered stylesheet to match `dist`. It does not sign in, open
orders or write data. For visual acceptance, open an existing catalog, search and
expand a long-label category at 1280px/1366px and phone widths, and check that
labels, price, quantity and Add remain readable. Do not submit an order as a test.

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
npm run build

# Runs the end-to-end tests
npm run test:e2e
# Runs the tests only on Chromium
npm run test:e2e -- --project=chromium
# Runs the tests of a specific file
npm run test:e2e -- tests/example.spec.ts
# Runs the tests in debug mode
npm run test:e2e -- --debug
```

### Check or fix lint

`npm run lint` (or `npm run lint:check`) checks with Oxlint and ESLint without changing source files. Use `npm run lint:fix` explicitly to apply automatic fixes. Verification callers should use the check commands; generated lint caches remain ignored. Generated build/review outputs and legacy root-level Functions compiler output are excluded in ESLint, matching `.gitignore`; `functions/src`, `functions/scripts`, application source and maintained tests remain checked. Run `node --test scripts/lint-scope.test.mjs` to verify that boundary.

```sh
npm run lint:check
# Apply fixes only when intended:
npm run lint:fix
```
