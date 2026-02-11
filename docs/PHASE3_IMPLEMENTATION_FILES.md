# Phase 3 Implementation Files & Structure

## Overview
Complete Phase 3 (Data Model Redesign) implementation spanning A/B/C - Data Models, Service Layer, and Pinia Stores.

---

## Data Models & Constants (Phase 3A)

### Type Definitions
**File:** `src/types/models.ts` (NEW, 400+ lines)

| Type | Purpose |
|------|---------|
| `Job` | Job with account#, foreman assignments, timecard status |
| `JobRosterEmployee` | Employee assigned to specific job with wage/unit info |
| `Timecard` | Weekly Sun-Sat timecard with daily entries |
| `TimecardDay` | Single day entry (hours, overtime, notes) |
| `DailyLog` | Hourly time tracking with job codes |
| `UserProfile` | User with role, assigned jobs, profile info |
| `Role` | Union: 'admin' \| 'employee' \| 'shop' \| 'foreman' \| 'none' |

### Configuration
**File:** `src/config/constants.ts` (UPDATED, +100 lines)

| Constant | Purpose |
|----------|---------|
| `USER_ROLES.FOREMAN` | Foreman role identifier |
| `LABOR_CONTRACTORS` | 3 contractor definitions |
| `ACCOUNT_VALIDATION` | Rules for GL codes and account numbers |
| `TIMECARD_CONFIG` | Week days, deadline config |
| `DAY_NAMES`, `DAY_NAMES_SHORT` | Display formats |

### Utilities
**File:** `src/utils/modelValidation.ts` (NEW, 400+ lines)

| Function | Purpose |
|----------|---------|
| `validateAccountNumber()` | GL code format (3-digit) |
| `validateEmployeeNumber()` | Employee ID validation |
| `validateWeekEndingDate()` | Saturday date validation |
| `validateTimecard()` | Full timecard object validation |
| `calculateWeekStartDate()` | Sunday from Saturday |
| `getSaturdayDates()` | Generate date range |
| `formatWeekRange()` | Display "Dec 15 - Dec 21" |

---

## Service Layer (Phase 3B)

### Job Roster Service
**File:** `src/services/JobRoster.ts` (NEW, 280 lines)

```
Functions: 9
├─ listRosterEmployees(jobId) - Query all job employees
├─ addRosterEmployee(jobId, employee) - Create roster entry
├─ updateRosterEmployee(jobId, id, updates) - Modify employee
├─ removeRosterEmployee(jobId, id) - Delete from roster
├─ getRosterEmployee(jobId, id) - Fetch single employee
├─ searchRosterEmployees(jobId, query) - Client-side search
├─ getRosterStats(jobId) - Count/summaries
├─ exportRosterToCsv(jobId) - CSV export
└─ Firestore: jobs/{jobId}/roster/{id}
```

### Timecards Service
**File:** `src/services/Timecards.ts` (RESTRUCTURED, 550 lines)

```
Functions: 15+
├─ listTimecardsByJobAndWeek(jobId, weekEndingDate) - Job+week query
├─ createTimecard(jobId, input) - Create with auto-calc
├─ updateTimecardDays(jobId, id, days) - Update days array
├─ submitTimecard(jobId, id) - Mark submitted
├─ archiveTimecard(jobId, id) - Mark archived
├─ unarchiveTimecard(jobId, id) - Reopen archived
├─ deleteTimecard(jobId, id) - Remove timecard
├─ exportTimecardsToCsv(jobIds, startDate, endDate) - Batch export
├─ getWeeklyStats(jobId, weekEndingDate) - Aggregates
├─ COMPAT: upsertTimecard() - Legacy wrapper
├─ COMPAT: listTimecardsByJobAndWeekLegacy() - Old format
└─ Firestore: jobs/{jobId}/timecards/{id}
```

### Jobs Service
**File:** `src/services/Jobs.ts` (UPDATED, 450 lines)

```
Functions: 25+
├─ listAllJobs(includeArchived) - Query all jobs
├─ getJob(jobId) - Fetch single job
├─ createJob(name, options) - Create with account# + foreman
├─ updateJob(jobId, updates) - Modify job details
├─ setJobActive(jobId, active) - Archive/restore
├─ assignForemanToJob(jobId, foremanId) - Add foreman
├─ removeForemanFromJob(jobId, foremanId) - Remove foreman
├─ getJobForemen(jobId) - Fetch all foremen for job
├─ setJobForemen(jobId, foremanIds) - Replace foremen list
├─ getTimecardStatus(jobId) - Fetch current status
├─ updateTimecardStatus(jobId, status) - Change status
├─ setTimecardPeriodEndDate(jobId, date) - Update deadline
├─ updateJobCodeAndAccount(jobId, glCode) - GL code logic
├─ normalize() - Map Firestore → Job type
└─ Firestore: /jobs/{jobId}
```

### Users Service
**File:** `src/services/Users.ts` (UPDATED, 400+ lines)

