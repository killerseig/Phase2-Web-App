<template>
  <div v-if="!isAuthReady" class="app-boot-screen">
    <div class="spinner-border text-primary" role="status" aria-label="Loading"></div>
  </div>
  <template v-else>
    <AppShell v-if="!isPublicRoute">
      <router-view />
    </AppShell>
    <router-view v-else />
    <GlobalConfirmModal />
  </template>
</template>

<script setup lang="ts">
import { useRoute, useRouter, type RouteLocationNormalized } from 'vue-router'
import { computed, ref, watch } from 'vue'
import AppShell from './components/layout/AppShell.vue'
import GlobalConfirmModal from './components/common/GlobalConfirmModal.vue'
import { useAuthStore } from './stores/auth'
import { useJobAccess } from '@/composables/useJobAccess'
import { getRouteAccessRedirect } from '@/router'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const jobAccess = useJobAccess()
const enforcingRouteAccess = ref(false)

const isAuthReady = computed(() => auth.ready)

const isPublicRoute = computed(() => ((route.meta?.public as boolean) ?? false))

watch(
  [
    () => auth.ready,
    () => auth.user?.uid ?? null,
    () => auth.role,
    () => auth.active,
    () => auth.assignedJobIds.join('|'),
    () => route.fullPath,
  ],
  async () => {
    if (!auth.ready || enforcingRouteAccess.value) return

    const redirect = getRouteAccessRedirect(
      route as RouteLocationNormalized,
      { user: auth.user, active: auth.active, role: auth.role },
      jobAccess.canAccessJob
    )

    if (redirect === true) return

    const target = router.resolve(redirect)
    if (target.fullPath === route.fullPath) return

    enforcingRouteAccess.value = true
    try {
      await router.replace(redirect)
    } finally {
      enforcingRouteAccess.value = false
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as vars;

.app-boot-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface, vars.$surface);
}
</style>
