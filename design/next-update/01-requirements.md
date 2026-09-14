# Consolidated requirements

Status: draft for discussion. See the [document index](README.md) for status definitions.

## Source register

These identifiers refer to material provided in the conversation, not separately stored email files.

| Source | Supplied material |
| --- | --- |
| S01 | Foremen need email copies of submitted timecards, daily logs, and shop orders |
| S02 | Superintendent, operations, and CEO access; shorter site visit reports; shop ordering |
| S03 | Careers, awards, biographies, projects, and estimating/preconstruction services |
| S04 | Pasted Copilot proposal for safety documents, OSHA references, AI search, and later safety tools |
| S05 | Calibrated Risk JHA example and planned demonstration; attachment not provided |
| S06 | Expanded mandatory site visit report, public navigation, and existing mSDS Source subscription |
| S07 | Personal, job, and group dashboards with user-added modules |
| S08 | Bug report, role definitions, dashboard architecture, files, widgets, MFA, and support |
| S09 | Estimate email: public website, admin editing, dashboards, report builder, ongoing support |
| S10 | User clarification that all collected requests are within the next phase |
| S11 | User direction to prioritize general and job SDS pages, including SDS "books" |
| S12 | User clarification that the reference SDS experience is essentially a file explorer |
| S13 | User confirms master SDS explorer, hierarchy as PDF/printed book table of contents, and job edit-mode checkboxes hiding unselected sheets from job browsing and books |
| S14 | User requests generalizing the explorer into a dashboard module; basic dashboards are sufficient until the broader dashboard design is fleshed out |
| S15 | User specifies Personal, Role, and Job dashboards; add Personal/Role pages or tabs, leave current Jobs page untouched, retain job-list navigation to the existing three-option Job dashboard; move jobs list into a module and retire Jobs page later |
| S16 | User emphasizes that all existing Jobs dashboards/pages must remain untouched because the whole company uses them; supersedes proposed initial additions to the Job dashboard |
| S17 | Admin adds SDS information and manages master; anyone with job access can select/deselect sheets and export its book; Role dashboards provide consistent shared resources and role-specific tools |

## Priority and existing work

**SDS is the first new feature priority** (S11). Reported defects still need triage: a confirmed loss of submitted work warrants immediate attention alongside SDS planning. Other requested features remain in scope and are sequenced in [delivery planning](05-delivery-and-decisions.md).

| ID | Request | Source | Status |
| --- | --- | --- | --- |
| SUB-01 | Copy the submitting person on daily log, timecard, and shop order emails | S01, S08 | Previously delivered; actual inbox receipt still needs user confirmation |
| SUB-02 | Let replies reach the submitting person | Earlier reply-email discussion | Previously delivered using Reply-To; not a mailing list or in-app inbox |
| BUG-01 | Viewing a daily log date must not create a draft; show submitted logs and explicitly offer another log | S08 | Reported bug / needs verification |
| BUG-02 | Viewing previous timecard weeks must show existing/submitted work without creating drafts | S08 | Reported bug / needs verification |
| BUG-03 | Restore dependable previous-week employee/card carryover | S08 | Reported bug / needs verification |
| BUG-04 | Investigate blank submitted cards reported for Vince Hintz, job 5229 — Lucky 3 Ranch | S08 | Reported bug / needs verification |
| BUG-05 | Restore Job # propagation to appropriate rows below an edited Job # on carried-forward cards | S08 | Reported bug; precise overwrite rules need examples |
| SDS-01 | Admin adds SDS information and manages the general company master explorer and organization | S11, S13, S17 | Confirmed; first priority; initial design uses Admin metadata entry and PDF uploads |
| SDS-02 | Anyone with job access can check/uncheck SDS sheets and export its book; unchecked sheets are hidden from its SDS view/book | S11, S13, S17 | Confirmed; includes otherwise read-only job access; does not grant master editing or broader job editing |
| SDS-03 | Export PDF and print general/job books with explorer hierarchy as table of contents and matching sheet order | S11, S12, S13 | Confirmed; pagination/style and duplicate placement details proposed/open; explanatory features separate |
| SDS-04 | Account for the existing mSDS Source service | S06, S17 | Existing service reported; optional integration remains unverified; first phase uses Admin-added content without vendor dependency |

## People and reports

| ID | Request | Source | Status / clarification |
| --- | --- | --- | --- |
| ROLE-01 | Admin has full access | S08 | Confirmed; distinguish employee administration and public publishing responsibilities |
| ROLE-02 | Payroll creates jobs and accesses timecard exports | S08 | Confirmed; do not infer all other privileges |
| ROLE-03 | Shop Foreman reads all jobs and edits only the shop job | S08 | Confirmed; clarify document and report exceptions |
| ROLE-04 | Foreman uses assigned job dashboards, timecards, daily logs, and shop orders | S08 | Confirmed |
| ROLE-05 | PM edits jobs without deleting/archiving, views job dashboards, receives assigned-job logs and orders | S08 | Confirmed; all-job versus assigned-job editing needs resolution |
| ROLE-06 | Superintendent, Operations, and CEO have PM-like access and can order for jobs | S02 | Confirmed; exact capabilities and job scope open |
| VISIT-01 | Site visit report for PMs and superintendents; earlier request also includes Operations and CEO | S02, S06 | Confirmed; reconcile all author categories |
| VISIT-02 | Report required whenever a relevant user visits a site | S06 | Confirmed; visit-recording and enforcement mechanism open |
| VISIT-03 | Capture all fields across the two site visit emails | S02, S06 | Confirmed; consolidated in workspace design |
| REPORT-01 | Report builder for forms similar to daily logs | S09 | Confirmed; admin template editing versus developer-built templates open |

