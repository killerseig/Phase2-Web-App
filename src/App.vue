<template>
  <AppShell v-if="!isPublicRoute" />
  <router-view />
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { watch, computed } from 'vue'
import AppShell from './components/layout/AppShell.vue'

const $route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const isPublicRoute = computed(() => ['login', 'signup', 'set-password'].includes($route.name as string))

type Role = 'admin' | 'employee' | 'shop' | 'none'

/**
 * Watch for role changes and re-check route access
 * - If new role loses access to current route, redirect to unauthorized
 * - If on unauthorized page and role now has access, redirect to dashboard
 */
watch(
  () => auth.role,
  () => {
    // Skip check for public routes
    const isPublic = ($route.meta?.public as boolean) ?? false
    if (isPublic) return

    // Get allowed roles for current route
    const allowedRoles = ($route.meta?.roles as Role[]) ?? undefined
    const userRole = auth.role || 'employee'

    // If route requires specific roles, check if new role is allowed
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      console.log(`[App] Role changed - no longer allowed on ${String($route.name)}, redirecting to unauthorized`)
      router.push({ name: 'unauthorized' })
    } 
    // If on unauthorized page and role now has valid access, go to dashboard
    else if ($route.name === 'unauthorized' && userRole !== 'none') {
      console.log(`[App] Role changed - now has access, redirecting to dashboard`)
      router.push({ name: 'dashboard' })
    }
  }
)
</script>
