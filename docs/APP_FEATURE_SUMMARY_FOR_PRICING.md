# Application Feature Summary (for Pricing Discussion)

## High-Level Overview
This is a custom role-based construction operations web application built with Vue 3 and Firebase. It organizes work by job, with job-specific modules for Daily Logs, Timecards, and Shop Orders, plus full admin tooling for users, jobs, catalog management, and email routing.

## User Roles
- Admin
- Foreman
- Employee
- Shop
- None (restricted/no module access)

## Authentication and Account Lifecycle
- Secure sign-in with role-aware access control.
- Password reset flow from login.
- Admin-only account creation (public signup disabled).
- New-user onboarding via secure setup token and set-password link.
- Deactivated users are automatically blocked/signed out.
- Unauthorized route handling for blocked pages or disallowed job access.

## Authorization and Access Control
- Route-level role guards.
- Job-level access enforcement (including foreman assigned-job restrictions).
- Module visibility changes by role and roster membership.
- Real-time profile listener updates role and active status during a session.

## Core Job Workflow
- Dashboard lists active jobs (and archived jobs for admins).
- Job Home acts as module launcher for each selected job.
- Job context/status display including current weekly timecard submission state.

## Daily Logs Module
- Create, auto-save, edit, submit, and delete daily logs.
- Date-based log browsing and load-by-date behavior.
- Draft vs submitted state management.
- View-only behavior for non-editable past/future contexts.
- Structured sections including:
  - Site information
  - Manpower lines
  - Schedule and assessment
  - Indoor climate readings
  - Safety and concerns
  - Deliveries/materials and additional notes
- Attachment uploads/deletes via Firebase Storage.
- Recipient management and send-by-email workflow.
- Cleanup/support utilities for deleted logs and live log subscription support.

## Timecards Module
- Weekly (Sun–Sat) timecard model.
- Create/edit/delete employee timecards with day-level entries.
- Auto-generate weekly timecards.
- Submit individual or all week timecards.
- Archive/unarchive timecards.
- Copy-from-previous-week support.
- Weekly totals/stat summaries.
- CSV export for selected timecards and all submitted timecards.
- Track “timecards sent” status on jobs.
- Email submission flow with recipient settings.

## Shop Orders Module
- Job-scoped order creation and management.
- Line-item editing with quantity/notes.
- Status workflow (draft → submitted/ordered → received).
- Real-time subscription/list updates.
- Search and filter on orders.
- Email send for submitted orders.
- Integration with category/catalog tree for item selection.

## Admin: Users and Employees
- User list with sorting and status.
- Create user (with welcome/setup email), edit user profile/role, delete user.
- User deletion includes cleanup from recipient lists.
- Employee CRUD management.
- Foreman assignment support and job-assignment sync behavior.

## Admin: Jobs
- Full job CRUD.
- Archive/activate jobs.
- Rich job metadata fields including:
  - Code, PM, foreman, GC
  - Address, start/finish dates
  - Tax/certified/CIP/KJIC flags
  - Account number and job type
- Foreman assignment support.
- Job-level daily log recipient management.
- Timecard export across jobs/week.

## Admin: Shop Catalog
- Nested category tree management.
- Catalog item CRUD (description/SKU/price/active).
- Archive/reactivate/delete categories.
- Search with tree auto-expansion for matching results.
- Handling for categorized and uncategorized items.

## Admin: Email Settings
- Global recipient lists for:
  - Timecard submissions
  - Shop order submissions
  - Daily log default recipients
- Per-job daily log recipient lists.
- One-click “remove recipient everywhere” cleanup across global and job lists.

## Admin: Data Migration and Integration Tools
- Legacy-to-job-scoped data migration utility.
- Migration verification and result reporting.
- Plexis integration utilities:
  - Export timecards to Plexis CSV
  - Validate and import Plexis employee CSV into job rosters

## Data Entities / Domain Model Coverage
- Users and roles
- Jobs
- Employees
- Job roster employees (job-scoped)
- Daily logs
- Timecards
- Shop catalog items and categories
- Shop orders
- Email settings and recipient lists

## Cloud Functions and Backend Automation
- Send daily log emails.
- Send timecard emails (including generated CSV/PDF attachments).
- Send shop order emails.
- Admin callable endpoints for create-user and delete-user.
- Verify setup token and set-user-password endpoints.
- Recipient cleanup callable endpoint.
- Firestore trigger for automatic recipient cleanup when access is revoked.
- Scheduled secret-expiration notification for admins.

## Quality and Engineering Notes
- Role-aware routing and guarded navigation.
- Service-layer architecture with centralized constants/error handling/validation patterns.
- Stores/composables for auth, jobs, roster, shop, and permissions.
- Automated test coverage for key services/stores/router guard (daily logs, jobs, timecards, users, shop, storage, access guard, etc.).

## Scope and Effort (Non-Technical Explanation)

### Why this is a substantial custom build
This is not a simple website with static pages. It is a business operations platform with multiple user roles, job-level permissions, workflow states, data validation, file storage, reporting exports, and automated emails. It includes both a full frontend application and a backend automation layer.

### Size Indicators (Measured from codebase)
> Approximate project metrics as of March 3, 2026.

- **~22,388 lines of code** across frontend, backend functions, and tests.
- **112 code files** across the main app, cloud backend, and tests.
- **Frontend app:** 92 files / ~18,913 lines.
- **Cloud backend functions:** 5 files / ~2,247 lines.
- **Automated tests:** 15 files / ~1,228 lines.
- **15 user-facing view screens** (login, dashboard, job modules, admin pages, etc.).
- **22 reusable UI components** (shared tables, forms, navigation, and module components).
- **17 service-layer modules** handling business/data operations.
- **8 application stores** for state management.
- **11 deployed cloud function exports** for backend workflows/automation.
- **19 named routes** with role-based navigation/security handling.

### What these numbers mean in plain language
- This project has the footprint of a **small-to-mid internal business platform**, not a brochure website.
- It includes **multiple independent subsystems** (Daily Logs, Timecards, Shop Orders, User/Admin Management, Catalog, Email Automation, Migration Tools).
- The codebase size reflects not only screens, but also **business rules**, **security rules**, **data integrity handling**, and **error handling**.
- The test coverage indicates effort spent on **stability and maintainability**, not just “making it work once.”
- Backend automation (email workflows, account onboarding, cleanup triggers) means this includes **operational infrastructure**, not only UI work.

### Client-Friendly Scope Statement (for pricing conversations)
This project is a custom-built operations system that combines:
1. A role-based web application for daily field workflows,
2. Administrative tools for managing jobs, users, data, and recipients,
3. Cloud backend automation for onboarding, notifications, and cleanup,
4. Reporting/export capabilities for payroll/integration workflows,
5. Test coverage and architecture patterns that support long-term use.

In practical terms, this represents a production-grade internal business app with significant implementation depth, not a lightweight template setup.
