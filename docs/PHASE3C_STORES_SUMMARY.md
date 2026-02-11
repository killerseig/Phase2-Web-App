# Phase 3C: Pinia Stores - Implementation Complete ✅

## Overview
Updated all Pinia stores to work with new Phase 3 data models (job-scoped rosters, weekly timecards, foreman role). Includes new jobRoster store for managing employee rosters per job.

**Build Status:** ✅ PASSING (3.01s, 185 modules transformed)

---

## Changes Made

### 1. **New Store: Job Roster** (`src/stores/jobRoster.ts`)
Manages job-scoped employee rosters. Replaces global employee management pattern.

**State:**
- `rosterByJob`: Map<jobId, JobRosterEmployee[]>
- `currentJobId`: string | null
- `loading`: boolean
- `error`: string | null

**Key Actions:**
- `setCurrentJob(jobId)` - Switch active job context
- `fetchJobRoster(jobId)` - Load roster for specific job
- `getRoster(jobId)` - Get cached or fetch roster
- `getEmployee(jobId, employeeId)` - Retrieve single employee
- `addEmployee(jobId, employee)` - Add to roster
- `updateEmployee(jobId, employeeId, updates)` - Update roster member
- `removeEmployee(jobId, employeeId)` - Remove from roster
- `toggleEmployeeStatus(jobId, employeeId)` - Toggle active/inactive
- `searchRoster(jobId, term)` - Search by name/number/occupation
- `getEmployeesByContractor(jobId, contractorName)` - Filter by contractor

**Computed:**
- `currentJobRoster` - Employees in current job
- `activeInCurrentJob` - Active only
- `inactiveInCurrentJob` - Inactive only
- `isLoading`, `hasError` - Status

---

### 2. **Updated: Auth Store** (`src/stores/auth.ts`)

**Type Updates:**
```typescript
// Added 'foreman' to Role type
export type Role = 'admin' | 'employee' | 'shop' | 'foreman' | 'none'

// Added assignedJobIds to state
type AuthState = {
  assignedJobIds: string[]  // NEW
  // ... existing fields
}
```

**Changes:**
- ✅ Added 'foreman' role support
- ✅ Added `assignedJobIds` state field (used by foremanship feature)
- ✅ Updated `setupProfileListener()` to track assignedJobIds changes in real-time
- ✅ Updated initial user document creation to include assignedJobIds array
- ✅ Clears assignedJobIds on signOut

**Real-time Updates:**
- Profile listener now tracks foreman job assignments
- Logs "Assigned jobs updated" when assignments change
- Automatically reflects in auth store state

---

### 3. **Updated: Jobs Store** (`src/stores/jobs.ts`)

**Type Update:**
```typescript
// Switched to new Job model type
import type { Job } from '@/types/models'
```

**New Computed:**
- Job fields now include: accountNumber, type, assignedForemanIds, timecardStatus, timecardPeriodEndDate

**New Actions:**

*Foreman Management:*
- `assignForemanToJob(jobId, foremanId)` - Add foreman to job
- `removeForemanFromJob(jobId, foremanId)` - Remove foreman from job

*Timecard Management:*
- `setTimecardStatus(jobId, status)` - Update timecard status (open/closed/review)
- `setTimecardPeriodEndDate(jobId, date)` - Set weekly period end

**Integration:**
- All actions sync with underlying JobsService (Phase 3B)
- Updates cached job lists and current job state
- Maintains backward compatibility with existing createJob/updateJob

---

### 4. **Updated: Users Store** (`src/stores/users.ts`)

**Type Update:**
```typescript
// Imported new UserProfile model with foreman support
import type { UserProfile } from '@/types/models'

// Added foreman role to role selection
async function changeUserRole(userId, newRole: '...' | 'foreman' | '...')
```

**New Computed:**
- `foremanUsers` - Filter all users with 'foreman' role

**New Actions:**

*Foreman Job Assignment:*
- `assignJobToForeman(foremanId, jobId)` - Add job to foreman
- `removeJobFromForeman(foremanId, jobId)` - Remove job from foreman
- `setForemanJobs(foremanId, jobIds)` - Replace all assignments

**Features:**
- Syncs with UsersService foreman methods (Phase 3B)
- Updates assignedJobIds in user state
- Updates current profile if you're modifying yourself

---

### 5. **Deprecated: Employees Store** (`src/stores/employees.ts`)
- No changes needed yet (legacy global employee list)
- Can be removed in Phase 3D when all UI views updated
- New jobRoster store is the replacement

---

## Architecture Patterns

