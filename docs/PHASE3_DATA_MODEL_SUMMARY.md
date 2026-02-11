# Phase 3 - Data Model Design: COMPLETE ✅

## Summary

You now have a **comprehensive data model redesign** that fundamentally changes how your application handles:
- ✅ Job-scoped employees (replacing global employee list)
- ✅ Weekly timecards (Sunday-Saturday format)
- ✅ Foreman-to-job mapping (new role with access control)
- ✅ Labor contractor subcategories (3 contractors, ~70-80 employees)
- ✅ Account number & GL code validation rules
- ✅ Timecard submission tracking
- ✅ Daily log archival support

---

## What Was Delivered

### 1. Design Documentation
📄 **[DATA_MODEL_CHANGES.md](DATA_MODEL_CHANGES.md)** (11 sections)
- Complete before/after comparison
- Detailed schema for each entity
- Migration strategy outlined
- Security rules impact documented

### 2. Implementation Roadmap
📄 **[PHASE3_IMPLEMENTATION_ROADMAP.md](PHASE3_IMPLEMENTATION_ROADMAP.md)** (10 sections)
- Phase-by-phase implementation plan (3B-3F)
- Service layer updates needed
- Component updates required
- Testing checklist
- Success criteria

### 3. Quick Reference Guide
📄 **[PHASE3_QUICK_REFERENCE.md](PHASE3_QUICK_REFERENCE.md)** (12 sections)
- At-a-glance data structure comparison
- Key differences from old structure
- Common queries & patterns
- Labor contractor configuration
- Migration checklist

### 4. TypeScript Types
📄 **[src/types/models.ts](src/types/models.ts)** (NEW)
- Complete type definitions for all new models
- UserProfile with foreman role
- Job with account#, type, timecard tracking
- JobRosterEmployee (job-scoped)
- Timecard with weekly structure
- DailyLog with archival
- View model types

### 5. Configuration Constants
📄 **[src/config/constants.ts](src/config/constants.ts)** (UPDATED)
- Added `FOREMAN` role
- Added `LABOR_CONTRACTORS` configuration (3 contractors)
- Added `ACCOUNT_VALIDATION` rules
- Added `TIMECARD_CONFIG` for week handling
- Added `DAY_NAMES` and `DAY_NAMES_SHORT` arrays

### 6. Validation Utilities
📄 **[src/utils/modelValidation.ts](src/utils/modelValidation.ts)** (NEW)
- Account number validation (4 digits)
- GL code validation (3 digits)
- Job account logic validation
- Employee number validation (4-5 digits)
- Timecard week validation (must be Saturday)
- Week calculation utilities
- Date formatting helpers
- CSV export validation

---

## Key Data Model Changes

### User Profile
```diff
  id: string
  role: 'admin' | 'employee' | 'shop' | 'foreman' | 'none'
+ assignedJobIds?: string[]  // Foreman access control
```

### Job
```diff
+ code?: string (3-digit GL code)
+ accountNumber?: string (4-digit)
+ type: 'general' | 'subcontractor'
+ assignedForemanIds?: string[]
+ timecardStatus?: 'pending' | 'submitted' | 'archived'
+ timecardSubmittedAt?: Timestamp
+ timecardPeriodEndDate?: string (Saturday)
```

### Employee (NOW JOB-SCOPED)
```diff
- employees/{id}
+ jobs/{jobId}/roster/{id}
+ jobId: string
+ contractor?: { name, category }  // Labor contractor
+ wageRate?: number (private per job)
+ unitCost?: number
+ addedByUid?: string (foreman who added)
```

### Timecard (RESTRUCTURED)
```diff
- timecards/{id} (global)
+ jobs/{jobId}/timecards/{id}
- weekStart/weekEnding (Mon/Sun)
+ weekStartDate/weekEndingDate (Sun/Sat)
- lines: []
+ days: [7 day objects]
+ totals: { hours[], production[], totals }
+ employeeRosterId (reference to jobs/{jobId}/roster/{id})
- status: 'draft' | 'submitted' | 'approved'
+ status: 'draft' | 'submitted'
+ archived: boolean
+ archivedAt?: Timestamp
```

### Daily Log
```diff
+ moved to jobs/{jobId}/dailyLogs/{id}
+ archived: boolean
+ archivedAt?: Timestamp
```

---

## Validation Rules Implemented

| Rule | Pattern | Example |
|------|---------|---------|
| Account Number | `^\d{4}$` | "1234" |
| GL Code | `^\d{3}$` | "123" |
| Employee Number | `^\d{4,5}$` | "1234" or "12345" |
| GL Code Logic | If GL code → account blank | code="123" ⟹ account=null |
| Week Ending | Must be Saturday | Date(2026-01-25).getDay() === 6 |

---

## Collection Structure (After Migration)

