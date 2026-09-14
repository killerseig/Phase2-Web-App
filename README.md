# Phase2 Web Application

This template should help get you started developing with Vue 3 in Vite.

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
