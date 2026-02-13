<template>
  <div
    class="d-flex vh-100 app-shell"
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
      <main class="container-fluid py-4 overflow-auto">
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

<style scoped lang="scss">
.app-shell {
  --sidebar-width: 260px;
}

.app-shell.is-collapsed {
  --sidebar-width: 56px;
}

@media (max-width: 991px) {
  .app-shell {
    --sidebar-width: 56px;
  }
  .app-shell.is-mobile-open {
    --sidebar-width: 260px;
  }

  .main-pane {
    margin-left: 0;
  }
}

.main-pane {
  transition: margin-left 0.3s ease;
  overflow: hidden;
  margin-left: var(--sidebar-width);
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 90;
}
</style>