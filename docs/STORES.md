# Pinia Stores Documentation

This document describes the Pinia stores that manage data for the application.

## Overview

The stores provide a centralized, cached state management layer for all data operations. Instead of components directly calling services, they use stores which handle:
- Data fetching and caching
- Loading and error states
- Reactive updates
- Computed properties for common queries

## Available Stores

### Auth Store (`src/stores/auth.ts`)
Manages authentication state and user session.

**Key State:**
- `user` - Firebase user object
- `role` - User's application role ('admin', 'employee', 'shop', 'none')
- `active` - Whether the user is active/deactivated
- `ready` - Whether auth initialization is complete

**Key Actions:**
- `login(email, password)` - Sign in user
- `signOut()` - Sign out user
- `init()` - Initialize auth state

### Jobs Store (`src/stores/jobs.ts`)
Manages job data and operations.

**Key State:**
- `jobs` - Array of all jobs
- `currentJob` - Currently selected job
- `loading` - Loading state
- `error` - Error message if operation failed

**Key Computed:**
- `activeJobs` - Jobs that are not archived
- `archivedJobs` - Archived jobs
- `isLoading` - Whether any operation is in progress

**Key Actions:**
```typescript
// Fetch all jobs (include archived or active only)
await jobsStore.fetchAllJobs(includeArchived = true)

// Fetch specific job
await jobsStore.fetchJob(jobId)

// Create new job
const newJob = await jobsStore.createJob(name, code)

// Update job
await jobsStore.updateJob(jobId, { name?, code? })

// Set job active/inactive
await jobsStore.setJobActive(jobId, active)

// Clear error state
jobsStore.clearError()

// Reset all store state
jobsStore.resetStore()
```

### Employees Store (`src/stores/employees.ts`)
Manages employee data and operations.

**Key State:**
- `employees` - Array of all employees
- `employeesByJob` - Map of employees by job ID
- `loading` - Loading state
- `error` - Error message

**Key Computed:**
- `activeEmployees` - Employees that are not archived
- `isLoading` - Whether operation is in progress

**Key Actions:**
```typescript
// Fetch all employees
await employeesStore.fetchAllEmployees()

// Fetch employees for specific job
const jobEmployees = await employeesStore.fetchEmployeesByJob(jobId)

// Get cached employees for job
const cached = employeesStore.getEmployeesByJob(jobId)

// Create employee
const employee = await employeesStore.createEmployee(jobId, { firstName, lastName, ... })

// Update employee
await employeesStore.updateEmployee(employeeId, { firstName?, lastName?, ... })

// Delete employee
await employeesStore.deleteEmployee(employeeId)
```

### Users Store (`src/stores/users.ts`)
Manages user profile data and operations.

**Key State:**
- `users` - Array of all user profiles
- `currentUserProfile` - Current logged-in user's profile
- `loading` - Loading state
- `error` - Error message

**Key Computed:**
- `activeUsers` - Users that are active
- `adminUsers` - Users with admin role
- `isLoading` - Whether operation is in progress

**Key Actions:**
```typescript
// Fetch all users
await usersStore.fetchAllUsers()

// Fetch current user's profile
await usersStore.fetchMyProfile()

// Update user profile
await usersStore.updateUserProfile(userId, { firstName?, lastName?, ... })

// Deactivate user
await usersStore.deactivateUser(userId)

// Reactivate user
await usersStore.reactivateUser(userId)

// Change user role
await usersStore.changeUserRole(userId, 'admin' | 'employee' | 'shop' | 'none')

// Delete user
await usersStore.deleteUser(userId)
```

### Shop Catalog Store (`src/stores/shopCatalog.ts`)
Manages shop catalog items.

**Key State:**
- `items` - Array of catalog items
- `loading` - Loading state
- `error` - Error message

**Key Computed:**
- `availableItems` - Items that are active
- `isLoading` - Whether operation is in progress

**Key Actions:**
```typescript
// Fetch catalog
await shopStore.fetchCatalog()

// Create item
const item = await shopStore.createItem(description)

// Update item
await shopStore.updateItem(itemId, { description? })

// Set item active/inactive
await shopStore.setItemActive(itemId, active)

// Delete item
await shopStore.deleteItem(itemId)
```

## Usage Examples

### Example 1: Using Jobs Store in a Component

```typescript
<script setup lang="ts">
import { useJobsStore } from '@/stores/jobs'
import { onMounted } from 'vue'

const jobsStore = useJobsStore()

onMounted(async () => {
  // Load all jobs
  await jobsStore.fetchAllJobs()
})
</script>

<template>
  <div>
    <!-- Show loading state -->
    <div v-if="jobsStore.isLoading">Loading...</div>
    
    <!-- Show error if any -->
    <div v-if="jobsStore.hasError" class="alert alert-danger">
      {{ jobsStore.error }}
      <button @click="jobsStore.clearError()">Dismiss</button>
    </div>
    
    <!-- Display jobs -->
    <div v-for="job in jobsStore.activeJobs" :key="job.id">
      <h3>{{ job.name }}</h3>
      <p>{{ job.code }}</p>
    </div>
  </div>
</template>
```

### Example 2: Refactored Admin Component

Instead of:
```typescript
const jobs = ref<Job[]>([])
const loading = ref(false)
const error = ref('')

async function loadJobs() {
  loading.value = true
  try {
    jobs.value = await JobsService.listAllJobs()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
```

Use:
```typescript
const jobsStore = useJobsStore()

async function loadJobs() {
  await jobsStore.fetchAllJobs()
}
```

Then in template, bind to:
- `jobsStore.allJobs` instead of `jobs`
- `jobsStore.isLoading` instead of `loading`
- `jobsStore.error` instead of `error`

## Benefits

1. **Single Source of Truth** - Data is stored in one place, not duplicated across components
2. **Caching** - Data fetched once is reused across components
3. **Consistent Error Handling** - All data operations follow the same error pattern
4. **Reactive Updates** - Changes automatically propagate to all components using the store
5. **Easier Testing** - Can mock the store instead of services
6. **Better Performance** - Computed properties avoid unnecessary re-renders
7. **Simpler Components** - Less boilerplate code in components

## Migration Guide

When refactoring existing components to use stores:

1. Import the store: `import { useJobsStore } from '@/stores/jobs'`
2. Create store instance in setup: `const jobsStore = useJobsStore()`
3. Replace direct service calls with store actions
4. Replace local refs with computed properties from store
5. Bind templates to store properties instead of local refs
6. Remove loading/error handling code from component

Example component refactoring:
```typescript
// Before
const jobs = ref([])
const loading = ref(false)

async function loadJobs() {
  loading.value = true
  jobs.value = await JobsService.listAllJobs()
  loading.value = false
}

// After
const jobsStore = useJobsStore()
await jobsStore.fetchAllJobs()

// In template: jobsStore.allJobs instead of jobs
// In template: jobsStore.isLoading instead of loading
```
