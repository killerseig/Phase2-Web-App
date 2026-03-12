<template>
  <nav class="navbar navbar-expand-lg topnav topnav-sticky">
    <div class="container-fluid px-3">
      <!-- Breadcrumb / Title -->
      <div class="navbar-text d-none d-md-block flex-grow-1">
        <div class="small text-muted mb-0 crumb-text">{{ crumb }}</div>
        <div class="fw-semibold title-text">{{ title }}</div>
      </div>

      <!-- Mobile Title (show only on small screens) -->
      <div class="d-md-none flex-grow-1">
        <div class="fw-semibold title-text-sm">{{ title }}</div>
      </div>

      <!-- Actions -->
      <div class="d-flex align-items-center gap-2 ms-auto">
        <router-link
          v-if="jobId"
          :to="{ name: ROUTE_NAMES.JOB_HOME, params: { jobId } }"
          class="btn btn-outline-secondary btn-sm topnav-btn"
          title="Go to Job Home"
        >
          <i class="bi bi-briefcase me-1" />
          <span class="d-none d-sm-inline">{{ jobName || 'Job Home' }}</span>
        </router-link>

        <button
          v-if="auth.user"
          class="btn btn-outline-danger btn-sm topnav-btn"
          type="button"
          @click="onSignOut"
          title="Sign out"
        >
          <i class="bi bi-box-arrow-right me-1" />
          <span class="d-none d-sm-inline">Sign out</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useJobsStore } from '@/stores/jobs'
import { ROUTE_NAMES, type RouteName } from '@/constants/app'
import { crumbByRouteName } from '@/config/nav'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()
const jobs = useJobsStore()
const knownRouteNames = new Set<string>(Object.values(ROUTE_NAMES))
const jobRouteNames = new Set<RouteName>([
  ROUTE_NAMES.JOB_HOME,
  ROUTE_NAMES.JOB_DAILY_LOGS,
  ROUTE_NAMES.JOB_TIMECARDS,
  ROUTE_NAMES.JOB_SHOP_ORDERS,
])
const adminRouteNames = new Set<RouteName>([
  ROUTE_NAMES.ADMIN_USERS,
  ROUTE_NAMES.ADMIN_JOBS,
  ROUTE_NAMES.ADMIN_SHOP_CATALOG,
  ROUTE_NAMES.ADMIN_EMAIL_SETTINGS,
  ROUTE_NAMES.ADMIN_DATA_MIGRATION,
])

const routeJobId = computed(() => {
  const jobParam = route.params.jobId
  if (typeof jobParam === 'string') return jobParam
  if (Array.isArray(jobParam) && typeof jobParam[0] === 'string') return jobParam[0]
  return undefined
})

const jobId = computed(() => app.currentJobId || routeJobId.value || jobs.currentJob?.id || null)
const jobName = computed(() => app.currentJobName || jobs.currentJob?.name || '')
const routeName = computed<RouteName | null>(() => {
  const name = route.name
  if (typeof name !== 'string' || !knownRouteNames.has(name)) return null
  return name as RouteName
})
const isJobRoute = computed(() => routeName.value !== null && jobRouteNames.has(routeName.value))
const isAdminRoute = computed(() => routeName.value !== null && adminRouteNames.has(routeName.value))
const isDashboardRoute = computed(() => routeName.value === ROUTE_NAMES.DASHBOARD)
const isAuthRoute = computed(() => routeName.value === ROUTE_NAMES.LOGIN || routeName.value === ROUTE_NAMES.SET_PASSWORD)

const title = computed(() => {
  const metaTitle = typeof route.meta.title === 'string' ? route.meta.title : undefined
  if (metaTitle) return metaTitle
  const byName = routeName.value ? crumbByRouteName[routeName.value] : undefined
  if (byName) return byName
  if (isJobRoute.value) return jobName.value || 'Job'
  return 'Phase 2'
})

const crumb = computed(() => {
  if (isJobRoute.value) {
    return jobName.value || 'Job'
  }
  const byName = routeName.value ? crumbByRouteName[routeName.value] : undefined
  if (byName) return byName
  if (isAdminRoute.value) return 'Admin'
  if (isDashboardRoute.value) return 'Dashboard'
  if (isAuthRoute.value) return 'Auth'
  return 'App'
})

async function onSignOut() {
  await auth.signOut()
  await router.push({ name: ROUTE_NAMES.LOGIN })
}
</script>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.topnav {
  background: var(--surface, $surface);
  color: var(--text-body, $body-color);
  border-bottom: 1px solid var(--border, $border-color);
  box-shadow: var(--shadow-sm, $box-shadow-sm);
}

.topnav-sticky {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 0.5rem 0 0.5rem 1rem;
  transition: padding-left 0.3s ease;
}

.crumb-text {
  font-size: 0.8rem;
}

.title-text {
  font-size: 0.95rem;
}

.title-text-sm {
  font-size: 0.9rem;
}

.topnav .navbar-text {
  color: var(--text-body, $body-color);
}

.navbar-text .text-muted {
  color: var(--text-muted, $text-muted);
}

.topnav .btn-outline-secondary {
  color: var(--text-body, $body-color);
  border-color: var(--border, $border-color);
  background: var(--surface-2, $surface-2);
}

.topnav-btn {
  padding: 0.375rem 0.6rem;
  font-size: 0.85rem;
}

.topnav .btn-outline-secondary:hover {
  background: rgba($primary, 0.12);
  border-color: $primary;
  color: var(--text-body, $body-color);
}

.topnav .btn-outline-danger {
  color: $danger;
  border-color: rgba($danger, 0.5);
  background: var(--surface-2, $surface-2);
}

.topnav .btn-outline-danger:hover {
  background: rgba($danger, 0.12);
  border-color: $danger;
}
</style>
