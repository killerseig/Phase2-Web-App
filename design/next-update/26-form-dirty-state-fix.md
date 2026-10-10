# False unsaved-form warning fixed locally

The builder marked any bubbled input event in canvas/inspector panels as dirty,
even if only a preview/control changed and the form definition did not. Dirty flags
could also outlive no-op updates. Respondent repeat controls emitted default empty
rows during hydration; the workspace marked every model event as a user edit.
Optional zero-minimum repeat groups could repeatedly initialize an empty array.

Builder dirty state now compares the actual normalized definition against its
saved baseline, independent of object key order. Checks are synchronous for quick
navigation; undo history remains post-flush. Broad panel input flags are removed.
No-op notifications cannot invent edits. New unsaved forms remain dirty, and real
changes, undo/redo, confirmation and pending-save protection are retained.

Respondent draft minimum rows are hydrated before setting a clean baseline. Answer
comparison uses the existing partial-answer normalization; invalid edits remain
dirty. Submitted answers are not rewritten. Receiving/saving a record resets the
baseline. Untouched pending reads can be left without a warning or manufactured
save. Actual respondent changes retain the existing prepare-navigation save behavior.
Already empty optional groups no longer emit repeated initialization updates.

Verified with mocked APIs: untouched open/leave, delayed initial hydration,
preview/control no-op, immediate real edit/leave, cancel keeping changes, cancel
switching forms, discard/switch to clean form, save/leave, and router back/forward.
Respondent default rows cause no save; real edits save once and then stay clean.
No production forms were saved or submitted, and nothing was deployed.

Full regression: 377 files / 1,798 tests passed. After the last optional-group
edge adjustment, all five focused files / 15 tests passed. Vue type checking and
production builds passed. 187 core business/auth/bootstrap files remain identical.
Latest fix modules are served by the loopback preview http://127.0.0.1:5173/.

Changed code: useFormAuthoring, new formDirtyState helper, FormBuilderView,
FormResponseWorkspace and FormDefinitionFields, plus related regression specs.
Previous blocked release is untouched. Evidence: oct10-dirty-regression.log,
oct10-dirty-focused-final.log, oct10-dirty-build-final.log and oct10-dirty-preview.json
under .forms-local-data/release-baseline.
