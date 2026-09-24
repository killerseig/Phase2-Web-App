# First-phase implementation

Implemented locally on September 14, 2026 following the user's instruction to proceed. The three SDS backend functions and additive Storage rules were deployed to `phase2-website` on September 14 after the new UI reported `internal [0]`. Hosting was not deployed during this fix.

## Available surfaces

- `/dashboards/personal`: new Personal Dashboard containing only the document widget within the app navigation; the welcome panel and duplicate shortcut buttons have been removed at the user's request.
- `/dashboards/role`: the same compact document-widget-only layout as Personal Dashboard. The surrounding workspace panel, role tool grid, and shared resource section have been removed from this page at the user's request.
- `/safety/sds`: expanded document widget, without a surrounding page heading, description, or panel. Job context, folder, and search can be passed with `sdsJob`, `folder`, and `search` query parameters. Navigation context is preserved when expanding and returning during a session.
- Existing Jobs navigation, list, dashboard, three workflow options, components, services, and access policies are unchanged. Personal and Role Dashboard links are hidden from shared navigation until announcement; their existing URLs remain available to signed-in test users. Existing `/dashboard` and login landing behavior are retained.

## SDS workflow

Admin creates nested folders and uploads supported documents. **Add file here** opens the file picker directly; choosing a file immediately uploads it into the clicked folder using its filename, without a metadata form or Save step. Canceling the picker does nothing. Upload progress and errors appear above the widget; a successful upload selects the new file for preview. Rename/move/edit remains available afterward for optional metadata and display order. Admin can upload a new immutable revision, archive/restore files, and remove empty folders. Folders appear before files at each level; equal order values sort by name and stable ID. This order is shared by the explorer and exported book.

The explorer supports right-click menus for sheets, folders (in the sidebar and contents), and empty space. Three-dot buttons expose the same actions on touch devices; Shift+F10 opens the menu from a focused item, arrow keys/Home/End navigate, and Escape dismisses it and restores focus. Double-clicking a sheet opens its PDF. Admin master menus offer folder creation, SDS upload, rename/move/edit, PDF revision upload, archive/restore, and removal of empty folders. Creation uses the clicked folder as its destination. Job menus offer selection actions that remain drafts until Save selection. No menu grants master-edit permissions to job readers; the existing server authorization still applies.

All active workspace users can browse the master. Explicit job-context links open a job collection; the scope dropdown has been removed. Any job reader, including Payroll and Shop Foreman with read-only job access, can save that job's selections and export/print. Master mutations require Admin. Existing job-edit permissions do not change.

Job edit mode shows available master sheets with checkboxes and folder bulk selection. Save/Cancel controls changes; folder selection includes all descendants even under a search. New sheets do not enter existing job selections automatically. Read mode hides unchecked sheets and empty folder branches. Concurrent saves produce an explicit reload/review error.

Job selections pin the chosen revision. Publishing a new revision leaves prior selections intact and exposes a **Use latest revision** action in edit mode. Archived selected sheets remain visible for resolution and block book output until removed/restored. Removing job membership never deletes a master document or historical PDF.

**Make PDF / print book** captures the complete saved scope, including hierarchy, title, order, and revisions; search filters do not narrow the book. A background function produces one PDF with a cover, nested clickable table of contents, hierarchical PDF bookmarks, and complete source pages in their original dimensions/orientations. Source pages receive no overlays. The final PDF page positions match the contents page references, including multi-page contents.

The same book artifact can be downloaded or opened in the browser's PDF viewer for printing. Selecting an individual sheet displays it directly inside the widget as described below. The latest export for a scope resumes when the user returns; only one book can run per user at a time, and repeated requests with the same operation ID are idempotent. Missing/malformed source PDFs fail the whole book visibly rather than producing incomplete output.

### Compact explorer/viewer widget

The user confirmed that the reusable widget must use generic language. Its configurable title defaults to **Documents**; navigation, search, menus, selection notices, and empty states use **files**, **folders**, and **collections**, without SDS branding. The existing SDS data adapter remains the first content source. File support has now expanded as described below; new storage collections and general user uploads remain deferred.