### Store Pattern: Composition API
All Phase 3C stores use the Composition API pattern:

```typescript
export const useXxxStore = defineStore('xxx', () => {
  // State (ref)
  const items = ref<Item[]>([])
  const loading = ref(false)
  
  // Computed
  const computed = computed(() => ...)
  
  // Actions
  async function loadItems() { ... }
  
  // Return
  return { items, loading, computed, loadItems }
})
```

**Benefits:**
- More TypeScript-friendly than Options API
- Closer to Composition API syntax (familiar to Vue developers)
- Better tree-shaking for unused properties

---

## Data Flow

### User Authentication → Job Context → Roster
```
1. Login → Auth store loads user + assignedJobIds
2. User navigates to job → JobsStore.setCurrentJob(jobId)
3. UI switches context → JobRosterStore.setCurrentJob(jobId)
4. Load roster → JobRosterStore.fetchJobRoster(jobId)
5. Display employees → Use JobRosterStore.currentJobRoster computed
```

### Foreman Management
```
1. Admin assigns job to foreman → UsersStore.assignJobToForeman(foremanId, jobId)
   ├─ Updates UsersService (Firestore)
   ├─ Updates assignedJobIds in users state
   └─ Auth listener picks up change in real-time

2. JobsStore tracks foreman side:
   ├─ JobsStore.assignForemanToJob(jobId, foremanId)
   ├─ Updates assignedForemanIds in job state
   └─ Both sides synchronized
```

### Weekly Timecard Status
```
1. Admin sets period → JobsStore.setTimecardPeriodEndDate(jobId, date)
   └─ Updates Job.timecardPeriodEndDate in Firestore

2. Change status → JobsStore.setTimecardStatus(jobId, 'submitted')
   └─ Updates Job.timecardStatus (open/submitted/approved/archived)

3. Foreman views in JobHome → Read from currentJob.timecardStatus
```

---

## Type Safety

### Imports Flow
```
src/stores/
  ├─ jobRoster.ts imports JobRosterEmployee from @/types/models
  ├─ auth.ts uses Role type exported here
  ├─ jobs.ts imports Job from @/types/models
  └─ users.ts imports UserProfile from @/types/models

@/services/ all import from @/types/models
  ├─ JobRoster.ts
  ├─ Timecards.ts
  ├─ Jobs.ts
  └─ Users.ts
```

**Benefits:**
- Single source of truth: @/types/models
- No circular dependencies
- Stores → Services → Models (one-way dependency)

---

## Testing Checklist

- [x] Build passes without errors
- [x] All imports resolve correctly
- [x] Type checking passes (TypeScript)
- [x] No unused imports or exports
- [x] Backward compatibility maintained (existing views still work)

### To Test Manually:
```typescript
// Auth store now tracks foreman assignments
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
// auth.assignedJobIds will update in real-time when profile changes

// Job roster management
import { useJobRosterStore } from '@/stores/jobRoster'
const roster = useJobRosterStore()
await roster.setCurrentJob('job-123')
await roster.fetchJobRoster('job-123')
// roster.currentJobRoster will be populated

// Foreman management
import { useJobsStore } from '@/stores/jobs'
const jobs = useJobsStore()
await jobs.assignForemanToJob('job-123', 'foreman-456')

import { useUsersStore } from '@/stores/users'
const users = useUsersStore()
await users.assignJobToForeman('foreman-456', 'job-123')
```

---

## Next Steps (Phase 3D)

### UI Component Updates
Affected views need updates to use new stores:
- [ ] `Timecards.vue` - Use JobRosterStore instead of EmployeesStore
- [ ] `AdminShopCatalog.vue` - Already using new models
- [ ] `AdminJobs.vue` - Add foreman assignment UI
- [ ] `AdminEmployees.vue` - Remove (replaced by jobRoster)
- [ ] `JobHome.vue` - Show foreman context, timecard status

### Features to Implement
- [ ] Foreman role restriction checks in router guards
- [ ] Job roster management UI (add/remove/update employees)
- [ ] Timecard submission workflow
- [ ] Weekly report generation

---

## Summary

**Phase 3C Complete:** All Pinia stores updated to support Phase 3 data model changes.

✅ **Auth:** Foreman role + assignedJobIds tracking  
✅ **Jobs:** Foreman assignments + timecard status management  
✅ **Users:** Foreman role support + job assignment methods  
✅ **JobRoster:** New store for job-scoped employee rosters  
✅ **Build:** Passing (3.01s, 185 modules)  
✅ **Types:** Fully integrated with @/types/models  

Ready for Phase 3D (UI Component Updates).
