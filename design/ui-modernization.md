# UI Modernization

## Purpose

This document defines the visual direction for the refactor.

The goal is not just to make the app cleaner. The app should feel modern, professional, and dependable for field/construction operations.

The visual system should help users move quickly through dense work without making the app feel generic.

## Current UI Read

The current app already has a useful visual foundation:

- dark industrial workspace
- blue/cyan operational accent
- card and pane layouts
- dense data-entry screens
- exact-print workflows for timecards and shop orders
- PrimeVue installed in unstyled mode
- global CSS tokens in `src/styles/main.css`

The main problem is not lack of styling. The main problem is that styling is not yet systematized.

Large views currently own too much:

- layout primitives
- card styling
- form styling
- button variants
- empty states
- mobile behavior
- workflow-specific visual states

That makes the app harder to modernize consistently.

## Visual North Star

Phase 2 should feel like:

- a focused operations command center
- sturdy and field-ready
- crisp enough for office/admin workflows
- dense but not cramped
- modern without looking trendy for its own sake

Avoid:

- generic SaaS white cards everywhere
- random one-off gradients
- excessive glassmorphism
- changing print/PDF layouts to match the web app
- making high-density workflows too spacious

## Design Language

### Theme

Keep the dark operational app shell unless the company asks for a full theme change.

Recommended direction:

- deep navy/charcoal base
- restrained cyan/steel-blue accent
- warm success/danger/warning tones
- subtle depth through borders and shadows
- clear focus states for keyboard-heavy workflows

Timecards may keep their lighter paper/workbook visual language where it supports the Excel-origin workflow.

### Typography

The current `Segoe UI`/`Inter` stack works, but the refactor should standardize type tokens.

Needed tokens:

- app body
- compact body
- section eyebrow
- page title
- card title
- table header
- numeric/data cell
- print/PDF type

Dense operational screens need excellent legibility more than decorative type.

### Spacing

Create spacing tokens and use them consistently.

Suggested scale:

- `--space-1`: 0.25rem
- `--space-2`: 0.5rem
- `--space-3`: 0.75rem
- `--space-4`: 1rem
- `--space-5`: 1.25rem
- `--space-6`: 1.5rem
- `--space-8`: 2rem

Dense workflows should use compact variants instead of custom one-off spacing.

### Shape And Depth

Standardize:

- radius tokens
- pane borders
- card borders
- active row treatment
- shadows
- focus rings

The app should not have every page inventing a different panel/card style.

## Component System Targets

### Shared Layout

Build or standardize:

- `AppShell`
- `AppPage`
- `AppPane`
- `AppSplitWorkspace`
- `AppSection`
- `AppToolbar`

These should replace repeated page-level layout markup over time.

### Shared Controls

Build or standardize:

- `AppButton`
- `AppInput`
- `AppTextarea`
- `AppSelect`
- `AppCheckbox`
- `AppDateInput`
- `AppBadge`
- `AppStatusMessage`
- `AppEmptyState`
- `SaveStatusIndicator`

Do not wrap every HTML element immediately. Start with controls that are repeated and visually inconsistent.

### Shared Workflow Components

Prioritize:

- `RecipientEditor`
- `ConfirmAction`
- `ActionBar`
- `FilterSearch`
- `HistoryList`
- `ModuleCard`
- `AttachmentPicker`

These should be props/events driven and avoid service imports.

## Workflow-Specific Visual Direction

### Jobs

Jobs should feel like an admin planning board.

Priorities:

- clear job cards/list rows
- stronger selected state
- clean module-recipient sections
- less repeated inline form styling

### Users And Employees

These should feel more administrative and trustworthy.

Priorities:

- clear directory/detail split
- obvious active/inactive/pending status
- safer destructive actions
- consistent forms

### Daily Logs

Daily logs should feel like a structured field report.

Priorities:

- readable form sections
- strong saved/submitted states
- clear photo/attachment handling
- compact but calm text areas

### Shop Orders

Shop orders should feel like a warehouse/order workspace.

Priorities:

- stable catalog/order split
- compact order item rows
- readable history
- clear submitted/read-only state
- email/PDF/print output remains practical for paper

### Timecards

Timecards are special.

Priorities:

- preserve Excel/workbook behavior
- keep keyboard input fast
- make save/submitted states clear
- do not make the workbook pretty at the cost of accuracy
- keep PDF/export output identical to the approved format

## Print, Email, And PDF Rule

Print/email/PDF outputs are not normal app UI.

Rules:

- Exact paper output wins over app theme consistency.
- Timecard email should attach the same PDF output used by admin export.
- Shop order email/PDF output should prioritize printed readability and page breaks.
- Shop order PDF is the reliable print surface when email clients ignore print CSS.
- Do not redesign print/PDF output as part of general app beautification.
- Use smoke tests and manual previews for every visual output change.

## Accessibility And Usability

The app is dense and operational, so usability matters more than decoration.

Required:

- visible keyboard focus
- high contrast text in dense tables
- large enough click targets on mobile
- selected rows/states that are not color-only
- inputs that preserve typing during autosave
- predictable keyboard navigation in timecards
- no hidden action buttons that move around during workflow changes

## CSS Direction

Short term:

- keep `src/styles/main.css` as the token/global base
- avoid large visual rewrites before component extraction
- move repeated styles into shared components as they are extracted

Medium term:

- split global CSS into:
  - tokens
  - reset/base
  - layout primitives
  - shared controls
  - utilities
- keep dense feature-specific CSS near feature components

Do not migrate all CSS at once.

## PrimeVue Direction

PrimeVue is currently installed with `unstyled: true`.

That is acceptable.

Use PrimeVue selectively for behavior-heavy primitives only when it helps:

- toast
- dialog
- overlay/menu if needed
- data components only when they fit the workflow

Do not let PrimeVue default visuals define the app.

If wrapping PrimeVue components, wrap them behind app components so visual behavior stays consistent.

## Modernization Refactor Order

1. Define/clean tokens in `main.css`.
2. Extract shared layout components from low-risk pages.
3. Extract shared controls only where repetition already exists.
4. Migrate jobs/users/employees first.
5. Migrate daily logs and shop orders after shared patterns are stable.
6. Touch timecards last and only with strong e2e/manual checks.

## Visual QA Checklist

Before finishing a visual refactor slice:

- Does the page still pass targeted e2e?
- Does it preserve existing `data-testid` values?
- Does keyboard focus remain visible?
- Are buttons and destructive actions consistent?
- Are loading/empty/error states covered?
- Does the page work on mobile width?
- Did any print/email/PDF output change unintentionally?

## Stop Conditions

Stop and reassess if:

- visual cleanup changes workflow behavior
- timecard dimensions or print/PDF output shift unexpectedly
- a shared component needs too many feature-specific props
- density changes make field workflows slower
- the app starts looking generic instead of operational
