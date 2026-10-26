# Phase2 Web Application

Phase 2 uses Vue 3 and Vite for the browser app and a separate TypeScript package for Firebase Functions. See [GIT-WORKFLOW.md](GIT-WORKFLOW.md) for the canonical checkout, `test`/`main` workflow and reviewed release process.

## Project structure and build contracts

- Root HTML files are Vite entry points. `src/` contains the browser app: views, components, features, services, stores and the router. These folder names are project conventions, not a Firebase/Vite requirement.
- `src/firebase.ts` owns lazy initialization of the modular browser SDK and the existing development-only emulator connections. `VITE_*` values are public browser configuration, never server secrets.
- Root Vite configurations select the employee, public and server-renderer builds. Reusable build plugins live in `scripts/`; they retain production fixture exclusion and iframe isolation. Imported assets go through Vite; files in `public/` are copied directly when that build enables `publicDir`.
- `functions/src/` contains backend TypeScript. Its own package and compiler build generated JavaScript/declarations into ignored `functions/lib/`; `functions/package.json` points to `lib/index.js`. Keep the named exports in `functions/src/index.ts` stable, because they identify deployed handlers. Shared pure model modules are imported as source by the browser; server runtime modules stay on the backend.
- `functions/assets/` contains packaged fonts. `functions/generated/` contains the generated public HTML template and SSR renderer. Both locations are runtime inputs to Functions; they are not frontend document storage.
- The normal frontend build writes `dist/`, matching `firebase.json` Hosting's `public` directory. The reviewed employee-only release build writes `hosting-dist/` and preserves the live public website through the existing release script. Do not substitute one artifact for the other or reorder the private-file/API rewrites behind the application fallback.
- Tests live in `e2e/`, source-adjacent specs and maintained verification scripts. Temporary evidence, emulator state and generated builds remain ignored by Git. Essential source, configuration, tests and lockfiles are tracked.

`npm run build` type-checks the frontend, builds the browser entries/public template, compiles Functions and builds its SSR renderer. Vite transpilation does not replace `vue-tsc` or the Functions compiler. After that build, `npm run verify:functions-build` checks the compiled entry/handler names, Firebase package inclusion, packaged fonts and public rendering using only synthetic local data; it makes no cloud calls.

The Node/tooling TypeScript project includes all named Vite, Vitest and Playwright configurations, so specialized build/review configurations receive the same type-checking as their base configuration.

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

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
