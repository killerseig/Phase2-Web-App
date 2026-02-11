# Phase 3 Quick Reference Guide

## New Data Models at a Glance

### User Profile (Updated)
```typescript
{
  id: string
  email, firstName, lastName
  role: 'admin' | 'employee' | 'shop' | 'foreman' | 'none'  // NEW: foreman
  active: boolean
  assignedJobIds?: string[]  // NEW: Foreman's accessible jobs
}
```

### Job (Updated)
```typescript
{
  id: string
  name, code?: string (3-digit GL)
  accountNumber?: string (4 digits)  // NEW
  type: 'general' | 'subcontractor'  // NEW
  active: boolean
  
  assignedForemanIds?: string[]  // NEW: Foremen managing this job
  timecardStatus?: 'pending' | 'submitted' | 'archived'  // NEW
  timecardSubmittedAt?: Timestamp  // NEW
  timecardPeriodEndDate?: string (YYYY-MM-DD, Saturday)  // NEW
  
  dailyLogRecipients?: string[]
  createdAt, archivedAt
}
```

### Job Roster Employee (NEW)
**Location**: `jobs/{jobId}/roster/{employeeId}`

```typescript
{
  id: string  // Auto-generated
  jobId: string
  
  employeeNumber: string  // 4-5 digits (e.g., "1234")
  firstName, lastName
  occupation: string
  
  contractor?: {
    name: string  // "ABC Labor Contractors"
    category: string  // "Ironworkers"
  }
  
  wageRate?: number  // Private per job!
  unitCost?: number  // Cost per production unit
  
  active: boolean
  addedByUid: string  // Foreman who added
  createdAt, updatedAt
}
```

### Timecard (Restructured)
**Location**: `jobs/{jobId}/timecards/{timecardId}`

```typescript
{
  id: string
  jobId: string
  
  // Weekly (Sunday-Saturday)
  weekStartDate: string  // YYYY-MM-DD (Sunday, calculated)
  weekEndingDate: string  // YYYY-MM-DD (Saturday, user selects)
  
  status: 'draft' | 'submitted'  // Removed 'approved'
  createdByUid: string  // Foreman owner
  submittedAt?: Timestamp
  
  // Employee reference
  employeeRosterId: string  // points to jobs/{jobId}/roster/{id}
  employeeNumber: string  // Denormalized
  employeeName: string  // Denormalized
  occupation: string  // Denormalized
  
  // 7 days (0=Sunday, 6=Saturday)
  days: [
    {
      date: string  // YYYY-MM-DD
      dayOfWeek: number  // 0-6
      hours: number
      production: number
      unitCost: number
      lineTotal: number  // production * unitCost
      notes?: string
    },
    // ... 6 more days
  ]
  
  totals: {
    hours: number[]  // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
    production: number[]  // Same
    hoursTotal: number  // Sum
    productionTotal: number  // Sum
    lineTotal: number  // Sum
  }
  
  notes: string
  
  archived: boolean  // NEW for archival
  archivedAt?: Timestamp  // NEW
  
  createdAt, updatedAt
}
```

### Daily Log (Updated)
**Location**: `jobs/{jobId}/dailyLogs/{logId}`

```typescript
{
  id: string
  jobId: string
  uid: string  // Foreman
  
  logDate: string  // YYYY-MM-DD
  status: 'draft' | 'submitted'
  
  // ... all existing fields ...
  
  archived: boolean  // NEW: default false
  archivedAt?: Timestamp  // NEW
  
  createdAt, updatedAt, submittedAt
}
```

---

## Key Differences from Old Structure

| Feature | Before | After |
|---------|--------|-------|
| **Employees** | Global collection | Job-scoped (`jobs/{jobId}/roster/`) |
| **Timecards** | Global, employee-indexed | Job-indexed (`jobs/{jobId}/timecards/`) |
| **Week Format** | Mon-Sun (weekStart/weekEnding) | Sun-Sat (weekStartDate/weekEndingDate) |
| **Timecard Days** | Lines array with day columns | Array of 7 DayObjects |
| **Totals** | Manual calculation | Pre-calculated in totals object |
| **Search** | By employee ID | By job ID + week |
| **Foreman Role** | Part of employee | Separate role with assignedJobIds |
| **Wage Privacy** | Global | Per-job (hidden from others) |
| **Daily Logs** | Global | Job-scoped with archival |

---

## Validation Rules

### Account Number
- **Pattern**: `^\d{4}$` (exactly 4 digits)
- **Logic**: If job code is 3-digit GL code → account must be blank

### Employee Number
- **Pattern**: `^\d{4,5}$` (4-5 digits)
- **Scope**: Unique within each job roster

### GL Code
- **Pattern**: `^\d{3}$` (exactly 3 digits)
- **Logic**: If provided, account number MUST be blank

### Week Ending Date
- **Must be**: Saturday (day 6)
- **Format**: YYYY-MM-DD
- **Week start**: Calculated as Saturday - 6 days