```
firestore/
├── users/{uid}
│   └── role, assignedJobIds (for foremen)
│
├── jobs/{jobId}
│   ├── Basic fields
│   ├── accountNumber, type
│   ├── assignedForemanIds, timecardStatus
│   │
│   ├── roster/{employeeId}  ← NEW subcollection
│   │   ├── employeeNumber (4-5 digits)
│   │   ├── firstName, lastName
│   │   ├── contractor { name, category }
│   │   ├── wageRate (private to this job)
│   │   └── unitCost
│   │
│   ├── timecards/{timecardId}  ← MOVED & RESTRUCTURED
│   │   ├── weekStartDate, weekEndingDate
│   │   ├── status: 'draft' | 'submitted'
│   │   ├── days[]  ← 7 day objects
│   │   ├── totals { hours, production, sums }
│   │   ├── archived, archivedAt
│   │   └── employeeRosterId (reference)
│   │
│   └── dailyLogs/{logId}  ← MOVED, added archival
│       ├── archived, archivedAt
│       └── ... existing fields ...
│
├── shopCatalog/  ← Unchanged
├── shopOrders/   ← Unchanged
└── ...
```

---

## Next Steps (Phase 3B+)

### Immediate (Phase 3B)
1. Create `src/services/JobRoster.ts` - job-scoped employee CRUD
2. Update `src/services/Timecards.ts` - restructure to weekly format
3. Update `src/services/Jobs.ts` - add account#, foreman, status tracking
4. Update `src/services/DailyLogs.ts` - add archival support
5. Update `src/stores/` - reflect new data structures

### Then (Phase 3C-D)
6. Update UI components (admin, foreman views, timecards)
7. Implement print functionality
8. Add CSV export for Plexis
9. Add daily log archival UI

### Finally (Phase 3E-F)
10. Update Firestore security rules
11. Create migration scripts
12. Test end-to-end
13. Deploy with data migration

---

## Important Notes

### What's Being REMOVED
- ❌ Global `employees` collection
- ❌ Global `timecards` collection (replaced with job-scoped version)
- ❌ Global `dailyLogs` collection (replaced with job-scoped version)
- ❌ Admin employees panel

### What's Being ADDED
- ✅ `foreman` role (new user type)
- ✅ Job roster management (per-job employees)
- ✅ Foreman-to-job assignment
- ✅ Labor contractor support
- ✅ Account number & GL code validation
- ✅ Weekly timecard format (Sun-Sat)
- ✅ Daily timecard totals row
- ✅ Timecard submission status tracking
- ✅ Daily log archival support

### What's CHANGING
- 🔄 Timecards: from employee-indexed to job-indexed
- 🔄 Timecards: from daily/flexible to weekly (Sunday-Saturday)
- 🔄 Timecards: week selector (Saturday only)
- 🔄 Employees: from global to job-scoped
- 🔄 Access control: foremen locked to assigned jobs
- 🔄 Wages: now private per job (hidden from other jobs)
- 🔄 Search: timecards searched by job, not employee

---

## Build Status

✅ **TypeScript compilation**: PASSED  
✅ **Vite build**: SUCCESS (3.19s)  
✅ **No errors or warnings**

All new types and validation utilities compiled successfully!

---

## Files Created/Updated

### NEW Files Created
- `DATA_MODEL_CHANGES.md` - Design specification
- `PHASE3_IMPLEMENTATION_ROADMAP.md` - Implementation plan
- `PHASE3_QUICK_REFERENCE.md` - Quick reference guide
- `src/types/models.ts` - All new TypeScript types
- `src/utils/modelValidation.ts` - Validation utilities

### UPDATED Files
- `src/config/constants.ts` - Added foreman role, contractors, validation rules

### TO BE CREATED (Phase 3B+)
- `src/services/JobRoster.ts` - Job-scoped employee service
- Various service/store updates
- UI component updates

---

## Success Metrics

### Data Model Tier
✅ All types defined in TypeScript  
✅ All validation rules implemented  
✅ Constants organized and configured  
✅ Build passes with no errors  
✅ Design documented comprehensively  

### Architecture Tier (Phase 3B+)
⏳ Service layer refactored  
⏳ Pinia stores updated  
⏳ UI components redesigned  
⏳ Security rules updated  
⏳ Data migration completed  

---

## Questions for Clarification

Before moving to Phase 3B (service layer), consider:

1. **Foreman Scope**: Can a foreman manage multiple jobs, or is it 1-to-1?
   - Current design: Many-to-many (via `assignedJobIds`)
   
2. **Employee Transitions**: How do we handle employees moving between jobs?
   - Current approach: Each job has independent roster, separate timecard records

3. **Wage Rate Confidentiality**: Should foremen see their own wages from other jobs?
   - Current design: Hidden completely (per-job privacy)

4. **Timecard Approval**: Who approves submitted timecards (foreman, office, system)?
   - Current design: Office will batch approve via Plexis import

5. **Daily Log Retention**: How long to keep archived logs (indefinite)?
   - Current design: Archive but never delete

---

## Conclusion

The **fundamental data model** for Phase 3 is now complete and ready for implementation. The new structure supports:

- Job-scoped employee rosters
- Weekly Sunday-Saturday timecards with detailed tracking
- Foreman-to-job access control
- Labor contractor subcategories
- Account number & GL code validation
- Timecard submission status tracking
- Daily log archival

All types are defined, validation rules are implemented, and the build is clean. You're ready to move forward with service layer implementation!

---

**Status**: ✅ **PHASE 3A COMPLETE**  
**Next**: Phase 3B - Service Layer Updates  
**Date**: January 29, 2026  
