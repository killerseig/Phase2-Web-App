# Website Builder: first milestone

Implemented locally; updated September 19, 2026. Not deployed or announced.

## Entry points

- `/admin/website`: Website Builder in the Admin sidebar. Active Admin accounts only, enforced by navigation, route capability, and every editing callable. Other roles are redirected to Jobs and cannot call the backend directly.
- `/website`: published homepage. `/website/{slug}`: published pages, accessible without signing in. Employee Login links to the existing app.
- Existing root/login behavior, Jobs pages, and hidden Personal/Role dashboard links remain unchanged. Moving the public site to a production domain or the root URL is a later launch decision.

## Editor

Three areas: page/section outline, live draft preview, and content inspector. Admins can click preview sections or outline entries to edit. Page settings include title, URL slug, description, navigation visibility, and ordering. The homepage keeps the `home` slug. Shared website settings include name, accent color and logo. Navigation and footer content is configured on individual widgets. Logo descriptions are required for publication; logo images fit without cropping. Legacy pages retain their shared footer settings until converted.

Section types: hero banner, text, standalone image, image with text, photo gallery, cards, contact/call to action, container, navigation, and footer. Sections support headings, plain or formatted text, images and alt descriptions, optional links, ordering, hiding, and removal. A standalone image uses its heading as an editor name and renders only the image; its editor omits text/link controls. Galleries and cards support ordered items. Cards can represent projects, biographies, jobs, services, or news in this first version; a reusable record catalog is not implemented yet. Contact sections display content and links, not a submission form.

Desktop/mobile preview uses the same renderer as public pages. Links do not navigate away while editing; select pages in the outline. Mobile preview is constrained to 390 pixels and responds to narrower available space. The builder fills the available app workspace with a compact fixed toolbar and no outer page scrolling. The outline, center preview, and inspector each scroll inside their own bounded pane; the center preview keeps its toolbar visible and reserves room for a scrollbar. At widths of 900 pixels or less, Pages & sections, Preview, and Editor buttons switch between full-height panels. Other app pages retain their existing scrolling layout.

### Reusable image library

Image fields and the header logo offer **Choose from library** alongside uploads. The Admin-only chooser displays filenames and lightweight previews, with batches of 24 images and a Load more button. Search filters the images already loaded, as the label indicates. Selecting an image reuses its immutable asset; descriptions belong to each placement, so using a photo in multiple sections can have different descriptions. Cancel or Escape returns focus to the opening button. Legacy uploads without names display as Uploaded image.

New uploads retain their filename and create a separate private WebP thumbnail. Legacy uploads generate a small preview on demand without requiring migration. Thumbnails remain private; public pages use only images referenced by the published snapshot. Upload removal/deletion and renaming remain future library-management work.

## Draft and publication workflow

1. Edit locally; changes appear immediately in the preview.
2. Save draft. It remains private; saving does not alter published content.
3. Publish the saved draft after confirmation. Unsaved changes disable Publish. Publication updates the whole website atomically, including navigation.
4. Restore the previous published version to the draft for review, then publish deliberately if desired. One previous published snapshot is retained, separately from the ten saved draft revisions.
5. Take website offline removes public access to the snapshot and images while retaining the draft.

Unsaved changes prompt before navigation/reload. Concurrent admin updates use a version check and refuse to overwrite a newer draft. Failed saves retain the local edits; Reload offers explicit discard/review. Images upload separately and become immutable assets; removing one from a draft does not delete published or historical image content.

## Local editing tools

The widget library places widgets freely on a networking-style grid canvas. The design space starts at 24 columns of 45 px and 18 rows of 32 px, then grows to contain authored widgets. Widgets keep independent X/Y, width/height and layer values; eight edge/corner handles resize the selected widget. Grid visibility, snapping and horizontal/vertical spacing are editable in Page settings. Zoom, Fit, Pan, Space-drag and middle-button panning navigate the canvas. Arrow keys move widgets; Shift uses ten steps. The inspector also accepts exact geometry. See [widget layout design](08-widget-layouts.md) for persistence and compatibility details.

The page outline includes collapsible templates for Company, Projects, Careers, Services and Contact. Each creates a new editable page with starter headings, unique IDs and an unused URL; existing content is retained. Review all starter content before publishing. The blank-page button remains available.

Shift-click or drag a selection box to select multiple widgets and move them together. Right-click menus provide internal copy/paste, group duplication/removal and front/back layer actions. Toolbar buttons also expose group duplication and layer changes. Ctrl/Cmd+A/C/V/D and Delete/Backspace apply to widgets outside text inputs. Clipboard contents stay within the current editor session; copied widgets receive fresh IDs. Selection changes are not draft edits, and each group edit can be undone in one step.

The multi-selection inspector and right-click menu offer edge/center alignment, equal horizontal/vertical gaps, and matching width or height to the primary widget. Distribution requires at least three widgets and enough space; matching sizes cannot exceed canvas bounds. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y) undo/redo draft edits outside text inputs. Text inputs keep native text undo.

Page settings and section editors offer duplication. Copies have independent content and fresh IDs, while image assets are reused. A copied page's links to itself point to the copy. Other links are retained. The existing 30-page and 30-section limits apply.

Undo/Redo stores up to 30 local draft steps during the current editor session, grouping typing and keeping structural actions separate. Saving retains local history, so undoing a saved edit marks the draft unsaved again. Reloading or restoring a published snapshot resets local history. These controls do not reverse publication, upload/delete image files, or change server revision numbers. Publication remains a separate Save draft / Publish workflow.

## Appearance, rotation and containers