---

## Labor Contractors (Constants)

```typescript
LABOR_CONTRACTORS = {
  CONTRACTOR_1: { id: 'contractor-1', name: 'ABC Labor Contractors', categories: [...] },
  CONTRACTOR_2: { id: 'contractor-2', name: 'XYZ Subcontractors', categories: [...] },
  CONTRACTOR_3: { id: 'contractor-3', name: 'Third Contractor', categories: [...] },
}

// Usage in roster employee:
contractor = {
  name: 'ABC Labor Contractors',
  category: 'Ironworkers'
}
```

---

## Foreman Access Control

### In User Profile
```typescript
role: 'foreman'
assignedJobIds: ['job123', 'job456']  // Only these jobs visible
```

### In Routes
```typescript
// Route guard checks:
if (user.role === 'foreman') {
  if (!user.assignedJobIds.includes(routeJobId)) {
    redirect('/unauthorized')
  }
}
```

### In Services
```typescript
// Filter queries by job:
if (user.role === 'foreman') {
  jobIds = user.assignedJobIds
} else if (user.role === 'admin') {
  jobIds = allJobs
}

// Hide wage rates:
const wageData = isOwnJob ? rosterEmployee.wageRate : null
```

---

## Timecard Week Selection

### Date Picker Logic
```typescript
// Get last 12 Saturdays
const saturdays = getSaturdayDates(12)
// Output: ['2026-01-25', '2026-01-18', '2026-01-11', ...]

// User selects Saturday (e.g., 2026-01-25)
// System auto-calculates Sunday (2026-01-19)
const weekStart = calculateWeekStartDate('2026-01-25')
// Result: '2026-01-19'

// Display: "01/19 - 01/25"
const display = formatWeekRange(weekStart, weekEnding)
```

---

## Common Queries

### Get all employees for a job
```typescript
import * as JobRoster from '@/services/JobRoster'

const employees = await JobRoster.listRosterEmployees(jobId)
// Returns: Employee[] sorted by lastName, firstName
```

### Get timecards for a week
```typescript
import * as Timecards from '@/services/Timecards'

const timecards = await Timecards.listJobTimecardsByWeek(jobId, weekEndingDate)
// Returns: Timecard[] for all employees in job for that week
```

### Check if timecards submitted for week
```typescript
const job = await Jobs.getJob(jobId)
if (job.timecardStatus === 'submitted') {
  // Show green indicator
}
```

### Get archived daily logs
```typescript
const logs = await DailyLogs.listArchivedLogs(jobId)
// Returns: DailyLog[] with archived=true, sorted by date
```

---

## New Utility Functions

### In `src/utils/modelValidation.ts`

**Validation**
- `validateAccountNumber(value)` → error or null
- `validateGLCode(value)` → error or null
- `validateJobAccountLogic(job)` → error or null
- `validateEmployeeNumber(value)` → error or null
- `validateWeekEndingDate(dateStr)` → error or null
- `validateTimecard(timecard)` → error or null

**Calculation**
- `calculateWeekStartDate(weekEndingDate)` → string (YYYY-MM-DD)
- `getSaturdayDates(numWeeks)` → string[] (sorted desc)
- `formatWeekRange(start, end)` → string (MM/DD - MM/DD)
- `isSaturday(dateStr)` → boolean

---

## Migration Checklist

- [ ] Create `jobs/{jobId}/roster/` subcollection
- [ ] Copy employees data → add jobId field
- [ ] Create `jobs/{jobId}/timecards/` subcollection
- [ ] Convert timecard structure (lines → days)
- [ ] Move `dailyLogs/` under `jobs/{jobId}/`
- [ ] Update user profiles with `assignedJobIds` for foremen
- [ ] Update job documents with account#, type, foreman assignments
- [ ] Update Firestore security rules
- [ ] Delete old `employees/` collection
- [ ] Delete old global `timecards/` collection
- [ ] Test all queries and filters

---

## Files to Review

1. **Design**: `DATA_MODEL_CHANGES.md` (full design spec)
2. **Roadmap**: `PHASE3_IMPLEMENTATION_ROADMAP.md` (step-by-step plan)
3. **Types**: `src/types/models.ts` (TypeScript interfaces)
4. **Constants**: `src/config/constants.ts` (foreman, contractors, validation)
5. **Validation**: `src/utils/modelValidation.ts` (validation functions)

---

## Key Decisions

✅ **Foreman as separate role** - allows specific job assignment  
✅ **Job-scoped employees** - keeps rosters per job, simpler privacy  
✅ **Weekly Sunday-Saturday** - matches business requirements  
✅ **Saturday date selector** - user picks the week-ending date  
✅ **Denormalized daily data** - enables efficient totals calculation  
✅ **Wage per-job** - prevents cross-job wage comparison  
✅ **Pre-calculated totals** - avoids on-read calculations  
✅ **Archival not deletion** - preserves historical data  

