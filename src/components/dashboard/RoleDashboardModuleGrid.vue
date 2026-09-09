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
  --app-link-card-background: var(--panel-background);
  --app-link-card-shadow: none;
  --app-link-card-hover-background: var(--field-hover);
  --app-link-card-hover-shadow: none;
}

.role-dashboard-module-card__eyebrow {
  color: var(--text-muted);
  font-size: var(--font-size-eyebrow);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
  font-weight: 500;
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
