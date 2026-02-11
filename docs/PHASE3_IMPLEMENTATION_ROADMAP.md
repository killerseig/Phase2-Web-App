# Phase 3 Implementation Roadmap

## Overview
This document outlines the implementation strategy for the new data models and how they cascade through the application.

---

## Data Model Changes Summary

### What Changed

1. **User Profile** → Added `assignedJobIds` for foreman role
2. **Job** → Added account#, type, foreman assignments, timecard status
3. **Employee** → Changed from global to **job-scoped** (`jobs/{jobId}/roster/{employeeId}`)
4. **Timecard** → Moved under job, changed to **weekly (Sun-Sat)** format, job-indexed
5. **Daily Log** → Moved under job, added archival support
6. **Constants** → Added foreman role, labor contractors, timecard validation rules
7. **Types** → New models file (`src/types/models.ts`) with all updated interfaces

---

## Implementation Phases

### Phase 3A: Data Models & Validation (CURRENT)
- [x] Create `DATA_MODEL_CHANGES.md` design document
- [x] Create `src/types/models.ts` with new interfaces
- [x] Update constants for foreman role, labor contractors, validation rules
- [x] Create `src/utils/modelValidation.ts` with validation functions
- [ ] **Next: Service layer updates**

### Phase 3B: Service Layer Updates
Services need to be created/updated to use new collection structure:

- [ ] **New**: `src/services/JobRoster.ts` - job-scoped employee management
  - `listRosterEmployees(jobId)`
  - `addRosterEmployee(jobId, employee)`
  - `updateRosterEmployee(jobId, employeeId, updates)`
  - `removeRosterEmployee(jobId, employeeId)`

- [ ] **Update**: `src/services/Timecards.ts`
  - Change queries to use `jobs/{jobId}/timecards/`
  - Update structure to weekly format (weekEndingDate, days[])
  - Add CSV export functionality
  - Update to search by job, not employee
  - Remove approval workflow

- [ ] **Update**: `src/services/DailyLogs.ts`
  - Move to `jobs/{jobId}/dailyLogs/`
  - Add archival support (archived, archivedAt fields)

- [ ] **Update**: `src/services/Jobs.ts`
  - Add timecard status tracking
  - Add foreman assignment management
  - Add account number & GL code validation

- [ ] **Update**: `src/services/Users.ts`
  - Add `assignedJobIds` to user profile updates
  - Add foreman role handling

### Phase 3C: Pinia Store Updates
- [ ] Update `src/stores/auth.ts` - handle foreman role
- [ ] Remove or archive `src/stores/employees.ts` (global employees removed)
- [ ] Create `src/stores/jobRoster.ts` - job-scoped employee state
- [ ] Update `src/stores/jobs.ts` - include timecard status
- [ ] Update `src/stores/users.ts` - handle foreman role assignment

### Phase 3D: View/Component Updates
- [ ] Remove/hide global employee admin panel
- [ ] Create job roster management UI (for foremen)
- [ ] Update Timecards view:
  - Change date selector to Saturday picker
  - Update layout for Sun-Sat week
  - Add daily hours, production, unit cost fields
  - Add daily totals row
  - Restore summary button
  - Add print functionality
- [ ] Update Daily Logs:
  - Add archival/retrieval UI
- [ ] Update Job list:
  - Add timecard status indicator (red/green tag)
- [ ] Update Admin panels:
  - Lock foremen to their jobs
  - Show foreman assignments
  - Hide wages from other jobs

### Phase 3E: Security Rules & Permissions
- [ ] Update Firestore security rules:
  - Foremen can only access their assigned jobs
  - Foremen cannot see wage rates for other jobs
  - Admin can see all
- [ ] Update router guards:
  - Add job access check based on `assignedJobIds`

### Phase 3F: Data Migration & Integration
- [ ] Create migration script (legacy → new structure)
- [ ] Setup Plexis CSV import/export
- [ ] Setup employee import from Plexis

---

## Key Implementation Details

### 1. Job Roster Employee Management
**File**: `src/services/JobRoster.ts`

```typescript
// Add employee to job roster
async function addRosterEmployee(jobId: string, employee: JobRosterEmployeeInput)
  // Validates employee number uniqueness
  // Saves to: jobs/{jobId}/roster/{auto-id}
  
// List employees for a job
async function listRosterEmployees(jobId: string)
  // Returns sorted by last name, first name
  
// Remove from roster (called when foreman removes employee)
async function removeRosterEmployee(jobId: string, employeeId: string)
  // Deletes from: jobs/{jobId}/roster/{employeeId}
```

### 2. Timecard Restructuring
**File**: `src/services/Timecards.ts`

**Old Structure**:
```
timecards/{timecardId}
  - weekStart (Monday)
  - weekEnding (Sunday)
  - employeeId, employeeName
  - lines[] with mon/tue/wed...
```

**New Structure**:
```
jobs/{jobId}/timecards/{timecardId}
  - weekStartDate (Sunday)
  - weekEndingDate (Saturday) ← user selects
  - employeeRosterId ← reference to roster
  - days[] with 7 day objects {date, hours, production, unitCost}
  - totals {hours[], production[], totals}
```

**Key Changes**:
- Search by job: `where('jobId', '==', jobId)`
- Query by week: `where('weekEndingDate', '==', dateStr)`
- Filter by foreman: check job in `assignedJobIds`

### 3. Weekly Timecard Data
**File**: `src/types/models.ts`

