# Role Capability Matrix

Date started: 2026-07-08

Purpose: this is the source-of-truth permission target for the refactor. It turns the client role notes into capabilities that can be implemented consistently in frontend route guards, UI affordances, Firestore Rules, Storage Rules, Cloud Functions, and tests.

## Target Roles

Stored role keys should eventually be:

- `admin`
- `payroll`
- `shop-foreman`
- `project-manager`
- `foreman`
- `none`

Temporary/current state:

- The current app still uses `admin`, `foreman`, `project-manager`, and `none`.
- `project-manager` is temporarily treated like `foreman`.
- That alias must not survive the role refactor.

## Role Summary

| Role | Summary |
| --- | --- |
| `admin` | Full access to all app areas, setup, records, exports, users, employees, jobs, catalog, dashboards, and workflow records. |
| `payroll` | Employee management, timecard export, timecard locking, job creation, and read-only job lookup. No shop order forms or job editing after creation unless later confirmed. |
| `shop-foreman` | Shop catalog management, read-only all-job lookup, and editable workflows for the `Shop` job. Same timecard ability as a foreman for the Shop job. |
| `project-manager` | Assigned jobs only for job dashboards/workflow visibility. Can edit assigned jobs but cannot delete/archive. Can view submitted timecards for billing. Receives Daily Log and Shop Order emails for assigned jobs. |
| `foreman` | Assigned job dashboards for timecards, daily logs, and shop orders. Receives Daily Log and Shop Order emails for assigned jobs. No setup/admin access. |
| `none` or inactive | No app workspace access. |

## Capability Table

Legend:

- `Yes`: allowed.
- `Assigned`: allowed only for jobs assigned to the user.
- `Shop`: allowed for the Shop job unless later expanded.
- `Read`: read-only.
- `No`: not allowed.
- `TBD`: needs company confirmation before implementation.

| Capability | Admin | Payroll | Shop Foreman | Project Manager | Foreman |
| --- | --- | --- | --- | --- | --- |
| Sign in to app | Yes | Yes | Yes | Yes | Yes |
| Role dashboard | Admin dashboard | Payroll dashboard | Shop Foreman dashboard | PM dashboard | Foreman dashboard |
| View all jobs list | Yes | Read | Read | Read | No |
| View assigned jobs list | Yes | Read | Yes | Yes | Yes |
| Create jobs | Yes | Yes | No | No | No |
| Edit all jobs | Yes | No | No | No | No |
| Edit assigned jobs | Yes | No | No | Yes | No |
| Edit Shop job setup | Yes | TBD | TBD | No unless assigned | No unless assigned and explicitly allowed |
| Archive jobs | Yes | No | No | No | No |
| Delete jobs | Yes | No | No | No | No |
| Manage global notification defaults | Yes | No | No | No | No |
| Manage job notification defaults | Yes | No | No | Assigned | No |
| Open job dashboard | Yes | No workflow dashboard by default | Shop | Assigned | Assigned |
| Create/edit timecards | Yes | No, export/lock only | Shop | No by default; view submitted for billing | Assigned |
| Submit timecards | Yes | No | Shop | No | Assigned |
| View submitted timecards | Yes | Yes, all through export | Shop | Assigned | Assigned own/assigned workflow |
| Timecard export | Yes | Yes | No | TBD: assigned billing view/export | No |
| Lock timecards | Yes | Yes | No | No | No |
| Delete draft timecard weeks | Yes | Yes if needed for export cleanup | No | No | No |
| Create daily logs | Yes | No | Shop | Assigned if company wants PM entry; otherwise view | Assigned |
| Edit daily log drafts | Yes | No | Shop | Assigned if PM-created; otherwise no | Assigned own/assigned workflow |
| View submitted daily logs | Yes | No by default | Shop | Assigned | Assigned |
| Submit daily logs | Yes | No | Shop | Assigned if company wants PM entry; otherwise no | Assigned |
| Receive daily log emails | Can be global/job recipient | No automatic field emails | Shop and assigned workflow jobs | Assigned | Assigned |
| Create shop orders | Yes | No | Shop | Assigned if company wants PM ordering; otherwise view | Assigned |
| Edit shop order drafts | Yes | No | Shop | Assigned if PM-created; otherwise no | Assigned |
| Submit shop orders | Yes | No | Shop | Assigned if company wants PM ordering; otherwise no | Assigned |
| View submitted shop orders | Yes | No by default | Shop | Assigned | Assigned |
| Receive shop order emails | Can be global/job recipient | No automatic field emails | Shop and assigned workflow jobs | Assigned | Assigned |
| Manage shop catalog | Yes | No | Yes | No | No |
| View shop catalog for ordering | Yes | No | Yes | Assigned workflow only if ordering allowed | Assigned workflow only |
| Manage employees | Yes | Yes | No | No | No |
| View employee admin list | Yes | Yes | No | No | No |
| Manage users | Yes | No | No | No | No |
| Reference/list settings | Yes | No | No | No | No |

