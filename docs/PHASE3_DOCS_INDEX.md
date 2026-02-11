# Phase 3: Documentation Index

## Overview
Phase 3 is a fundamental data model redesign to support:
- ✅ Job-scoped employees (replacing global employee list)
- ✅ Weekly timecards (Sunday-Saturday format)
- ✅ Foreman role with job assignment
- ✅ Labor contractor subcategories
- ✅ Account number & GL code validation

---

## Main Documentation

### 📋 Phase 3 Data Model Summary (START HERE)
**File**: [PHASE3_DATA_MODEL_SUMMARY.md](PHASE3_DATA_MODEL_SUMMARY.md)
- Complete overview of what was delivered
- Key changes at a glance
- Build status: ✅ PASSED
- Next steps clearly outlined

### 📐 Data Model Design Specification
**File**: [DATA_MODEL_CHANGES.md](DATA_MODEL_CHANGES.md)
- Detailed before/after schemas
- Collection structure diagrams
- Validation rules (account#, GL code, employee#)
- Migration strategy
- Firestore security rules impact

### 🗺️ Implementation Roadmap
**File**: [PHASE3_IMPLEMENTATION_ROADMAP.md](PHASE3_IMPLEMENTATION_ROADMAP.md)
- Phase-by-phase breakdown (3B, 3C, 3D, 3E, 3F)
- Service layer updates needed
- Pinia store changes
- Component updates required
- Testing checklist
- Success criteria

### 🔍 Quick Reference Guide
**File**: [PHASE3_QUICK_REFERENCE.md](PHASE3_QUICK_REFERENCE.md)
- Data structure comparison table
- Common queries & examples
- Labor contractor configuration
- Foreman access control patterns
- Migration checklist
- Key decisions explained

---

## Code Files

### New TypeScript Types
**File**: [src/types/models.ts](src/types/models.ts) - NEW
```typescript
// All new type definitions:
- UserProfile (with foreman role)
- Job (with account#, foreman, timecard status)
- JobRosterEmployee (job-scoped, with contractor)
- Timecard (weekly Sun-Sat format)
- TimecardDay (individual day tracking)
- TimecardTotals (calculated summaries)
- DailyLog (with archival support)
- LaborContractor (configuration)
- View models (TimecardDetail, JobWithTimecardStatus)
```

### Updated Constants
**File**: [src/config/constants.ts](src/config/constants.ts) - UPDATED
```typescript
// Added:
- USER_ROLES.FOREMAN
- LABOR_CONTRACTORS (3 contractors, categories)
- ACCOUNT_VALIDATION (patterns, rules)
- TIMECARD_CONFIG (week start/end days)
- DAY_NAMES, DAY_NAMES_SHORT (display)
```

### New Validation Utilities
**File**: [src/utils/modelValidation.ts](src/utils/modelValidation.ts) - NEW
```typescript
// Functions:
Validation:
- validateAccountNumber()
- validateGLCode()
- validateJobAccountLogic()
- validateEmployeeNumber()
- validateWeekEndingDate()
- validateTimecard()

Utilities:
- calculateWeekStartDate()
- getSaturdayDates()
- formatWeekRange()
- isSaturday()
```

---

## Phase 3 Status

### ✅ Phase 3A: Data Models (COMPLETE)
- [x] Design comprehensive data models
- [x] Create TypeScript type definitions
- [x] Add validation rules & constants
- [x] Implement validation utilities
- [x] Build verification (passing ✅)
- [x] Create implementation roadmap
- [x] Document for future developers

### ⏳ Phase 3B: Service Layer (NEXT)
- [ ] Create `src/services/JobRoster.ts`
- [ ] Update `src/services/Timecards.ts`
- [ ] Update `src/services/Jobs.ts`
- [ ] Update `src/services/DailyLogs.ts`
- [ ] Update `src/services/Users.ts`

### ⏳ Phase 3C: Pinia Stores
- [ ] Update auth store (foreman role)
- [ ] Create/update jobs store
- [ ] Create job roster store
- [ ] Remove employees store

### ⏳ Phase 3D: UI Components
- [ ] Job roster management panel
- [ ] Timecard redesign (Sun-Sat, totals)
- [ ] Daily log archival UI
- [ ] Job list status indicator

### ⏳ Phase 3E: Security & Access
- [ ] Update Firestore rules
- [ ] Implement foreman job locking
- [ ] Hide wage rates per-job

### ⏳ Phase 3F: Integrations
- [ ] CSV export for Plexis
- [ ] Employee import from Plexis
- [ ] Data migration script

---

## Key Data Structures

### User Profile (Updated)
```typescript
{
  id: string                          // Firebase Auth UID
  email, firstName, lastName
  role: 'admin' | 'employee' | 'shop' | 'foreman' | 'none'  // NEW: foreman
  active: boolean
  assignedJobIds?: string[]  // NEW: Which jobs foreman manages
}
```

### Job (Updated)
```typescript
{
  id: string
  name, code?: string (3-digit GL)
  accountNumber?: string (4 digits)  // NEW
  type: 'general' | 'subcontractor'  // NEW
  
  assignedForemanIds?: string[]      // NEW: Foremen managing this
  timecardStatus?: 'pending' | 'submitted' | 'archived'  // NEW
  timecardPeriodEndDate?: string (Saturday)  // NEW
  
  active: boolean
  dailyLogRecipients?: string[]
}
```

### Job Roster Employee (NEW)
```typescript
Location: jobs/{jobId}/roster/{employeeId}

{
  id: string                         // Auto-generated
  jobId: string                      // Parent job
  
  employeeNumber: string             // 4-5 digits
  firstName, lastName
  occupation: string
  
  contractor?: {                     // Labor contractor (NEW)
    name: string
    category: string
  }
  
  wageRate?: number                  // Private per job
  unitCost?: number
  
  active: boolean
  addedByUid: string                 // Foreman who added
}
```

### Timecard (RESTRUCTURED)
```typescript
Location: jobs/{jobId}/timecards/{timecardId}  // MOVED & RESTRUCTURED

{
  id: string
  jobId: string
  
  weekStartDate: string              // YYYY-MM-DD (Sunday)
  weekEndingDate: string             // YYYY-MM-DD (Saturday, user selects)
  
  status: 'draft' | 'submitted'      // Removed 'approved'
  createdByUid: string               // Foreman owner
  
  employeeRosterId: string           // Reference to roster employee
  employeeNumber, employeeName, occupation  // Denormalized
  
  // 7 days (0=Sunday, 6=Saturday)
  days: [
    {
      date: string                   // YYYY-MM-DD
      dayOfWeek: number              // 0-6
      hours: number
      production: number
      unitCost: number
      lineTotal: number
      notes?: string
    },
    // ... 6 more
  ]
  
  totals: {
    hours: number[]                  // [Sun, Mon, ..., Sat]
    production: number[]
    hoursTotal, productionTotal, lineTotal
  }
  
  notes: string
  archived: boolean                  // NEW
  archivedAt?: Timestamp             // NEW
}
```

---

## Validation Rules Implemented

| Field | Rule | Example |
|-------|------|---------|
| Account Number | `^\d{4}$` (4 digits) | "1234" |
| GL Code | `^\d{3}$` (3 digits) | "123" |
| GL Code Logic | If 3-digit code → account blank | code="123" ⟹ account=null |
| Employee Number | `^\d{4,5}$` (4-5 digits) | "1234" |
| Week Ending | Must be Saturday | date.getDay() === 6 |

---

## Labor Contractors Configuration

```typescript
LABOR_CONTRACTORS = {
  CONTRACTOR_1: {
    id: 'contractor-1'
    name: 'ABC Labor Contractors'
    categories: ['Ironworkers', 'Laborers', 'Equipment Operators', 'Welders']
  },
  CONTRACTOR_2: {
    id: 'contractor-2'
    name: 'XYZ Subcontractors'
    categories: ['Concrete Specialists', 'Carpenters', 'Formwork Specialists']
  },
  CONTRACTOR_3: {
    id: 'contractor-3'
    name: 'Third Contractor'
    categories: ['Electricians', 'HVAC Technicians', 'Plumbers', 'Safety Inspectors']
  },
}

// Total capacity: ~70-80 employees across 3 contractors
```

---

## Quick Start for Phase 3B

### 1. Create JobRoster Service
```typescript
// src/services/JobRoster.ts
export async function listRosterEmployees(jobId: string): Promise<JobRosterEmployee[]>
export async function addRosterEmployee(jobId: string, employee: JobRosterEmployeeInput): Promise<void>
export async function updateRosterEmployee(jobId: string, employeeId: string, updates: Partial<JobRosterEmployee>): Promise<void>
export async function removeRosterEmployee(jobId: string, employeeId: string): Promise<void>
```

### 2. Update Timecards Service
```typescript
// src/services/Timecards.ts (restructure)
export async function listJobTimecardsByWeek(jobId: string, weekEndingDate: string): Promise<Timecard[]>
export async function createTimecard(jobId: string, timecard: TimecardInput): Promise<void>
export async function submitTimecard(jobId: string, timecardId: string): Promise<void>
export async function exportToCsv(timecards: Timecard[]): Promise<string>
```

### 3. Update Jobs Service
```typescript
// src/services/Jobs.ts (add new methods)
export async function updateTimecardStatus(jobId: string, status: TimecardStatus): Promise<void>
export async function assignForemanToJob(jobId: string, foremanId: string): Promise<void>
export async function removeForemanFromJob(jobId: string, foremanId: string): Promise<void>
```

---

## Migration Path

**Current State**: Global employees, daily timecards  
**Target State**: Job-scoped roster, weekly timecards

**Migration Steps**:
1. Create new `jobs/{jobId}/roster/` subcollection
2. Copy employees + add jobId
3. Create new `jobs/{jobId}/timecards/` structure
4. Convert timecard format (lines → days)
5. Move daily logs under jobs
6. Update security rules
7. Retire old collections

---

## Important Notes

### What's Different from Before
- 🔄 Employees now job-scoped (not global)
- 🔄 Timecards now weekly (Sun-Sat, not flexible)
- 🔄 Timecards now job-indexed (not employee-indexed)
- 🔄 New "foreman" role (was employee with elevated perms)
- 🔄 Wage rates now private per-job (hidden from others)

### What's New
- ✅ `assignedJobIds` on foreman profiles
- ✅ `accountNumber` & `type` on jobs
- ✅ Labor contractor support
- ✅ Account # / GL code validation
- ✅ Timecard status tracking
- ✅ Daily log archival
- ✅ Foreman-to-job assignments

### What's Removed
- ❌ Global employees collection
- ❌ Global timecards collection (replaced)
- ❌ Global dailyLogs collection (moved to jobs)
- ❌ Approval workflow in timecards

---

## Build Status

✅ **TypeScript Compilation**: PASSED  
✅ **Vite Build**: SUCCESS (3.19s, no errors)  
✅ **All New Types**: Imported & used  
✅ **All Validation**: Implemented  

---

## Next: Phase 3B

When ready to start Phase 3B (Service Layer), refer to:
- [PHASE3_IMPLEMENTATION_ROADMAP.md](PHASE3_IMPLEMENTATION_ROADMAP.md) - Section "3B: Service Layer Updates"
- [PHASE3_QUICK_REFERENCE.md](PHASE3_QUICK_REFERENCE.md) - Section "Common Queries"

---

**Phase**: 3A ✅ COMPLETE  
**Date**: January 29, 2026  
**Status**: Ready for Phase 3B Implementation  
