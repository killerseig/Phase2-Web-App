# Future Dashboard Widgets

## Purpose

This document captures future dashboard, widget, and file-storage ideas so they are not forgotten.

This is not current refactor scope.

The current refactor should only preserve an architecture that can support these ideas later:

- role dashboards
- shared job dashboards
- reusable dashboard cards/modules
- capability-based access
- clean Firebase service/function/storage boundaries
- a consistent Vue component and CSS system

Do not implement widget persistence, drag/drop layouts, file storage, or analytics during the current cleanup/refactor unless the project scope changes.

## Future Product Direction

The long-term idea is that dashboards become the go-to location for job and personal information.

There may eventually be:

- personal dashboards for users
- role dashboards for Admin, Payroll, Shop Foreman, Project Manager, and Foreman
- job dashboards for each job
- configurable widgets that can be added, removed, reordered, or pinned
- shared widgets that show common job information to everyone with access
- role-specific widgets that show only what that user type needs

## Dashboard Customization

Potential direction:

- Users can drag and drop widgets on job dashboards or personal dashboards.
- Widgets can be arranged by user, role, or job.
- Some widgets may be required/pinned by the company.
- Some widgets may be optional/personal.
- Job dashboards should share important job information with everyone who has access.

Open design questions for later:

- Can individual users customize job dashboards, or should job dashboards be controlled by Admin/Project Managers?
- Can personal dashboards be fully customized?
- Should roles have default dashboard templates?
- Should widgets be permission-gated individually?
- Should widget layout be per user, per role, per job, or a mix?

## Widget List

### Alerts

Purpose:

- Let users know if something needs attention.

Possible alerts:

- timecards need to be created
- timecards need to be submitted
- daily logs need to be completed
- shop orders are pending/submitted
- job dates or permits are approaching
- approvals or review items are waiting
- missing required job information

Design notes:

- Alerts should be generated from real workflow state where possible.
- Alerts should be role-aware.
- Alerts should link directly to the related job/module.
- Alerts should not create records just by viewing them.

### Calendar

Purpose:

- Show job or personal events.

Possible uses:

- job schedule reminders
- permit dates
- inspection dates and times
- delivery dates
- personal reminders
- company events

Design notes:

- Calendar events may belong to a job, user, or company-wide context.
- Calendar should eventually support reminders/alerts.
- Job calendar events should be visible only to users with job access.

### Notes

Purpose:

- Let users leave lightweight notes on personal or job dashboards.

Possible uses:

- quick job notes
- reminders
- coordination notes
- temporary field notes

Design notes:

- Notes need author, timestamp, and edit history if used for job records.
- Personal notes and job notes should be separate data types.
- Notes should not replace daily logs.

### Todo List

Purpose:

- Track actionable items.

Possible uses:

- personal todo list
- job todo list
- project-manager task list
- foreman checklist

Design notes:

- Todos should support done/not done.
- Later they may support assignment, due dates, and priority.
- Keep this separate from official submitted records.

### Checklist

Purpose:

- Track what needs to be done and what has been completed.

Possible uses:

- job startup checklist
- closeout checklist
- safety checklist
- required documentation checklist
- training checklist

Design notes:

- Checklists may need templates.
- Some checklist items may be required before job completion.
- Completed checklist items should record who completed them and when.

### Documents Tree

Purpose:

- Provide a central place for job documents and important company documents.

Possible uses:

- job documents
- safety sheets
- plans
- permits
- inspection reports
- photos
- PDFs
- company forms

Design notes:

- This likely needs Firebase Storage plus Firestore metadata.
- Document folders should have permission checks.
- Job documents and global important documents may need different root folders.
- File actions should include upload, download/view, rename, move, archive/delete, and possibly pin.

### Pinned Documents

Purpose:

- Put important documents directly on a dashboard so users do not have to dig through folders.

Possible uses:

- safety sheet
- permit
- current plan set
- job-specific PDF
- SOP
- frequently used form

Design notes:

- Pinned documents should still reference the document storage system.
- Pinning should not duplicate the file.
- Permissions should follow the underlying document.

### Photo/PDF Viewer And Gallery

Purpose:

- Let users view images and PDFs from dashboards.

Possible uses:

