# Timecards Rebuild Blueprint

## Purpose

This document defines the replacement architecture for the Timecards feature.

The current web implementation is structurally clean enough to maintain, but it is based on the wrong product model. The customer wants the web experience to follow the Excel workbook workflow and layout much more closely.

This is therefore a redesign and rebuild, not just another refactor.

## Source Of Truth

The rebuild should be guided by these references:

- `customer files/P2_Time_Cards.xlsm`
- `customer files/P2_Time_Cards - Filled Out.xlsm`
- `customer files/2026-02-28 AGUTIERREZ TERM.csv`
- `customer files/Phase2-Scanner@Phase2Co.Com_20260306_100005.pdf`

The workbook is the source of truth for:

- card layout
- employee workflow
- week-scoped workspace behavior
- accounts summary behavior
- two-cards-per-page print layout

The web app intentionally does **not** need to reproduce these Excel-only mechanics:

- printer selection
- direct print commands
- emailing the workbook
- worksheet copy/delete/protection tricks

## Confirmed Product Decisions

These decisions are already confirmed.

- Timecards are scoped to one `job + week ending` at a time.
- The work week is `Sun-Sat`.
- A foreman sees employees assigned to their job.
- Employees come from the job roster only.
- If an employee is missing, the foreman must contact an admin.
- The weekly workspace should include all active roster employees automatically.
- Active roster employees may still be subcontracted employees.
- The old Excel `Saved Cards` concept is not needed in the web version.
- The main workspace should focus on one selected card at a time.
- A searchable employee list should be available for navigation.
- The on-screen card should look the same as Excel.
- The `H / P / C` row structure should remain exactly the same.
- The number of job lines should stay fixed for now.
- If a field does not have a system-driven function, it can be editable.
- Employee master data like wage, occupation, and employee identity should not be editable by foremen here.
- The accounts summary should remain visible and useful.
- Submission should generate one weekly `PDF + CSV`.
- The `PDF` is for accounting to print.
- The `CSV` is for import into accounting/payroll software.
- After submit, the week becomes read-only for foremen.
- Controller will later reuse the same system but with edit and print-range powers.
- The PDF must be a near-clone of the workbook card layout, with two timecards per page.

## Current Implementation Mismatch

The current web page in `src/views/Timecards.vue` is based on a list of accordion-style editors.

That conflicts with the workbook model in several ways:

- it is list-first instead of workspace-first
- it treats timecards like expandable records instead of fixed card canvases
- it allows manual employee creation instead of roster-driven creation
- it copies previous-week cards instead of ensuring the full roster is represented
- it uses a simplified CSV export format that does not match the sample import file
- it emails submitted timecards through the current workflow instead of building the final weekly PDF + CSV package first

The rebuild should replace this mental model rather than continue refining it.

## Target User Experience

### Foreman Experience

The foreman opens Timecards for one job and one week.

The page should show:

- a page header for job + week context
- a searchable employee list for the selected week
- one main card canvas that visually matches the Excel card
- an accounts summary panel
- a weekly action bar for save/submit/export state

The employee list should be built from the active roster for that job and week.

Each employee should always have a card for the selected week, even if it remains blank or zeroed out. This supports the controller requirement that every employee be accounted for.

After submission:

- foremen can view but not edit
- controller/admin flows can still edit later

### Controller Experience

Controller should later reuse the same card canvas and week workspace components with different permissions.

Controller-specific powers will include:

- edit submitted cards
- review any range of cards
- print/export subsets if needed

The important architectural rule is that Controller should reuse the new timecard card system, not fork its own layout.

## Target Page Structure

`src/views/Timecards.vue` should become a thin route view that mostly composes shared sections.

Target shape:

```vue
<AppPageHeader />
<TimecardWeekToolbar />
<TimecardWeekWorkspace />
<TimecardSubmissionBar />
```

Inside the workspace:

```vue
<TimecardWeekWorkspace>
  <TimecardEmployeeList />
  <TimecardCardCanvas />
  <TimecardAccountsSummary />
</TimecardWeekWorkspace>
```

## Proposed Component Architecture

