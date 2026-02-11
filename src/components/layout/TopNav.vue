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
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useJobsStore } from '@/stores/jobs'

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

  const p = route.path
  if (p.startsWith('/dashboard')) return 'Dashboard'
  if (p.startsWith('/job/') && p.endsWith('/daily-logs')) return 'Daily Logs'
  if (p.startsWith('/job/') && p.endsWith('/timecards')) return 'Timecards'
  if (p.startsWith('/job/') && p.endsWith('/shop-orders')) return 'Shop Orders'
  if (p.startsWith('/job/')) return jobName.value || 'Job'
  if (p.startsWith('/admin/users')) return 'Admin · Users'
  if (p.startsWith('/admin/jobs')) return 'Admin · Jobs'
  if (p.startsWith('/admin/email-settings')) return 'Admin · Email Settings'
  if (p.startsWith('/admin/shop-catalog')) return 'Admin · Shop Catalog'
  if (p.startsWith('/unauthorized')) return 'Unauthorized'
  if (p.startsWith('/login')) return 'Login'
  return 'Phase 2'
})

const crumb = computed(() => {
  const p = route.path
  if (p.startsWith('/admin')) return 'Admin'
  if (p.startsWith('/job/')) {
    return jobName.value ? `Job · ${jobName.value}` : 'Job'
  }
  if (p.startsWith('/dashboard')) return 'Dashboard'
  if (p.startsWith('/login')) return 'Auth'
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
