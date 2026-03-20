# Phase2 Web App

Vue 3 + TypeScript + Vite application with Firebase-backed services.

## Prerequisites

- Node.js `>=20.19.0` (project uses Node `22` in CI)
- npm `>=10`

## Setup

1. Install dependencies:

```bash
npm ci
```

2. Configure environment variables:

PowerShell (Windows):

```powershell
Copy-Item .env.example .env.local
```

macOS/Linux:

```bash
cp .env.example .env.local
```

Populate `.env.local` with your Firebase project values.

3. Start local development:

```bash
npm run dev
```

## Quality Commands

- Type check: `npm run typecheck`
- ESLint: `npm run lint:vue`
- Full lint: `npm run lint:all`
- Unit tests (single run): `npm run test -- --run`
- Browser smoke tests: `npm run test:e2e`
- Browser smoke tests (headed): `npm run test:e2e:headed`
- Production build: `npm run build`
- Full local CI gate: `npm run check`

## Browser Smoke Tests

Playwright is configured for browser-level smoke coverage under `e2e/` and runs against a seeded local Firebase emulator stack.

Prerequisites:

- Java runtime on your machine. Firestore emulator will not start without it.
- First-run emulator downloads are handled by the Firebase CLI and may take a few minutes.

Commands:

- `npm run test:e2e`
- `npm run test:e2e:headed`
- `npm run test:e2e:ui`

The E2E stack uses:

- `firebase emulators:exec` with a demo project id
- `.env.e2e` for emulator-safe Firebase config
- deterministic seed data from `e2e/fixtures/seed-data.mjs`

The seeded baseline includes admin, controller, and foreman users plus representative jobs, roster, daily logs, timecards, shop orders, catalog items, and email settings.
## CI

GitHub Actions runs:

- type checking
- linting (warning-gated)
- unit tests
- production build

Workflow file: `.github/workflows/ci.yml`.

## Firebase Notes

This repo includes Firebase configuration and rules files:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

Deploy and emulator workflows are managed via Firebase CLI and project-specific credentials.