```typescript
interface TimecardDay {
  date: string                // YYYY-MM-DD
  dayOfWeek: number          // 0=Sun, 6=Sat
  hours: number              // Hours worked
  production: number         // Units produced
  unitCost: number          // Cost per unit
  lineTotal: number         // production * unitCost
  notes?: string
}

interface TimecardTotals {
  hours: number[]           // [Sun, Mon, Tue, ..., Sat]
  production: number[]
  hoursTotal: number        // Sum
  productionTotal: number
  lineTotal: number
}
```

### 4. Date Handling
**File**: `src/utils/modelValidation.ts`

- `validateWeekEndingDate(dateStr)` - ensure Saturday
- `calculateWeekStartDate(weekEndingDate)` - get Sunday
- `getSaturdayDates(numWeeks)` - get last N Saturdays for selector
- `formatWeekRange(start, end)` - display "MM/DD - MM/DD"

### 5. Account Number Validation
**File**: `src/utils/modelValidation.ts`

```typescript
validateAccountNumber(value)      // Must be exactly 4 digits
validateGLCode(value)             // Must be exactly 3 digits
validateJobAccountLogic(job)      // If GL code → account must be blank
validateEmployeeNumber(value)     // Must be 4-5 digits
```

### 6. Foreman Access Control
**File**: `src/services/Users.ts` and `src/router/index.ts`

```typescript
// In User Profile
assignedJobIds: ['job1', 'job2']  // Which jobs foreman can access

// In route guard
if (role === 'foreman') {
  // Check if route's jobId is in user's assignedJobIds
}

// In service queries
if (role === 'foreman') {
  // Filter: jobs where id in assignedJobIds
  // Hide wage data from other jobs
}
```

### 7. Labor Contractors
**File**: `src/config/constants.ts`

```typescript
export const LABOR_CONTRACTORS = {
  CONTRACTOR_1: {
    id: 'contractor-1',
    name: 'ABC Labor Contractors',
    categories: ['Ironworkers', 'Laborers', ...]
  },
  // 3 contractors total, ~70-80 employees
}
```

In roster employee:
```typescript
contractor?: {
  name: 'ABC Labor Contractors',
  category: 'Ironworkers'
}
```

---

## Firestore Collection Structure (After Migration)

```
firestore/
├── users/{uid}                          ← Added: assignedJobIds
├── jobs/{jobId}                         ← Updated: accountNumber, type, foreman, timecard status
│   ├── roster/{employeeId}              ← NEW: Job-scoped employees
│   ├── timecards/{timecardId}           ← MOVED & RESTRUCTURED: Weekly format
│   │   └── (weekEndingDate, days[], totals)
│   └── dailyLogs/{logId}                ← MOVED: Added archived field
├── shopCatalog/                         ← Unchanged
├── shopOrders/                          ← Unchanged
└── ...
```

**Removed**:
- Global `employees/` collection
- Global `timecards/` collection
- Global `dailyLogs/` collection

**Moved to subcollections** under `jobs/{jobId}/`

---

## Component Updates Required

### Admin Panels
- [ ] Remove `AdminEmployees.vue` (global employee list)
- [ ] Update `AdminJobs.vue` to show timecard status & foreman assignments
- [ ] Update `AdminEmailSettings.vue` if needed

### Foreman Views
- [ ] Create job roster management panel
- [ ] Update Timecards view (major restructure)
  - Date selector → Saturday picker
  - Layout → Sun-Sat columns
  - Fields → hours, production, unit cost per day
  - Add daily totals row
  - Add summary button
  - Add print button
- [ ] Update Daily Logs view
  - Add archive/retrieval UI

### Dashboard
- [ ] Update job list to show timecard status indicator
  - Green tag = timecards submitted
  - Red tag = timecards pending

---

## Testing Checklist

- [ ] Foreman can add/remove employees from job roster
- [ ] Foreman sees only their assigned jobs
- [ ] Foreman cannot see wage rates from other jobs
- [ ] Timecard week selector shows only Saturdays
- [ ] Timecard calculated totals are correct
- [ ] CSV export generates valid Plexis format
- [ ] Timecard status syncs with job
- [ ] Daily logs can be archived/retrieved
- [ ] Employee transitions between jobs work smoothly
- [ ] Account number validation (4 digits)
- [ ] GL code logic (3 digits → blank account#)

---

## Notes

- All timestamps use Firebase `serverTimestamp()`
- Dates stored as ISO string `YYYY-MM-DD`
- Timecards indexed by job, searchable by week ending date
- Foreman role is NEW (separate from employee)
- Global employee list being **removed completely**
- Weekly tracking is **Sunday to Saturday** (Saturday is the period end)

---

## Files Modified/Created

### Created
- `DATA_MODEL_CHANGES.md` (this design doc)
- `src/types/models.ts` (new domain models)
- `src/utils/modelValidation.ts` (validation rules)
- `src/services/JobRoster.ts` (job-scoped employees)

### Updated
- `src/config/constants.ts` (foreman role, contractors, validation)
- `src/stores/jobs.ts` (add timecard status)
- `src/services/Timecards.ts` (restructure)
- `src/services/Jobs.ts` (account#, foreman, status)
- `src/router/index.ts` (job access checks)
- `firestore.rules` (security updates)

### Removed
- Global employees admin panel
- Global employees service queries
- `src/services/Employees.ts` (jobId version becomes JobRoster)

---

## Success Criteria

✅ Foremen can manage their own job rosters  
✅ Timecards are weekly (Sun-Sat) and job-indexed  
✅ Foremen cannot see other jobs or wage rates  
✅ Timecard data supports hours + production + unit cost  
✅ Daily logs can be archived and retrieved  
✅ CSV export works with Plexis format  
✅ Account number validation enforced  
✅ Employee transitions between jobs handled gracefully  
✅ All legacy data migrated to new structure  