```
Functions: 20+
├─ listUsers() - Fetch all user profiles
├─ getUser(uid) - Fetch single user
├─ getMyUserProfile() - Current user profile
├─ updateUser(uid, updates) - Modify profile
├─ deleteUser(uid) - Remove user
├─ createUserByAdmin(email, firstName, lastName, role) - Admin create
├─ assignJobToForeman(foremanId, jobId) - Add job assignment
├─ removeJobFromForeman(foremanId, jobId) - Remove assignment
├─ setForemanJobs(foremanId, jobIds) - Replace assignments
├─ getForemanAssignedJobs(foremanId) - Fetch jobs for foreman
├─ listForemen() - All foremen users
├─ getForemenForJob(jobId) - Foremen assigned to job
├─ normalizeUser() - Map Firestore → UserProfile type
└─ Firestore: /users/{uid}
```

---

## Pinia Stores (Phase 3C)

### Auth Store (Core)
**File:** `src/stores/auth.ts` (UPDATED, 230 lines)

```typescript
State:
  ├─ user: User | null (Firebase auth user)
  ├─ role: Role | null (admin/employee/shop/foreman/none)
  ├─ active: boolean (deactivation flag)
  ├─ assignedJobIds: string[] (NEW - foreman's jobs)
  └─ ready: boolean (init complete)

Actions:
  ├─ init() - Load auth state on startup
  ├─ setupProfileListener() - Real-time profile updates
  ├─ login(email, password) - Firebase auth
  ├─ register(email, password) - Create account
  ├─ signOut() - Logout
  └─ signout() / logout() - Aliases

Real-time Features:
  ├─ Tracks role changes immediately
  ├─ Tracks assignedJobIds changes
  ├─ Auto signs out if deactivated
  └─ Cleans up listeners on logout
```

### Jobs Store
**File:** `src/stores/jobs.ts` (UPDATED, 220 lines)

```typescript
State:
  ├─ jobs: Job[] (all cached jobs)
  ├─ currentJob: Job | null (selected job)
  ├─ loading: boolean
  └─ error: string | null

Computed:
  ├─ allJobs
  ├─ activeJobs
  ├─ archivedJobs
  ├─ isLoading
  └─ hasError

Actions:
  ├─ fetchAllJobs(includeArchived)
  ├─ fetchJob(jobId) - Switch currentJob
  ├─ createJob(name, options) - NEW fields
  ├─ updateJob(jobId, updates)
  ├─ setJobActive(jobId, active)
  ├─ assignForemanToJob(jobId, foremanId) - NEW
  ├─ removeForemanFromJob(jobId, foremanId) - NEW
  ├─ setTimecardStatus(jobId, status) - NEW
  └─ setTimecardPeriodEndDate(jobId, date) - NEW
```

### Job Roster Store (NEW)
**File:** `src/stores/jobRoster.ts` (NEW, 290 lines)

```typescript
State:
  ├─ rosterByJob: Map<jobId, JobRosterEmployee[]>
  ├─ currentJobId: string | null
  ├─ loading: boolean
  └─ error: string | null

Computed:
  ├─ currentJobRoster - Employees in current job
  ├─ activeInCurrentJob
  ├─ inactiveInCurrentJob
  ├─ isLoading
  └─ hasError

Actions:
  ├─ setCurrentJob(jobId)
  ├─ fetchJobRoster(jobId) - Load roster for job
  ├─ getRoster(jobId) - Cache aware fetch
  ├─ getEmployee(jobId, employeeId)
  ├─ addEmployee(jobId, employee)
  ├─ updateEmployee(jobId, employeeId, updates)
  ├─ removeEmployee(jobId, employeeId)
  ├─ toggleEmployeeStatus(jobId, employeeId)
  ├─ searchRoster(jobId, term)
  ├─ getEmployeesByContractor(jobId, contractorName)
  ├─ clearError()
  ├─ clearJobCache(jobId)
  └─ resetStore()
```

### Users Store
**File:** `src/stores/users.ts` (UPDATED, 260 lines)

```typescript
State:
  ├─ users: UserProfile[]
  ├─ currentUserProfile: UserProfile | null
  ├─ loading: boolean
  └─ error: string | null

Computed:
  ├─ allUsers
  ├─ activeUsers
  ├─ adminUsers
  ├─ foremanUsers - NEW
  ├─ isLoading
  └─ hasError

Actions:
  ├─ fetchAllUsers()
  ├─ fetchMyProfile()
  ├─ updateUserProfile(uid, updates)
  ├─ deleteUser(uid)
  ├─ deactivateUser(uid)
  ├─ reactivateUser(uid)
  ├─ changeUserRole(uid, role) - Includes foreman
  ├─ createUser(email, firstName, lastName, role) - Includes foreman
  ├─ assignJobToForeman(foremanId, jobId) - NEW
  ├─ removeJobFromForeman(foremanId, jobId) - NEW
  └─ setForemanJobs(foremanId, jobIds) - NEW
```

### Employees Store (Legacy)
**File:** `src/stores/employees.ts` (DEPRECATED)

```
Status: Still exists, not updated
Purpose: Global employee list (being replaced by jobRoster)
Action: Will be removed in Phase 3D when all UI updated
```

