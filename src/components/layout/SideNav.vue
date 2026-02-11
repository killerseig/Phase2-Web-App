<template>
  <!-- Sidebar: Always 56px when collapsed, expands to 260px overlay -->
  <aside
    class="sidebar border-end d-flex flex-column h-100 position-fixed"
    :style="{ width: app.sidebarCollapsed ? '56px' : '260px' }"
  >
    <!-- Header with Toggle Button -->
    <div class="p-2 border-bottom sidebar-header">
      <div :style="{ opacity: textOpacity }" class="d-flex align-items-center gap-2 sidebar-header-text">
        <div class="fw-bold fs-5 sidebar-title">Phase 2</div>
        <span v-if="role" class="badge text-bg-primary text-uppercase small sidebar-role">{{ role }}</span>
      </div>
      <button
        type="button"
        @click="app.toggleSidebar"
        :title="app.sidebarCollapsed ? 'Expand menu' : 'Collapse menu'"
        class="sidebar-toggle"
      >
        <i :class="app.sidebarCollapsed ? 'bi bi-chevron-right' : 'bi bi-chevron-left'" class="sidebar-toggle-icon"></i>
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
        <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Dashboard</span>
      </router-link>

      <!-- Job Section -->
      <template v-if="jobId">
        <div class="px-3 mt-3 mb-2 sidebar-section-label" :style="{ opacity: textOpacity }">
          <small class="text-uppercase text-muted fw-semibold">Job</small>
        </div>

        <router-link
          :to="{ name: 'job-home', params: { jobId } }"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Job Home' : ''"
        >
          <i class="bi bi-briefcase flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Job Home</span>
        </router-link>

        <router-link
          v-if="canEmployee"
          :to="{ name: 'job-daily-logs', params: { jobId } }"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Daily Logs' : ''"
        >
          <i class="bi bi-journal-text flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Daily Logs</span>
        </router-link>

        <router-link
          v-if="canEmployee"
          :to="{ name: 'job-timecards', params: { jobId } }"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Timecards' : ''"
        >
          <i class="bi bi-clock-history flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Timecards</span>
        </router-link>

        <router-link
          v-if="canShop"
          :to="{ name: 'job-shop-orders', params: { jobId } }"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Shop Orders' : ''"
        >
          <i class="bi bi-receipt flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Shop Orders</span>
        </router-link>
      </template>

      <!-- Admin Section -->
      <template v-if="isAdmin || isShopRole">
        <div class="px-3 mt-4 mb-2 sidebar-section-label" :style="{ opacity: textOpacity }">
          <small class="text-uppercase text-muted fw-semibold">Admin</small>
        </div>

        <router-link
          v-if="isAdmin"
          to="/admin/users"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Users' : ''"
        >
          <i class="bi bi-people flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Users</span>
        </router-link>

        <router-link
          v-if="isAdmin"
          to="/admin/jobs"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Jobs' : ''"
        >
          <i class="bi bi-building flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Jobs</span>
        </router-link>

        <router-link
          v-if="isAdmin || isShopRole"
          to="/admin/shop-catalog"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Shop Catalog' : ''"
        >
          <i class="bi bi-box-seam flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Shop Catalog</span>
        </router-link>

        <router-link
          v-if="isAdmin"
          to="/admin/email-settings"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="app.sidebarCollapsed ? 'Email Settings' : ''"
        >
          <i class="bi bi-envelope flex-shrink-0"></i>
          <span :style="{ opacity: textOpacity }" class="text-nowrap sidebar-link-text">Email Settings</span>
        </router-link>
      </template>
    </nav>

    <!-- Current Job Footer -->
    <div v-if="jobName" class="p-2 border-top small sidebar-footer">
      <div :style="{ opacity: textOpacity }" class="text-muted mb-1 sidebar-link-text">Current Job</div>
      <div
        :style="{ opacity: textOpacity }"
        class="fw-semibold text-truncate"
        :title="jobName"
      >
        {{ jobName }}
      </div>
      <div v-if="app.sidebarCollapsed" class="text-center" :title="jobName">
        <i class="bi bi-briefcase-fill sidebar-footer-icon"></i>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useJobsStore } from '@/stores/jobs'

type Role = 'admin' | 'employee' | 'shop'

const auth = useAuthStore()
const app = useAppStore()
const jobs = useJobsStore()
const route = useRoute()

const role = computed(() => auth.role as Role | null)

const jobId = computed(() => app.currentJobId || (route.params.jobId as string | undefined) || jobs.currentJob?.id || null)
const jobName = computed(() => app.currentJobName || jobs.currentJob?.name || null)

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

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.sidebar {
  background: $surface;
  color: $body-color;
  border-right: 1px solid $border-color !important;
  box-shadow: 6px 0 24px rgba(0, 0, 0, 0.25);
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.3s ease;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 99;
}

.sidebar .border-bottom,
.sidebar .border-top {
  border-color: $border-color !important;
}

.sidebar-header {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sidebar-header-text {
  transition: opacity 0.3s ease;
  overflow: hidden;
}

.sidebar-title,
.sidebar-role {
  white-space: nowrap;
}

.sidebar-toggle {
  border: none;
  background: none;
  padding: 8px;
  color: #6c757d;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.sidebar-toggle-icon {
  font-size: 1.25rem;
}

.sidebar-link-text {
  transition: opacity 0.3s ease;
}

.sidebar-section-label {
  transition: opacity 0.3s ease;
}

.sidebar-footer {
  min-height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.sidebar-footer-icon {
  font-size: 1.25rem;
  opacity: 0.6;
}

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
  background-color: rgba($primary, 0.12);
}

.nav-link.active {
  font-weight: 600;
  color: $primary;
  background-color: rgba($primary, 0.16);
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
