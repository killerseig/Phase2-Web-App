<template>
  <div
    class="d-flex app-shell"
    :class="{ 'is-collapsed': app.sidebarCollapsed, 'is-mobile-open': app.sidebarOpenMobile }"
  >
    <!-- Sidebar: fixed position -->
    <SideNav />

    <!-- Mobile backdrop -->
    <div
      v-if="app.sidebarOpenMobile"
      class="sidebar-backdrop d-lg-none"
      role="presentation"
      aria-hidden="true"
      @click="app.setSidebarOpenMobile(false)"
    ></div>

    <!-- Main content area: account for fixed sidebar with dynamic margin -->
    <div class="flex-grow-1 d-flex flex-column main-pane">
      <TopNav />
      <main class="container-fluid app-shell__content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import SideNav from './SideNav.vue'
import TopNav from './TopNav.vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()
</script>

