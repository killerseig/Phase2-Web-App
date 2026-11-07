<script setup lang="ts">
import ModuleLauncherCard from '@/components/jobs/ModuleLauncherCard.vue'

export interface ModuleLauncherItem {
  detail: string
  label: string
  to: string
}

defineProps<{
  jobId: string
  modules: readonly ModuleLauncherItem[]
  showCompanyLibrary?: boolean
  responsiveToContainer?: boolean
}>()
</script>

<template>
  <div
    class="module-launcher-grid"
    :class="{
      'module-launcher-grid--library': showCompanyLibrary,
      'module-launcher-grid--container': responsiveToContainer,
    }"
  >
    <ModuleLauncherCard
      v-for="module in modules"
      :key="module.to"
      :label="module.label"
      :detail="module.detail"
      :to="`/jobs/${jobId}/${module.to}`"
      :test-id="`job-dashboard-module-${module.to}`"
    />
    <ModuleLauncherCard
      v-if="showCompanyLibrary"
      label="Company Library"
      detail="Browse company documents and safety references."
      to="/company-library"
      test-id="job-dashboard-module-company-library"
    />
  </div>
</template>

<style scoped>
.module-launcher-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.module-launcher-grid--library {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}
.module-launcher-grid--library :deep(.module-launcher-card) {
  padding: 1rem;
}
.module-launcher-grid--library :deep(strong) {
  font-size: 1.15rem;
}
.module-launcher-grid--library :deep(p) {
  font-size: 0.9rem;
  line-height: 1.4;
}

@media (max-width: 1100px) {
  .module-launcher-grid:not(.module-launcher-grid--container) {
    grid-template-columns: 1fr;
  }
  .module-launcher-grid--library:not(.module-launcher-grid--container) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .module-launcher-grid--library:not(.module-launcher-grid--container)
    :deep(.module-launcher-card) {
    padding: 0.85rem;
    min-height: 3.5rem;
    align-content: center;
  }
  .module-launcher-grid--library:not(.module-launcher-grid--container) :deep(strong) {
    font-size: 1rem;
  }
  .module-launcher-grid--library:not(.module-launcher-grid--container) :deep(p) {
    display: none;
  }
}
/* Dashboard widgets use authored container width, independent of editor zoom. */
@container dashboard-workflows (max-width: 1100px) {
  .module-launcher-grid--container {
    grid-template-columns: 1fr;
  }
  .module-launcher-grid--container.module-launcher-grid--library {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container dashboard-workflows (max-width: 560px) {
  .module-launcher-grid--container.module-launcher-grid--library :deep(.module-launcher-card) {
    padding: 0.85rem;
    min-height: 3.5rem;
    align-content: center;
  }
  .module-launcher-grid--container.module-launcher-grid--library :deep(strong) {
    font-size: 1rem;
  }
  .module-launcher-grid--container.module-launcher-grid--library :deep(p) {
    display: none;
  }
}
@container dashboard-workflows (max-width: 320px) {
  .module-launcher-grid--container.module-launcher-grid--library {
    grid-template-columns: 1fr;
  }
}
</style>