The collection/job dropdown has since been removed at the user's request to simplify the widget. Ordinary page navigation opens company documents, and the widget no longer subscribes to the jobs list. Previously saved job scope is not silently restored. Existing explicit `sdsJob` links retain their job context; a future user-facing scope selector remains deferred.

The user clarified that the dashboard module should be a compact file explorer on the left and a file viewer on the right. The former document table, large metadata panel, separate scope toolbar, and duplicate Admin buttons have been removed. The header contains the title, search, and expand icon. The dashboard body is 440 pixels tall with independently scrollable panes; the expanded page allows more height. Both panes remain side by side on phones. Folders collapse/expand and contain their files directly. Selecting a file previews it without opening another tab; record editing also occupies the right pane.

The viewer uses locally bundled [PDF.js](https://mozilla.github.io/pdf.js/examples/) to draw one PDF page at a time, with pagination, zoom, fit-to-width, download, and open-original controls. File changes discard stale authorization responses; changing job context clears the previous preview. File-download/render failures show an explicit error, and Reload preview obtains a fresh authorized ticket. Unselected sheets can be inspected in job edit mode using the existing backend's current-master-revision fallback. Saved selections still preview their pinned revisions.

An additive Hosting rewrite, `/sds-file`, forwards to the existing `downloadSdsFile` function. Vite proxies the same path during development. This keeps preview requests on the app's origin while preserving ticket expiry and account/job rechecks; no public Storage permissions or CORS changes are needed. PDF.js workers, character maps, fonts, decoder assets, and their licenses are served locally. CSP permits WebAssembly compilation for PDF image decoders via `wasm-unsafe-eval`; JavaScript eval and iframe/object embedding remain restricted. The expanded file support requires deployment of all three document functions, additive Storage rules, and Hosting.

Verification includes rendered PDF pixels, two-page portrait/landscape navigation, zoom, source-fetch failure/retry, folder collapse/expand, a fixed dashboard height, mobile rendering, late-response isolation, and a production-assets check with actual Hosting headers. Fixtures are local sample PDFs, not safety instructions. The split widget is implemented locally and has not been published.

### Expanded file previews

- PDF: existing page navigation, zoom and fit-width controls.
- JPG/JPEG, PNG and WebP: still-image previews with zoom and fit controls.
- UTF-8 TXT: readable text. CSV: a table preserving quoted commas and multiline cells.
- DOCX: readable text through locally bundled Mammoth; download the original for images and full formatting.
- XLSX: worksheet selection and cell values through locally bundled read-excel-file; charts, images, full formatting and recalculation require the original application.

Office/text processing runs in a worker with a 20-second timeout, cancelled when switching files or leaving. Previews render text through Vue interpolation, without raw HTML or external document-viewer services. Text previews show up to 200,000 characters; table previews show up to 500 rows and 50 columns, with a notice when truncated. Original downloads retain the complete file. Legacy records without format metadata remain PDFs, and pinned job revisions retain their actual format even if the latest master revision changes type.

Books support PDFs and images. Images become fitted portrait/landscape letter pages; PDFs retain original pages. Other formats require explicit confirmation before exclusion, and the server records excluded files in the export. It refuses silent exclusions or an export with no printable files. Existing job-reader selection permissions and Admin-only master uploads are unchanged.

## Role resources

The role resource component and backend remain available for later dashboard composition, but are no longer displayed on the Role Dashboard. The page now matches Personal Dashboard's document-widget-only layout. Existing role resource records are retained. The reusable component supports Admin publishing of shared text and links, with other users reading their own role's resources; delegation and custom layout editing remain later work.

## Storage and operating defaults

- Admin uploads: at most 20 MB; TXT/CSV at most 2 MB and valid UTF-8 without binary control characters. PDFs must be readable, unencrypted, and at most 500 pages. Still images are decoded and limited to 40 million pixels.
- DOCX/XLSX uploads undergo archive and format checks: at most 30 MB expanded, 10 MB per entry, and 2,000 archive entries; macros and XML entity declarations are rejected. XLSX bounds are 30 worksheets, 10,000 rows, 200 columns, and 100,000 populated cells. Unsupported older Office formats are not accepted.
- Master library: at most 1,000 sheets, 200 folders, eight nested folder levels.
- Book: at most 100 MB of source files, 3,000 total pages, and a 750 KB captured entry manifest. Oversized books fail explicitly.
- Only Admin can create their own staged upload, and staged objects cannot be overwritten. Published files, revisions, selections, and export records have no direct client writes; all new Firestore collections retain the existing deny-by-default rules.
- File access uses five-minute opaque download tickets, stored only as hashes. The HTTP download handler rechecks the originating user's active status and job access on each request. No public Firebase download tokens or service-account signing grants are needed.
- Original SDS revisions and completed books are retained. Downloaded PDFs provide offline document access; offline app search/cache is not implemented.
- Expired ticket records are harmless because expiry is enforced on every request. Configure Firestore TTL on `sdsDownloads.expiresAt` for metadata cleanup when deploying; failed/abandoned staged uploads can be cleaned separately after an agreed retention period. Neither cleanup should delete published revisions or books.

## Verification

- Production app build and Vue/TypeScript checks.
- Functions TypeScript build and focused frontend lint.
- Focused unit tests for the explorer, navigation, existing dashboard components, and landing behavior.
- Local Firebase emulator tests for Admin uploads, master mutation denial, all job-reader selection/export roles, out-of-job denial, concurrent edits, revision snapshots, export idempotency/resume, ticket expiry/revocation, and unchanged job records.
- PDF checks for nested contents links/bookmarks, multi-page contents, Unicode/long titles, mixed source page orientations, and failure when any selected source is unavailable.
- Existing security-rule suite and existing Jobs/browser workflow regressions.
- New browser scenarios for saving/canceling selection, checkbox visibility, Admin controls, role resources, error isolation, expansion/return context, and a 390-pixel mobile viewport.
- Real production assets served locally with Firebase Hosting headers; Personal/Role/SDS routes render without page errors or CSP violations. Remote services are mocked for this smoke check; it makes no production data changes.

Commands: `npm run build`, `npm --prefix functions run build`, `npm run test:sds`, `npm run test:security-rules`, `npm run test:unit -- --run`, `npm run test:e2e -- e2e/sds-workspace.spec.ts`, and `node scripts/verify-sds-production.mjs` after building. Emulator tests require Java 21+ on PATH and use only `demo-phase2-security` on localhost.

## Deployment

Deploy the new functions and additive Storage rules before exposing the new pages. The new functions are `sdsWorkspace`, `generateSdsBook`, and `downloadSdsFile`; include `functions/assets/SourceSans3-Regular.ttf` and its license in the deployment package. Existing functions need not be redeployed. No Firestore rule changes, job migrations, or existing Job-page changes are required.

For an authorized production rollout, use `npm run deploy -- --only functions:sdsWorkspace,functions:generateSdsBook,functions:downloadSdsFile,storage`, then `npm run deploy -- --only hosting`. The initial backend deployment required `--force` to confirm the PDF worker's retry policy; its export leases and completion checks guard against duplicate processing. Hosting's existing build step remains in place. Verify with an Admin-provided sample SDS and authorized job reader after release; the automated checks use local fixtures and emulators.

### September 14 deployment fix

The live `sdsWorkspace` endpoint returned HTTP 404 because the new backend had not been deployed. Firebase successfully created `sdsWorkspace` and `downloadSdsFile` in `us-central1`, and the Firestore-triggered `generateSdsBook` in the database region `us-west3`. Only these functions and Storage rules were included in the deployment. After deployment, the workspace endpoint returned the expected HTTP 401 `UNAUTHENTICATED` for a signed-out request, and the download endpoint returned HTTP 403 for an invalid ticket. No production user records or SDS documents were created by these checks.

The local UI now hides the empty explorer and editing actions when its initial load fails, and displays a readable retry message instead of the raw callable error. The production build and four SDS browser scenarios passed after this change. This UI correction still requires a Hosting deployment for production users; the backend fix is already live. A signed-in production upload and export remain to be verified with an authorized user's sample.

Full dashboard customization, new leadership roles, website publishing, site visits, additional document types, and vendor/AI integration remain later stages.
