<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-light border-bottom" :style="{ position: 'sticky', top: 0, zIndex: 50, padding: '0.5rem 0 0.5rem 1rem', transition: 'padding-left 0.3s ease' }">
    <div class="container-fluid px-3">
      <!-- Breadcrumb / Title -->
      <div class="navbar-text d-none d-md-block flex-grow-1">
        <div class="small text-muted mb-0" style="font-size: 0.8rem;">{{ crumb }}</div>
        <div class="fw-semibold" style="font-size: 0.95rem;">{{ title }}</div>
      </div>

      <!-- Mobile Title (show only on small screens) -->
      <div class="d-md-none flex-grow-1">
        <div class="fw-semibold" style="font-size: 0.9rem;">{{ title }}</div>
      </div>

      <!-- Actions -->
      <div class="d-flex align-items-center gap-2 ms-auto">
        <router-link
          v-if="jobId"
          :to="{ name: 'job-home', params: { jobId } }"
          class="btn btn-outline-secondary btn-sm"
          title="Go to Job Home"
          style="padding: 0.375rem 0.6rem; font-size: 0.85rem;"
        >
          <i class="bi bi-briefcase me-1" />
          <span class="d-none d-sm-inline">Job</span>
        </router-link>

        <button
          v-if="auth.user"
          class="btn btn-outline-danger btn-sm"
          type="button"
          @click="onSignOut"
          title="Sign out"
          style="padding: 0.375rem 0.6rem; font-size: 0.85rem;"
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

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()

const jobId = computed(() => app.currentJobId)
const jobName = computed(() => app.currentJobName)

const title = computed(() => {
  const metaTitle = route.meta.title as string | undefined
  if (metaTitle) return metaTitle

  const p = route.path
  if (p.startsWith('/dashboard')) return 'Dashboard'
  if (p.startsWith('/job/') && p.endsWith('/daily-logs')) return 'Daily Logs'
  if (p.startsWith('/job/') && p.endsWith('/timecards')) return 'Timecards'
  if (p.startsWith('/job/') && p.endsWith('/shop-orders')) return 'Shop Orders'
  if (p.startsWith('/job/')) return jobName.value ?? 'Job'
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
