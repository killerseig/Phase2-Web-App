# Data Model Changes - Phase 3

## Overview
This document outlines the fundamental data model changes needed to support job-scoped employees, weekly timecards, and foreman-to-job locking.

---

## 1. USER PROFILE (`users/{uid}`)

### Current Structure
```typescript
{
  id: string              // Firebase Auth UID
  email: string | null
  firstName: string | null
  lastName: string | null
  role: 'admin' | 'employee' | 'shop' | 'none'
  active: boolean
  createdAt?: Timestamp
  lastLoginAt?: Timestamp
}
```

### New Structure
```typescript
{
  // Base fields
  id: string              // Firebase Auth UID
  email: string | null
  firstName: string | null
  lastName: string | null
  role: 'admin' | 'employee' | 'shop' | 'foreman' | 'none'
  active: boolean
  
  // Foreman-specific fields
  assignedJobIds?: string[]  // Which jobs this foreman can access/manage
                            // Admin can see all jobs, foremen see only their assigned jobs
  
  createdAt?: Timestamp
  lastLoginAt?: Timestamp
}
```

### Changes:
- ✅ Add new role: `'foreman'` (separate from employee)
- ✅ Add `assignedJobIds[]` - array of job IDs foreman manages
- ✅ Admin sees all jobs; Foreman sees only assigned jobs; Employee sees jobs from roster

---

## 2. JOB (`jobs/{jobId}`)

### Current Structure
```typescript
{
  id: string
  name: string
  code?: string | null
  active: boolean
  createdAt?: Timestamp
  archivedAt?: Timestamp
  dailyLogRecipients?: string[]
}
```

### New Structure
```typescript
{
  // Base fields
  id: string
  name: string
  code?: string | null              // 3-digit GL code for project identifier
  accountNumber?: string | null      // 4-digit account number (blank if code is 3-digit)
  
  // Job type
  type: 'general' | 'subcontractor'  // Distinguish internal jobs from subcontractor contracts
  
  // Foreman assignment
  assignedForemanIds?: string[]      // UIDs of foremen responsible for this job
  
  // Timecard tracking
  timecardStatus?: 'pending' | 'submitted' | 'archived'  // Has all timecards been submitted?
  timecardSubmittedAt?: Timestamp    // When was the week's timecards submitted?
  timecardPeriodEndDate?: string     // YYYY-MM-DD (Saturday) of current tracking period
  
  // Active/archived
  active: boolean
  createdAt?: Timestamp
  archivedAt?: Timestamp
  
  // Communications
  dailyLogRecipients?: string[]
}
```

### Changes:
- ✅ Add `accountNumber` (4-digit validation)
- ✅ Add `type` field (general vs subcontractor)
- ✅ Add `assignedForemanIds` for foreman-to-job mapping
- ✅ Add `timecardStatus` / `timecardSubmittedAt` for submission tracking
- ✅ Add `timecardPeriodEndDate` for weekly tracking

---

## 3. JOB ROSTER EMPLOYEE (`jobs/{jobId}/roster/{employeeId}`)

### New Collection (Replaces Global Employees)

Instead of a global `employees` collection, employees are now job-scoped:

```typescript
{
  // Identity
  id: string              // Auto-generated doc ID (NOT employee#)
  employeeNumber: string  // 4-5 digit employee identifier (e.g., "1234")
  firstName: string
  lastName: string
  
  // Job relationship
  jobId: string           // Parent job
  
  // Contractor info (optional)
  contractor?: {
    name: string          // e.g., "ABC Labor Contractors", "XYZ Subcontractors"
    category: string      // Subcategory within contractor (e.g., "Ironworkers", "Laborers")
  }
  
  // Wage/rate info
  occupation: string      // Job title/trade
  wageRate?: number       // Hourly rate (hidden from other foremen/jobs)
  unitCost?: number       // Cost per unit for production tracking
  
  // Status
  active: boolean
  
  // Metadata
  createdAt?: Timestamp
  updatedAt?: Timestamp
  addedByUid?: string     // Foreman who added this employee to the roster
}
```

