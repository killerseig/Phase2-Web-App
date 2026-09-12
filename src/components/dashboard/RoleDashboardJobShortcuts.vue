<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppBadge from '@/components/common/AppBadge.vue'
import AppButtonLink from '@/components/common/AppButtonLink.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import type { RoleDashboardJobShortcut } from '@/features/dashboard/roleDashboardJobShortcuts'

defineProps<{
  error?: string | null
  loading?: boolean
  shortcuts: readonly RoleDashboardJobShortcut[]
}>()
</script>

<template>
  <section class="role-dashboard-job-shortcuts" data-testid="role-dashboard-job-shortcuts">
    <AppSectionHeader eyebrow="Job Dashboards" title="Quick Access" title-tag="h2">
      <template #actions>
        <AppBadge>{{ shortcuts.length }} {{ shortcuts.length === 1 ? 'job' : 'jobs' }}</AppBadge>
      </template>
    </AppSectionHeader>

    <AppStatusMessage
      v-if="error"
      :message="error"
      tone="error"
      data-testid="role-dashboard-job-error"
    />

    <AppEmptyState
      v-else-if="loading"
      panel
      data-testid="role-dashboard-job-loading"
      message="Loading job shortcuts..."
    />

    <AppEmptyState
      v-else-if="!shortcuts.length"
      panel
      data-testid="role-dashboard-job-empty"
      message="No job dashboards are available for this role yet."
    />

    <div v-else class="role-dashboard-job-shortcuts__grid">
      <article
        v-for="shortcut in shortcuts"
        :key="shortcut.id"
        class="role-dashboard-job-shortcut"
        :data-testid="`role-dashboard-job-shortcut-${shortcut.id}`"
      >
        <div class="role-dashboard-job-shortcut__body">
          <AppBadge v-if="shortcut.isShopJob" class="role-dashboard-job-shortcut__badge">Shop</AppBadge>
          <RouterLink
            class="role-dashboard-job-shortcut__title"
            :to="shortcut.dashboardRoute"
            :data-testid="`role-dashboard-job-link-${shortcut.id}`"
          >
            {{ shortcut.label }}
          </RouterLink>
          <p>{{ shortcut.detail }}</p>
        </div>

        <div class="role-dashboard-job-shortcut__actions" :aria-label="`${shortcut.label} modules`">
          <AppButtonLink :to="shortcut.moduleRoutes.timecards">Timecards</AppButtonLink>
          <AppButtonLink :to="shortcut.moduleRoutes.dailyLogs">Daily Logs</AppButtonLink>
          <AppButtonLink :to="shortcut.moduleRoutes.shopOrders">Shop Orders</AppButtonLink>
          <AppButtonLink
            v-if="shortcut.moduleRoutes.submittedTimecards"
            :to="shortcut.moduleRoutes.submittedTimecards"
          >
            Submitted Timecards
          </AppButtonLink>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.role-dashboard-job-shortcuts {
  display: grid;
  gap: var(--space-4);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-soft);
}

.role-dashboard-job-shortcut__badge {
  justify-self: start;
}

.role-dashboard-job-shortcuts__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.role-dashboard-job-shortcut {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel-background);
}

.role-dashboard-job-shortcut__body {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  overflow-wrap: anywhere;
}

.role-dashboard-job-shortcut__title {
  color: var(--text);
  font-weight: var(--font-weight-heading);
  text-decoration: none;
}

.role-dashboard-job-shortcut__title:hover,
.role-dashboard-job-shortcut__title:focus-visible {
  color: var(--accent-strong);
}

.role-dashboard-job-shortcut p {
  margin: 0;
  color: var(--text-muted);
}

.role-dashboard-job-shortcut__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (max-width: 900px) {
  .role-dashboard-job-shortcuts__grid {
    grid-template-columns: 1fr;
  }
}
</style>