## Implementation Targets

Frontend:

- Add a capability helper that answers questions like `canManageEmployees`, `canUseTimecardExport`, `canCreateJob`, `canEditJob`, `canOpenJobDashboard`, `canUseShopCatalog`, and `canManageUsers`.
- Map protected route metadata to target role capabilities before wiring Vue Router/AppShell navigation so Payroll and Shop Foreman get only their requested admin-like routes.
- Keep the future Vue Router guard behind one target route-access helper so public redirects, workspace gating, protected route capabilities, and job-scoped dashboard access stay testable outside the router.
- Keep target AppShell navigation behind one helper so Dashboard/Jobs workspace links, admin/sidebar links, and role labels are capability-driven instead of duplicated in the layout template.
- Reuse a single assigned-job membership helper across target role policies so route guards, dashboards, email recipients, and timecard access all agree on job scoping.
- Keep Daily Log and Shop Order module viewing separate from create/edit/submit checks so PM assigned-job visibility can launch view-first modules without granting field-entry rights before the company confirms that behavior.
- Keep Timecard Export/locking, job timecard workflow edit/submit, and Project Manager submitted-timecard reporting as separate policy checks so PM billing visibility does not imply export/lock access.
- Route guards should call capabilities, not scattered role-name checks.
- Role dashboards should render modules based on capabilities.
- Job dashboards should render workflow modules based on job-scoped capabilities.

Firestore Rules:

- Mirror the same capabilities at document/path level.
- Do not rely on UI hiding.
- Keep sensitive employee data Admin/Payroll only.
- Keep PM timecard reporting scoped to submitted records for assigned jobs.
- Keep Shop Foreman catalog access explicit.

Cloud Functions:

- Use shared auth/capability helpers.
- Use `HttpsError` for callable failures.
- Validate target resource access server-side.
- Include assigned Foremen, Shop Foremen, and Project Managers in Daily Log and Shop Order email recipient resolution.
- Reuse the target field-email recipient policy when wiring live Daily Log and Shop Order delivery so assigned-role recipients are not reimplemented differently per function.

E2E Runtime:

- Add seeded users for every target role.
- Preserve current behavior tests while adding role-specific tests.
- Include negative tests for "can view jobs list but cannot open workflow" cases.

## Required Test Coverage Before Completion

- Payroll can access Employees and Timecard Export.
- Payroll can create a job and cannot delete/archive a job.
- Payroll cannot access shop order forms.
- Shop Foreman can manage Shop Catalog.
- Shop Foreman can use the Shop job workflows.
- Shop Foreman can view all jobs read-only.
- Project Manager can edit assigned jobs only.
- Project Manager cannot delete/archive jobs.
- Project Manager can view submitted timecards for assigned jobs.
- Project Manager cannot view unassigned job dashboards.
- Foreman can create and submit timecards for assigned jobs.
- Foreman cannot see employee admin data, user admin, catalog admin, or timecard export.
- Assigned Foremen, Shop Foremen, and Project Managers are included in Daily Log and Shop Order emails.
- Automatic field-email recipient resolution skips inactive users, users without valid email addresses, unassigned field users, Payroll, Admin, and no-access users unless they are explicitly configured as normal job/global recipients.

## Completion Evidence

2026-07-17 audit status: browser and policy coverage is in place for the required role matrix behaviors below. Firestore/Storage Rules emulator proof is intentionally deferred under `R08`, so this table does not claim direct emulator verification.

