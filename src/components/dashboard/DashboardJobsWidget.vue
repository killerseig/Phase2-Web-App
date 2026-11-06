<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { jobsManagementRoute } from '@/features/jobs/jobsRouteIntent'
import { RouterLink } from 'vue-router'
import AppButton from '@/components/common/AppButton.vue'
import AppButtonLink from '@/components/common/AppButtonLink.vue'
import AppLoadingRegion from '@/components/common/AppLoadingRegion.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import type { JobRecord } from '@/types/domain'

const props = defineProps<{
  jobs: JobRecord[]
  editing: boolean
  jobsLoading?: boolean
  jobsError?: string | null
  canCreateJobs?: boolean
  canManageJobs?: boolean
  editableJobIds?: string[]
  scope?: 'personal' | 'role' | 'job'
  jobId?: string
}>()
const id = useId()
const query = ref('')
const search = ref<HTMLInputElement | null>(null)
const terms = computed(() => query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))
const matches = computed(() =>
  props.jobs.filter((job) => {
    const text = `${job.code || ''} ${job.name}`.toLocaleLowerCase()
    return terms.value.every((term) => text.includes(term))
  }),
)
function clearSearch() {
  query.value = ''
  search.value?.focus()
}
</script>

<template>
  <AppLoadingRegion
    class="dashboard-jobs"
    :class="{ 'dashboard-jobs--loading': jobsLoading }"
    :inert="editing"
    :loading="!!jobsLoading"
    label="Loading jobs."
  >
    <nav v-if="canCreateJobs || canManageJobs" class="dashboard-jobs__management" aria-label="Job management">
      <AppButtonLink v-if="canCreateJobs" :to="jobsManagementRoute('create', scope, jobId)">New job</AppButtonLink>
      <AppButtonLink v-if="canManageJobs" :to="jobsManagementRoute('archived', scope, jobId)">Archived jobs</AppButtonLink>
      <AppButtonLink v-if="canManageJobs" :to="jobsManagementRoute('defaults', scope, jobId)">Notification defaults</AppButtonLink>
    </nav>
    <p v-if="jobsError" class="dashboard-jobs__error" role="alert">
      Jobs could not be loaded. {{ jobsError }} Use Refresh to try again.
    </p>
    <AppEmptyState
      v-else-if="!jobsLoading && !jobs.length"
      message="No jobs are available for your account."
    />
    <template v-else-if="!jobsLoading">
      <div class="dashboard-jobs__search">
        <label :for="`${id}-search`">Find a job</label>
        <div class="dashboard-jobs__search-row">
          <input
            :id="`${id}-search`"
            ref="search"
            v-model="query"
            type="search"
            placeholder="Search job number or name"
            :aria-describedby="`${id}-count`"
            :aria-controls="`${id}-results`"
            @keydown.esc.prevent="clearSearch"
          />
          <AppButton v-if="query" type="button" @click="clearSearch">Clear search</AppButton>
        </div>
      </div>
      <p
        :id="`${id}-count`"
        class="dashboard-jobs__count"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ matches.length }} of {{ jobs.length }} {{ jobs.length === 1 ? 'job' : 'jobs' }}
      </p>
      <div
        :id="`${id}-results`"
        class="shared-job-links dashboard-jobs__results"
        role="region"
        aria-label="Matching jobs"
        :tabindex="matches.length ? 0 : undefined"
      >
        <article v-for="entry in matches" :key="entry.id" class="dashboard-jobs__job">
          <RouterLink :to="{ name: 'shared-job-home', params: { jobId: entry.id } }">
            {{ entry.code || 'No Job #' }} · {{ entry.name }}
          </RouterLink>
          <nav :aria-label="`${entry.name} tools`">
            <AppButtonLink v-if="editableJobIds?.includes(entry.id)" :aria-label="'Manage job ' + entry.name" :to="jobsManagementRoute('edit', scope, jobId, entry.id)">Manage job</AppButtonLink>
            <AppButtonLink :to="`/jobs/${entry.id}/timecards`">Timecards</AppButtonLink>
            <AppButtonLink :to="`/jobs/${entry.id}/daily-logs`">Daily Logs</AppButtonLink>
            <AppButtonLink :to="`/jobs/${entry.id}/shop-orders`">Shop Orders</AppButtonLink>
          </nav>
        </article>
        <p v-if="!matches.length" class="dashboard-jobs__empty">
          No jobs match your search. Try a different job number or name.
        </p>
      </div>
    </template>
  </AppLoadingRegion>
</template>

<style scoped>
.dashboard-jobs__management { display: flex; flex-wrap: wrap; gap: .5rem; }
.dashboard-jobs { --loading-region-min-height: 0; }
.dashboard-jobs--loading {
  --loading-region-min-height: 12rem;
}
.dashboard-jobs__error {
  color: var(--danger, #b91c1c);
  overflow-wrap: anywhere;
}
.dashboard-jobs {
  min-width: 0;
}
.dashboard-jobs__search {
  display: grid;
  gap: 0.4rem;
}
.dashboard-jobs__search label {
  font-weight: 600;
}
.dashboard-jobs__search-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.dashboard-jobs__search-row input {
  flex: 1 1 12rem;
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  box-sizing: border-box;
  font: inherit;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--field);
  color: var(--text);
}
.dashboard-jobs__search-row input::placeholder { color: var(--text-muted); }
.dashboard-jobs__count {
  margin: 0.65rem 0;
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}
.dashboard-jobs__results {
  max-height: 30rem;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: 0.25rem;
  gap: 0.65rem;
}
.dashboard-jobs__results .dashboard-jobs__job {
  min-width: 0;
  padding: 0.75rem;
}
.dashboard-jobs__results nav {
  gap: 0.5rem;
}
.dashboard-jobs__results .app-button {
  min-height: 2.75rem;
}
.dashboard-jobs__results:focus-visible,
.dashboard-jobs__search-row input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.dashboard-jobs__empty {
  margin: 0;
  padding: 1rem;
  background: var(--field);
  border-radius: var(--radius-sm);
}
@media (max-width: 600px) {
  .dashboard-jobs__results {
    max-height: 26rem;
  }
}
</style>
