<template>
  <!-- Sidebar: Always 56px when collapsed, expands to 260px overlay -->
  <aside
    class="border-end d-flex flex-column h-100 position-fixed"
    :style="{
      width: app.sidebarCollapsed ? '56px' : '260px',
      backgroundColor: '#f8f9fa',
      overflowY: 'auto',
      overflowX: 'hidden',
      transition: 'width 0.3s ease',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 99,
    }"
  >
    <!-- Header with Toggle Button -->
    <div class="p-2 border-bottom" :style="{ minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }">
      <div :style="[headerTextStyle, { opacity: textOpacity, overflow: 'hidden' }]" class="d-flex align-items-center gap-2">
        <div class="fw-bold fs-5" style="white-space: nowrap;">Phase 2</div>
        <span v-if="role" class="badge text-bg-primary text-uppercase small" style="white-space: nowrap;">{{ role }}</span>
      </div>
      <button
        type="button"
        @click="app.toggleSidebar"
        :title="app.sidebarCollapsed ? 'Expand menu' : 'Collapse menu'"
        style="border: none; background: none; padding: 8px; color: #6c757d; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;"
      >
        <i :class="app.sidebarCollapsed ? 'bi bi-chevron-right' : 'bi bi-chevron-left'" style="font-size: 1.25rem;"></i>
      </button>
    </div>

    <!-- Navigation Menu -->
    <nav class="nav flex-column flex-grow-1">
      <!-- Dashboard -->
      <router-link
        to="/dashboard"
        class="nav-link py-2 px-3 d-flex align-items-center gap-3"
        :class="{ active: $route.path === '/dashboard' }"
        :title="app.sidebarCollapsed ? 'Dashboard' : ''"
      >
        <i class="bi bi-grid-1x2 flex-shrink-0"></i>
        <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Dashboard</span>
      </router-link>

      <!-- Job Section -->
      <template v-if="jobId">
        <div class="px-3 mt-3 mb-2" :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }">
          <small class="text-uppercase text-muted fw-semibold">Job</small>
        </div>

        <router-link
          :to="{ name: 'job-home', params: { jobId } }"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Job Home' : ''"
        >
          <i class="bi bi-briefcase flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Job Home</span>
        </router-link>

        <router-link
          v-if="canEmployee"
          :to="{ name: 'job-daily-logs', params: { jobId } }"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Daily Logs' : ''"
        >
          <i class="bi bi-journal-text flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Daily Logs</span>
        </router-link>

        <router-link
          v-if="canEmployee"
          :to="{ name: 'job-timecards', params: { jobId } }"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Timecards' : ''"
        >
          <i class="bi bi-clock-history flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Timecards</span>
        </router-link>

        <router-link
          v-if="canShop"
          :to="{ name: 'job-shop-orders', params: { jobId } }"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Shop Orders' : ''"
        >
          <i class="bi bi-receipt flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Shop Orders</span>
        </router-link>
      </template>

      <!-- Admin Section -->
      <template v-if="isAdmin || isShopRole">
        <div class="px-3 mt-4 mb-2" :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }">
          <small class="text-uppercase text-muted fw-semibold">Admin</small>
        </div>

        <router-link
          v-if="isAdmin"
          to="/admin/users"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Users' : ''"
        >
          <i class="bi bi-people flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Users</span>
        </router-link>

        <router-link
          v-if="isAdmin"
          to="/admin/jobs"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Jobs' : ''"
        >
          <i class="bi bi-building flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Jobs</span>
        </router-link>

        <router-link
          v-if="isAdmin || isShopRole"
          to="/admin/shop-catalog"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Shop Catalog' : ''"
        >
          <i class="bi bi-box-seam flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Shop Catalog</span>
        </router-link>

        <router-link
          v-if="isAdmin"
          to="/admin/email-settings"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Email Settings' : ''"
        >
          <i class="bi bi-envelope flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-nowrap">Email Settings</span>
        </router-link>
      </template>
    </nav>

    <!-- Current Job Footer -->
    <div class="p-2 border-top small" :style="{ minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }">
      <div :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }" class="text-muted mb-1">Current Job</div>
      <div
        :style="{ opacity: textOpacity, transition: 'opacity 0.3s ease' }"
        class="fw-semibold text-truncate"
        :title="jobName ?? 'None'"
      >
        {{ jobName ?? 'None' }}
      </div>
      <div v-if="app.sidebarCollapsed" class="text-center" :title="jobName ?? 'None'">
        <i class="bi bi-briefcase-fill" style="font-size: 1.25rem; opacity: 0.6;"></i>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

type Role = 'admin' | 'employee' | 'shop'

const auth = useAuthStore()
const app = useAppStore()

const role = computed(() => auth.role as Role | null)

const jobId = computed(() => app.currentJobId)
const jobName = computed(() => app.currentJobName)

const isAdmin = computed(() => role.value === 'admin')
const isShopRole = computed(() => role.value === 'shop')

const canEmployee = computed(() => role.value === 'admin' || role.value === 'employee')
const canShop = computed(() => role.value === 'admin' || role.value === 'employee' || role.value === 'shop')

// Smooth opacity transition for text without reflow
const textOpacity = computed(() => (app.sidebarCollapsed ? 0 : 1))

const headerTextStyle = computed(() => ({
  transition: 'opacity 0.3s ease',
}))
</script>

<style scoped>
.nav-link {
  color: inherit;
  text-decoration: none;
  border: none;
  background: none;
  padding-top: 0.5rem !important;
  padding-bottom: 0.5rem !important;
  padding-left: 0.75rem !important;
  padding-right: 0.75rem !important;
}

.nav-link:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.nav-link.active {
  font-weight: 600;
  color: var(--bs-primary);
}

.nav-link.router-link-active {
  font-weight: 600;
}

.nav-link i {
  font-size: 1.25rem;
  min-width: 1.25rem;
  text-align: center;
}
</style>
