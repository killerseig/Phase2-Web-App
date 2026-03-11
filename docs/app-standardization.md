# App Standardization Checklist

Use this checklist when adding or refactoring table/form-heavy views.

## Tables

- Wrap in `table-responsive`.
- Use consistent classes (`table table-sm table-striped table-hover mb-0`).
- Keep column widths explicit for narrow/action columns.
- Use `small fw-semibold` headers and centered numeric cells.
- Keep row-level actions in a compact button group with tooltips.
- Confirm destructive actions with the shared confirm dialog.

## Forms

- Keep labels, placeholders, and validation messages consistent.
- Group related fields with clear section headers.
- Keep submit/cancel actions grouped and visible.
- Disable all dependent controls while saving.

## Validation and Errors

- Validate before submit and show inline feedback.
- Use consistent error text and toast patterns.
- Prefer typed validators from shared utilities.

## Accessibility

- Provide labels and aria text for icon-only controls.
- Ensure keyboard support for all primary actions.
- Keep color/status indicators readable with text fallback.

## Testing

- Add unit tests for pure helpers/composables.
- Add component tests for major view flows and role-gated UI.
- Keep `lint`, `lint:ci`, and `test -- --run` green before merging.
