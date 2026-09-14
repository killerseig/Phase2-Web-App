# Delivery sequence and decision register

Draft for discussion. All requirements remain in the next-phase scope. Stages describe sequencing, not separate exclusions, approved deadlines, or pricing commitments.

## Proposed sequence

| Stage | Outcome | Main dependencies / completion evidence |
| --- | --- | --- |
| 0: Clarify and verify | Apply confirmed Admin content ownership and job-access selection/export rules; refine remaining book details and triage reported defects | Representative Admin-provided PDFs, remaining D01–D06 details, safe bug examples |
| 1: SDS first and basic dashboards | Add Personal/Role pages and separate SDS surfaces: Admin metadata/PDF entry and master organization, job-access-based sheet selection/export, role-specific shared resources/tools | All existing Jobs pages/dashboards untouched; representative uploaded PDFs; agreed placement, book/connectivity and permission walkthroughs; no vendor integration dependency |
| 2: Roles and site visits | Approved access model, new user categories, and short site visit reporting | Permission matrix, report-template interpretation, visit/recipient rules |
| 3: Workspace and documents | Flesh out Personal/Role dashboards and other document collections; resolve earlier group-workspace needs; revisit Job-dashboard integration later | Role/group/layout ownership and shared versus private data rules; Job-page changes remain deferred under the current user boundary |
| 4: Module expansion | Customization, announcements, alerts, calendars, checklists, media, maps, contacts, analytics/spreadsheets | Module-specific behavior, event/metric definitions, provider decisions |
| Later jobs-list migration | Add reusable jobs-list module to dashboards and eventually retire standalone Jobs page | Preserve existing relevant list/actions/access behavior, navigate to same Job dashboards, review workflow parity and old-link handling before retiring the page |
| Public website track | Company website with all requested content and admin editing | Content ownership, navigation, publish workflow, domains and link continuity |
| Safety tools track | Company search, source-linked answers, JHA assistance, talks/trends/training features | Approved documents, expected JHA output, reviewer workflow and source verification |
| Throughout | Regression protection, support, operational visibility, and MFA planning | IT and stakeholder review; agreed operating expectations |

The first SDS release uses the confirmed capability rule: Admin maintains the master, and existing job access permits that job's SDS selection/export. The complete role/dashboard expansion must not become an accidental prerequisite. A minimal dashboard host is part of first-release delivery. Reported defects remain tracked separately; the current no-change boundary for existing Jobs pages still applies. Broader safety AI is in scope but is not a dependency of reliable SDS access.

## Decision register

Suggested decision participants are planning recommendations, not assigned commitments.

| ID | Decision | Proposed starting point / unanswered question | Participants | Needed for |
| --- | --- | --- | --- | --- |
| D01 | SDS browser and books | Core confirmed: master hierarchy, job checkboxes hiding unselected sheets, PDF/print with matching contents. Remaining details: initial organization, duplicate placements, save/bulk-selection defaults, cover/pagination styling | User, field users, safety lead | SDS workflow |
| D02 | SDS source strategy | Resolved for first phase: Admin adds SDS information; metadata entry and PDF upload provide book sources. Vendor integration is optional later work; upload limits/sample files remain implementation details | Admin, user | Storage, search, preview/export |
| D03 | SDS reading and editing access | Confirmed: Admin manages master; any user with job access can check/uncheck and export/print, including otherwise read-only users. General-library/logged-out audience remains to define | Admin, user | New SDS permission matrix |
| D04 | Revisions and retention | Explicit binder revision updates proposed; define supersession, archived jobs, historical books, and deletion | Safety/library owner, operations | Records and binder export |
| D05 | Field connectivity | Is downloaded PDF access sufficient, or is offline search/app access needed at launch? | Foremen, superintendents, safety, IT | SDS first-release acceptance |
| D06 | SDS launch content and scale | Admin is the confirmed maintainer. Sample products/jobs, sheet counts, languages, scanned PDFs and explanation needs remain to establish | Admin, field users | Search and review scope |
| D07 | Roles and titles | Exact actions and all-job/assigned-job scope for PM, Superintendent, Operations, CEO; sensitive timecard access | Leadership, payroll, operations | Roles and reports |
| D08 | Mandatory visits | How a visit is recorded, report due time, exemptions, reminders, escalation | PMs, superintendents, operations | Visit compliance workflow |
| D09 | Site visit form | Required fields, personnel definition/departments, attachments, recipients, correction policy | Report authors and recipients | First report template |
| D10 | Report builder | Admin-created templates versus reusable developer-created forms; conditional fields/PDF/signature needs | User, admins, report owners | Builder interaction design |
| D11 | Role layouts and future groups | Confirmed purpose: consistency and shared resources/tools tailored to each role. Remaining: resource/layout publishing ownership, multi-role view selection, and relationship to earlier custom groups | Operations, admins, users | Role presentation and later shared workspaces |
| D12 | File storage | Personal/job/group visibility, uploads, folders, versions, retention, external storage integration if any | IT, operations, safety | General documents |
| D13 | Alerts and communications | Due-work applicability, announcement acknowledgement, reminder recipients/channels, calendar behavior | Workflow owners, operations | Module specifications |
| D14 | Website content and publishing | Services/awards placement, location scope, careers behavior, content owners, publisher, preview/revisions | Marketing/leadership, admins | Public website |
| D15 | Domains and employee entry | Public versus employee URLs and existing shared-link preservation | User, IT | Website release plan |
| D16 | Safety/JHA expected output | Obtain sample JHA and demo outcomes; define risk method, review, citations, approval, training/incident fields | Safety lead, operations | Safety tools |
| D17 | External providers | Verify OSHA needs, maps, spreadsheets, and any AI/vendor integration | User, IT, feature owners | Provider selection |
| D18 | MFA | Factors, enrollment, recovery, shared devices, and enforcement | IT, admins | Authentication rollout |
| D19 | Support and acceptance | Named reviewers, support channel, urgency definitions, response expectations, missing estimate attachment | User, stakeholders | Delivery and ongoing support |
| D20 | Historical bug semantics | Carry-forward rules and Job # overwrite boundaries; submitted-versus-new-record selection | Foremen, payroll | Reliable regression fixtures |
| D21 | Explorer module and initial dashboards | Confirmed: add Personal/Role pages; all existing Jobs pages/dashboards untouched. Proposed: master/job-context explorer on new surfaces with an authorized job selector. First placement and role modules/layout ownership remain open | User, field users | SDS module presentation |
| D22 | Existing Jobs boundary and later migration | Confirmed: no changes to existing Jobs list, dashboards, pages, routes, or workflows now; no SDS insertion. Job-dashboard integration and jobs-list replacement are deferred until this boundary is revisited | User, field users, job administrators | Initial navigation protection and later migration |

