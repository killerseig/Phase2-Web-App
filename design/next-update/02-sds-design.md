# SDS library and job binders

Draft design · First feature priority · Requirements SDS-01 through SDS-04

## Purpose and design direction

Give people a dependable way to find Safety Data Sheets through an organized file explorer and turn that organization into a printable book. The user confirmed a master general explorer containing all SDS sheets, with its folder/document hierarchy serving as the book's table of contents. Both PDF export and printing are required.

Each job uses a selected subset of the master explorer. In job edit mode, users see the master sheets with checkboxes and select those needed for the job. Unchecked sheets are hidden from the ordinary job SDS view and excluded from its book; they remain in the master library and available for later selection. The job inherits the master hierarchy and ordering.

Admin supplies the SDS information and manages the master library. Any user who can access a job can check/uncheck its sheets and export/print its book. This includes users whose existing job access is otherwise read-only; SDS selection does not grant broader job editing. Initial content entry uses Admin-added metadata and PDF files for book generation.

These core interactions and ownership rules are confirmed requirements. Detailed search/preview layout, save behavior, export styling, revision policy, offline app behavior, and explanation features below remain proposals until reviewed. Explanations are not a prerequisite for the document browser or book.

The user confirmed a reusable dashboard module and new basic Personal and Role pages. All existing Jobs dashboards/pages must remain untouched; the earlier proposed Job-dashboard placement is deferred. Proposed initial placement: explorer on Personal and/or Role, with a job-context selector in the new SDS module/page for job binders. The general SDS library is an expanded content page, not a fourth dashboard type. These new surfaces share records and behavior without changing existing job workflows. See [initial dashboards and module design](03-workspace-design.md#document-explorer-module-and-initial-dashboards).

## Reference review and limits

The initial draft was written before inspecting the example interfaces. After the user's correction, the public [mSDS Source website](https://www.msdssource.com/) and [SDS management page](https://www.msdssource.com/sds-management) were reviewed. The vendor describes search and location/category organization; its public [results screenshot](https://cdn.msdssource.com/results-15ece9de.webp) shows product entries with manufacturer, language, and location labels. This supports organized document browsing, but does not establish the exact layout or capabilities of Phase 2's subscribed binder.

The subscriber login page was opened without signing in. Calibrated Risk could not be loaded by the research tool. Its signed-in interface has not been verified. A folder tree and preview pane below are Phase 2 design proposals informed by the user's file-explorer direction, not claims that every referenced site has that exact layout.

## Main user journeys

| User need | Proposed flow | Successful outcome |
| --- | --- | --- |
| Find a product's sheet | Open SDS Library → search product/manufacturer → inspect matching record → open sheet | Correct product and document are identifiable |
| Find job material sheets | New Personal/Role SDS entry → choose authorized job context → search its binder (proposed access path) | Only this job's binder membership is shown; existing Job pages stay untouched |
| Choose sheets for a job | Job SDS → Edit mode → check/uncheck master sheets → Save | Job view and book contain only selected sheets, without duplicating source files |
| Organize the master library | Admin → add SDS information/PDFs → create/rename folders and arrange sheets | Explorer hierarchy and order define the book's contents order |
| Request a missing sheet | Search has no suitable match → Request SDS → provide product/manufacturer and job | Request is assigned for review; it is not mistaken for an available sheet |
| Maintain a sheet | Admin → add revision → review identity/source → publish | Existing revision is preserved and affected job references are handled visibly |
| Prepare a general or job book | Master or job SDS → Export PDF / Print book → preview → generate | Book has a table of contents matching its scoped explorer and the included original sheets |
| Understand a sheet | Open document → view reviewed explanation/source links, if enabled | User can return directly to supporting original content |

Do not automatically add every item in a shop order to a binder. A future catalog-to-SDS association can suggest additions, but product matching and who confirms it need separate decisions.

## Navigation and screen sketches

Proposed routes are discussion labels, not implemented contracts:

- `/safety/sds`: general library content page providing the expanded master explorer, available from employee navigation and the module.
- `/safety/sds/jobs/:jobId`: proposed separate job-binder content route reached from new SDS surfaces; does not modify existing Jobs routes or dashboard links.
- `/safety/sds/:documentId`: document details, preserving return-to-job context when entered from a binder.

On desktop, use a file-explorer layout: folder/binder navigation on the left, the selected folder's document list in the main area, and a preview/details area when a sheet is selected. Put breadcrumbs and scoped search above the list. Initially give the dashboard module full-width space and an Expand action; the following sketches apply to both dashboard and expanded presentations. On phones, use a folder list, document list, and document view as successive screens with clear back navigation. Default placement makes SDS available without users configuring a dashboard.

```text
SDS Library
[Search this folder________________] [Search all SDS]
[Export PDF] [Print book] [Edit library*]

Folders / binders    | All SDS > Selected folder
All SDS             | Name          Manufacturer   Revision
  Folder A          | Product A     Manufacturer A YYYY-MM-DD
  Folder B          | Product B     Manufacturer B YYYY-MM-DD
Job binders*        |
  Job A             | Selected sheet: PDF preview / Open source
  Job B             | [Open] [Download sheet] [Print sheet]
                    | Details and revision history
*Only accessible jobs and permitted actions are shown.
```

```text
SDS > Selected job > Job name
Job SDS Binder                     [Edit mode*]
[Search this job________________] [Export PDF] [Print book]

Job folders         | Job name > Selected folder
All job sheets      | Product A     Manufacturer A YYYY-MM-DD
  Folder A          | Product B     Manufacturer B YYYY-MM-DD
  Folder B          |
                    | Selected sheet: preview / Open source
                    | [Open] [Download sheet] [Print sheet]
*Every user with access to this job can use Edit mode and export/print.
```

```text
SDS > Selected job > Job name > Edit selection
[Search master library____________] [Save] [Cancel]

Master folders      | All master sheets in selected folder
  Folder A          | [x] Product A     Manufacturer A
  Folder B          | [ ] Product B     Manufacturer B
                    | [x] Product C     Manufacturer C

Checked sheets appear in this job's SDS view and book.
```

Folder names above are placeholders; maintainers create the actual master hierarchy. Keep folder depth modest, distinguish global from job search, and preserve the selected folder when returning from a document. Job selection references master document IDs, not independent job folder copies. Creating/renaming master folders and arranging sheets require library edit permission, separate from permission to check sheets for a job. Public reference material does not confirm a vendor folder-management API.

## Job edit mode and selection rules

Confirmed behavior: ordinary job browsing shows selected sheets only. Edit mode reveals all available master sheets, including unchecked ones. Selecting or deselecting a sheet changes its inclusion for this job, not the master library or another job.

Proposed interaction details:

- Save applies the selection together; Cancel discards unsaved changes. Leaving with unsaved changes prompts the user to save or discard.
- Hide folders with no selected descendants in ordinary job browsing and its table of contents. Retain ancestor folders needed to show the path to selected sheets. Edit mode shows the full master hierarchy.
- Folder checkboxes select/deselect the current descendant sheets, with a mixed state for partially selected folders. Show the affected count; search filtering must not silently narrow a folder action. Folder selection is a convenience for selecting sheets, not a subscription to future additions.
- New master sheets start unchecked for existing jobs; moving or renaming a selected sheet preserves its inclusion by stable ID. New jobs start with an empty selection unless an explicit future template is agreed.
- Search and folder expansion affect browsing only. Export/print use the whole saved master or job scope, even when the current screen is filtered. Save job changes before exporting an updated book.
- A concurrent saved selection change should be surfaced before overwriting it, so one editor does not silently undo another's work.

Unchecked means excluded from this job's view and output. It does not revoke a user's independent permission to find the same sheet in the general library.

## PDF and printed book

Confirmed: both the master library and each job support exporting a combined PDF or printing a book. The master book contains all available published master sheets; a job book contains exactly its saved selected sheets. The explorer's hierarchy and document order become the table of contents and the order of the sheets in the book.

Proposed book format:

1. Cover naming the company/general library or job, plus generation date.
2. Table of contents with nested folder headings, document titles, and starting page numbers. PDF entries link to their corresponding sheet; PDF bookmarks mirror the same hierarchy.
3. Complete original SDS pages in explorer order, preserving readable content and original page orientation. Added book page numbering must not obscure source text.

PDF export and Print book use the same generated artifact and pagination. Print book opens its print workflow. Individual sheet printing remains a separate action. Generate the final page references after cover and contents pagination is known, including when the table of contents spans multiple pages.

Capture saved selection, hierarchy/order, document titles, and exact revisions at generation start, so edits made during generation cannot change half of a book. A saved earlier export remains a snapshot; a later export reflects the current saved organization and agreed revision policy.

Unchecked sheets are intentionally excluded, not export failures. A selected sheet that cannot be retrieved or merged is an export failure to resolve: show its identity and reason, and do not present a complete-looking book. Proposed first-release behavior is to block final book generation until required sheets are available. No selection produces an empty-binder message rather than an empty book. Combined output is required, so a source strategy limited to external links cannot satisfy this requirement by itself.

Reading actions should be prominent; uploading, organizing, and revision review belong in permitted management actions. Keep advanced metadata and maintenance controls out of the ordinary browse/open flow. Reuse the same explorer interaction for general and job SDS pages, changing its scope and allowed actions.

These are content hierarchies, not a prescription for new visual styling. Reuse Source Sans 3, the existing brand treatment, common search/input/status components, and the job navigation context from the [brand guide](../Phase2-Design-Guide.html). Document reading surfaces should be quiet and readable.

## Library record and job membership

Proposed records:

| Record | Information |
| --- | --- |
| Product/SDS record | Stable ID, product name, manufacturer, product identifier, useful search aliases, current published revision |
| SDS revision | Stable revision ID, language, revision date if supplied, source type, source record/link or stored file reference, upload/review metadata, file checksum where available |
| Job binder membership | Job ID, SDS/product ID, selected revision ID, who added it and when, optional job-specific note, active/removed status |
| Master folder / document placement | Stable folder ID, parent folder, name/order, and ordered document references; jobs inherit this organization; duplicate placement behavior remains to decide |
| Binder export | General or job scope, optional job ID, generation time, captured hierarchy/order/titles and revision IDs, page references, unavailable items, generated-file reference if retained |
| Missing-sheet request | Product/manufacturer details, optional job, requesting user, assignee, status, resolution |

Revision date, date uploaded, and date the source was checked mean different things and must be labeled separately. Do not invent an expiration date when the source does not provide one. Search aliases must not merge distinct products or formulations just because names are similar.

**Proposed revision policy:** a published revision is immutable. Job binders reference a specific revision. When a new revision is published, show affected binders as needing review and offer an explicit update. Historical exports retain their original revision list. Decide with the safety owner whether any categories should instead update automatically; do not silently choose a policy during implementation.

Unchecking a sheet removes its active job membership, not the company document. Retirement prevents inappropriate new selection while preserving historical references. Define retention and access to retired records before enabling permanent deletion. The proposed retirement workflow must flag affected current job binders for resolution rather than silently omit their selected sheets.

## Admin-managed content and optional mSDS Source integration

Confirmed first-phase source: Admin adds the SDS information and maintains the master list. Provide metadata entry and PDF upload so books use company-managed files. Vendor retrieval/synchronization is not a first-phase dependency. The options below are future integration considerations, not an unresolved choice blocking this upload workflow.

Phase 2 reports an existing subscription. No vendor login or API investigation has been performed for this design. Credentials and company registration codes supplied in email are intentionally omitted.

| Option | What the app would do | What must be verified |
| --- | --- | --- |
| Provider links | Organize metadata and job associations; open sheets in the existing service | Stable document links, authentication behavior, mobile access, availability |
| Company-managed files | Store authorized PDF copies and maintain records in Phase 2 | Download/reuse permissions, review responsibility, revision maintenance, storage/retention |
| Provider integration | Search or synchronize through a supported vendor interface | Supported API/export, authorization, limits, cost, permitted caching, update behavior |
| Hybrid | Start with supported links/files; connect provider IDs later | How duplicate records and conflicting revisions are reconciled |

Use one library record per identifiable product/document with Admin-supplied metadata and PDF revisions initially; optional source references can support future integration. Do not assume vendor credentials can be embedded, the vendor can be framed inside the app, or its content may be scraped and copied.

An external-link record may support opening the source but not inline preview or binder export. Show this limitation per record and resolve document retrieval for selected sheets before generating a book. The confirmed combined PDF/print requirement needs accessible, authorized document files; provider links alone are insufficient. A vendor shortcut may only be an explicitly accepted interim step.

## Confirmed access and remaining proposals

- Active employees can read the general published library; whether any SDS access must work without login remains open.
- Reading a job binder follows approved job-read access. General library access does not grant access to job-specific notes or membership.
- Admin adds, organizes, publishes, and revises the master SDS library. Non-admin users cannot modify master sheets or organization.
- Every user with access to a job can check/uncheck its SDS sheets and export/print its book. No additional job-edit role is required. Derive this SDS permission from existing job access without changing existing job permissions or pages.
- Other readers can request sheets or report issues without receiving global edit rights.
- Public website Safety content does not automatically expose the internal library or vendor access details.
- Search, document delivery, downloads, and exports enforce the same permissions as the page, including after job access is revoked.

## Loading, errors, accessibility, and connectivity

| State | Required proposed behavior |
| --- | --- |
| Initial load | Visible page title/navigation and loading message; no blank screen |
| No search results | Explain that no match was found; clear filters or request a sheet |
| Empty job binder | Say that no sheets are selected; offer Edit mode to permitted users and distinguish from a loading failure |
| Source unavailable / login required | Explain the problem; provide the supported source-opening path and a report-issue action |
| Preview failure | Keep metadata and authorized download/open-source actions available |
| Unsupported export item | Identify the selected sheet and cause; proposed behavior blocks final book generation until resolved |
| New revision | Show a review/update action without overwriting history |
| Connection lost | Explain what is unavailable; downloaded files are not the same as offline app access |
| Unauthorized | Show a clear access state without leaking document/job metadata |

Controls need keyboard access, visible focus, meaningful labels, and touch-friendly layouts. Document status must be conveyed in text as well as color. Preserve search and job context when returning from a document. Establish expected document counts and device/connectivity conditions before setting performance targets.

Offline access is a decision for the first SDS release, not an assumed completed feature. If required, specify cache freshness, shared-device behavior, download completeness, device storage, and what happens after access revocation. The field team and safety owner should confirm the acceptable access method during a connectivity outage before operational rollout.

## Helping people understand SDS

If SDS-03 includes explanations, begin by deciding the exact questions people need answered. A proposed first approach is reviewed explanatory notes or navigation to relevant portions of the sheet. Link every product-specific explanation to the exact document revision and page/section, and identify its author/reviewer.

AI-generated explanations are a separate capability under SAFE-02. They must be visibly identified, cite authorized source material, avoid unsupported conclusions, and handle missing/conflicting evidence. This draft does not approve any PPE example from the pasted Copilot response or claim that a generated explanation replaces the source document.

## Proposed acceptance criteria

| ID | Scenario / evidence |
| --- | --- |
| SDS-A01 | An authorized employee reaches the general library directly from navigation and finds a known product/manufacturer |
| SDS-A02 | Two similarly named products remain distinguishable by manufacturer and identifier |
| SDS-A03 | A reader opens the source sheet and can see its available revision/source information |
| SDS-A04 | A permitted user enters job edit mode, sees checked and unchecked master sheets, and saves selection for two jobs without duplicating source files |
| SDS-A05 | Unchecked sheets are absent from ordinary job browsing, job search, its table of contents, and its book; they remain in the master library and selectable in edit mode |
| SDS-A06 | Publishing a revision preserves prior revisions and follows the agreed binder-update policy |
| SDS-A07 | Users outside a job cannot read its restricted binder details through the UI, API, file URL, search, or export |
| SDS-A08 | No results, denied access, unavailable sources, and preview failures produce usable states rather than endless loading |
| SDS-A09 | General and job PDF/print books use the captured master order and hierarchy, correct contents page references, and complete source sheets; selected unavailable items cannot silently disappear |
| SDS-A10 | Mobile and keyboard users can search, open, and return to a sheet without losing job context |
| SDS-A11 | The agreed no-connection workflow is demonstrated on a field device |
| SDS-A12 | If explanations are included, each is linked to an identifiable source revision and review status |
| SDS-A13 | A missing-sheet request has an accountable owner and can be resolved into a usable library record |
| SDS-A14 | A job with selections across nested folders shows only the relevant ancestor folders; PDF and print match that saved hierarchy, independent of search filters |
| SDS-A15 | Under the proposed save model, Cancel preserves the saved selection, unsaved edits are handled before leaving/exporting, and concurrent saves cannot silently overwrite another editor |
| SDS-A16 | Under the proposed selection defaults, new master sheets stay unchecked on existing jobs and moving/renaming a selected sheet preserves inclusion |
| SDS-A17 | A multi-page table of contents points to the correct SDS start pages; mixed-orientation and multi-page sheets remain readable and complete in PDF and print |
| SDS-A18 | Changes to selections, order, titles, or revisions during generation do not alter the captured book; earlier exports remain unchanged |
| SDS-A19 | New Personal/Role or separate SDS surfaces host master/job-context explorers with agreed placements; actions share records/permissions with expanded views; all existing Jobs pages/dashboards stay untouched and receive no added modules |
| SDS-A20 | Expanding and returning preserves folder/search context; a module error leaves the dashboard's navigation and existing workflow links usable |
| SDS-A21 | Admin can add SDS metadata/PDFs and organize the master; non-admin master mutations are denied through both UI and direct requests |
| SDS-A22 | Users with job access, including otherwise read-only access, can save SDS selections and export that job's book; users without job access cannot. Existing job-edit permissions remain unchanged |

Applicable criteria and sample products/jobs should be agreed during SDS review. Initial design decisions are tracked as D01–D06 in the [decision register](05-delivery-and-decisions.md).
