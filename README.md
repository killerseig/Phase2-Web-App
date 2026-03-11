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
- Production build: `npm run build`
- Full local CI gate: `npm run check`

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