### Route Layer

- `src/views/Timecards.vue`

Responsibilities:

- route params
- page composition
- top-level guards only

### Shared Timecards Domain Components

- `TimecardWeekToolbar`
  - job/week context
  - week picker
  - search input
  - counts/status

- `TimecardWeekWorkspace`
  - high-level workspace layout
  - responsive one-card/two-column shell

- `TimecardEmployeeList`
  - searchable roster-backed list
  - selection state
  - draft/submitted/read-only indicators
  - support for large weekly rosters

- `TimecardCardCanvas`
  - exact workbook-inspired card layout
  - fixed line count
  - exact `H / P / C` row grouping
  - read mode vs edit mode using the same layout

- `TimecardCardHeader`
  - employee name
  - employee number
  - occupation
  - wage
  - week ending

- `TimecardLineGrid`
  - fixed number of job entry groups
  - exact `JOB #`, `ACCT`, `DIF`, day columns, `TOTAL`, `PROD`, `OFF`
  - same physical structure as workbook

- `TimecardTotalsPanel`
  - totals
  - OT / REG
  - office / amount summary fields as required by the layout

- `TimecardNotesPanel`
  - notes section matching workbook placement

- `TimecardAccountsSummary`
  - aggregated summary like the workbook accounts panel

- `TimecardSubmissionBar`
  - save/submission state
  - submit week
  - export state messaging

### Reuse Expectations

These components should be shared by:

- foreman Timecards page
- controller timecard review/edit flows

The goal is one reusable workbook-style timecard system with permission/mode differences, not two parallel implementations.

## Proposed Composable Architecture

### `useTimecardWeekWorkspace`

Owns:

- selected week
- selected employee/timecard
- employee search
- workspace initialization
- read-only/editability state

### `useTimecardWeekRoster`

Owns:

- active roster subscription
- filtering to active employees only
- roster-to-card mapping
- ensuring every active employee has a card for the selected week

### `useTimecardWeekCards`

Owns:

- weekly timecard subscription
- card hydration
- optimistic saves
- card selection
- dirty/persist state

### `useTimecardCardEditing`

Owns:

- edits within the selected card
- fixed-line mutations
- totals recalculation
- same-layout edit/read behavior

### `useTimecardAccountsSummary`

Owns:

- workbook-equivalent account aggregation
- grouping and rollup behavior
- derived summary rows for the right-side panel

### `useTimecardSubmission`

Owns:

- weekly submit flow
- read-only transition for foremen
- PDF build orchestration
- CSV build orchestration
- email trigger orchestration

## Data Model Direction

The existing `Timecard` model is close enough to evolve, but it needs reshaping for workbook fidelity.

### Keep

- `jobId`
- `weekStartDate`
- `weekEndingDate`
- `status`
- `employeeRosterId`
- `employeeNumber`
- `employeeName`
- `occupation`
- `employeeWage`
- `subcontractedEmployee`
- `notes`
- `archived`

### Rethink

- current `jobs[].days[]` structure
- current top-level `days[]`
- simplified totals assumptions
- freeform creation flow

### Target Direction

The model should explicitly support workbook rows and fixed layout:

- fixed line count per card
- exact H/P/C grouping
- per-line day values
- summary values needed for the clone PDF
- enough normalized data to produce the sample CSV shape

It may be worth introducing a workbook-oriented shape such as:

- `lines[]`
  - `jobNumber`
  - `account`
  - `dif`
  - `hours[7]`
  - `production[7]`
  - `cost/unit/office values as needed`

This can still be stored in Firestore cleanly while making the UI and PDF generation much simpler.

## Weekly Initialization Rules

When a foreman opens a job/week:

1. Load the job roster.
2. Keep only active roster employees.
3. Load existing timecards for that job/week.
4. Ensure there is one timecard per active roster employee.
5. Create missing cards automatically if needed.
6. Sort the employee list predictably.
7. Select the first employee or preserve the prior selection if still present.

This replaces the current manual create-card workflow.

## Editability Rules

### Foreman

Before submit:

- can edit card work fields
- can edit notes
- cannot edit employee master data

After submit:

