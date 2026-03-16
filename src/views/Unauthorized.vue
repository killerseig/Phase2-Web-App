<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ROUTES } from '@/constants/app'

const auth = useAuthStore()
const returnPath = computed(() => (auth.user ? ROUTES.DASHBOARD : ROUTES.LOGIN))
const returnLabel = computed(() => (auth.user ? 'Go to Dashboard' : 'Go to Login'))
</script>

<template>
  <div class="status-shell">
    <div class="status-card">
      <div class="status-card__eyebrow">Access Restricted</div>
      <h1 class="status-card__title">Unauthorized</h1>
      <p class="status-card__text">You do not have access to this page.</p>
      <RouterLink :to="returnPath" class="btn btn-primary mt-3">
        {{ returnLabel }}
      </RouterLink>
    </div>
  </div>
</template>