| Requirement | Evidence |
| --- | --- |
| Payroll can access Employees and Timecard Export. | `e2e/access-control.spec.ts` covers Payroll creating/editing an employee and opening Timecard Export; verified by `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium` passing 17/17. |
| Payroll can create a job and cannot delete/archive a job. | `e2e/jobs.spec.ts` covers Payroll job creation and read-only job setup without archive/delete controls; protected by the Jobs role E2E suite. |
| Payroll cannot access shop order forms. | `e2e/access-control.spec.ts` covers Payroll redirect away from `/jobs/job-e2e/shop-orders`; verified by the 17/17 access-control E2E run. |
| Shop Foreman can manage Shop Catalog. | `e2e/admin-pages.spec.ts` covers Shop Foreman opening `/settings/shop-catalog`, restricted admin navigation, and create/edit catalog mutation through the real page. |
| Shop Foreman can use the Shop job workflows. | `e2e/access-control.spec.ts` covers Shop Foreman opening Shop Orders from the dashboard plus direct Shop Daily Logs and Shop Timecards without explicit assignment; verified by the 17/17 access-control E2E run. |
| Shop Foreman can view all jobs read-only. | `e2e/access-control.spec.ts` covers Shop Foreman seeing Shop and non-Shop jobs in `/jobs`, lacking setup create/edit controls, and being denied non-Shop workflow drill-in; verified by the 17/17 access-control E2E run. |
| Project Manager can edit assigned jobs only. | `e2e/jobs.spec.ts` covers PM editing assigned jobs, seeing unassigned jobs read-only, and lacking create/archive/delete controls. |
| Project Manager cannot delete/archive jobs. | `e2e/jobs.spec.ts` checks assigned PM job setup has no archive/delete/restore controls. |
| Project Manager can view submitted timecards for assigned jobs. | `e2e/access-control.spec.ts` covers assigned PM submitted-timecard report mode with draft/edit/submit controls unavailable; verified by the 17/17 access-control E2E run. |
| Project Manager cannot view unassigned job dashboards. | `e2e/access-control.spec.ts` covers direct unassigned job dashboard redirect; verified by the 17/17 access-control E2E run. |
| Foreman can create and submit timecards for assigned jobs. | `e2e/timecard-workbook.spec.ts` covers Foreman timecard create/submit workflows, including job-record assignment when profile assignments are stale. |
| Foreman cannot see employee admin data, user admin, catalog admin, or timecard export. | `e2e/access-control.spec.ts` covers Foreman redirect away from Users, Employees, Timecard Export, and Shop Catalog plus hidden admin navigation; verified by the 17/17 access-control E2E run. |
| Assigned Foremen, Shop Foremen, and Project Managers are included in Daily Log and Shop Order emails. | `src/__tests__/targetFieldEmailRecipients.spec.ts` and `src/__tests__/functionTargetFieldEmailRecipients.spec.ts` cover frontend/Functions automatic field-email recipient policy parity. |
| Automatic field-email recipient resolution skips inactive users, invalid email users, unassigned field users, Payroll, Admin, and no-access users unless explicitly configured as normal recipients. | `src/__tests__/targetFieldEmailRecipients.spec.ts` and `src/__tests__/functionTargetFieldEmailRecipients.spec.ts` cover normalization, dedupe, sorting, inactive/invalid/unassigned filtering, and Admin/Payroll/no-access exclusion; verified with the field policy unit command below. |

Verification commands from the 2026-07-17 audit:

- `npm run type-check`: passed.
- `npm run test:e2e -- e2e/access-control.spec.ts --project=chromium`: passed, 17/17.
- `npm run test:unit -- --run src/__tests__/routeAccess.spec.ts src/__tests__/targetRouteAccess.spec.ts src/__tests__/targetJobAccess.spec.ts src/__tests__/capabilities.spec.ts src/__tests__/useJobsLifecycle.spec.ts`: passed, 47/47, using the approved elevated Vitest path after sandboxed Vitest hit the known Windows/Vite `spawn EPERM` startup issue.
- `npm run test:unit -- --run src/__tests__/targetFieldEmailRecipients.spec.ts src/__tests__/functionTargetFieldEmailRecipients.spec.ts src/__tests__/targetFieldWorkflowAccess.spec.ts src/__tests__/functionTargetFieldWorkflowAccess.spec.ts src/__tests__/targetTimecardAccess.spec.ts src/__tests__/functionTargetTimecardAccess.spec.ts`: passed, 31/31, using the approved elevated Vitest path.

## Open Questions

- Should Project Managers be able to export/download assigned-job timecards as PDF/CSV, or only view them in-app?
- After Payroll creates a job, can Payroll edit that job later or only create/read?
- Does Shop Foreman edit the Shop job setup fields or only the Shop job workflows?
- If Shop Foreman is assigned to a non-Shop job, should they get normal Foreman workflow access for that job?
- Should Project Managers ever create/submit Daily Logs and Shop Orders, or only view/receive them?

Move answers into this file and `current-understanding.md` once confirmed.