The Appearance and rotation inspector controls background/text/border colors, font family, text/heading size, text alignment, image fit, padding, border width, corner radius, opacity and rotation (-180 to 180 degrees). Blank values retain defaults. Reset controls remove overrides. Preview and public rendering use the same styles; copying widgets makes independent style objects. Rotation pivots around the center, including contained children. Selected widgets show a round rotation icon; drag it to rotate, holding Shift for 15-degree steps. With that handle focused, arrow keys rotate one degree (Shift: 15 degrees) and Home resets the angle. Root grid widgets retain all eight resize handles when rotated; resizing follows their local axes and keeps the opposite corner or edge fixed. Contained widgets can rotate independently while their size remains controlled by the container. Moving, resizing and rotation preview locally and commit one undo step on release. Escape or release outside the workspace cancels; Escape during a gesture retains selection. Width/Height and rotation number fields remain available for exact values. Move slanted objects inward from page edges to keep their corners visible.

Containers arrange children in rows or columns with a 0–160 px gap. Select siblings and choose Group in container to arrange them in a new row. Add a Container from the widget library for an empty container. Clicking a library widget while a container is selected inserts the widget into it; dragging from the library still places on the page grid. Each widget's Container selector moves it into or out of a container. Nested containers are supported, and the editor/server reject cycles or nonexistent/non-container parents. Children share available space; the container controls their size/position, and outline arrows control order. Ungroup promotes children to the container's parent. Returning to the page grid restores their stored grid geometry. Independent mobile geometry and free-position child canvases remain future work.

Container headings are editor names, not public headings. Hiding a container hides all descendants and excludes their private content/assets from publication. Removing a container confirms removal of its contents; copying/duplicating a container copies the entire subtree with fresh IDs and remapped parent references. The 30-widget page limit counts containers and children. Appearance, hierarchy and layout changes use the existing draft history, server version checks and explicit Save/Publish workflow. Server validation permits typed fields and bounded numeric values. The separate Page CSS editor accepts the scoped subset described below; HTML remains unsupported.

## Data and access

- `websitePrivate/state`: draft, version, timestamps, latest editor, and previous publication.
- `websitePublished/current`: public snapshot, published timestamp and its image allowlist. It contains visible sections only.
- `websiteAssets/{id}`: private upload metadata.
- Storage `website-images/{id}.webp`: server-owned normalized image bytes, without public download tokens.
- Existing deny-by-default Firestore/Storage rules prevent direct client access to all of these paths. No rule relaxation is needed.
- `websiteBuilder`: Admin-only load/save/publish/restore/unpublish/image upload/image preview/image listing. Image listing is paginated by document ID and returns metadata only, excluding uploader identity. Branding images use the same validation and public-image allowlist as section images.
- `getPublishedWebsite`: anonymous read of the published snapshot only.
- `websiteImage`: serves only image IDs currently referenced by the public snapshot, using a no-store response. An unpublished upload or hidden section image is inaccessible publicly. Public images can still be downloaded by visitors while published; taking a site offline cannot recall copies already downloaded.

Images: JPG/PNG/WebP up to 5 MB and 25 million pixels; decoded, stripped of metadata, resized to at most 2,000 pixels per side, and encoded as WebP, at most 2 MB. Image bytes pass through an Admin-only callable; there are no public staging URLs.

Limits: 30 pages, 30 sections/page, 12 items per gallery/card section, 100 referenced images, and 500 KB per site draft. Server validation rejects duplicate IDs/slugs, unsupported links, missing images and malformed payloads. Publication also requires visible content on each page, descriptions for images, paired link labels/URLs and valid internal links. Custom HTML and JavaScript are rejected; text is rendered with Vue interpolation. Page CSS uses the validated subset described below.

## Validation and deployment

Run `npm run build`, `npm --prefix functions run build`, `npm run test:website`, and `npm run test:e2e -- e2e/website-builder.spec.ts`. Emulator verification includes every non-admin role, inactive/missing profiles, direct database/storage denial, unpublished-image denial, public/draft isolation, validation, concurrent saves, restoring, and taking a site offline. Browser scenarios cover editing, image upload, page creation, cards, save/publish confirmation, public rendering, conflicts, mobile layout, and route/sidebar restrictions.

Deploy `websiteBuilder`, `getPublishedWebsite`, and `websiteImage` before Hosting. Hosting adds `/website-image` forwarding to `websiteImage` in `us-central1`; Vite proxies that path in development. Do not publish placeholder content as part of deployment. Content publication remains an explicit action inside Website Builder.

## Later milestones

Dedicated project/staff/career records, media-library renaming and cleanup, page-level publication scheduling, domain routing, and server-rendered/static output with sitemap/social metadata. Current public pages are client-rendered and use browser-set page titles/descriptions; search and social previews need a separate launch pass. Uploaded assets are retained for now, so an eventual cleanup policy must preserve current drafts, published content and retained revisions.


## Responsive sizing and page CSS

Page settings offers desktop free-grid or content-flow layout and separate tablet/mobile scale-or-flow choices. Existing pages keep their grid behavior until an admin changes these settings. Flow stacks root widgets in outline order, grows to fit content and uses configurable gap/padding. Containers retain row/column arrangement with wrapping, child alignment and distribution; children support grow proportions, percentage starting size, minimum height and self alignment. Position/resize editing remains available on the desktop free grid; flow order uses outline arrows.

Desktop, Tablet (820px) and Mobile (390px) preview buttons also choose the appearance/layout editing target. Tablet covers widths 768-1023px and mobile covers widths up to 767px on the public page. Content and hierarchy stay shared, while tablet/mobile can override appearance (including rotation), container layout, sizing and visibility. Missing overrides inherit desktop; Reset device overrides removes the selected device's settings. Global Hide section applies to every device and all descendants.

Page settings > Page CSS provides an editable starter template, live preview, validation messages and clearing. Widget CSS class accepts a single custom- name such as custom-feature. Stable selectors include .page, .page-header, .page-footer, .page-content, .page-brand, .page-navigation, .widget, .widget-title, .widget-text, .widget-image img, .widget-button and .container-items. Descendant/child selectors, comma lists, :hover and :focus-visible are supported. Width-based @media rules are compiled into named container queries, so they follow the preview width and public page width consistently.

