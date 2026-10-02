# Phase 2 next update: design documents

Design and implementation record · September 14, 2026

The next phase includes **all requests collected from the stakeholder emails and planning conversation**. General and job-specific SDS access is the first feature priority. The user subsequently authorized first-phase implementation. These documents do not establish delivery dates or remove later work from scope; see the implementation record for what is built versus still proposed.

## Start here: October 2 employee Forms release

Read the latest employee-only Forms release checkpoint in [workspace design](03-workspace-design.md) and the resolved access decision in [delivery and decisions](05-delivery-and-decisions.md). Atlas approved production release after regression checks with mandatory employee login, Admin-only builder viewing/authoring, and owner/Admin access to submitted answers and photos. Public Forms use and anonymous submission links are deferred. Employees use the same form through an inline dashboard widget or a full-page launcher/link. The release includes the form library, drag-and-drop authoring, field inspector, history, versioned drafts/submissions, configurable recipients, photo viewer, email/PDF output and safe templates. Hosting and the six scoped functions are deployed from runtime commit 02db8c7, release 1790961992098000/version 4fb1bdb7cb2f4493. Deployed; live dashboard verification is blocked by Cloud Run transport permission. See workspace design for the exact remaining gate and evidence. Dan Larsen's actual committee audit is the next separately coordinated authoring task through the real builder UI/tools, using his original attachment. It is not seeded by this code release.

The normal checkout remains the development source at http://127.0.0.1:5173/login with local demo Admin access. Read workspace design for startup, saved demo state and known hard-stop persistence limits. Website Fit/inline editing and nine-page responsive checks pass; the Website Builder remains the visual reference. Read [Website Builder milestone](07-website-builder.md) for its prior verified code release and the separate owner content Review/Save/Publish boundary. Existing Daily Logs, Shop Orders, Timecards and user management remain regression gates. Legacy anonymous Daily Logs email-photo galleries are an explicitly reported exception outside this Forms release. Earlier dated local checkpoints below remain implementation history; the latest checkpoint controls current access and release state. No live test email or production test record is created by verification.

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
