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
        <button
          class="btn btn-outline-secondary btn-sm d-lg-none topnav-btn"
          type="button"
          title="Toggle menu"
          @click="app.setSidebarOpenMobile(!app.sidebarOpenMobile)"
        >
          <i class="bi bi-list"></i>
        </button>

        <router-link
          v-if="jobId"
          :to="{ name: 'job-home', params: { jobId } }"
          class="btn btn-outline-secondary btn-sm"
          title="Go to Job Home"
          :class="'topnav-btn'"
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
import { crumbByRouteName } from '@/config/nav'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()
const jobs = useJobsStore()

const jobId = computed(() => app.currentJobId || (route.params.jobId as string | undefined) || jobs.currentJob?.id || null)
const jobName = computed(() => app.currentJobName || jobs.currentJob?.name || '')

const title = computed(() => {
  const metaTitle = route.meta.title as string | undefined
  if (metaTitle) return metaTitle
  const byName = crumbByRouteName[route.name as string]
  if (byName) return byName
  if (route.path.startsWith('/job/')) return jobName.value || 'Job'
  return 'Phase 2'
})

const crumb = computed(() => {
  if (route.path.startsWith('/job/')) {
    return jobName.value || 'Job'
  }
  const byName = crumbByRouteName[route.name as string]
  if (byName) return byName
  if (route.path.startsWith('/admin')) return 'Admin'
  if (route.path.startsWith('/dashboard')) return 'Dashboard'
  if (route.path.startsWith('/login')) return 'Auth'
  return 'App'
})

async function onSignOut() {
  await auth.signOut()
  app.clearJob()
  router.push('/login')
}
</script>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.topnav {
  background: $surface;
  color: $body-color;
  border-bottom: 1px solid $border-color;
  box-shadow: $box-shadow-sm;
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
  color: $body-color;
}

.navbar-text .text-muted {
  color: $text-muted !important;
}

.topnav .btn-outline-secondary {
  color: $body-color;
  border-color: $border-color;
  background: $surface-2;
}

.topnav-btn {
  padding: 0.375rem 0.6rem;
  font-size: 0.85rem;
}

.topnav .btn-outline-secondary:hover {
  background: rgba($primary, 0.12);
  border-color: $primary;
  color: $body-color;
}

.topnav .btn-outline-danger {
  color: $danger;
  border-color: rgba($danger, 0.5);
  background: $surface-2;
}

.topnav .btn-outline-danger:hover {
  background: rgba($danger, 0.12);
  border-color: $danger;
}
</style>
