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

## Local Forms addition — October 2

In the local Forms emulator profile, the existing Personal/Role palette additionally has one Form widget. Choose an issued template and Full-page launcher or Inline (up to eight fields). The layout pins the issued version; reselection is required to adopt later versions. Opening creates no draft. Inline and full-page share the same respondent component and owner record, and switching saves progress before navigating. Save errors keep the current view/answers. Existing personal ownership and Admin-only shared role editing apply; eligible employees respond as themselves even when a layout is shared. Form selection is excluded for Payroll/No Access. Photos remain in authenticated records and are not linked or attached in email.

This implementation does not add Forms to existing Jobs dashboards or redesign the Dashboard Builder. The job integration hook is the reusable FormDashboardWidget identity/presentation component; job-context ownership and placement are deferred. Form metadata contains no answers. Server validation enforces an issued available version, inline size and emulator-only operation. The Forms routes and widget component are DEV-only. **Do not follow the historical deployment instructions above for this checkpoint: no Forms release is authorized.** See [workspace design](03-workspace-design.md) for startup and verification details.


## Parallel shared dashboards - current local implementation, 3 October 2026

**Start here:** use the normal checkout and npm run dev:forms, then sign in through the local demo buttons at http://127.0.0.1:5173/login. Review /dashboards/role-home and /dashboards/job-home/dashboard-local-a (or choose another authorized job). Synthetic community-center/warehouse jobs belong only to the demo emulator. The old Jobs/job pages, /dashboard, /dashboards/personal and /dashboards/role retain their existing routes and behavior. New sidebar links remain hidden. Authentication and ordinary role/job authorization apply to direct URLs; no new guessed-URL development feature flag is requested. Plain non-emulator development refuses the new dashboard service calls. Nothing in this checkpoint authorizes deployment, production data/email, IAM or sidebar rollout.

### Core/current catalog and behavior

Both new surfaces offer the same catalog: Job tools (Timecards, Daily Logs, Shop Orders), Assigned jobs, Text, Calendar, Notes, Documents, Role resources and Forms. Each uses authorized data from the selected job or signed-in person; shared layout never aggregates a role's private records or grants access. Assigned jobs always means the viewer's authorized jobs on either surface. Job tools on Role home has an explicit authorized-job chooser. Documents reuses the existing general file explorer/viewer abstracted from SDS, including its existing authorized library/job chooser. Role resources is bound to the viewer's actual role. Multiple Text, Notes and Forms placements are allowed. Useful defaults preserve job tools/assigned-jobs navigation without requiring customization.

One shared template key, sharedDashboardTemplates/all-jobs, serves ALL jobs, independent of role. Each existing role has one sharedDashboardTemplates/role-{role} template. Subsequent loads/Refresh read the shared template; open dashboards do not poll for layout updates. Optimistic versions protect concurrent saves. New storage is separate from existing dashboardPersonal/dashboardRoles. Job notes/calendar events use sharedDashboardJobData/{jobId}; personal role-home notes/calendar use sharedDashboardUserData/{signed-in uid}, with role-specific keys. Existing job start/finish dates appear alongside that job's calendar; Role home dates are the person's own entries. Existing deny-by-default rules prohibit direct template/content writes. No roles or RBAC settings have been added.

Admin edits the global job template and any existing role template. For non-Admin roles, the per-role checkbox **Allow this role to edit its dashboard** defaults FALSE. Only Admin can change it. An enabled role edits only its own shared template, cannot select another role, self-enable or change editing permission. Revoking it takes effect in the next authenticated save/load check. Each employee may maintain their own notes/calendar independently of template-edit permission. Job note/calendar authoring remains Admin-only until job-content delegation is agreed. This optional role-editor permission is implemented locally; production access expansion still requires Atlas's explicit later release approval.

Normal viewing has no editor chrome. Edit reveals the palette, canvas and inspector, existing drag/resize/confirmation controls, widths, Undo/Redo and Desktop/Tablet/Phone preview. Fit defaults ON on entering Edit, persists through device/resize changes and only explicit zoom opts out. White canvas cards keep content styling readable. Text uses a browsable clickable supported-variable picker plus font size/color/weight/alignment/line-height controls. Supported tokens are job.name/code/gc/jobAddress/startDate/finishDate and user.name/role. No JavaScript or Vue evaluation; unavailable/unknown tokens appear clearly. Default job identity uses general Text with {{ job.code }} and {{ job.name }}. Titles, spans and safe styling are validated on the server. Unsaved layout/notes/calendar changes prompt before discard; dirty Forms save before navigation and retain answers on failure.

Forms reuse the existing versioned FormResponseWorkspace and issued definitions in launcher/inline presentations (inline remains at most eight fields). Opening creates no draft. New job Forms have optional immutable job context, job-specific draft/retry keys, authenticated job checks and correct return navigation. Owner/Admin record permission remains separate from layout sharing. Revoked job assignment blocks contextual draft/list/submission-viewer reads; unbound existing Forms keep their previous behavior. The narrow shared integration touches FormResponseWorkspace, formModel, formFunctions and formSubmissionViewer; it does not rewrite either builder or mature workflows. Issued/submitted definitions, answers/photos and email state remain durable/independent.

### Future/nice-to-have and verification

Weather is future only: current conditions and roughly seven-day forecast for the job site or the user's chosen/current location. Provider/source/permissions are TBD; no API integration or location tracking is implemented. Personal configurable desktops, larger inline forms, job-content delegation, live shared-template syncing, wider audits/refactors and old-page retirement are later work.

See [current workspace checkpoint](03-workspace-design.md#parallel-shared-dashboards---current-local-implementation-3-october-2026) for final test counts, source/preview verification, preservation boundary and production gates. The existing production dashboardWorkspace allUsers invoker repair is explicitly denied and remains unresolved. No deployment, production write/email, IAM expansion or sidebar rollout is authorized by this local checkpoint.
