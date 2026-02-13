<template>
  <div v-if="!isAuthReady" class="app-boot-screen">
    <div class="spinner-border text-primary" role="status" aria-label="Loading"></div>
  </div>
  <template v-else>
    <AppShell v-if="!isPublicRoute">
      <router-view />
    </AppShell>
    <router-view v-else />
  </template>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import AppShell from './components/layout/AppShell.vue'
import { useAuthStore } from './stores/auth'

const $route = useRoute()
const auth = useAuthStore()

const isAuthReady = computed(() => auth.ready)

const isPublicRoute = computed(() => {
  const routeName = $route.name as string | undefined
  const explicitPublic = ($route.meta?.public as boolean) ?? false
  return explicitPublic || ['login', 'signup', 'set-password'].includes(routeName || '')
})
</script>

<style scoped>
.app-boot-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
}
</style>
