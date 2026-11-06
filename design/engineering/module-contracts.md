# Module contracts

Use this index to load the relevant boundary first, then inspect source/tests when changing it or when evidence conflicts. These cards describe existing behavior as of November 6, 2026; commercial module interfaces and general company entitlements remain proposals. Each card should stay short enough to review alongside a change.

## Contract card format

Record purpose/nonresponsibilities; public entry points and types; inputs/outputs and units; invariants/state ownership; side effects, errors, cleanup and retry behavior; permissions and scope; required/optional dependencies; source and behavioral tests. Add a usage example when it clarifies the contract. Update the card when callers' observable behavior changes, not for every internal line edit.

## Form authoring

**Interface:** `useFormAuthoring(draft, dirty)` returns selection/select/reset/saved/undo/redo and reactive availability flags. Inputs are Vue refs; history snapshots cover the form definition and selected field, not network state. Reset establishes a baseline; `saved()` marks the current definition saved. Undo/redo retain stable field IDs and restore optional definition properties correctly.

**Ownership and effects:** mutates the caller's draft/dirty refs and manages bounded local history/watchers. No server writes or authorization. The view owns account/scope reset and navigation; persistence owns successful-save notification.

[Source](../../src/features/forms/useFormAuthoring.ts) · [Tests](../../src/features/forms/useFormAuthoring.spec.ts)

## Form persistence

**Interface:** `useFormPersistence(options)` coordinates device library storage, server template loading/saving and confirmed save-before-publish. Options supply UID/draft/library/status refs, storage, authoring callbacks and confirmation. Returned operations/status are the authoritative persistence boundary; the view retains field editing and navigation.

**Invariants and effects:** device versions and server revisions are different concepts. Successful saves/publication have owner/draft guards; issuing follows a successful save and confirmation. The implementation does not guard every error/finally update by request generation, and server loading checks UID only. Callers must preserve its existing lifetime constraints; this is not a complete stale-result isolation guarantee. Uses local storage and Admin template transport. Server handlers independently authorize Admin access and validate immutable issuance; a client flag cannot grant it. Busy/error/publication state reports failures without silently declaring a draft published.

[Source](../../src/features/forms/useFormPersistence.ts) · [Tests](../../src/features/forms/useFormPersistence.spec.ts)

## Website editing and commands

**Interfaces:** `useWebsiteWidgetEditing(options)` owns selection, inspector context and widget geometry operations; `useWebsiteCommands(options)` returns `load` and `command` to coordinate explicit persistence/publication. Both compose injected editor state and the existing history/autosave/draft-sync boundaries.

**Invariants and effects:** there is one editable site state; geometry/selection is separate from publication. Selection and layout changes preserve IDs/references. Commands may call Website services and confirmation callbacks; editor operations do not independently publish. Account/scope and stale-result guards remain necessary. Admin authorization and public rendering are enforced at their existing server/renderer boundaries.

[Editing source](../../src/features/website/useWebsiteWidgetEditing.ts) · [Editing tests](../../src/features/website/useWebsiteWidgetEditing.spec.ts) · [Command source](../../src/features/website/useWebsiteCommands.ts) · [Command tests](../../src/features/website/useWebsiteCommands.spec.ts)

## Library mutation lifetime

**Interface:** `useLibraryMutation({busy,error,progress}).runMutation(operation)` supplies a `stageFile(File)` callback returning uploaded metadata. One mutation stages one file; the caller owns file validation, metadata commands, navigation and success UI.

**Effects and limits:** the helper sets busy/progress, maps operation errors and awaits staging cleanup in `finally`. It does not grant document access, renew viewer tickets or own byte ranges. Cleanup failures can reject; callers must not assume arbitrary operations are idempotent or use this as a batch transaction. Backend upload/metadata services remain the permission boundary.

[Source](../../src/features/sds/useLibraryMutation.ts) · [Tests](../../src/features/sds/useLibraryMutation.spec.ts)

## Authorized document requests

**Interface:** `createAuthorizedFetch(url,{signal,isCurrent,renew?,onRenewing?}).request(init?)` returns a successful `Response` or throws. The caller supplies viewer lifetime and optional ticket renewal; the helper normalizes the file URL and sends no-store requests.

**Invariants and effects:** an expired-ticket response may cause one renewed retry per request; concurrent expired ranges share a renewal. Other denials do not renew indefinitely. Abort or changed-view checks run around asynchronous work. A renewed link is not a new access grant: the renewal service rechecks permission. Keep this instance scoped to one viewer; do not share it across owners/documents.

