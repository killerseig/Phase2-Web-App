# Current Understanding

## Product

- The rebuild is for Phase 2, a construction company.
- The app replaces three existing field tools:
  - timecards
  - shop orders
  - daily logs
- Tech direction is `Vue + Firebase`.
- Build priority is:
  - core admin functionality needed for a working app
  - Jobs Dashboard page
  - job modules inside the Jobs Dashboard
  - `Timecards` first

## App Structure

- Admins should use the same core pages that foremen use.
- Admin capabilities should appear through `edit mode` on those same pages rather than through a separate admin-only page set.
- Through edit mode, admins should be able to do things like:
  - create jobs
  - edit jobs
  - archive jobs
  - delete jobs
- The Jobs Dashboard is primarily for foremen, but admins should still be able to enter it and edit when needed.
- Foreman flow should be:
  - log into the app
  - choose a job
  - open that job's dashboard
  - choose the module they want to use
- Users should not be able to create accounts through a normal public sign-up flow.
- Account creation should only happen through the admin-created email setup flow.
- The rebuild should keep using the same working email-based setup system as `v1`.

## Save Behavior

- The application should prefer `auto-save` behavior instead of making users press explicit save buttons for routine edits.
- An auto-save should happen on simple commit events such as:
  - clicking a button or toggle that changes data
  - changing a selection
  - leaving or deselecting a text box or other input field
- Users should get lightweight save feedback such as:
  - `Saving...`
  - `Saved`
  - clear error feedback if a save fails

## Roles

- `Admin`
  - full access
  - can create jobs, employees, and users
  - can do anything in the application
  - should see the same base workflow and screens that a foreman sees
  - should enter an explicit `edit mode` when admin-only changes are needed
- `Foreman`
  - works inside assigned jobs
  - fills out timecards, daily logs, and shop orders
- Multiple foremen can be assigned to the same job.
- The first version should use only two built-in roles:
  - `Admin`
  - `Foreman`
- For the first version, the old controller workflow should be handled through `Admin` access.
- The system should be designed so foremen can later be moved into custom non-admin roles.
- A future custom `Controller` role should be possible, but it is not needed in the first version.
- The `Admin` role should always keep full access and should not be part of the customizable role system.

## Devices

- Foremen need the app to work on:
  - laptop
  - tablet
  - phone
- Everything should still work on desktop, laptop, tablet, and phone.

## Visual Direction

- The old Phase 2 web app had useful features, but users felt it looked messy and was not comfortable.
- The networking application is the visual and UX reference for the shell.
- The target feel is:
  - desktop-like
  - dense and organized
  - application-style, not generic SaaS
  - inspired by VS Code and Autodesk Fusion
- Admin tooling should follow the same philosophy as the networking app dashboard:
  - normal runtime/user view first
  - explicit `edit mode` for administrative changes
  - avoid splitting the experience into a completely separate admin-only UI when possible

## Timecards

- The timecard layout needs to look `exactly` like the Excel timecard layout as closely as we can make it.
- The Excel timecard behavior is more important than the current web timecard behavior.
- The current web timecard flow is not acceptable because it does not match the Excel mental model closely enough.
- Timecards are weekly records that cover `Sunday to Saturday`.
- Timecards are the only module that needs PDF output.
- Timecards should export as one combined PDF for the whole week.
- The weekly timecard PDF needs to match the Excel sheet layout exactly.
- That includes keeping the same two-cards-per-page print layout as the Excel file.
- The timecard PDF should match the provided example output exactly.
- The company needs to print timecards each week for documentation.
- The weekly printed output is a core reason the timecard layout must remain exact.
- The app should also support a filtered timecard export workspace for office/admin use.
- The filtered timecard export workspace should be `Admin` only in the first version.
- The filtered timecard export workspace should mainly target `submitted` timecards.
- Admins should also have an option to include `draft` timecards when needed.
- That export workflow should allow filtering by things like:
  - start date
  - end date
  - employee name
  - foreman
  - job
  - similar timecard fields as needed
- Export actions should respect the active filters.
- That means users should be able to generate:
  - PDFs for all timecards in a week
  - PDFs for all timecards on a job
  - CSV exports based on the same filtered set
- In the future, page access like this should be assignable to custom non-admin roles.
- A CSV export example was provided.
- The example CSV columns are:
  - `Employee Name`
  - `Employee Code`
  - `Job Code`
  - `DETAIL_DATE`
  - `Sub-Section`
  - `Activity Code`
  - `Cost Code`
  - `H_Hours`
  - `P_HOURS`
- The CSV export should match the provided example output exactly.
- A PDF example was also provided as a print/layout reference for timecards.
- Card order should be alphabetical.
- The same crew tends to return week to week.
- Employee identity/header information should carry forward week to week.
- When a new week starts:
  - employee information stays
  - weekly entry cells reset blank
