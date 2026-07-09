# CSS Architecture

## Purpose

This document defines how CSS should be organized during the Vue refactor.

The goal is a consistent, professional app without a giant global stylesheet that every page keeps patching.

## Current CSS Read

The app currently has:

- one global stylesheet at `src/styles/main.css`
- global theme tokens
- global base/reset rules
- app shell styles
- shared primitive styles such as buttons, select fields, panels, empty states, and status messages
- auth, jobs, dashboard, quick-link, workflow, and preview styles in the same global file
- many large Vue views with `<style scoped>` blocks
- PrimeVue configured with `unstyled: true`

This is a workable transition state, but not the ideal final shape.

The main problem is responsibility mixing:

- `main.css` is both design-system foundation and page-specific styling.
- Shared components depend on global classes instead of owning their own visual contract.
- Some style names describe pages instead of reusable primitives.
- Tokens exist, but the token set is not yet complete enough to prevent one-off spacing, radius, shadow, and color choices.

## Target Principles

- Global CSS should define the system, not individual pages.
- Shared Vue components should own their component styles.
- Feature-specific styles should live near the feature component or view that owns the workflow.
- Exact print/email/PDF styles are output-rendering concerns and should not be mixed into normal app styling.
- CSS should make dense workflows feel consistent without making timecards, daily logs, or shop orders slower to use.
- Visual reuse should happen through tokens and shared components before utility-class sprawl.

## Target Style Folder Shape

Keep `src/styles/main.css` as the single imported stylesheet from `src/main.ts`, but turn it into an entry point.

Target:

```text
src/styles/
  main.css
  tokens.css
  reset.css
  base.css
  utilities.css
  primevue.css
```

Recommended responsibility:

- `main.css`
  - imports the other global CSS files in order
  - contains no page-specific selectors long-term
- `tokens.css`
  - colors
  - typography tokens
  - spacing scale
  - radii
  - borders
  - shadows
  - z-index
  - motion
  - density tokens
- `reset.css`
  - box sizing
  - root/body/app height
  - default button/input font inheritance
  - reduced-motion rule
- `base.css`
  - body background
  - default text rendering
  - links
  - selection
  - scrollbars if we keep custom scrollbars
  - generic focus ring defaults
- `utilities.css`
  - tiny, stable, app-wide utilities only
  - examples: `.sr-only`, simple layout helpers if truly reused
- `primevue.css`
  - PrimeVue toast/dialog/overlay overrides when those components are wrapped or used

Do not split all CSS at once. Move rules as components are extracted.

## Component Style Rules

Shared components should prefer colocated `<style scoped>` blocks.

Examples:

- `AppButton.vue` owns `.app-button` styles.
- `AppPane.vue` owns pane border, header, body, and action layout styles.
- `AppStatusMessage.vue` owns status-message tones.
- `AppEmptyState.vue` owns empty-state spacing and type.
- `AppShell.vue` owns app shell and navigation styles.

Rules:

- A shared component's root class should be stable and documented.
- Component variants should be explicit props, not random extra classes from parent pages.
- Parent pages can pass layout classes, but should not reach deep into child internals.
- Use CSS custom properties for sanctioned local overrides when a component needs density or width variation.
- Do not make shared components depend on page-specific selectors.

Good:

```vue
<AppButton variant="primary" density="compact" />
```

Risky:

```vue
<button class="app-button jobs-page__special-blue-button" />
```

## Feature Style Rules

Feature styles should stay near the feature.

Use `<style scoped>` for:

- large workflow views
- feature components
- special layouts that are not shared elsewhere
- exact interactive workbook layouts

Feature CSS should still use global tokens:

```css
.shop-orders-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
}
```

Avoid:

- hard-coded colors that already have tokens
- one-off shadows/radii
- page styles in `main.css`
- deep selectors into shared component internals
- matching print/PDF styles to the app theme

## Token Plan

The current tokens are a good start. The refactor should normalize them into categories.

Color tokens:

- `--color-bg`
- `--color-bg-elevated`
- `--color-surface`
- `--color-surface-raised`
- `--color-field`
- `--color-border`
- `--color-border-strong`
- `--color-text`
- `--color-text-muted`
- `--color-text-soft`
- `--color-accent`
- `--color-accent-strong`
- `--color-success`
- `--color-warning`
- `--color-danger`

