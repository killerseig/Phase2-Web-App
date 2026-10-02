# Phase 2 next update: design documents

Design and implementation record · September 14, 2026

The next phase includes **all requests collected from the stakeholder emails and planning conversation**. General and job-specific SDS access is the first feature priority. The user subsequently authorized first-phase implementation. These documents do not establish delivery dates or remove later work from scope; see the implementation record for what is built versus still proposed.

## Start here: October 2 Forms production release candidate

Read the latest Forms production release candidate in [workspace design](03-workspace-design.md) for executed core regression gates, named deployment scope, rollback evidence and pending public-sharing approval. No Forms deployment has occurred yet. Read the working-checkout verification, visual review and production release gate in [Website Builder milestone](07-website-builder.md) first. Fit/inline editing and the nine-page editable starter have passed current local checks. Website code release 1790884180642000 (Hosting version 93ef3982169778a9) is deployed and verified. Existing private/public content and 45 unrelated function revisions are unchanged; owner content Review/Save/Publish is a separate action. Existing daily logs, shop orders, timecards and user management are protected acceptance gates. Form Builder local implementation has begun; read the Report builder section in [workspace design](03-workspace-design.md) for the verified first slice, authenticated local audit lifecycle, demo startup instructions and basic-control completeness checklist and local PrimeVue checkbox/radio/multiselect checkpoint. The October 2 local presentation slice adds a pinned Form widget to Personal/Role layouts with inline (up to eight fields) and full-page launcher modes sharing one owner record; Job dashboard placement remains deferred. The subsequent October 2 bounded authoring checkpoint implements ordered palette-to-canvas pointer insertion/reordering, field selection and inspector properties, structural undo/redo, and Admin server duplication. The emulator server is the main library source of truth; legacy device drafts require explicit import. The shared normal-checkout review is now on http://127.0.0.1:5173/login using the local demo Admin button. The current shell has a compact categorized left palette, central ordered canvas showing actual form controls, wide-screen right inspector and device-preview/save/history controls; it remains a visible work in progress. Start with the latest Forms-only visual polish checkpoint in workspace design for the compact selectable library, readable file buttons, matching controls and responsive verification. Website Builder stays the unchanged visual reference. The preceding output and familiar-shell checkpoint records the output implementation: full email/photo viewer, optional PDF, safe field templates and default-login/scoped-share settings are implemented locally. It records actual verification and remaining gaps. Forms remains local only; no Forms deployment or production writes.

## Reading order

| Document | Purpose |
| --- | --- |
| [Requirements](01-requirements.md) | Consolidated requests, source references, and known status |
| [SDS library and job binders](02-sds-design.md) | First-priority workflows, screens, document handling, and acceptance criteria |
| [People and workspace design](03-workspace-design.md) | Roles, dashboards, reports, documents, public website, and safety tools |
| [Technical design direction](04-technical-design.md) | Existing application context and proposed integration boundaries |
| [Delivery and decisions](05-delivery-and-decisions.md) | Build sequence, unresolved questions, verification, and review checklist |
| [First-phase implementation](06-first-phase-implementation.md) | Delivered code, defaults, verification, limits, and deployment steps |
| [Website Builder milestone](07-website-builder.md) | Admin editor, private drafts, publication, public pages, and launch boundaries |
| [Widget layouts](08-widget-layouts.md) | Drag-and-drop, responsive widths, personal ownership and Admin-managed shared layouts |
| [Website Builder editing guide](09-website-builder-guide.md) | Owner workflows for editing, previewing, reusing widgets and publishing |
| [Website Builder quality audit](10-website-builder-quality-audit.md) | Reliability fixes, verification evidence and remaining acceptance gates before polish |

## How to read this set

- **Confirmed request:** explicitly requested in the conversation or supplied emails.
- **Proposed:** a design recommendation for discussion; not an approved requirement.
- **Open:** a question that must be resolved for the affected design.
- **Previously delivered:** completed earlier in this conversation; distinct from new work. Production behavior should be checked again when implementation resumes.
- **Reported bug / needs verification:** a stakeholder report, not a newly reproduced defect.

Requirement IDs remain stable so future tasks and tests can reference them. The decision register is the place to record answers; update the affected design documents when a decision changes.

## Product direction

One employee workspace with three dashboard types: Personal, Role, and Job. **Initial work adds Personal and Role pages/tabs only; all existing Jobs pages and Job dashboards remain untouched.** This includes their layout, routes, workflow options, and behavior; no SDS module is added to them now. Job-specific SDS can be accessed through separate new SDS surfaces, with placement still proposed. Job-dashboard additions, a jobs-list module, and retirement of the standalone Jobs page are later work. Earlier group requests remain future design inputs. Reports, documents, tasks, and events are shared records presented through dashboards. A public company website shares the Phase 2 identity but publishes only approved public content.

For SDS, Admin adds information/PDFs and manages the master explorer; its hierarchy becomes the table of contents for PDF/printed books. Anyone with access to a job can check/uncheck its sheets and export/print its book, including otherwise read-only job users. Unchecked sheets remain in the master library; jobs inherit its organization. These actions live on new SDS surfaces and do not change existing job-edit permissions. Vendor integration is optional later work; embedded preview details and offline app access still need decisions.

Role dashboards provide consistent shared resources and tools tailored to each role. Admin, Foreman, and Project Manager views can differ while respecting the viewer's existing access. Personal dashboards focus on the individual's information. Admin ownership of shared role layouts is confirmed; users edit their own personal layouts.

The explorer is a reusable dashboard module, with SDS as its first collection configuration. Basic dashboards with fixed default placements are sufficient initially; master/job explorer modules and expanded views share the same records and actions. The general SDS library is a content page, not a fourth dashboard type. User-added modules and layout customization follow in the broader dashboard work. See [module and initial dashboard design](03-workspace-design.md#document-explorer-module-and-initial-dashboards).

Use the existing [brand and typography guide](../Phase2-Design-Guide.html) as visual context. New screens should reuse the application's established controls and layout components. This set contains workflow sketches, not final visual mockups.

## Current boundaries

The first phase has now been implemented locally; production deployment is separate. All existing Jobs pages/dashboards and their data remain unchanged. No vendor logins, emails, or production data edits were performed. A public mSDS Source reference review is recorded in the SDS design; subscribed integration capabilities remain unverified and are not required for Admin uploads.

The estimate email mentions $6,000 and continuing support. The user has clarified that all submitted requests belong to this phase. The missing estimate attachment and support terms remain open planning inputs; neither the price nor the older email's timing has been used to cut scope.

Do not copy vendor credentials or registration codes from the supplied emails into these documents, application pages, fixtures, or public content.
