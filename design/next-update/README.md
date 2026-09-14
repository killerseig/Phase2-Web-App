# Phase 2 next update: design documents

Draft for discussion · September 14, 2026

The next phase includes **all requests collected from the stakeholder emails and planning conversation**. General and job-specific SDS access is the first feature priority. These documents organize the work; they do not authorize implementation, establish a delivery date, or remove later work from scope.

## Reading order

| Document | Purpose |
| --- | --- |
| [Requirements](01-requirements.md) | Consolidated requests, source references, and known status |
| [SDS library and job binders](02-sds-design.md) | First-priority workflows, screens, document handling, and acceptance criteria |
| [People and workspace design](03-workspace-design.md) | Roles, dashboards, reports, documents, public website, and safety tools |
| [Technical design direction](04-technical-design.md) | Existing application context and proposed integration boundaries |
| [Delivery and decisions](05-delivery-and-decisions.md) | Build sequence, unresolved questions, verification, and review checklist |

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

Role dashboards provide consistent shared resources and tools tailored to each role. Admin, Foreman, and Project Manager views can differ while respecting the viewer's existing access. Personal dashboards focus on the individual's information. Role resource/layout publishing ownership is distinct from the confirmed Admin ownership of the SDS master.

The explorer is a reusable dashboard module, with SDS as its first collection configuration. Basic dashboards with fixed default placements are sufficient initially; master/job explorer modules and expanded views share the same records and actions. The general SDS library is a content page, not a fourth dashboard type. User-added modules and layout customization follow in the broader dashboard work. See [module and initial dashboard design](03-workspace-design.md#document-explorer-module-and-initial-dashboards).

Use the existing [brand and typography guide](../Phase2-Design-Guide.html) as visual context. New screens should reuse the application's established controls and layout components. This set contains workflow sketches, not final visual mockups.

## Current boundaries

Documentation only: no application changes, deployments, vendor logins, emails, or external integrations are part of this task. A subsequent public mSDS Source reference review is recorded in the SDS design; the subscribed interface, API/integration capabilities, and current regulatory requirements remain unverified. The documents make no compliance certification claims.

The estimate email mentions $6,000 and continuing support. The user has clarified that all submitted requests belong to this phase. The missing estimate attachment and support terms remain open planning inputs; neither the price nor the older email's timing has been used to cut scope.

Do not copy vendor credentials or registration codes from the supplied emails into these documents, application pages, fixtures, or public content.
