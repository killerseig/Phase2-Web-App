<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ROUTES } from '@/constants/app'

defineProps<{ pathMatch?: string[] }>()

const auth = useAuthStore()
const returnPath = computed(() => (auth.user ? ROUTES.DASHBOARD : ROUTES.LOGIN))
const returnLabel = computed(() => (auth.user ? 'Go to Dashboard' : 'Go to Login'))
</script>

<template>
  <div class="status-shell">
    <div class="status-card">
      <p class="status-card__code">404</p>
      <h1 class="status-card__title">Page Not Found</h1>
      <p class="status-card__text">The page you requested does not exist.</p>
      <RouterLink :to="returnPath" class="btn btn-primary">
        {{ returnLabel }}
      </RouterLink>
    </div>
  </div>
</template>
