<template>
  <nav class="navbar navbar-expand-lg topnav topnav-sticky">
    <div class="container-fluid topnav__inner">
      <div class="navbar-text d-none d-md-flex align-items-center gap-2 flex-grow-1 topnav-context">
        <span v-if="showCrumb" class="crumb-chip">{{ crumb }}</span>
        <div class="fw-semibold title-text">{{ title }}</div>
      </div>

      <div class="d-md-none flex-grow-1">
        <div class="fw-semibold title-text-sm">{{ title }}</div>
      </div>

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
  ROUTE_NAMES.CONTROLLER,
  ROUTE_NAMES.ADMIN_USERS,
  ROUTE_NAMES.ADMIN_JOBS,
  ROUTE_NAMES.ADMIN_SHOP_CATALOG,
  ROUTE_NAMES.ADMIN_EMAIL_SETTINGS,
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
const showCrumb = computed(() => Boolean(crumb.value && crumb.value !== title.value))

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