### Structure:
- ✅ Nest under jobs: `jobs/{jobId}/roster/{employeeId}`
- ✅ Keeps employees job-scoped
- ✅ Each foreman manages their own roster
- ✅ Allows labor contractors with subcategories
- ✅ Wage rates are job-specific and private

### Rationale:
- Global employee list is removed ✅
- Foremen can add/remove employees from their job roster ✅
- Supports labor contractor subcategories ✅
- Wage rates stay private to each job ✅

---

## 4. TIMECARD (`jobs/{jobId}/timecards/{timecardId}`)

### Current Structure
```typescript
{
  id: string
  jobId: string
  uid: string              // User who created
  status: 'draft' | 'submitted' | 'approved'
  weekStart: string        // YYYY-MM-DD (Mon)
  weekEnding: string       // YYYY-MM-DD (Sun)
  employeeId: string
  employeeName: string
  occupation: string
  lines: TimecardLine[]    // 7 days (mon-sun)
  notes: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
  submittedAt?: Timestamp
  approvedAt?: Timestamp
}
```

### New Structure
```typescript
{
  // Identity
  id: string              // Auto-generated doc ID
  jobId: string           // Parent job
  
  // Weekly tracking
  weekEndingDate: string  // YYYY-MM-DD (Saturday - end of week)
  weekStartDate: string   // YYYY-MM-DD (Sunday - start of week, calculated)
  
  // Submission tracking
  status: 'draft' | 'submitted'  // Removed 'approved' - office will approve
  createdByUid: string    // Foreman who created/owns this timecard
  submittedAt?: Timestamp
  
  // Employee roster reference
  employeeRosterId: string    // Reference to jobs/{jobId}/roster/{employeeId}
  employeeNumber: string      // Denormalized for quick display
  employeeName: string        // Denormalized (firstName + lastName)
  occupation: string          // Denormalized
  
  // Daily entries (Sunday=0, Saturday=6)
  days: TimecardDay[]         // 7 days (index 0=Sunday, index 6=Saturday)
  
  // Summary/totals (calculated)
  totals: {
    hours: number[]           // 7 elements, one per day
    production: number[]      // 7 elements
    dailyHoursTotal: number   // Sum of all hours
    dailyProductionTotal: number
  }
  
  // Notes
  notes: string
  
  // Archive
  archivedAt?: Timestamp      // Timestamped when moved to archive
  
  createdAt?: Timestamp
  updatedAt?: Timestamp
}
```

### New TimecardDay Type
```typescript
export type TimecardDay = {
  date: string              // YYYY-MM-DD
  dayOfWeek: number         // 0=Sun, 1=Mon, ..., 6=Sat
  hours: number            // Hours worked
  production: number       // Units produced
  unitCost: number        // Cost per unit
  lineTotal: number       // production * unitCost
  notes?: string
}
```

### Changes:
- ✅ Changed from employee-indexed to job-indexed (`jobs/{jobId}/timecards/`)
- ✅ Changed week tracking: `weekEndingDate` (Saturday) + calculated `weekStartDate`
- ✅ Removed approval workflow (office will batch-approve via CSV)
- ✅ Added `days` array with structured daily entries (Sun-Sat)
- ✅ Added denormalized fields for quick display
- ✅ Added `totals` object for daily summaries
- ✅ Added `archivedAt` for archival tracking
- ✅ Support hours, production, AND unit cost per day
- ✅ Reference roster employee via `employeeRosterId`

### Search/Query Changes:
- ✅ Query by job: `where('jobId', '==', jobId)` NOT by employee
- ✅ Filter by week: `where('weekEndingDate', '==', 'YYYY-MM-DD')`
- ✅ Foremen can only see timecards for jobs in their `assignedJobIds`

---

## 5. DAILY LOG (`jobs/{jobId}/dailyLogs/{logId}`)

### Current Structure (same, but with archival support)
```typescript
{
  id: string
  jobId: string
  uid: string              // Foreman who created
  status: 'draft' | 'submitted'
  logDate: string          // YYYY-MM-DD
  
  // ... all existing fields ...
  
  createdAt?: Timestamp
  updatedAt?: Timestamp
  submittedAt?: Timestamp
}
```

