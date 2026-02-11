<template>
  <AppShell v-if="!isPublicRoute">
    <router-view />
  </AppShell>
  <router-view v-else />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import AppShell from './components/layout/AppShell.vue'

const $route = useRoute()

const isPublicRoute = computed(() => {
  const routeName = $route.name as string | undefined
  const explicitPublic = ($route.meta?.public as boolean) ?? false
  return explicitPublic || ['login', 'signup', 'set-password'].includes(routeName || '')
})
</script>