---

## Data Flow & Relationships

```
Component Layer
    ↓
Pinia Stores (Phase 3C)
    ├─ auth.ts (user identity, assigned jobs)
    ├─ jobs.ts (job list, current job, foreman list)
    ├─ jobRoster.ts (current job's employees)
    └─ users.ts (all users, foreman info)
    ↓
Service Layer (Phase 3B)
    ├─ JobRoster.ts (job/{jobId}/roster queries)
    ├─ Timecards.ts (job/{jobId}/timecards queries)
    ├─ Jobs.ts (/jobs queries, foreman management)
    └─ Users.ts (/users queries, foreman assignment)
    ↓
Type Definitions (Phase 3A)
    ├─ models.ts (Job, JobRosterEmployee, Timecard, UserProfile)
    ├─ constants.ts (roles, validation rules, contractors)
    └─ modelValidation.ts (validation functions)
    ↓
Firebase Firestore
    ├─ /jobs/{jobId} (with foreman assignments)
    ├─ /jobs/{jobId}/roster/{id} (job-scoped employees)
    ├─ /jobs/{jobId}/timecards/{id} (weekly timecards)
    ├─ /users/{uid} (user profiles with assignedJobIds)
    └─ /jobs/{jobId}/dailylogs/{id} (time entries)
```

---

## Documentation Files Created

| File | Purpose | Phase |
|------|---------|-------|
| `PHASE3A_DATA_MODELS.md` | Type definitions, models, design | 3A |
| `PHASE3B_SERVICES_SUMMARY.md` | Service layer architecture | 3B |
| `PHASE3C_STORES_SUMMARY.md` | Pinia stores implementation | 3C |
| `PHASE3_PROGRESS.md` | Overall Phase 3 progress | 3A-C |
| `PHASE3_IMPLEMENTATION_FILES.md` | This file - file inventory | 3A-C |

---

## File Locations

### Core Implementation
```
src/
├─ types/
│  └─ models.ts .......................... All TypeScript types (NEW)
├─ config/
│  └─ constants.ts ...................... Config constants (UPDATED)
├─ utils/
│  └─ modelValidation.ts ................ Validation functions (NEW)
├─ services/
│  ├─ JobRoster.ts ...................... Job-scoped employees (NEW)
│  ├─ Timecards.ts ...................... Weekly timecards (RESTRUCTURED)
│  ├─ Jobs.ts ........................... Enhanced job management (UPDATED)
│  └─ Users.ts .......................... Foreman support (UPDATED)
└─ stores/
   ├─ auth.ts ........................... Foreman + assignedJobIds (UPDATED)
   ├─ jobs.ts ........................... Foreman methods (UPDATED)
   ├─ users.ts .......................... Foreman management (UPDATED)
   ├─ jobRoster.ts ...................... New roster store (NEW)
   ├─ employees.ts ...................... Legacy (DEPRECATED)
   ├─ shopCatalog.ts .................... Unchanged
   └─ (others unchanged)
```

### Root Documentation
```
├─ PHASE3A_DATA_MODELS.md
├─ PHASE3B_SERVICES_SUMMARY.md
├─ PHASE3C_STORES_SUMMARY.md
├─ PHASE3_PROGRESS.md
└─ PHASE3_IMPLEMENTATION_FILES.md (this file)
```

---

## Statistics

| Metric | Count |
|--------|-------|
| Files Created | 5 (models, validation, JobRoster, jobRoster store, docs) |
| Files Updated | 5 (constants, Timecards, Jobs, Users, auth store, jobs store, users store) |
| Lines of Code Added | 2,500+ |
| Types Defined | 10+ |
| Functions Implemented | 80+ |
| Services | 4 |
| Stores | 6 (1 new, 4 updated, 1 deprecated) |
| Backward Compat Wrappers | 2 |
| Build Status | ✅ PASSING |

---

## Next: Phase 3D (UI Components)

### Views Needing Updates
- [ ] Timecards.vue - Use new weekly format
- [ ] AdminEmployees.vue → Replaced by job roster management
- [ ] AdminJobs.vue - Add foreman assignment UI
- [ ] JobHome.vue - Show foreman context
- [ ] DailyLogs.vue - New job-scoped interface

### New Components Needed
- [ ] ForemansJobSelector - Show assigned jobs
- [ ] JobRosterManager - Add/edit/remove employees
- [ ] TimecardWeeklyForm - New weekly entry form
- [ ] TimecardStatusBadge - Show open/submitted/archived

### Estimated Work
- Update 5 existing views
- Create 4 new components
- Test foreman workflows
- Integration testing with new services/stores

---

## Reference

**Phase 3 Completion Status:**
- ✅ Phase 3A: Data Models Complete
- ✅ Phase 3B: Service Layer Complete
- ✅ Phase 3C: Pinia Stores Complete
- ⏳ Phase 3D: UI Components (Ready to start)
- ⏳ Phase 3E: Advanced Features

**Current Build:** ✅ PASSING (3.01s, 185 modules)