This first editor accepts plain CSS, not Sass. The shared frontend/backend compiler scopes each selector to that page and restricts declarations to colors, typography, spacing, borders, shadows, image fit and flex/grid content layout. HTML, scripts, external URLs/imports, arbitrary selectors, positioning, transforms, nested rules and other at-rules are rejected. Canvas controls own placement/rotation. CSS overrides matching appearance controls using scoped important declarations. Maximum 12,000 characters and 100 rules per page; the existing total draft limit still applies.

While CSS is invalid, the preview retains its last valid styles and Save/Publish is disabled. CSS and device settings participate in local undo/redo and copies; saving keeps them private until deliberate publication. Server validation repeats the same checks and retains these fields in published snapshots. Deploy the updated website functions before Hosting so these fields are preserved; deployment itself does not publish drafts.


## Layers panel

The left sidebar has Sections and Layers views. Layers lists all page widgets from front to back, nesting container contents below their parent. Each row shows its widget type, stacking value and effective hidden state for the selected preview device. Equal stacking values follow paint order: the later sibling appears in front.

Drag a row grip above or below another sibling to change stacking order. Raise/lower buttons and Alt+Up/Down provide the same action without dragging. Container membership, content order, positions and sizes stay intact; use the Container field to move between containers and Sections for flow order. A container and its descendants move as one stacking group. The list scrolls near its edges during a drag; Escape, dropping outside the list, or dropping across container boundaries leaves the draft unchanged.

Single-click selects an object. Double-click, or press Enter on its name, selects only that object and scrolls the preview and any inner container to it. Hidden objects remain editable in the inspector without being automatically revealed. On phones, a single click keeps the list available; finding an object opens the preview. Layer edits use existing local undo/redo, draft saving and explicit publishing; selection and navigation do not alter saved content.


## Saved section library

The outline sidebar includes Saved sections. Admins select one or more widgets (or a container with its descendants), enter a name, and save a reusable copy. Entries can be renamed, previewed, inserted on the current page, or removed. Each insert makes fresh widget/item IDs and remaps nested containers, retaining content, immutable image references, appearance, device overrides, CSS class names, sizing and relative geometry. Edits to a source, inserted copy or library name do not propagate to the others.

Inserted roots are placed below the page's existing root widgets and selected for editing. Group stacking is preserved and normalized within the existing numeric limits. The current page limit of 30 total widgets includes nested contents. Each library entry holds 1-30 widgets, with up to 20 entries per site and 80 characters per name; the entire draft remains capped at 500 KB and 100 referenced images, including library images.

Previews use the existing widget renderer and authenticated image previews. They show desktop appearance and temporarily reveal hidden widgets for inspection; the saved visibility settings remain intact. Page CSS is not copied into the library or applied to this preview. CSS class names are retained so inserted widgets can use the destination page's rules.

Library changes participate in local undo/redo and are persisted with Save draft under websitePrivate/state. Server validation applies the same content, hierarchy and layout checks as page widgets and verifies library image references. Published snapshots exclude the entire savedSections field and only allow images actually referenced by published pages. Library-only content and images therefore stay private. Restoring an older published website preserves the current saved library. Removing a library entry does not remove inserted copies or uploaded assets.

Deploy the updated websiteBuilder function before Hosting for the new field to be retained on saves and restores. Deployment does not publish drafts. Unit tests cover detached trees, IDs, independent copies and placement limits; browser tests cover the full workflow and phone image previews; emulator tests cover validation, missing images, private/public separation and restoration.


## Blank pages and optional navigation/footer widgets

A fresh website and each blank page start with no widgets and `chrome: 'widgets'`. The renderer does not insert a header or footer on these pages. Templates include editable navigation, hero, content and footer widgets with content-driven layout. Navigation and footer widgets support normal grid placement, resizing, rotation, layers, containers, duplication, hiding, removal and saved sections.

Navigation widgets can show the shared website name/logo, automatically list pages marked for navigation, optionally include Employee Login, and contain custom links with one dropdown level. Footers use the same link editor and a local text field. Up to 12 top-level menu links and eight children per dropdown are supported; HTTPS, email, telephone and existing website page links use shared validation. Dropdowns are keyboard-operable disclosure controls. Copies keep independent links; page copies remap self-links in buttons, menus and formatted text.

Existing published pages keep the legacy header/footer until deliberately republished. Opening a legacy draft converts its chrome into editable widgets, copies the shared footer text/links, and offsets root widgets by four grid rows without altering contained child geometry. The conversion is a draft change that requires Save before Publish. The marker prevents deleted chrome widgets from reappearing on reload. Legacy pages with more than 28 widgets or insufficient space at the grid's lower limit stay intact and display instructions to make room before converting on reload.

## Formatted text and image placement

Text fields offer an opt-in formatting toolbar for bold, italic, headings, bullet/numbered lists and links. The editor displays Markdown-style markers; the preview renders the result. Existing plain text stays plain. A small shared parser creates Vue text nodes and approved formatting/link elements, never raw HTML. Invalid link schemes remain literal text. Internal links are checked again when publishing.

Image placements have horizontal/vertical focal points, crop zoom (1-3), captions, overlay color and opacity (0-80%). These settings affect rendering without changing the stored upload, and are independently copied with widgets, items and saved sections. Reset removes placement effects.

## Layout locking, revision history and publishing checks

The inspector's lock prevents direct movement, resizing and rotation, including keyboard/group gestures and numeric fields. Container locks apply to descendants. Content can still be edited; locking is an editing convenience, not an access-control boundary. Page/container layout changes can still reflow content. Unlock the container to adjust an inherited lock.

Saved draft history lists the latest ten saved or restored draft snapshots, including the private saved-section library. Restore replaces the draft, increments the concurrency version and records a new snapshot, leaving publication unchanged. Unsaved edits use the existing discard confirmation. Revisions are stored under `websitePrivate/state/revisions`, readable/restorable only through the Admin callable; direct client access remains denied. Concurrent saves/restores use the same transaction/version check. Older revisions are pruned atomically. Drafts saved before this feature are not backfilled.