- read-only

### Controller

Later phase:

- can review submitted weeks
- can edit submitted cards
- can print/export ranges as needed

## Accounts Summary Rules

The Excel `CalculateAccounts_Click` behavior should be reproduced as derived app logic, not by mimicking cell operations.

The new accounts summary should:

- scan the weekly active cards
- read each populated line
- group by the workbook's effective account key
- sum hours and production
- display the same summary concepts the Excel panel uses

This should live in derived logic and be testable with plain data inputs.

## CSV Export Requirements

The current CSV service output is too simple and does not match the sample import file.

The rebuild should define a new CSV builder that matches the real required format from:

- `customer files/2026-02-28 AGUTIERREZ TERM.csv`

The builder should:

- export the whole selected week
- output one row per detail line as required by the accounting software
- use roster-backed employee data
- preserve the expected column order
- be test-driven with fixture-based snapshots

This should likely live as a dedicated service or utility, not as a view concern.

## PDF Export Requirements

The PDF is not a generic report.

It must:

- visually clone the workbook card layout
- render two cards per page in landscape orientation
- preserve the workbook's card proportions and grouping
- include the same fields accounting expects to print
- export the whole week in one package

The website does not need direct printing controls.
It only needs to generate the PDF artifact used for email and later printing.

## Submission Flow

Target weekly submission flow:

1. Validate the weekly cards.
2. Persist any pending optimistic edits.
3. Generate the weekly CSV.
4. Generate the weekly PDF.
5. Email both artifacts.
6. Mark the week submitted.
7. Lock the foreman view into read-only mode.

If email fails after generation:

- submission state should not silently lie
- the app should clearly show whether the week was marked submitted
- retry handling should be explicit

## Styling Direction

The rebuilt system should still follow the shared Sass architecture already established in the app.

Suggested additions:

- `_timecardWorkbook.scss`
- `_timecardEmployeeList.scss`
- `_timecardAccountsSummary.scss`
- `_timecardPdfPreview.scss` if preview UI is introduced

The workbook-clone layout should be centralized in Sass so later visual tuning stays manageable.

## Migration Strategy

This should be built in parallel with the legacy implementation, then swapped over.

### Phase 1

- finalize this blueprint
- reshape the timecard data model if needed
- build CSV/PDF builders against fixtures

### Phase 2

- build the new workbook-style shared components
- build the new week workspace composables
- wire roster-driven weekly initialization

### Phase 3

- replace `src/views/Timecards.vue` with the new page composition
- keep the old controller integrations untouched temporarily

### Phase 4

- migrate Controller onto the same shared card/workspace system
- add controller-specific review/edit/export powers

### Phase 5

- delete the legacy accordion-style timecard editor stack once fully replaced

## Legacy Pieces Likely To Be Replaced

These parts are likely legacy once the rebuild starts:

- `src/views/Timecards.vue`
- `src/components/timecards/TimecardsToolbar.vue`
- `src/components/timecards/TimecardCreateModal.vue`
- current accordion-driven use of `src/components/timecards/TimecardEditorCard.vue`
- `src/composables/timecards/useTimecardWorkflow.ts`

Some lower-level pieces may still be partially reusable, but the rebuild should not assume they are.

## Implementation Guardrails

- Do not keep the accordion/list-first UX.
- Do not allow ad hoc employee creation from Timecards.
- Do not treat the current simple CSV export as good enough.
- Do not add a printer-selection feature to the web app.
- Do not split foreman and controller into two completely separate timecard UI systems.
- Do not change the visible card structure just because the web version could be cleaner.

## Definition Of Done

This rebuild should be considered complete when:

- the foreman Timecards page follows the workbook layout closely
- all active roster employees are represented for the selected job/week
- the employee list + search workflow is smooth
- the main card matches Excel closely enough to satisfy the customer
- the accounts summary is visible and correct
- weekly submit generates one `PDF + CSV`
- the PDF is a two-cards-per-page clone suitable for accounting printing
- the CSV matches the import format actually required by the office
- foremen are read-only after submit
- the controller path can be migrated onto the same component system without redoing the card UI
