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
  <div class="not-found-wrapper">
    <div class="not-found-card">
      <p class="not-found-code">404</p>
      <h1 class="not-found-title">Page Not Found</h1>
      <p class="not-found-text">The page you requested does not exist.</p>
      <RouterLink :to="returnPath" class="btn btn-primary">
        {{ returnLabel }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as vars;

.not-found-wrapper {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 10vh;
  background: var(--surface, vars.$surface);
}

.not-found-card {
  background: var(--surface-2, vars.$surface-2);
  border: 1px solid var(--border, vars.$border-color);
  border-radius: 12px;
  padding: 24px 28px;
  box-shadow: var(--shadow, vars.$box-shadow);
  text-align: center;
  max-width: 420px;
  width: 100%;
}

.not-found-code {
  margin: 0 0 8px;
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--color-primary, vars.$primary);
}

.not-found-title {
  margin: 0 0 8px;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-body, vars.$body-color);
}

.not-found-text {
  margin: 0 0 16px;
  color: var(--text-muted, vars.$text-muted);
  font-size: 0.975rem;
}
</style>
