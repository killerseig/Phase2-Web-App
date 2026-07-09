# UI Token Rollout Plan

Date started: 2026-07-08

Purpose: this plan keeps GUI polish from becoming scattered CSS changes. The app can become more modern and professional only if new visual decisions go through shared tokens, shared primitives, and scoped feature ownership.

## Goal

Make the app feel:

- more polished
- more consistent
- less visually clunky
- still dense enough for field operations
- still safe for exact print/PDF workflows

This is not a full redesign. It is a controlled visual system pass.

## Non-Goals

- Do not change timecard print/PDF dimensions.
- Do not change shop order PDF/email rendering as part of general UI polish.
- Do not restyle every page in one pass.
- Do not introduce a new visual theme before basic tokens and primitives exist.
- Do not make dense workflows slower by adding excessive spacing.

## First Token Set

Start with the smallest set that reduces one-off CSS.

### Color Tokens

- app background
- app surface
- app elevated surface
- app border
- app muted border
- primary accent
- primary accent hover
- success
- warning
- danger
- text strong
- text normal
- text muted
- focus ring

### Spacing Tokens

- `--space-1`: smallest inline gap
- `--space-2`: compact form gap
- `--space-3`: row gap
- `--space-4`: normal section gap
- `--space-5`: pane inner padding
- `--space-6`: page gap
- `--space-8`: large layout gap

### Radius Tokens

- small control radius
- normal control radius
- card radius
- pane radius
- pill radius

### Depth Tokens

- flat border only
- raised pane shadow
- active row glow/shadow
- modal/dialog shadow

### Typography Tokens

- app body
- compact body
- page title
- pane title
- section eyebrow
- table header
- data cell
- button label
- helper text

### Density Tokens

- compact input height
- normal input height
- compact row height
- normal row height
- dense table row height

## First Visual Targets

Start with lower-risk pages/patterns:

1. App shell tokens.
2. Shared buttons and badges.
3. Shared panes/cards.
4. Jobs/users/employees split panes.
5. Daily log and shop order forms after primitives stabilize.
6. Timecards last and only with workflow-specific checks.

## CSS Ownership Direction

The target CSS shape:

```txt
src/styles/
  main.css
  tokens.css
  reset.css
  base.css
  utilities.css
  primevue.css
```

Rules:

- `main.css` imports the global layers and should become smaller over time.
- Tokens belong in `tokens.css`.
- PrimeVue overrides belong in `primevue.css`.
- Component visuals belong in component styles when the component owns the markup.
- Feature/page styles can stay scoped in views while a page is being actively refactored.
- Avoid new page-specific selectors in global CSS unless there is a short-term migration reason.

## Visual Slice Checklist

Before a visual slice:

- Identify the page/component being polished.
- Identify which existing selectors will move or be replaced.
- Confirm print/email/PDF output is untouched.
- Confirm targeted E2E exists.
- Decide whether the slice is token-only, component-only, or page polish.

During a visual slice:

- Use existing tokens first.
- Add a token only if the value is expected to repeat.
- Avoid `!important`.
- Avoid hard-coded colors.
- Preserve focus states.
- Preserve mobile behavior.
- Preserve dense row/input sizing unless intentionally changing it.

After a visual slice:

- Run type-check.
- Run targeted E2E for the touched page.
- Verify the visual change did not bleed into unrelated workflows.
- Record any new visual rule in this file or `css-architecture.md`.

## Suggested First Token Slice

R06 from the execution board:

- Add or normalize the first token categories.
- Do not move large CSS blocks yet.
- Apply tokens only where the change is low-risk.
- Keep visual output nearly identical unless the slice explicitly says otherwise.

Required test command:

```sh
npm run type-check
```

If a real route is visually touched, also run that route's targeted E2E spec.

## Stop Conditions

Stop if:

- visual polish changes workflow behavior
- a token pass becomes a page redesign
- a shared component needs too many special-case props
- timecard or shop order print/PDF output shifts
- mobile usability gets worse
- the app starts looking generic instead of operational
