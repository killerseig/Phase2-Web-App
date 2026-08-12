<script setup lang="ts">
import AppLinkCard from '@/components/common/AppLinkCard.vue'
import type { TargetRoleDashboardModule } from '@/features/dashboard/roleDashboardModules'

defineProps<{
  modules: readonly TargetRoleDashboardModule[]
}>()
</script>

<template>
  <div v-if="modules.length" class="role-dashboard-module-grid">
    <AppLinkCard
      v-for="module in modules"
      :key="module.key"
      class="role-dashboard-module-card"
      :to="module.targetRoute"
      :data-testid="`role-dashboard-module-${module.key}`"
    >
      <span class="role-dashboard-module-card__eyebrow">{{ module.label }}</span>
      <strong>{{ module.label }}</strong>
      <p>{{ module.detail }}</p>
    </AppLinkCard>
  </div>

  <p v-else class="role-dashboard-module-grid__empty" data-testid="role-dashboard-empty">
    No dashboard modules are available for this role yet.
  </p>
</template>

<style scoped>
.role-dashboard-module-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
}

.role-dashboard-module-card {
  --app-link-card-gap: 0.35rem;
  --app-link-card-border: 1px solid rgba(168, 190, 209, 0.16);
  --app-link-card-background:
    radial-gradient(circle at 8% 0%, rgba(99, 199, 230, 0.06), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.034), rgba(255, 255, 255, 0)),
    rgba(255, 255, 255, 0.038);
  --app-link-card-shadow: 0 10px 24px rgba(3, 10, 16, 0.1);
  --app-link-card-hover-background:
    linear-gradient(180deg, rgba(99, 199, 230, 0.13), rgba(33, 52, 65, 0.18)),
    rgba(255, 255, 255, 0.045);
  --app-link-card-hover-shadow:
    0 14px 30px rgba(3, 10, 16, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.018);
}

.role-dashboard-module-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.role-dashboard-module-card p,
.role-dashboard-module-grid__empty {
  color: var(--text-muted);
}

@media (max-width: 1100px) {
  .role-dashboard-module-grid {
    grid-template-columns: 1fr;
  }
}
</style>
