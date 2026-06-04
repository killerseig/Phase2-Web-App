<script setup lang="ts">
import { RouterLink } from 'vue-router'

const modules = [
  { label: 'Timecards', description: 'Open the timecard workbook workflow.', to: '/__e2e/timecard-workbook' },
  { label: 'Daily Log Draft', description: 'Open the daily log draft editor.', to: '/__e2e/daily-log-draft' },
  { label: 'Daily Log Typing', description: 'Open the typed daily log editor.', to: '/__e2e/daily-log-typing' },
]
</script>

<template>
  <main class="e2e-job-dashboard-page" data-testid="e2e-job-dashboard-page">
    <header class="e2e-job-dashboard-header">
      <h1>E2E Job Dashboard</h1>
      <p>Use this page to launch the core app modules for regression testing.</p>
    </header>

    <section class="e2e-job-dashboard-grid">
      <RouterLink
        v-for="module in modules"
        :key="module.label"
        :to="module.to"
        class="e2e-job-dashboard-module"
        :data-testid="`job-dashboard-module-${module.label.toLowerCase().replace(/\s+/g, '-')}`"
      >
        <strong>{{ module.label }}</strong>
        <span>{{ module.description }}</span>
      </RouterLink>
    </section>
  </main>
</template>

<style scoped>
.e2e-job-dashboard-page {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  max-width: 56rem;
}

.e2e-job-dashboard-header {
  display: grid;
  gap: 0.5rem;
}

.e2e-job-dashboard-grid {
  display: grid;
  gap: 0.75rem;
}

.e2e-job-dashboard-module {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid #bbb;
  background: white;
  text-decoration: none;
  color: inherit;
}

.e2e-job-dashboard-module:hover {
  border-color: #888;
}
</style>
