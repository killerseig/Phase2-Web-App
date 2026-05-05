<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

type NavigationItem = {
  label: string
  to: string
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const mobileNavOpen = ref(false)

const workspaceNavigationItems = computed<NavigationItem[]>(() => [
  { label: 'Jobs', to: '/jobs' },
])

const adminNavigationItems = computed<NavigationItem[]>(() => [
  { label: 'Users', to: '/users' },
  { label: 'Employees', to: '/employees' },
  { label: 'Timecard Export', to: '/exports/timecards' },
  { label: 'Shop Catalog', to: '/settings/shop-catalog' },
])

const roleLabel = computed(() => {
  if (auth.isAdmin) return 'Admin'
  if (auth.roleKey === 'foreman') return 'Foreman'
  return 'Workspace'
})

function openMobileNav() {
  mobileNavOpen.value = true
}

function closeMobileNav() {
  mobileNavOpen.value = false
}

async function handleSignOut() {
  closeMobileNav()
  await auth.signOut()
  await router.push('/login')
}

watch(() => route.fullPath, () => {
  closeMobileNav()
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--mobile-nav-open': mobileNavOpen }">
    <button
      class="app-shell__sidebar-backdrop"
      type="button"
      :tabindex="mobileNavOpen ? 0 : -1"
      aria-label="Close navigation"
      @click="closeMobileNav"
    ></button>

    <aside id="app-shell-navigation" class="app-shell__sidebar">
      <div class="app-shell__brand">
        <div class="app-shell__logo">P2</div>
        <div>
          <div class="app-shell__brand-title">Phase 2</div>
          <div class="app-shell__brand-subtitle">Field Operations</div>
        </div>
        <Button class="app-shell__sidebar-close" type="button" aria-label="Close navigation" @click="closeMobileNav">
          <i class="pi pi-times app-shell__control-icon" aria-hidden="true"></i>
        </Button>
      </div>

      <div class="app-shell__sidebar-main">
        <div class="app-shell__section-label">Navigation</div>
        <nav class="app-shell__nav">
          <RouterLink
            v-for="item in workspaceNavigationItems"
            :key="item.to"
            :to="item.to"
            class="app-shell__nav-link"
            active-class="app-shell__nav-link--active"
            @click="closeMobileNav"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>

      <div class="app-shell__sidebar-footer">
        <div v-if="auth.isAdmin" class="app-shell__sidebar-admin">
          <div class="app-shell__section-label">Admin</div>
          <nav class="app-shell__nav">
            <RouterLink
              v-for="item in adminNavigationItems"
              :key="item.to"
              :to="item.to"
              class="app-shell__nav-link"
              active-class="app-shell__nav-link--active"
              @click="closeMobileNav"
            >
              {{ item.label }}
            </RouterLink>
          </nav>
        </div>
        <div class="app-shell__sidebar-signout">
          <button
            class="app-shell__nav-link app-shell__sidebar-signout-button"
            type="button"
            @click="handleSignOut"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>

    <div class="app-shell__body">
      <header class="app-shell__topbar">
        <div class="app-shell__topbar-leading">
          <Button
            class="app-shell__menu-button"
            :class="{ 'app-shell__menu-button--open': mobileNavOpen }"
            type="button"
            :aria-expanded="mobileNavOpen ? 'true' : 'false'"
            aria-controls="app-shell-navigation"
            :aria-label="mobileNavOpen ? 'Close navigation' : 'Open navigation'"
            @click="mobileNavOpen ? closeMobileNav() : openMobileNav()"
          >
            <i :class="['pi', mobileNavOpen ? 'pi-times' : 'pi-bars', 'app-shell__control-icon']" aria-hidden="true"></i>
            <span class="app-shell__visually-hidden">Menu</span>
          </Button>
        </div>

        <div class="app-shell__topbar-meta">
          <slot name="topbar-actions" />
          <div class="app-shell__topbar-chip app-shell__topbar-chip--role">
            {{ roleLabel }}
          </div>
        </div>
      </header>

      <main class="app-shell__content">
        <slot />
      </main>

      <footer class="app-shell__statusbar">
        <span>Ready</span>
      </footer>
    </div>
  </div>
</template>