Publishing checks identify empty pages, missing image descriptions, incomplete buttons/menus and broken internal links. Errors block Publish while allowing unfinished drafts to be saved; missing descriptions and pages with no main content are warnings. Hidden content and the private saved-section library are excluded. Backend publication validation repeats the checks that block publication.

Deployment order: update website functions before Hosting so the new fields and revision actions are supported. This implementation has not been deployed or published.
## Custom widgets

Admins can now create visual widgets from selected built-in widgets or containers, or create static HTML/CSS widgets. Custom widgets appear beside the built-in library and can be added as linked placements or independent copies. A linked placement shares the library design; changing that source updates every linked placement in the draft. Independent copies and detached placements retain their own design. All changes participate in existing undo/redo, Save draft, revision restoration and explicit publication.

The source editor has a live preview. Visual sources retain the captured group geometry and container hierarchy, with controls for source content, images, appearance, geometry, containers and additional built-in widgets. The group renders as one resizable/rotatable placement; its inner canvas scales with the placement width. Internal layout is authored in the source. Page CSS remains page-specific and is not copied into the design. Custom widgets cannot contain other custom widgets in this version.

Designers can expose up to 20 named settings. Visual settings target a source widget's heading, text, image, image description, button label/link or background/text color. Each placement inherits the source default until a local value is supplied; Use default clears that override. Image descriptions can be exposed separately from the image setting. Code widgets expose text and color settings using `{{setting_key}}`; text placeholders belong between HTML tags, and CSS placeholders accept only colors. Changing/removing a setting key removes that old override from linked placements.

HTML/CSS widgets use a quoted-attribute, static HTML subset and isolated sandboxed frames. No JavaScript, event handlers, forms, embedded pages, document-level tags, external resources or CSS resource loading are supported. Text values are escaped; color values must be six-digit hex. Static images can use embedded PNG/JPEG/WebP data; visual widgets support the existing image library. Links support the existing permitted URLs and navigate the top page only after user activation. The builder preview suppresses interaction with frame contents. HTML is limited to 20,000 characters and CSS to 12,000. Hosting allows same-site frames for srcdoc rendering; each frame applies its own restrictive policy in addition to the application policy.

There can be 20 custom designs per website, with up to 30 built-in widgets per visual design. Each placed custom widget consumes one of the page's 30 slots; existing draft size/image limits still apply. A design with linked page or saved-section placements cannot be deleted until those placements are detached or removed. The private library is included in saved draft revisions. Restoring a previous public snapshot keeps the current private library.

Publication resolves each used placement into an independent public snapshot, applying its local settings and removing hidden source content. Unused designs, unneeded setting defaults and the custom library remain private. Images from hidden or unused designs are excluded from the public image allowlist. Publication rejects invalid internal links, missing image descriptions and unresolved/missing custom sources. Expanded publications are limited to 900 KB to remain within storage document limits.

Deploy updated website functions and Hosting together (functions first). Browser, unit and emulator tests cover linked updates, local settings, detachment, copies, saving/reloading, validation, publication, hidden/private content, and sandbox rendering under production Hosting headers. This update has not been deployed.

## Public forms and admin inquiries

The Public forms library adds reusable form widgets to pages. Admins configure labels, required fields, text/email/phone inputs, multiline messages, dropdowns and checkboxes. Each definition supports up to 12 fields; a site supports 20 definitions. Multiple placements share their definition. Forms cannot be captured inside custom widgets in this version. Preview fields are disabled to prevent test inquiries while editing.

Each form has private To, CC and subject settings, plus a selected email field for Reply-To. Notifications use the existing application Microsoft Graph sender and secrets. The visitor email is Reply-To, never the sender or a recipient supplied by the public request. Empty To is allowed in unfinished drafts but blocks publication of visible forms. Save draft retains private changes; Publish atomically activates the public schema and server-private routing. Public responses omit delivery settings and unused forms. Restoring previous public content keeps current private routing settings for matching forms.

Anonymous visitors submit through `submitWebsiteForm`. The server validates values against the currently published form, stores the inquiry, then `deliverWebsiteFormEmail` attempts delivery after creation. Success means the inquiry was received, not that email delivery is confirmed. Stable submission IDs prevent duplicate inquiries on network retries. A honeypot and limits of 10 accepted submissions per IP per hour and 200 per site per hour provide basic abuse controls; these do not replace a future CAPTCHA if traffic requires one. No public attachments are supported.

View form submissions opens an Admin-only inbox with paginated inquiry details and delivery status. Failed or disabled notifications retain their answers and can be retried. A retry uses the original recipient snapshot; the confirmation explains that an ambiguous previous delivery can cause a duplicate email. A delivery lease prevents concurrent attempts and permits manual recovery after ten minutes. Sent notifications cannot be resent through this action. No automatic deletion or retention policy is enabled.

Data remains server-managed: `websitePrivate/publicForms` stores active private routing, `websiteSubmissions` stores inquiries and delivery attempts, and `websiteFormLimits` stores counters with hashed IP identifiers. Existing deny-by-default rules prohibit direct client access. `websiteFormAdmin` enforces active Admin access for listing and retrying. No email addresses, inquiry answers or credentials are added to public snapshots.

Deployment requires the updated website functions plus `submitWebsiteForm`, `deliverWebsiteFormEmail` and `websiteFormAdmin` before Hosting. This update is local and has not been deployed. Root URL/domain changes remain on hold; `/website` and `/website/{slug}` remain the public entry points, with Employee Login leading into the existing account-required app.

Validation covers public/private isolation, form validation, idempotency, rate limits, authorization, failed/disabled delivery, retries, escaped email content and To/CC/Reply-To formatting. Run `node functions/scripts/smoke-website-form-email.cjs` for the mocked Graph routing check in addition to the build, website unit/browser tests and `npm run test:website`. Tests intercept email delivery and do not send real messages.

## Accordion, tabs, video and document widgets

The widget library includes Accordion / FAQ, Tabs, Video and Document downloads. They share the existing grid placement, rotation, appearance, responsive layout, duplication, saved sections and visual custom-widget workflows. Accordion, tabs and downloads support up to 12 items with add/remove/reorder controls. Empty or incomplete content can be saved as a draft; publishing checks flag it in both normal placements and resolved custom designs.