Spacing tokens:

- `--space-1`
- `--space-2`
- `--space-3`
- `--space-4`
- `--space-5`
- `--space-6`
- `--space-8`
- `--space-10`
- `--space-12`

Shape and depth tokens:

- `--radius-xs`
- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-pill`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`

Typography tokens:

- `--font-body`
- `--font-mono`
- `--font-size-xs`
- `--font-size-sm`
- `--font-size-md`
- `--font-size-lg`
- `--font-size-xl`
- `--line-height-tight`
- `--line-height-normal`
- `--letter-spacing-eyebrow`

Density tokens:

- `--control-height-sm`
- `--control-height-md`
- `--control-height-lg`
- `--pane-padding`
- `--pane-padding-compact`
- `--row-gap`
- `--row-gap-compact`

Motion tokens:

- `--duration-fast`
- `--duration-normal`
- `--ease-standard`

The exact token names can be adjusted during implementation, but the categories should exist.

## Naming Rules

Use these naming patterns:

- shared app components: `.app-button`, `.app-pane`, `.app-status-message`
- app shell: `.app-shell`
- feature components/views: `.shop-orders-*`, `.daily-logs-*`, `.timecards-*`
- private child elements: BEM-style `__element`
- variants: BEM-style `--variant`

Avoid:

- generic names like `.card`, `.panel`, `.row`, `.button`
- styling by element type inside large page scopes unless intentional
- page-specific classes in shared component CSS
- styling by generated PrimeVue internals outside `primevue.css`

## Cascade Strategy

Keep specificity low.

Preferred order:

1. tokens
2. reset
3. base
4. shared component scoped styles
5. feature scoped styles
6. tiny utilities
7. PrimeVue overrides

Avoid:

- `!important`
- deeply nested selectors
- global descendant selectors like `.page .card .header button`
- CSS that requires import order tricks to work

CSS cascade layers are optional. If introduced, use them only for global files and keep them simple:

```css
@layer reset, base, utilities, vendor;
```

Do not use layers as a substitute for component ownership.

## Responsive Rules

Responsive behavior should be owned by the component or feature that changes layout.

Global breakpoints should be tokenized/documented:

- `--breakpoint-sm`: mobile
- `--breakpoint-md`: tablet
- `--breakpoint-lg`: desktop

Implementation can use plain media queries for now.

Rules:

- App shell owns sidebar/topbar responsive behavior.
- Split workspaces own their collapse/stack behavior.
- Dense tables should use scroll/scale strategies intentionally.
- Email/PDF paper-width scaling is not the same as app responsive layout.

## PrimeVue Styling Rules

PrimeVue should stay unstyled unless there is a strong reason to change.

Rules:

- Wrap PrimeVue behavior-heavy components behind app components when practical.
- Keep PrimeVue override CSS in `primevue.css`.
- Do not let PrimeVue theme classes become the app's visual language.
- Avoid styling random PrimeVue internals from feature views.

## Migration Plan

Do this gradually:

1. Add token categories to `main.css` without renaming every current token at once.
2. Extract `tokens.css`, `reset.css`, `base.css`, `utilities.css`, and `primevue.css`.
3. Keep `main.css` as the import entry point.
4. Move `AppShell` styles from global CSS into `AppShell.vue`.
5. Move shared primitive styles into their components as those components are formalized.
6. Move auth/jobs/dashboard page-specific global styles into their views or extracted feature components.
7. Leave timecard workbook/print styles colocated and protected by tests.
8. Audit `main.css` after each extraction and delete migrated global selectors.

Do not do a big-bang CSS migration.

## Visual QA Checklist

For every CSS refactor slice:

- Did the touched page still pass targeted e2e?
- Did focus states remain visible?
- Did keyboard navigation still work?
- Did mobile layout still fit?
- Did dense workflows keep their density?
- Did shared component variants remain consistent?
- Did `main.css` get smaller or more foundational?
- Did print/email/PDF output remain unchanged unless intentionally touched?

## Stop Conditions

Pause if:

- a global stylesheet change affects unrelated workflows
- a component needs several parent-specific style escape hatches
- a visual fix requires `!important`
- a page starts depending on shared component internals
- a CSS migration changes behavior or output rendering
- timecard, shop order, or daily log data-entry speed gets worse