- Starting a new week should reuse the previous week's employee roster, but not duplicate the previous week's filled-in card body.
- If a foreman removes an employee card from the current week, that removal should carry forward into the next week's roster.
- Custom employees added to the current week's crew should also carry forward into the next week's roster.
- Foremen can edit current draft timecards until submission.
- Foremen can delete draft timecards before submission.
- Admins should be able to help foremen with current draft timecards when needed.
- Foremen submit a completed week.
- Timecards only need two main statuses:
  - `draft`
  - `submitted`
- Once submitted:
  - the weekly cards blank out for the next cycle
  - the submitted week remains viewable later
  - all later changes to that submitted record should be tracked
- Timecards should keep a visible history of submitted records.
- Foremen should be able to see all submitted timecard records for jobs they are assigned to for now.
- Past submitted weeks:
  - are viewable later
  - are editable by `Admin`
- Foremen should be able to reopen submitted timecard weeks for viewing.
- Reopening a submitted timecard week should not let a foreman edit the submitted record.
- That reopen behavior should be implemented in a way that can be tightened later if the company changes direction.
- The system should be designed so future custom non-admin roles can be granted extra timecard permissions if needed.
- `Saved Cards` is not currently wanted as a separate area in the rebuild.

### Timecard row meanings

Based on the workbook structure and formulas:

- `H` = Hours
- `P` = Production
- `C` = Cost

### Timecard overtime rule

- `REG` hours:
  - if total weekly hours are greater than 40, regular hours are capped at 40
  - otherwise regular hours equal total weekly hours
- `OT` hours:
  - if total weekly hours are greater than 40, overtime is total weekly hours minus 40
  - otherwise overtime is 0

### Job-level timecard calculation settings

- Different jobs can change how production or cost should calculate.
- That should be controlled from the job dashboard when creating or editing a job.
- Jobs should include a configurable `Burden` value that affects those calculations.

## Jobs

- Jobs should have a dashboard or configuration area for job-level settings.
- That dashboard should allow admins to create or edit job settings such as `Burden`.
- The Jobs Dashboard should act as the main hub for job-level modules such as timecards.
- The Jobs Dashboard is the main job workspace that foremen use after selecting a job.
- Archived jobs should only be visible to admins.
- Archived jobs should appear in their own separate section to keep the jobs page clean.
- Job creation/editing should support these required fields:
  - `Job Number`
  - `Job Name`
  - `Foremen assigned to job`
  - `Job Type`
- Job creation/editing should also support these extra fields:
  - `GC`
  - `Start Date`
  - `End Date`
  - `Burden`
  - `Tax Exempt`
  - `Certified`
  - `CIP`
  - `KJIC`
  - `Job Address`
- `Tax Exempt` should default to `false` on new jobs.
- `Certified` should default to `false` on new jobs.
- `GC` should come from a fixed list.
- Admins should be able to manage the `GC` list in the app.
- `GC` is not a required job field.
- `Start Date` is not a required job field.
- `End Date` is not a required job field.
- `Burden` is not a required job field.
- If `Burden` is blank, assume a default value of `0.33` unless changed.
- `Job Address` is not a required job field.
- The exact meaning and expected values for `CIP` and `KJIC` are still unknown and need to be confirmed with the company.
- Example job types include:
  - `Paint`
  - `Acoustics`
  - `Drywall`
  - `Small Jobs`
- `Job Type` should come from a fixed list.
- Admins should be able to manage the fixed `Job Type` list in the app.

## Employees

- The app should support a global employee list.
- Global employee records should include:
  - `First Name`
  - `Last Name`
  - `Employee Number`
  - `Wage`
  - `Occupation`
  - `Contractor`
- `Occupation` should come from a fixed list.
- Admins should be able to manage the `Occupation` list in the app.
- Required employee fields should be:
  - `First Name`
  - `Last Name`
  - `Employee Number`
  - `Wage`
- Timecards should be able to select an employee from that global list.
- Timecards should also allow creation of a custom employee when needed.
- Foremen should be able to remove an employee card from the current week's timecards without affecting the global employee list.
- For custom employees created from a timecard:
  - `First Name` should be required
  - `Last Name` should be required
  - `Employee Number` should be required
  - `Occupation` should be required
  - `Wage` should be required
  - there should be a field for whether the person is a contractor
- Contractors should still require an `Employee Number`.
- If a timecard uses an employee from the global employee list:
  - employee fields on the timecard should auto-fill
  - those linked fields should not be editable directly on the timecard
  - if an admin updates that employee record later, linked draft/current timecards and other current employee-based records should reflect the updated employee information
  - submitted timecards should not auto-update from later employee changes
  - admins should have to intentionally edit a submitted timecard if they want that submitted record updated
