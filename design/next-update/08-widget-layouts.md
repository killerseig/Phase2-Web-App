# Widget placement and dashboard layouts

Implemented locally September 18, 2026. Production deployment remains separate.

## Confirmed ownership

Users edit their own personal dashboard. **Only admins edit shared role layouts**, including layouts for other roles. Non-admins read the shared layout for their own role. Existing Jobs pages, job dashboards, permissions and sidebar visibility remain unchanged.

## Interaction

The dashboard editor retains ordered responsive rows. The Website Builder now uses its own coordinate canvas, following the networking application's grid model. This follow-up is scoped to Website Builder; personal and role dashboards remain as previously implemented.

Dashboard widgets use full, half, one-third, or two-thirds widths and stack on narrow screens. Website widgets use independent geometry and can overlap; their layer controls stacking. Published grid pages scale the authored coordinate space to the available width, preserving placement rather than repacking into rows.

## Website Builder

Drag a library widget onto the grid or click to append below existing widgets. Hidden sections remain available in the outline. Drag widgets directly, use their Move handle, or drag an outline handle onto the grid. Eight resize handles surround the selection. The inspector exposes X, Y, Width, Height and Layer. Each completed gesture is one undoable action; Escape or release outside the canvas cancels. The outline arrows change reading order, not coordinates.

The networking reference uses 24 columns, 45 px columns, 32 px rows, an initial 18-row extent, and major grid markers every four minor intervals. The builder uses those same values. Page settings offer grid visibility, snap on/off, and independent 0.25/0.5/1/2/4-unit snap spacing. Without snapping, pointer movement resolves to design pixels. Zoom and pan are editor view state and never alter authored geometry. Canvas bounds grow with widget placement.

Section `layout` stores finite numeric `x`, `y`, `w`, `h`, `z`. Width/height are at least one unit; coordinates are nonnegative; right/bottom bounds are limited to 1,000 columns and 10,000 rows. Layers are integers from 0 through 10,000. The optional legacy `span` remains accepted for old published row layouts. Grid settings and geometry are validated and retained by the server.

Legacy drafts receive deterministic positions in the editor. Conversion marks the draft unsaved, so Publish requires Save draft first. Existing published snapshots continue rendering their previous layout until explicitly replaced. Templates and copies receive independent geometry. Public pages omit editor grid dots, handles and controls. Content that exceeds a widget's authored height can scroll inside that widget.

Shift-click widgets or outline entries to toggle selection, or drag a box over empty canvas space to select intersecting widgets. Shift-box selection adds to the selection. Dragging or arrow-key movement moves the group with its spacing preserved, clamping the whole group at canvas bounds. Resize handles appear only for a single selected widget; inspector fields edit the primary widget.

Right-click a widget for Copy, Paste, Duplicate selection, Bring to front, Send to back, Select all and Remove selection. Right-click empty canvas to paste at that position. Copy/paste uses an internal editor clipboard that lasts until the editor closes; it does not read or write the operating-system clipboard. Ctrl/Cmd+A/C/V/D and Delete/Backspace work while focused outside text inputs. Copies receive fresh IDs and independent content/geometry. Layer actions preserve group stacking and leave reading order intact. Each group content action is one undo step; selection changes do not alter the draft. Removing a group requires confirmation. The existing 30-section/page limit remains in place.

The multi-selection inspector and right-click menu include the networking editor's six alignment actions, horizontal/vertical distribution, and matching width/height. Alignment uses the selection's outer bounds; matching uses the primary widget shown in the inspector. Distribution needs three widgets and sufficient room for equal nonnegative gaps. Arrangement is exact even when grid snapping is enabled. Matching that would exceed canvas bounds is unavailable rather than partially applied. Already-satisfied actions are disabled and create no undo entry. Each arrangement is one undoable draft edit.

Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes while focused outside text inputs; text fields retain native text undo. Selection and arrangement controls are also available from the Editor pane on phones.

The builder also supports appearance overrides, center rotation, standalone images, and nested row/column containers. Container membership uses optional `parentId`; child layout uses optional `container: { direction, gap }`. Children retain their grid geometry for detaching, but the container handles their displayed layout. Copying/removing a container includes descendants; hidden ancestors suppress descendants in preview and publication. See [Website Builder design](07-website-builder.md) for controls and limits.

This milestone matches the networking editor's basic coordinate, snap, move, resize, selection, arrangement, clipboard, layer and viewport interactions. Negative-coordinate workspace expansion, free-position nested canvases, frame editing, locks and breakpoint-specific geometry remain outside this implementation.

## Personal and role dashboards

Use Edit layout to add, move, resize through the width selector, or remove widgets. Save layout persists the whole layout; Cancel discards its local changes. Unsaved changes prompt before leaving or reloading. Removing a widget does not delete stored documents or shared resource records. Notes are part of the layout, so removing a Notes widget removes those notes when saved.

Available widgets: Documents, Role resources, Notes and Quick links. The default remains the single Documents widget. Up to 12 widgets are allowed; Documents, Role resources and Quick links are each limited to one instance. Notes can have multiple instances. Existing module interactions are suspended while editing the layout.

Admin can select the role to manage on the role dashboard. Resource widgets follow that selected role. A personal dashboard's resource widget uses its owner's current role. Layouts are independent of the underlying document/resource permissions.

## Storage and authorization

- `dashboardWorkspace`: authenticated callable with `load` and `save` actions.
- `dashboardPersonal/{uid}`: layout owned by the signed-in user. The server derives the UID and rejects supplied owner IDs.
- `dashboardRoles/{role}`: shared layout, readable by that role or Admin, writable only by Admin.
- Both stores contain widgets, version, last editor and update time. The UI receives only widgets, version and edit capability.
- The transaction reads the current user profile before authorizing access. Missing/inactive/unassigned accounts are rejected. Saves require the current version to prevent overwrites.
- Existing Firestore deny-by-default rules prevent direct access, including direct Admin writes. No rule relaxation is required.

## Verification and deployment

Run the full build, website unit tests, Website Builder/dashboard/SDS browser tests and `npm run test:website`. The latter includes dashboard owner isolation, non-admin write rejection, cross-role read rejection, invalid widget data, direct Firestore denial, concurrent saves and website-width persistence.

Deploy the updated `websiteBuilder` function and new `dashboardWorkspace` function before Hosting. Deploying the app does not publish website drafts or replace saved layouts. New layouts are created only on deliberate Save layout. The personal and role dashboard routes remain available for test users while their sidebar links remain hidden.


Website pages additionally support optional content-flow layouts, container child sizing, tablet/mobile overrides and scoped page CSS. See [Website Builder](07-website-builder.md#responsive-sizing-and-page-css). These additions apply only to Website Builder and its public renderer; they do not change personal, role or job dashboard layouts.