Accordion entries use native expandable details. Tabs have named panels, a single tab stop, arrow-key navigation and Home/End navigation; headings wrap on small screens. Item content supports the existing formatted text, image and link controls. These interactions work in the builder without dragging the widget; Move, resize and rotation controls remain available.

Video accepts public YouTube/Vimeo links or HTTPS MP4/WebM URLs. Provider URLs are normalized to approved embed hosts, and arbitrary iframe URLs are rejected. Visitors explicitly choose Load video before any player is loaded. Builder previews keep playback disabled. The original video link remains available as a fallback. Hosting permits the two video embed hosts and HTTPS media; embedding restrictions or unavailable media at the source can still prevent playback.

Document downloads display a named list of public HTTPS document links, optional descriptions and configurable link labels. Files are hosted at the supplied address; this widget does not upload documents or expose private app files. A host may open a document in a new tab instead of forcing a download. The inspector and public link describe this behavior.

Validation includes shared frontend/backend publication checks, normal and custom source rejection cases, browser editing/save/publish and mobile interaction, plus production Hosting-header checks using mocked video hosts. Deploy updated website functions before Hosting to accept the new widget types. This work remains local; no launch URL changes or deployment were performed.

## Component widget library

The editor now includes 14 additional component types: Button, Icon, Divider, Spacer, List / checklist, Badge, Notice / alert, Team profiles, Testimonials, Statistics, Logo strip, Chart, Timeline and Progress bars. Existing cards, forms, containers and interactive/media widgets remain available. The main picker supports text search and Basic, Layout, Company, Media, Interactive and Data categories. Forms have a picker shortcut as well as their existing shared-definition library; they retain the private recipient and submission handling described above.

Company and data widgets use the existing item editor with add/remove/reorder controls (12 items maximum). Profiles have a role/title, testimonials have attribution, timelines have a date/milestone, statistics have a numeric value and unit/description, and progress items have percentages. Lists support bullets, numbering or checkmarks. Buttons/badges/notices support solid and outline variants; company collections support one to six columns, reducing columns on narrow widgets. Shared appearance, responsive positioning, rotation and custom page CSS still apply. Icon selection comes from a fixed icon library. A spacer shows an editor label and renders no public text.

Charts use manually entered labels and values, with bar, line and donut views. SVG rendering introduces no third-party chart dependency or external data requests. An adjacent semantic table provides exact values independently of color or chart interpretation. Bar/line charts support negative and zero values; donut charts require nonnegative values and a positive total. Progress is restricted to 0-100, and numeric data must be finite and within plus or minus one billion. These are presentation widgets, not live job analytics or spreadsheet integrations.

The new data/settings participate in draft saving, publication, copies, saved sections and reusable visual custom-widget source editing. Shared frontend/backend validation covers item labels/content, icon selection, column limits and numeric/chart constraints, including nested visual sources. Publication blocks incomplete required content while unfinished widgets can remain in drafts. Existing page/item/draft limits remain unchanged.

Validation includes unit tests for chart geometry and accessible data tables; browser coverage for adding all fourteen types, configuration, publishing and mobile layouts; server acceptance/rejection checks for normal and custom placements; and production Hosting-header checks. Updated website functions must be deployed before Hosting to accept the added types and fields. This implementation has not been deployed and does not change public launch URLs, Jobs, or existing submission workflows.

## Compact component widgets

The next additions are independent Card, Profile card, Metric tile, Progress ring, Sparkline and Data table widgets. A card holds its own image, title, description and link; a profile card edits a single person directly. Metric and progress widgets use a value on the widget itself. Sparkline and table widgets use labeled item rows. These are small components that can be moved, resized, rotated and composed inside containers or reusable visual widgets, with no required collection heading or full-width section wrapper.

New compact components start with 12px padding, an 18px heading, a thin border and rounded corners. Default grid sizes vary by component: metric 6x5, profile 6x10, progress ring 6x7, sparkline 8x6, card 8x11 and table 10x10. These are editable initial sizes; saved geometry and appearance are retained. The initial chart size is now 10x9. Existing saved sections are not automatically resized.

Chart options now include Area, filling against the actual numeric zero baseline. New charts place their exact values under a keyboard-accessible View chart data disclosure. Always show chart data expands the table as part of the component; older charts without this setting retain their visible table. Sparklines use a short graph with a separate View data disclosure. Both retain semantic tables for exact values. Data tables provide label, details and optional numeric value columns. Progress rings expose progressbar semantics and enforce the same 0-100 bound as progress bars. Metrics preserve zero and negative numbers.

Frontend and server checks validate the new types/settings and standalone values. Tests cover compact sizing, custom-source persistence/validation, editing, saving, publication, chart disclosures, mobile overflow and production rendering. Deploy updated website functions before Hosting. These changes remain local and do not modify Jobs or public URL routing.

## Shared design and homepage quality prototype

Website style > Shared design adds opt-in, site-wide page/widget colors, text colors, button text color, body and heading fonts, body size, line height, button radius, default flow spacing and flow content width. Individual appearance overrides and explicit page spacing remain in force. Existing websites without a theme retain their prior styling. Design edits participate in draft/history/publishing; the backend validates a bounded color/font/number contract. Disabling shared design removes the theme without rewriting pages or widget geometry.

Basic readability warnings compare the configured body/background, body/surface, secondary-text/surface and button/accent color pairs. These warnings are guidance, not a complete accessibility audit; image backgrounds, custom CSS, opacity, widget-specific colors and all interaction states still require review. Invalid design values block publication and are rejected by the server.

Public and builder views now load the same bundled fonts from the global stylesheet. The first visible built-in hero image uses eager loading and high fetch priority on public pages; other website images remain lazy-loaded. Stretched cards inside flow containers align in height and keep their links at the bottom. Duplicating a widget now copies its component settings independently, fixing shared chart-option edits between copies.