[Source](../../src/features/documents/authorizedFetch.ts) · [Tests](../../src/features/documents/authorizedFetch.spec.ts)

## Dashboard transport and server model

**Interface:** `sharedDashboardCommand(action,data)` maps typed actions to typed responses through `sharedDashboardWorkspace`. Context contains personal/job/role scope and optional job/role identifiers; personal ownership is derived server-side. For example:

```ts
const layout = await sharedDashboardCommand('load', { scope: 'personal' })
// Save with layout.version; never substitute notesVersion for a template revision.
```

**Invariants:** template version and private-content version are separate. Copy/group operations move configuration, not saved private notes, submissions or documents. Role templates are Admin-owned with explicit default-off delegation; Job templates are Admin-owned. Every request still checks active identity and authorized scope. Client workspace availability is not authorization.

**Model:** `validateSharedWidgets` and `validateDashboardViewport` are pure shape/bounds validators, not permission checks. Layouts contain at most 12 widgets including descendants, bounded 24-column placement, bounded nesting and required Job/Role navigation tools (Personal may be empty). Containers retain a flat ID/parent/region graph. Tablet/phone overrides are optional; absent overrides inherit desktop behavior. Invalid saved display/hierarchy data produces a controlled server error without rewriting the record.

**Effects and dependencies:** the client uses Firebase callable transport; the handler uses Admin transactions and issued-form checks. The client exposes typed actions; the server validates action/data at runtime, and saves detect revision conflicts. No contract here grants production deployment or changes legacy workflows.

[Transport](../../src/services/sharedDashboards.ts) · [Model](../../functions/src/sharedDashboardModel.ts) · [Handler](../../functions/src/sharedDashboardFunctions.ts) · [Model tests](../../src/__tests__/sharedDashboards.spec.ts) · [Emulator authorization/persistence tests](../../scripts/verify-shared-dashboards.mjs)

## Dashboard geometry and pointer lifetime

**Interfaces:** `editorGeometry.ts` provides resize/translate/arrange, selection roots, descendant expansion, inherited geometry locks and configuration copying. Positions use 24 logical columns and 32px rows; render scale is separate. `useWidgetDrag` owns threshold, grab offset, pointer cancellation, drop targeting and scroll assistance; the view owns persistence and the selected surface.

**Invariants and effects:** geometry locks constrain editing but never confer permission. Opposite resize edges stay anchored; group movement preserves offsets within bounds. Clipboard remaps IDs/parents and clears legacy note text. Responsive edits affect the chosen widget/device rather than freezing all other devices. Escape/blur cancels uncommitted pointer work; handlers/listeners are removed on disposal. Pure geometry functions do not access Firestore. DOM measurement belongs to the view/canvas.

[Geometry](../../src/features/dashboard/editorGeometry.ts) · [Pointer helper](../../src/features/dashboard/useWidgetDrag.ts) · [Units](../../src/__tests__/dashboardEditorParity.spec.ts) · [Browser behavior](../../e2e/dashboard-editor-parity.spec.ts)

**Edit-grid rendering:** `DashboardSnapGrid` receives spacing and the current rendered layout. It draws minor/major dots at the same 24-column/32px-row intersections used by snapping, above opaque widgets so full-width tools cannot hide the guide. The SVG is decorative and never receives pointer events. Each canvas masks direct containers out of its grid; nested canvases draw their own local intersections. DOM bounds/resize observation stay inside the component and are disposed with it. Show grid and edit mode control mounting; rendering never saves or changes placement.

[Grid overlay](../../src/components/dashboard/DashboardSnapGrid.vue)

**Workspace grid and camera:** `useDashboardWorkspaceGrid({viewport,content,active,spacing,dependency})` measures the root canvas relative to the viewport and paints only the viewport's seven background properties. It follows native scrolling, resize, camera translation and scale through one scheduled animation frame, without re-rendering the editor or changing a draft. This protects uncommitted number-input text from measurement updates. It removes its styles/listeners/observers on replacement or disposal; inactive mode removes the background. The opaque edit canvas draws its own grid, preventing doubled dots.

`viewportGeometry.ts` owns pure camera conversion: saved starting offsets use 24-column/32px-row units; pointer deltas convert from screen pixels through the current scale. Non-finite pan input preserves the original camera. Origin and actual-size controls change local view state only; they do not alter the saved starting view or widget positions.

[Workspace grid](../../src/features/dashboard/useDashboardWorkspaceGrid.ts) · [Camera geometry](../../src/features/dashboard/viewportGeometry.ts) · [Grid browser checks](../../e2e/dashboard-grid-visibility.spec.ts)