## Dashboards and shared information

| ID | Request | Source | Status / clarification |
| --- | --- | --- | --- |
| DASH-01 | Separate Personal and Role dashboard pages/tabs; existing Job dashboard remains the destination when selecting a job | S08, S09, S15 | Confirmed initial structure; preserve existing three workflow options |
| DASH-02 | Personal, Role, and Job dashboards initially; earlier custom-group dashboard request retained for later clarification | S07, S15 | Latest initial structure confirmed; relationship of future custom groups to role workspaces remains open |
| DASH-03 | Add and rearrange modules, including drag-and-drop | S07, S08 | Confirmed; shared versus personal layout editing open |
| DASH-04 | Assigned-job statistics and missing-work alerts | S08 | Confirmed; alert triggers and metrics need definitions |
| DASH-05 | Reusable document explorer module, with SDS first on new surfaces | S14, S16 | Confirmed direction; placement on existing Job dashboards deferred; job context in separate new SDS module/page proposed |
| DASH-06 | Keep all existing Jobs pages and dashboards untouched initially; defer additions, redesign, and eventual jobs-list migration | S15, S16 | Confirmed boundary includes layouts, routes, workflow options, and behavior; new Personal/Role pages are additive |
| DASH-07 | Role dashboards provide consistent shared resources and tools suited to each role, distinct from personal information | S17 | Confirmed purpose; shared role-specific starting layouts; resource/layout editing ownership and multi-role behavior remain open |
| FILE-01 | Job and personal file storage as a central document location | S08 | Confirmed; group sharing proposed to align with DASH-02 |
| WIDGET-01 | Alerts, announcements, calendars, notes, and to-do/checklists | S08 | Confirmed; announcement audiences include job and everyone |
| WIDGET-02 | Document tree, pinned documents, photo/PDF viewers and galleries | S08, S14 | Confirmed; explorer module begins with SDS; other document collections/media follow |
| WIDGET-03 | Job map and contacts | S08 | Confirmed |
| WIDGET-04 | Pie/bar/line charts and PM analytics; investigate spreadsheet integration | S08 | Confirmed planning scope; spreadsheet behavior open |

## Public website and safety tools

| ID | Request | Source | Status / clarification |
| --- | --- | --- | --- |
| WEB-01 | Public website: Company, Location, Safety, Careers, Insights, Projects | S06 | Confirmed latest navigation request |
| WEB-02 | Awards, who-we-are content, office/superintendent/operations/safety biographies | S03 | Confirmed; placement within WEB-01 open |
| WEB-03 | Preconstruction services, estimating, budgeting, and takeoffs | S03 | Confirmed; visible navigation placement open |
| WEB-04 | Admin editing of website text, images, and pages | S09 | Confirmed; draft/preview/publish and revision history proposed |
| WEB-05 | J. E. Dunn website as design reference | S06 | Requested reference; detailed review not performed |
| SAFE-01 | Search AHAs, safety manuals, SDS, orientation documents, policies, manufacturer instructions | S04 | Included by S10; source ownership and access need definition |
| SAFE-02 | AI-assisted answers grounded in company material and OSHA references | S04 | Included by S10; generated examples are not approved safety guidance |
| SAFE-03 | Task-specific JHA/risk-assessment assistance, informed by Calibrated Risk demonstration | S05 | Included by S10; example attachment and expected output missing |
| SAFE-04 | OSHA reference/data lookups | S04 | Included; standards/reference search and enforcement datasets are separate needs to evaluate |
| SAFE-05 | Incident trends, toolbox talks, hazard recognition, training tracking | S04 | Included; workflows and data collection remain to be specified |
| AUTH-01 | Evaluate MFA with Phase 2 IT | S08 | Confirmed evaluation; method, enrollment, and recovery open |
| QA-01 | Automated test coverage, role-based test lists, and controlled releases | S08 | Confirmed |
| OPS-01 | Continuing support, troubleshooting, and requested changes | S08, S09 | Confirmed; response expectations and operating terms open |

## Reconciliation rules

1. Latest SDS priority supersedes the earlier suggested feature order.
2. The detailed site visit email expands the short form; retain items noted and items addressed unless stakeholders explicitly merge them.
3. The latest website navigation does not remove earlier awards, biographies, or services content.
4. Everything in the source set remains in phase scope. Unclear details remain open rather than being treated as approvals.
5. Role-specific defaults and user-customizable dashboards should coexist.
6. Previously delivered email behavior is a regression requirement, not a feature to rebuild.
7. Earlier estimates, release dates, and proposed Copilot stages are historical inputs, not current delivery commitments.
8. S13 resolves the earlier ambiguity about SDS books: combined PDF/print output is required, using master organization filtered by saved job selections. Document explanations are separate.
9. S14 brings a minimal dashboard host and reusable explorer module into SDS delivery. Full module customization remains in phase scope for later stages; it is not a prerequisite for the first SDS release.
10. S15 defines the three initial dashboard types as Personal, Role, and Job. Preserve the current Jobs page and job-selection behavior; its eventual replacement by a jobs-list module is later work. Earlier group requests do not require an additional initial dashboard type.
11. S16 extends the untouched boundary to every existing Jobs dashboard/page. Earlier proposals to add an SDS explorer to those dashboards are superseded for initial delivery. Preserve job SDS requirements through separate new surfaces; do not use them as justification to modify company workflows.
12. S17 resolves SDS ownership and job-selection permissions and confirms the Role dashboard's shared-resource purpose. Admin supplies master content; existing job access is sufficient for SDS selection/export, without changing permissions on existing Jobs pages.