## Review agenda

The main ownership/access/purpose questions are answered. Next, use representative Admin-provided PDFs and an accessible job to review uploads, master organization, new dashboard/module placement, selection saving, and book output. Review remaining general-library audience, connectivity, revision/retention, and initial role-resource details without reopening the confirmed Admin and job-access rules. Resolve D04 before building revision changes or binder exports.

Next discussions: access matrix and site visits; dashboard/group ownership and documents; website content/publishing; safety tools and provider discovery. Record decisions here and reconcile all affected requirements before producing implementation tasks.

## Validation plan

No tests are being added or run as part of this documentation task. During implementation, use scenario tests that prove user outcomes rather than only reproducing component internals.

| Area | Evidence before release |
| --- | --- |
| SDS | [SDS acceptance criteria](02-sds-design.md#proposed-acceptance-criteria), source failures, similar-product disambiguation, mobile/keyboard use, agreed no-connection workflow |
| Permissions | Positive and negative cases for each role across routes, direct queries, callable operations, file delivery, search, and exports |
| Reports | No draft on viewing, explicit create/submit, validation, immutable submitted history, mandatory-visit cases, configured recipients |
| Existing submissions | Previous-week carryover, blank-card reproduction, Job # propagation, duplicate-send protection, sender copies and Reply-To |
| Dashboards | Initially: distinct Personal/Role pages; every existing Jobs page/dashboard unchanged in layout/routes/permissions/behavior; no added modules there; separate SDS job context, per-viewer role access and independent module failures. Later: layout customization and explicitly revisited Job integration/migration |
| Documents | Upload/publish failure, revision change, revoked access, deleted membership, preservation of history |
| Public website | Draft privacy, publishing/rollback, responsive pages, content accessibility, public/internal separation, existing URLs and account flows |
| Safety tools | Authorized-source retrieval, exact source citations, missing/conflicting evidence, reviewer workflow, historical version traceability |
| MFA | Enrollment, second-factor prompt, recovery, shared-device behavior, authorized administration |

Production-built browser checks are required for affected critical pages: development-only tests previously missed an export-page crash caused by a production transform. Build/type checks, focused tests, and representative user walkthroughs serve different purposes. Validate real inbox behavior through an explicitly coordinated test; do not send unsolicited test emails.

## Proposed readiness checklist for each release

- Requirements and applicable acceptance cases are identifiable by ID.
- Open decisions affecting the release have recorded answers; unrelated open questions do not block it.
- Representative data, reviewer, access matrix, and failure states are covered.
- Existing links and workflows remain usable; any migration has a recovery plan.
- Content/source maintenance has an owner.
- Support staff can identify failures and provide a next step.
- Stakeholder walkthrough feedback is recorded before wider rollout.

## Known limitations of this design pass

The sample JHA and estimate attachment were not provided. Vendor account access, licensing/API behavior, production user data, actual SDS content, and current regulatory obligations were not investigated. Public mSDS Source material has since been reviewed as recorded in the SDS design. The user confirmed the master explorer, job checkbox selection, and PDF/printed books using the hierarchy as contents. Initial folder content, detailed output styling, and source retrieval remain discovery items, not reasons to omit the requested features.
