<template>
  <div class="d-flex vh-100">
    <!-- Sidebar: fixed position -->
    <SideNav />

    <!-- Main content area: account for fixed sidebar with dynamic margin -->
    <div class="flex-grow-1 d-flex flex-column" :style="{ marginLeft: app.sidebarCollapsed ? '56px' : '260px', transition: 'margin-left 0.3s ease', overflow: 'hidden' }">
      <TopNav />
      <main class="container-fluid py-4 overflow-auto">
        <router-view />
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