- This hybrid approach is important because there is internal company debate about whether a strict global employee list should be required.
- The product should support both workflows cleanly.
- In general, the product should avoid unnecessary exceptions when a more consistent rule will work.
- For the first version, custom timecard employees should stay one-off and should not be promoted into the global employee list.
- Directly converting a custom employee into a global employee from the timecard flow should be left out of the first version.

## Shop Orders

- Users like the current Excel shop order workflow.
- The rebuild should preserve the fast worksheet-style entry flow.
- The main requested improvement is categories that work more like a file explorer.
- Shop orders are tied to a single delivery date.
- Shop orders should only allow `today` or future delivery dates.
- The Excel workflow includes a quick `Thursday delivery` action, and that shortcut is worth preserving in the rebuild.
- Shop orders do not need PDF output.
- The shop catalog should behave like a file system:
  - folders can contain folders
  - folders can contain items
- The shop catalog tree should be shared across all jobs.
- Admins control the folder/category structure.
- Admins should be able to drag and drop folders and items to reorganize the shop tree.
- Foremen should not create or edit catalog folders/categories.
- Foremen should be able to request custom items outside the catalog.
- Foremen should be able to add custom one-off shop items without admin approval.
- This allows the company to control what is normally orderable while still supporting special requests.
- Shop orders only need two main statuses for now:
  - `draft`
  - `submitted`
- Shop order recipient management should follow the same pattern as daily logs.
- That means:
  - admin-managed recipients can be global and per-job
  - foreman-managed recipients are per-job
  - foremen cannot remove or modify admin-managed entries
- Foremen can edit shop order drafts until submission.
- Foremen can delete shop order drafts before submission.
- Once submitted, shop orders are locked for foremen.
- Foremen should be able to reopen submitted shop orders for viewing.
- Reopening a submitted shop order should not let a foreman edit the submitted record.
- That reopen behavior should be implemented in a way that can be tightened later if the company changes direction.
- Shop orders should keep a visible history of submitted records.
- Foremen should be able to see all submitted shop order records for jobs they are assigned to for now.
- The shop does not need a separate fulfillment view in the first version.
- For now, the shop workflow is email-driven:
  - the shop receives the email
  - they call if changes are needed
  - they fulfill from the email they received
- A separate shop fulfillment view may be added later.

## Daily Logs

- Users do not like the current daily log tool as much.
- A proper web form should naturally improve this workflow.
- The content structure still matters, but the old UI does not need to be preserved closely.
- Daily logs are tied to a specific day/date.
- Every daily log field should be required before submission.
- Users should have to actively fill every field, even if the value is `N/A`.
- Foremen can submit multiple daily logs for the same job on the same date if needed.
- Foremen can only submit daily logs for the current day.
- Foremen should not be able to submit daily logs for past or future dates.
- No one, including admins, should be able to create or edit daily logs for past or future dates.
- Daily logs only need two main statuses for now:
  - `draft`
  - `submitted`
- Daily logs do not need PDF output.
- Foremen can edit daily log drafts until submission.
- Foremen can delete daily log drafts before submission.
- Once submitted, daily logs are locked for foremen.
- Foremen should be able to reopen submitted daily logs for viewing.
- Reopening a submitted daily log should not let a foreman edit the submitted record.
- Daily logs should keep a visible history of submitted records.
- Foremen should be able to see all submitted daily log records for jobs they are assigned to for now.

## Daily Log Recipients

- Admins should be able to add email recipients.
- Foremen should also be able to add email recipients.
- Admin-managed daily log recipients should support:
  - global recipients
  - per-job recipients
- Foreman-managed daily log recipients should be per-job recipients.
- Daily log recipients do not need separate `To` and `Cc` groups in the rebuild.
- If an admin adds someone, a foreman cannot remove or modify that admin-managed entry.

## Old App Pieces Worth Preserving

- Daily log form field structure
- general user login flow
- admin-created user setup flow
- password setup flow
- same working email-based account setup system
- remove / confirm-delete workflow

## Shared Component Direction

- Shared recipient-management components should be built for reuse across:
  - daily logs
  - shop orders
  - future modules that need the same pattern

## Audit Trail Direction

- Records should keep track of who created them.
- Records should keep track of who submitted them.
- This should be built in from the start so access rules can be tightened later without changing the data model.
- Submitted timecards should keep a full history of changes made after submission.

## Role Management Direction

- The app should be designed so non-admin permissions are data-driven and expandable.
- The first version should keep built-in roles simple:
  - `Admin`
  - `Foreman`
- Admins may later need to:
  - create custom non-admin roles
  - delete custom non-admin roles
  - manage a permissions table for what each custom role can do
- Foremen should be able to be transferred into those future custom roles.
- The `Admin` role should stay fixed and always keep full access.
