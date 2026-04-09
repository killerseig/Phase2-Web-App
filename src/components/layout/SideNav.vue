<template>
  <aside
    class="sidebar d-flex flex-column h-100 position-fixed"
    :class="{ 'is-collapsed': isSidebarCollapsed, 'is-mobile-open': app.sidebarOpenMobile }"
    role="navigation"
    aria-label="Main navigation"
    tabindex="-1"
    ref="sidebarRef"
  >
    <!-- Header with Toggle Button -->
    <div class="sidebar-header">
      <div class="d-flex align-items-center gap-2 sidebar-header-text">
        <div class="fw-bold sidebar-title">Phase 2</div>
        <RoleBadge
          v-if="role"
          :role="role"
          uppercase
          class="small sidebar-role"
        />
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
        :to="{ name: ROUTE_NAMES.DASHBOARD }"
        class="nav-link d-flex align-items-center sidebar-nav-link"
        active-class="active"
        :title="isSidebarCollapsed ? 'Dashboard' : ''"
      >
        <i class="bi bi-grid-1x2 flex-shrink-0"></i>
        <span class="text-nowrap sidebar-link-text">Dashboard</span>
      </router-link>

      <!-- Job Section -->
      <template v-if="jobId">
        <div class="sidebar-section-label sidebar-section-label--spaced">
          <small class="text-uppercase text-muted fw-semibold">Job</small>
        </div>

        <router-link
          v-for="item in jobNav"
          :key="item.label"
          :to="resolveNavTarget(item)"
          class="nav-link d-flex align-items-center sidebar-nav-link"
          active-class="active"
          :title="isSidebarCollapsed ? item.label : ''"
        >
          <i :class="['bi', item.icon, 'flex-shrink-0']"></i>
          <span class="text-nowrap sidebar-link-text">{{ item.label }}</span>
        </router-link>
      </template>

      <!-- Admin Section -->
      <template v-if="controllerNav.length > 0">
        <div class="sidebar-section-label sidebar-section-label--spaced-lg">
          <small class="text-uppercase text-muted fw-semibold">Controller</small>
        </div>

        <router-link
          v-for="item in controllerNav"
          :key="item.label"
          :to="item.to"
          class="nav-link d-flex align-items-center sidebar-nav-link"
          active-class="active"
          :title="isSidebarCollapsed ? item.label : ''"
        >
          <i :class="['bi', item.icon, 'flex-shrink-0']"></i>
          <span class="text-nowrap sidebar-link-text">{{ item.label }}</span>
        </router-link>
      </template>

      <!-- Admin Section -->
      <template v-if="adminNav.length > 0">
        <div class="sidebar-section-label sidebar-section-label--spaced-lg">
          <small class="text-uppercase text-muted fw-semibold">Admin</small>
        </div>

        <router-link
          v-for="item in adminNav"
          :key="item.label"
          :to="item.to"
          class="nav-link d-flex align-items-center sidebar-nav-link"
          active-class="active"
          :title="isSidebarCollapsed ? item.label : ''"
        >
          <i :class="['bi', item.icon, 'flex-shrink-0']"></i>
          <span class="text-nowrap sidebar-link-text">{{ item.label }}</span>
        </router-link>
      </template>
    </nav>

    <!-- Current Job Footer -->
    <div v-if="jobName" class="small sidebar-footer">
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
import { useRoute, type RouteLocationNamedRaw, type RouteLocationRaw } from 'vue-router'
import RoleBadge from '@/components/common/RoleBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useJobsStore } from '@/stores/jobs'
import { navItems, type NavItem } from '@/config/nav'
import { ROLES, ROUTE_NAMES } from '@/constants/app'

const auth = useAuthStore()
const app = useAppStore()
const jobs = useJobsStore()
const route = useRoute()
const sidebarRef = ref<HTMLElement | null>(null)

const role = computed(() => auth.role)

const routeJobId = computed(() => {
  const jobParam = route.params.jobId
  if (typeof jobParam === 'string') return jobParam
  if (Array.isArray(jobParam) && typeof jobParam[0] === 'string') return jobParam[0]
  return undefined
})

const jobId = computed(() => app.currentJobId || routeJobId.value || jobs.currentJob?.id || null)
const jobName = computed(() => app.currentJobName || jobs.currentJob?.name || null)

const canSee = (itemRoles?: string[]) => {
  if (!itemRoles || itemRoles.length === 0) return true
  return itemRoles.includes(role.value ?? ROLES.NONE)
}

const jobNav = computed(() => navItems.filter((n) => n.section === 'job' && canSee(n.roles)))
const controllerNav = computed(() => navItems.filter((n) => n.section === 'controller' && canSee(n.roles)))
const adminNav = computed(() => navItems.filter((n) => n.section === 'admin' && canSee(n.roles)))
const isSidebarCollapsed = computed(() => app.sidebarCollapsed && !app.sidebarOpenMobile)

function isNamedRouteTarget(target: RouteLocationRaw): target is RouteLocationNamedRaw {
  return typeof target === 'object' && target !== null && !Array.isArray(target) && 'name' in target
}

function resolveNavTarget(item: NavItem): RouteLocationRaw {
  if (!item.jobScoped || !jobId.value) return item.to
  if (!isNamedRouteTarget(item.to)) return item.to

  return {
    ...item.to,
    params: {
      ...(item.to.params ?? {}),
      jobId: jobId.value,
    },
  }
}

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