- job photo gallery
- daily log photo review
- pinned PDF viewer
- document preview
- project-manager visual review

Design notes:

- Viewer should be read-first.
- Large files should not block dashboard load.
- Consider thumbnails/previews later.
- Keep daily log attachments and general document storage related but not accidentally merged.

### Job Map

Purpose:

- Show job location visually.

Possible uses:

- job address map
- directions link
- nearby job context

Design notes:

- Requires address quality.
- May need external map provider decisions later.
- Do not add this until there is a clear need and provider choice.

### Contacts

Purpose:

- Keep important job or company contact information in one place.

Possible contacts:

- project manager
- foreman
- customer contact
- general contractor
- superintendent
- safety contact
- vendor
- emergency contact

Design notes:

- Contacts may be job-specific or global.
- Some contacts may come from existing users/jobs.
- Some may be external contacts.
- Permission and privacy rules matter.

### Announcements

Purpose:

- Push messages to a job, role, or everyone.

Possible uses:

- company-wide notice
- job-specific update
- urgent safety alert
- training announcement
- schedule change

Design notes:

- Announcements may need read receipts later.
- Announcements should be permission-gated.
- Important announcements may need popup or pinned behavior.

### Business Analytics Modules

Purpose:

- Give Project Managers and Admin users visual business insight.

Possible widgets:

- pie chart
- bar chart
- line chart
- simple metric cards
- job activity summary
- daily log count by job/foreman
- submitted timecard totals
- shop order counts

Design notes:

- Analytics should be based on queryable/reportable data, not broad client reads.
- Project Manager analytics should be scoped to assigned jobs.
- Admin analytics can be broader.
- This will likely need deliberate Firestore indexes or precomputed summaries.

### Spreadsheet Integration

Purpose:

- Potentially connect app data to spreadsheet-style workflows.

Possible uses:

- exports
- imports
- reporting
- payroll/accounting handoff
- job dashboards fed by spreadsheet-like data

Design notes:

- This needs careful scoping before implementation.
- CSV/PDF exports already matter today.
- Do not mix spreadsheet integration with the current refactor.

### Two-Factor Authentication

Purpose:

- Increase login security.

Possible direction:

- user signs in
- user enters a code
- code is sent by email or text
- attacker would need password plus access to user email/phone

Design notes:

- This should involve Phase 2 IT before implementation.
- The app would need reliable email or phone data for users.
- This is separate from normal dashboard widget work, but belongs in the future backlog.

## Future Data Model Thoughts

Do not design the full schema yet, but likely future concepts include:

```text
dashboardLayouts/{layoutId}
dashboardWidgets/{widgetId}
jobs/{jobId}/documents/{documentId}
jobs/{jobId}/announcements/{announcementId}
jobs/{jobId}/contacts/{contactId}
users/{userId}/personalDashboard/{widgetId}
```

Likely shared fields:

- `jobId`
- `ownerUserId`
- `roleKey`
- `widgetType`
- `sortIndex`
- `pinned`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `archived`

Future implementation should follow:

- `firebase-architecture.md`
- `firestore-schema-and-routes.md`
- `frontend-architecture.md`
- `css-architecture.md`

## Future Component Direction

Likely shared components:

- `DashboardGrid`
- `DashboardWidgetFrame`
- `DashboardWidgetHeader`
- `DashboardWidgetActions`
- `PinnedDocumentCard`
- `DocumentTree`
- `AlertList`
- `CalendarWidget`
- `NotesWidget`
- `TodoWidget`
- `ChecklistWidget`
- `ContactsWidget`
- `AnalyticsCard`
- `ChartWidget`

Rules:

- Widgets should be props/events driven.
- Widget persistence should live in services.
- Widget permissions should be capability-driven.
- Widgets should not import Firebase directly.
- Widgets should be read-first and must not create records just by loading.

## Current Refactor Guardrails

During the current refactor:

- Build role dashboards and job dashboards in a way that can host future widgets.
- Keep dashboard module cards reusable.
- Keep permissions capability-based.
- Keep Firebase access behind services.
- Keep CSS token/component structure consistent.
- Do not implement drag/drop widget layout storage yet.
- Do not implement file storage yet.
- Do not implement announcements yet.
- Do not implement analytics yet.
- Do not implement 2FA yet.