`e2e/fixtures/homepagePrototype.ts` composes a local Phase 2 homepage entirely from supported editable widgets, shared design and page CSS. It uses existing placeholder photography and clearly marked draft copy. The prototype and its placeholder companion pages are test fixtures; they do not populate or replace a real Firebase draft. No content is deployed or published by this work.

Run `npm run test:e2e -- e2e/homepage-prototype.spec.ts` with `PLAYWRIGHT_HEADLESS=1` to review the prototype. It validates the fixture with the backend model, edits/saves/publishes through mocked endpoints, checks desktop/mobile flow, equal-height cards, fonts, hero loading and keyboard navigation, and writes desktop/mobile screenshots to `.security-work/homepage-desktop.png` and `.security-work/homepage-mobile.png`. Website units, full builder browser tests, emulator tests and production-header checks cover the surrounding changes. This demonstrates the editor workflow and exposes design gaps; it is not a claim of a complete production site or an independent accessibility/performance certification.

## Content, Design and Code editor modes

The builder now opens in Content mode and remembers the chosen mode for the current browser tab session. Modes share a single draft and undo history; changing modes does not save, publish, convert widgets, or alter authored layouts.

- **Content:** Page selection and content fields, images, links, collection entries, form settings, and custom widgets' exposed placement settings. Layout handles, the widget catalog, layer tools, source editors, and widget/page removal are omitted. Pointer, context-menu and keyboard layout operations are also gated.
- **Design:** Existing widget creation, templates, reusable visual widgets, layers, grouping, drag/resize/rotation, responsive layout and appearance controls. HTML/CSS custom widgets can be placed; their source is edited in Code.
- **Code:** Page CSS with the existing starter template, live validation and preview, widget CSS classes, and custom HTML/CSS creation/source editing. This is scoped plain CSS and sandboxed custom HTML/CSS, not Sass, JavaScript, or an arbitrary whole-page HTML round-trip editor.

Existing site-wide name/logo, accent and theme controls have moved from Page settings into **Site settings**. Shared design controls appear in Design mode; name/logo remain available in Content. Page settings retains the page title, URL, description and navigation membership, with structural controls in Design. No new site-wide CSS, favicon, contact-data schema, domain/launch settings or email defaults are added by this change.

The mode selector remains available on narrow screens alongside the existing Pages & sections, Preview and Editor panel switcher. Mode preference is optional browser storage and is not part of the site's persisted data or an authorization boundary. Website Builder continues to require admin access.

Browser regression coverage checks mode defaults, shared draft preservation, layout shortcut guards, CSS preview/persistence, undo, session preference, mobile overflow, shared settings, and editing exposed HTML/CSS-widget content without source controls. Existing builder tests explicitly enter Design or Code as appropriate. All browser submissions are mocked; this work does not deploy or publish a real website.

Validation for editor modes: production build and scoped source ESLint passed. The 35-test browser run passed 33 checks and identified two test assumptions about old control locations/initial draft normalization. After correcting those assumptions, all four affected mode/CSS/custom-widget checks passed. The mobile Content-mode screenshot was visually reviewed at 390 px width. No backend contract or production data changed.

## Shared site layout and site/page code

The builder now has **Current page** and **Site layout** editing scopes. Admins explicitly create the shared layout; existing pages retain **No layout** until assigned **Default layout** under Page settings. New pages use the shared layout when one exists. Navigation and footer remain editable widgets. The layout flows around exactly one visible root **Page content** slot; it cannot be removed, duplicated, nested or hidden. No domain or landing URL settings were changed.

Code mode edits layout/page HTML, site/page CSS, and site/page JavaScript. HTML fragments preserve visual widgets through `<website-widget id="existing-id"></website-widget>` references. The shared fragment contains one `<page-content></page-content>` slot. Authors can add supported static HTML wrappers, content and controls around those references. HTML is parsed into validated Vue nodes, never injected into the employee application's DOM with `v-html`. Scripts/event attributes, arbitrary embedded documents, inline styles and Vue expressions are not accepted in HTML. Visual structure changes reconcile widget references within the same undo step; page duplication remaps IDs. Reset to visual widget order removes authored wrappers without deleting widgets. Site CSS applies before scoped page CSS. CSS remains the supported plain-CSS subset, not Sass.

JavaScript runs as classic scripts after the rendered website mounts: site first, then current page. Save validation checks syntax without executing code on the server. **Run code preview** captures an explicit snapshot; stop and run again to test later edits. Script errors appear beside the frame. Scripted public pages render using the same Vue widget components in a separate `/website-runtime.html` document. Replacing that document clears the old script environment, timers and listeners.

The runtime is sandboxed without `allow-same-origin`. Its document response also enforces the sandbox, including on direct navigation. Only its dedicated route permits inline script execution; the application CSP is unchanged. The runtime blocks fetch/WebSocket connections and direct form actions. Vue form events use a narrow parent bridge limited to forms on the displayed page/layout, with preview submissions disabled, source-window/token checks, bounded in-flight requests, existing submission IDs and server validation. Email routing stays outside the runtime. Private image access occurs in the parent only for referenced website assets; scripts receive rendered website content and image data, not Firebase sessions. This boundary follows the browser's [sandbox model](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Headers/Content-Security-Policy/sandbox).

Runtime static assets have public CORS headers because opaque sandbox documents load compiled modules/fonts anonymously. External script libraries, external API calls, arbitrary app access, and whole-page Vue source compilation are not supported. This is an HTML/CSS/DOM-JavaScript authoring interface with retained widget components.

Validation covers optional shared layout persistence/publication, slot/HTML/script rejection, visual/code synchronization and undo, public layout rendering, parent/storage/network isolation, fresh page script state, public forms and disabled preview submissions. Production smoke tests serve built files with the actual route-specific Hosting headers. All service and email interactions in browser tests are mocked; server tests use local Firebase emulators. No production deployment or real email was performed.

## Editor usability: first refinement pass

