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

## Open Questions

- Should Project Managers be able to export/download assigned-job timecards as PDF/CSV, or only view them in-app?
- After Payroll creates a job, can Payroll edit that job later or only create/read?
- Does Shop Foreman edit the Shop job setup fields or only the Shop job workflows?
- If Shop Foreman is assigned to a non-Shop job, should they get normal Foreman workflow access for that job?
- Should Project Managers ever create/submit Daily Logs and Shop Orders, or only view/receive them?

Move answers into this file and `current-understanding.md` once confirmed.
