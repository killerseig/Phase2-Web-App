<template>
  <!-- Sidebar: Always 56px when collapsed, expands to 260px overlay -->
  <aside
    class="sidebar border-end d-flex flex-column h-100 position-fixed"
    :class="{ 'is-collapsed': isSidebarCollapsed, 'is-mobile-open': app.sidebarOpenMobile }"
    role="dialog"
    aria-modal="true"
    aria-label="Main navigation"
    tabindex="-1"
    ref="sidebarRef"
  >
    <!-- Header with Toggle Button -->
    <div class="p-2 border-bottom sidebar-header">
      <div class="d-flex align-items-center gap-2 sidebar-header-text">
        <div class="fw-bold fs-5 sidebar-title">Phase 2</div>
        <span v-if="role" class="badge text-bg-primary text-uppercase small sidebar-role">{{ role }}</span>
      </div>
      <div class="d-flex align-items-center gap-1">
        <button
          type="button"
          @click="onToggleClick"
          :title="isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'"
          class="sidebar-toggle"
          aria-label="Toggle sidebar"
        >
          <i :class="isSidebarCollapsed ? 'bi bi-chevron-right' : 'bi bi-chevron-left'" class="sidebar-toggle-icon"></i>
        </button>
      </div>
    </div>

    <!-- Navigation Menu -->
    <nav class="nav flex-column flex-grow-1">
      <!-- Dashboard -->
      <router-link
        to="/dashboard"
        class="nav-link py-2 px-3 d-flex align-items-center gap-3"
        :class="{ active: $route.path === '/dashboard' }"
        :title="isSidebarCollapsed ? 'Dashboard' : ''"
      >
        <i class="bi bi-grid-1x2 flex-shrink-0"></i>
        <span class="text-nowrap sidebar-link-text">Dashboard</span>
      </router-link>

      <!-- Job Section -->
      <template v-if="jobId">
        <div class="px-3 mt-3 mb-2 sidebar-section-label">
          <small class="text-uppercase text-muted fw-semibold">Job</small>
        </div>

        <router-link
          v-for="item in jobNav"
          :key="item.label"
          :to="item.jobScoped ? { ...(item.to as any), params: { ...(item.to as any).params, jobId } } : item.to"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="isSidebarCollapsed ? item.label : ''"
        >
          <i :class="['bi', item.icon, 'flex-shrink-0']"></i>
          <span class="text-nowrap sidebar-link-text">{{ item.label }}</span>
        </router-link>
      </template>

      <!-- Admin Section -->
      <template v-if="isAdmin || isShopRole">
        <div class="px-3 mt-4 mb-2 sidebar-section-label">
          <small class="text-uppercase text-muted fw-semibold">Admin</small>
        </div>

        <router-link
          v-for="item in adminNav"
          :key="item.label"
          :to="item.to"
          class="nav-link py-2 px-3 d-flex align-items-center gap-3"
          :title="isSidebarCollapsed ? item.label : ''"
        >
          <i :class="['bi', item.icon, 'flex-shrink-0']"></i>
          <span class="text-nowrap sidebar-link-text">{{ item.label }}</span>
        </router-link>
      </template>
    </nav>

    <!-- Current Job Footer -->
    <div v-if="jobName" class="p-2 border-top small sidebar-footer">
      <div class="text-muted mb-1 sidebar-link-text">Current Job</div>
      <div class="fw-semibold text-truncate" :title="jobName">
        {{ jobName }}
      </div>
      <div v-if="isSidebarCollapsed" class="text-center" :title="jobName">
        <i class="bi bi-briefcase-fill sidebar-footer-icon"></i>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useJobsStore } from '@/stores/jobs'
import { navItems } from '@/config/nav'
import { ROLES } from '@/constants/app'

const auth = useAuthStore()
const app = useAppStore()
const jobs = useJobsStore()
const route = useRoute()
const sidebarRef = ref<HTMLElement | null>(null)

const role = computed(() => auth.role)

const jobId = computed(() => app.currentJobId || (route.params.jobId as string | undefined) || jobs.currentJob?.id || null)
const jobName = computed(() => app.currentJobName || jobs.currentJob?.name || null)

const isAdmin = computed(() => role.value === ROLES.ADMIN)
const isShopRole = computed(() => role.value === ROLES.SHOP)

const canSee = (itemRoles?: string[]) => {
  if (!itemRoles || itemRoles.length === 0) return true
  return itemRoles.includes(role.value ?? ROLES.NONE)
}

const jobNav = computed(() => navItems.filter((n) => n.section === 'job' && canSee(n.roles)))
const adminNav = computed(() => navItems.filter((n) => n.section === 'admin' && canSee(n.roles)))
const isSidebarCollapsed = computed(() => app.sidebarCollapsed && !app.sidebarOpenMobile)

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && app.sidebarOpenMobile) {
    app.setSidebarOpenMobile(false)
  }
}

watch(
  () => app.sidebarOpenMobile,
  (open) => {
    if (open) {
      requestAnimationFrame(() => {
        sidebarRef.value?.focus()
      })
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onToggleClick() {
  const isMobile = window.innerWidth <= 991
  if (isMobile) {
    app.setSidebarOpenMobile(!app.sidebarOpenMobile)
  } else {
    app.toggleSidebar()
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.sidebar {
  background: var(--surface, $surface);
  color: var(--text-body, $body-color);
  border-right: 1px solid var(--border, $border-color) !important;
  box-shadow: 6px 0 24px rgba(0, 0, 0, 0.25);
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.3s ease, transform 0.3s ease;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 99;
  width: var(--sidebar-width, 260px);
}

.sidebar.is-collapsed .sidebar-header-text,
.sidebar.is-collapsed .sidebar-section-label,
.sidebar.is-collapsed .sidebar-link-text,
.sidebar.is-collapsed .sidebar-footer .text-truncate,
.sidebar.is-collapsed .sidebar-footer .text-muted {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.sidebar.is-collapsed .sidebar-header {
  justify-content: center;
}

.sidebar.is-collapsed .sidebar-toggle {
  margin: 0 auto;
}

@media (max-width: 991px) {
  .sidebar {
    width: 56px;
    transform: translateX(0);
  }

  .sidebar.is-mobile-open {
    width: 260px;
  }

  .sidebar:not(.is-mobile-open) .sidebar-header-text,
  .sidebar:not(.is-mobile-open) .sidebar-section-label,
  .sidebar:not(.is-mobile-open) .sidebar-link-text,
  .sidebar:not(.is-mobile-open) .sidebar-footer .text-truncate,
  .sidebar:not(.is-mobile-open) .sidebar-footer .text-muted {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

}

.sidebar .border-bottom,
.sidebar .border-top {
  border-color: var(--border, $border-color) !important;
}

.sidebar-header {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sidebar-header-text {
  max-width: 180px;
  transition: opacity 0.3s ease, visibility 0.3s ease;
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
  color: var(--text-muted, $text-muted);
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
  display: inline-block;
  max-width: 180px;
  transition: opacity 0.3s ease, visibility 0.3s ease;
  overflow: hidden;
}

.sidebar-section-label {
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.sidebar-footer .text-truncate,
.sidebar-footer .text-muted {
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.sidebar.is-collapsed .sidebar-header-text {
  max-width: 0;
}

.sidebar.is-collapsed .sidebar-link-text {
  max-width: 0;
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
