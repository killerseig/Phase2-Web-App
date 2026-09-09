<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { RoleDashboardJobShortcut } from '@/features/dashboard/roleDashboardJobShortcuts'

defineProps<{
  error?: string | null
  loading?: boolean
  shortcuts: readonly RoleDashboardJobShortcut[]
}>()
</script>

<template>
  <section class="role-dashboard-job-shortcuts" data-testid="role-dashboard-job-shortcuts">
    <div class="role-dashboard-job-shortcuts__header">
      <div>
        <span class="role-dashboard-job-shortcuts__eyebrow">Job Dashboards</span>
        <h2>Quick access</h2>
      </div>
      <span class="role-dashboard-job-shortcuts__count">
        {{ shortcuts.length }} {{ shortcuts.length === 1 ? 'job' : 'jobs' }}
      </span>
    </div>

    <p v-if="error" class="role-dashboard-job-shortcuts__message" data-testid="role-dashboard-job-error">
      {{ error }}
    </p>

    <p
      v-else-if="loading"
      class="role-dashboard-job-shortcuts__message"
      data-testid="role-dashboard-job-loading"
    >
      Loading job shortcuts...
    </p>

    <p
      v-else-if="!shortcuts.length"
      class="role-dashboard-job-shortcuts__message"
      data-testid="role-dashboard-job-empty"
    >
      No job dashboards are available for this role yet.
    </p>

    <div v-else class="role-dashboard-job-shortcuts__grid">
      <article
        v-for="shortcut in shortcuts"
        :key="shortcut.id"
        class="role-dashboard-job-shortcut"
        :data-testid="`role-dashboard-job-shortcut-${shortcut.id}`"
      >
        <div class="role-dashboard-job-shortcut__body">
          <span v-if="shortcut.isShopJob" class="role-dashboard-job-shortcut__badge">Shop</span>
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
          <RouterLink :to="shortcut.moduleRoutes.timecards">Timecards</RouterLink>
          <RouterLink :to="shortcut.moduleRoutes.dailyLogs">Daily Logs</RouterLink>
          <RouterLink :to="shortcut.moduleRoutes.shopOrders">Shop Orders</RouterLink>
          <RouterLink
            v-if="shortcut.moduleRoutes.submittedTimecards"
            :to="shortcut.moduleRoutes.submittedTimecards"
          >
            Submitted Timecards
          </RouterLink>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.role-dashboard-job-shortcuts {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(168, 190, 209, 0.16);
  border-radius: var(--radius);
  background: var(--panel-background);
}

.role-dashboard-job-shortcuts__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.role-dashboard-job-shortcuts__eyebrow {
  color: var(--text-muted);
  font-size: var(--font-size-eyebrow);
  font-weight: 500;
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.role-dashboard-job-shortcuts h2 {
  margin: 0.2rem 0 0;
  font-size: clamp(1.05rem, 2vw, 1.35rem);
}

.role-dashboard-job-shortcuts__count,
.role-dashboard-job-shortcut__badge {
  align-self: start;
  border: 1px solid rgba(99, 199, 230, 0.35);
  border-radius: var(--radius-sm);
  color: var(--accent-strong);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0.28rem 0.6rem;
  text-transform: uppercase;
  white-space: nowrap;
}

.role-dashboard-job-shortcuts__message {
  margin: 0;
  color: var(--text-muted);
}

.role-dashboard-job-shortcuts__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.role-dashboard-job-shortcut {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
  padding: 0.9rem;
  border: 1px solid rgba(168, 190, 209, 0.14);
  border-radius: var(--radius-sm);
  background: var(--panel-background);
}

.role-dashboard-job-shortcut__body {
  display: grid;
  gap: 0.35rem;
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
  gap: 0.45rem;
}

.role-dashboard-job-shortcut__actions a {
  border: 1px solid rgba(99, 199, 230, 0.24);
  border-radius: var(--radius-sm);
  color: var(--accent-strong);
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.34rem 0.6rem;
  text-decoration: none;
}

.role-dashboard-job-shortcut__actions a:hover,
.role-dashboard-job-shortcut__actions a:focus-visible {
  background: rgba(99, 199, 230, 0.12);
}

@media (max-width: 900px) {
  .role-dashboard-job-shortcuts__grid {
    grid-template-columns: 1fr;
  }
}
</style>