### New Structure
```typescript
{
  // Identity
  id: string              // Auto-generated doc ID
  jobId: string           // Parent job
  uid: string             // Foreman who created
  
  // Date tracking
  logDate: string         // YYYY-MM-DD
  status: 'draft' | 'submitted'
  
  // ... all existing fields remain the same ...
  
  // Archival support
  archived: boolean       // Default: false
  archivedAt?: Timestamp  // When moved to archive
  
  createdAt?: Timestamp
  updatedAt?: Timestamp
  submittedAt?: Timestamp
}
```

### Changes:
- ✅ Moved under job: `jobs/{jobId}/dailyLogs/` (may already be here)
- ✅ Added `archived` and `archivedAt` fields for catalog/retrieval
- ✅ Foremen can retrieve historical logs by querying `where('archived', '==', false)`

---

## 6. LABOR CONTRACTOR SUBCATEGORIES

### Configuration (in constants)
```typescript
export const LABOR_CONTRACTORS = {
  CONTRACTOR_1: {
    id: 'contractor-1',
    name: 'ABC Labor Contractors',
    categories: ['Ironworkers', 'Laborers', 'Equipment Operators'],
  },
  CONTRACTOR_2: {
    id: 'contractor-2',
    name: 'XYZ Subcontractors',
    categories: ['Concrete Specialists', 'Carpenters'],
  },
  CONTRACTOR_3: {
    id: 'contractor-3',
    name: 'Third Contractor',
    categories: ['Electricians', 'HVAC Technicians'],
  },
} as const
```

### Usage:
- When adding an employee to a job roster, select contractor + category
- Stored in roster employee's `contractor` field
- Supports ~70-80 employees across 3 contractors

---

## 7. SUMMARY OF COLLECTION STRUCTURE

### Before
```
├── users/{uid}
├── employees/{employeeId}  ← GLOBAL (to be removed)
├── jobs/{jobId}
├── timecards/{timecardId}  ← Flat, employee-indexed
├── dailyLogs/{logId}       ← Flat
└── ...
```

### After
```
├── users/{uid}
├── jobs/{jobId}
│   ├── roster/{employeeId}      ← NEW: Job-scoped employees
│   ├── timecards/{timecardId}   ← MOVED: Now under job
│   ├── dailyLogs/{logId}        ← MOVED: Now under job
│   └── timecardArchive/{id}     ← NEW: Archived timecards (optional)
└── ...
```

---

## 8. VALIDATION RULES

### Account Number
- 4 digits only: `^\d{4}$`
- Required UNLESS job code is 3-digit GL code
- If code exists and is 3-digit, accountNumber must be null

### Employee Number
- Format: 4-5 digits (e.g., "1234" or "12345")
- Unique within a job roster

### Job Code
- If provided: must be exactly 3 digits (GL code)
- If 3-digit: accountNumber must be blank
- If blank or non-3-digit: accountNumber must be 4-digit

### Timecard Week
- `weekEndingDate`: must be a Saturday
- `weekStartDate`: calculated as Saturday - 6 days (Sunday)
- Sunday = day 0, Saturday = day 6

---

## 9. MIGRATION STRATEGY

1. **Create new collections** (`jobs/{jobId}/roster/`)
2. **Create new timecard structure** (keep old timecards as reference)
3. **Update user profiles** (add `assignedJobIds` for foremen)
4. **Update job documents** (add account#, type, foreman assignments, timecard status)
5. **Remove access** to global employees collection
6. **Batch move/archive** old timecards
7. **Update all services/stores** to use new models

---

## 10. FIRESTORE SECURITY RULES IMPACT

### Changes Needed:
- ✅ Foremen can only read/write to `jobs/{jobId}` where `jobId` in `user.assignedJobIds`
- ✅ Foremen cannot read wage rates from other jobs
- ✅ Admin can read all jobs and all timecards
- ✅ Employees can only see timecards they belong to
- ✅ Daily logs archived by setting `archived: true`

---

## Next Steps

1. Review and approve data model changes
2. Create new Firestore documents/subcollections
3. Update TypeScript types (`src/types/documents.ts`)
4. Update service layers (Employees, Timecards, DailyLogs)
5. Update Pinia stores
6. Update UI components to use new data structures
7. Update Firestore security rules
8. Add migration utilities to move legacy data