The reference review used the neighboring Networking-Application repository's `AutomationWorkbenchLayout.vue`, `DashboardView.vue`, `DashboardWidgetLibraryDock.vue`, and `DashboardWidgetPropertiesInspector.vue`. Its collapsible work areas, dedicated widget library and selection-specific inspector informed this change; no networking source files were modified.

External references were [Framer's editor interface](https://www.framer.com/academy/lessons/framer-interface), [Webflow's Navigator](https://help.webflow.com/hc/en-us/articles/33961320786451-Navigator), and [Webflow's Add panel](https://help.webflow.com/hc/en-us/articles/33961270096659-The-Add-panel). Their separation of page navigation, insertion, hierarchy and selected-object settings supports organizing the current feature set into task panels.

- **Pages:** page creation/templates, shared-layout scope, and the current page's content order.
- **Widgets:** searchable component catalog, forms, saved groups and custom widget authoring. The duplicate Section type/Add section picker is removed.
- **Layers:** the existing hierarchy, selection, reveal and stacking tools in Design mode.
- **Publishing:** checks, draft revisions, reload and recovery operations. Save and Publish remain explicit header actions.

Content mode presents Pages and Publishing. Design adds Widgets and Layers; Code includes Widgets for custom source authoring. Selected custom-widget placement fields remain accessible in Content mode. Switching tools changes only editor UI, preserving the draft and selection.

Desktop users can collapse either side panel or focus the canvas by hiding both. Selecting a canvas object reopens its inspector. Phone users retain the panel switcher. The empty canvas provides a direct path to adding the first widget. Content fields precede the grouped Layout & appearance controls, and selection actions appear only while objects are selected. Widget insertion, dragging, rotation, responsive settings, code, saved designs and publishing retain their existing data contracts.

This is the first usability pass, not a replacement of the existing feature set. Further refinement can address inspector field grouping, keyboard discoverability and additional visual polish after using the editor to build the real homepage. No public URL, Jobs workflow, production content or deployment changes are part of this pass.

Validation: all 39 builder browser scenarios passed across the regression run and focused reruns after adapting tests to the new control locations. Coverage includes independent pane scrolling, mobile insertion, panel collapse without lost edits, saved-widget rename/restore, layer ordering, drag/resize/rotation, shared layout/code, public forms and deliberate publishing. Desktop and phone screenshots were reviewed. Type checking and scoped ESLint passed; production builds retain the existing non-fatal bundle-size warnings. Browser writes and email requests were mocked.

### Widget inspector refinement

Design mode now separates the selected widget's settings into Content, Appearance and Layout tabs. Content holds text, media, links, entries and widget-specific options; Appearance holds colors, typography, spacing and rotation; Layout holds grid geometry, containers, visibility and locking. The selected widget's title and tabs remain visible while its fields scroll. Duplicate and Remove remain available beneath the active panel, retaining the existing deletion confirmation.

Content mode keeps the direct content editor without the extra tabs. Changing editor mode or selecting another widget resets to Content. Tab changes preserve the same draft and undo history; keyboard users can navigate the tab strip with arrow keys, Home and End. Responsive settings retain the existing inheritance behavior. This change reorganizes controls without changing the stored website schema, public renderer or publishing flow.

Validation: production build, type checking and scoped source lint passed. All 40 browser scenarios passed across the main regression run and focused reruns after updating test navigation. The new scenario checks keyboard tab navigation, content/geometry/rotation persistence, mobile sizing and Content mode simplification. Desktop and phone screenshots were reviewed; all saves, publication and form requests in these tests were mocked. No deployment was performed.

### Compact builder workspace

The builder opts into a compact app shell with one editor toolbar in place of the separate console header and Ready footer. Its navigation button opens the existing sidebar on smaller screens. Title, draft state, editor modes and save/publish actions remain available. Routine messages use a dismissible, scrolling status strip below the workspace; errors retain visible alerts above it. Other app pages retain their existing shell.

Validation: production build and scoped lint passed, along with seven browser scenarios covering desktop/mobile layout, independent panel scrolling, navigation access, editor modes, selection and save conflicts. The layout checks require the workspace to start within 80 pixels of the top on desktop/tablet and 150 pixels on a phone, and occupy more than 78% of viewport height. Desktop and phone screenshots were reviewed. No deployment was performed.

### Canvas controls cleanup

Canvas controls are grouped into panel visibility, zoom/pan and device preview. Icon buttons retain accessible names, tooltips, pressed states and visible keyboard focus. The selected widget's name (or selection count) appears beside compact duplicate, layer-order and grouping actions, plus a deselect button. Long names truncate without displacing actions; touch controls remain larger on phones. Code preview keeps its explicit Run/Stop label.

Validation: production build and scoped lint passed. Seven browser scenarios passed covering selection, grouping, clipboard, undo, editor modes and independent scrolling. Updated layout assertions check that the controls fit in one row on desktop and phone, and deselecting preserves the widgets. Reviewed desktop/mobile screenshots after sidebar transitions. No deployment was performed.

### Iterative workflow review — September 23, 2026

Four review/fix/verification passes covered the current editor:

1. **Responsive canvas:** zoom now affects desktop, tablet and phone previews. Fit uses the selected device's width and the actual available canvas space. While Fit is active it follows panel and viewport resizing; manual zoom remains under the user's control. Fitting waits until a hidden preview is visible and does not interrupt an active widget gesture.
2. **Widget discovery:** catalog entries include icons and short descriptions. Search includes those descriptions, making terms such as photo and graph useful. Filters remain available while scrolling, with a result count and a Clear filters action. Click/drag insertion still uses the existing widget definitions.
3. **Publishing correction:** errors and suggestions are visible when opening Publishing. Each check identifies its owning widget or page, including items inside collections and repeated placements of custom widgets. Selecting a check opens the appropriate editor and preserves access to the remaining checks. Shared-layout errors no longer navigate to a nonexistent page. A badge indicates blocking checks.
4. **Site code access:** Code mode's Site settings exposes site-wide CSS and JavaScript without requiring a shared layout. Site CSS is checked once and its error points back to these settings. Page-specific code and shared-layout HTML retain their existing editors.

The [editing guide](09-website-builder-guide.md) documents the owner workflows and draft/publication distinction.

Validation: all 42 scenarios in the full Chromium builder regression passed, followed by six targeted passing scenarios after adding site-code access (43 distinct scenarios total). All 76 website unit tests passed, with affected publishing tests rerun after the final change. Production builds and scoped lint passed. Browser checks cover draft save/publication, image reuse, templates, grid gestures, selection, grouping, clipboard, history, responsive views, custom widgets, public forms, code isolation and shared layouts. Desktop/phone screenshots were reviewed. Builds retain existing non-fatal bundle-size warnings.

This is a locally verified editor build. No production deployment, real email, vendor integration, or company content publication occurred. The tests do not establish production-service availability or approve the design/content of the company's eventual public site.

### Content mode and owner workflow

Content mode now edits exposed custom-widget fields directly in the main inspector. The component library remains in Design/Code mode. Copy explains the difference between shared design and placement-specific content, and shared-layout edits display their wider impact. Custom image uploads also propagate their busy state to the builder.

Image and button/video/download fields are grouped. Empty optional groups begin collapsed in Content mode; existing content and Design controls remain accessible. Internal image/navigation headings, decorative layout labels and the page-layout selector are omitted from Content mode. Containers and page-content slots explain how to select the content they contain.

The header distinguishes loading, unavailable, unsaved, saving and saved draft states. Save remains disabled during the request, errors preserve edits, and editing again clears an obsolete saved-success message. The owner walkthrough checks links, image/decorative fields, inline custom content, isolation between linked placements, delayed saves, save conflicts and phone layout. All 44 browser scenarios passed, followed by the owner scenario after final inspector styling. Scoped lint passed; no deployment or real email was performed.

### Inline text editing

The builder lazy-loads a restricted Tiptap editor for the main headings and paragraphs in the existing hero/text/image-text/contact/gallery/cards renderer. Content and Design modes both use click-to-edit. In Design, Shift-click preserves widget selection and ends any active text edit before changing the selection. Text editing suspends grid gestures and keeps typing shortcuts local; finishing the edit restores layout gestures. A fixed floating control group follows the edited text without inheriting canvas zoom and remains within the viewport on phones.

Headings remain plain single-line titles. Body text supports bold/italic, heading levels 2/3, flat lists and validated links. The editor adapts to the existing text/markdown contract; it does not save arbitrary HTML or introduce a new site schema. The shared safe renderer now supports escaped literal punctuation and nested bold/italic needed for rich-text round trips. Pasting imports plain text. Transactions exceeding the existing 160/8,000-character limits are rejected without truncating prior content.

Canvas changes update the same draft fields as the inspector. Text undo/redo works while editing, and a completed inline session becomes one main-history action. Outside clicks end editing before Save draft runs. Shared-layout scope, public read-only rendering and explicit publication remain intact. Collection-item text, compact widgets, custom source, captions and buttons retain the existing editors in this pass.

Implementation reference: [Tiptap Vue 3 integration](https://tiptap.dev/docs/editor/getting-started/install/vue3) and [StarterKit extensions](https://tiptap.dev/docs/editor/extensions/functionality/starterkit).

Validation: production build and scoped lint passed (existing bundle-size and test-style warnings remain). All 82 website unit tests and the full 48-scenario Chromium builder suite passed. Six targeted scenarios passed after preserving Shift-click selection, including a new keyboard/formatting scenario (49 distinct browser scenarios total). Coverage includes inline/sidebar synchronization, editing-session undo, local text undo, links, lists, heading styles, plain-text paste, character limits, direct draft saving, phone toolbar bounds and public read-only behavior. Browser services were mocked; no deployment or publication occurred.

### Expanded rich-text toolbar

The floating Tiptap toolbar now displays font family/size, text/highlight colors, bold/italic/underline/strike, subscript/superscript, inline code, links, paragraph/heading styles, four-way alignment, line spacing, indentation, nested lists, quotes, code blocks, horizontal rules and text undo/redo. It appears for both headings and body text. Single-line widget headings disable structural controls such as lists; character formatting and alignment remain available. The controls wrap and scroll within a bounded toolbar on phones. Text remains editable directly on the canvas, and the sidebar reuses the same editor for formatted content.

Richer formatting uses optional `titleRichText` and `textRichText` document fields with plain `title`/`text` mirrors. Existing plain text and supported Markdown remain compatible; content only gains a rich document when it needs one. `websiteRichText.ts` validates supported nodes, marks, font/color/spacing attributes, safe links, nesting, size and character limits on both client and server. Public rendering builds Vue nodes from the validated structure, without inserting authored HTML. Publication checks include rich-text links, and page/widget copies clone documents independently and remap self-links. Changing exposed custom-widget text explicitly replaces that bound field's formatting when its content differs.

Frontend and Functions must be deployed together for the server to retain these new fields. This work does not deploy or publish content. TextStyle and alignment integration follows the installed Tiptap extensions and [Tiptap's TextAlign documentation](https://tiptap.dev/docs/editor/extensions/functionality/textalign).

The subsequent compact-toolbar pass removes the title/count header and opens with a single desktop strip of common controls. The three-dot More formatting toggle exposes the existing advanced controls without duplicating buttons or changing the saved text. A checkmark finishes editing. Desktop controls are 28 px tall; phone controls retain larger touch targets and wrap. The character count is available in the expanded controls.

Validation: 89 website unit tests passed, including server draft/publication validation, safe rendering, rich-link checks and independent page copies. All 52 builder browser scenarios passed across the full run and targeted rerun: 50 passed in the full run, and two workspace checks that timed out passed on rerun alongside the new rich-text workflows. Coverage includes formatted heading/body save/reload/publication, nested lists, subscript/superscript, quotes, code, soft breaks, dividers, sidebar edits, undo and phone toolbar bounds. Desktop/phone screenshots were reviewed. Production build and scoped lint passed with existing bundle-size and test-style warnings. Services and publication were mocked in browser tests; no production changes were made.
