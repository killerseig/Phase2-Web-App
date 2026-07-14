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
}>()
</script>

<template>
  <div class="module-launcher-grid">
    <ModuleLauncherCard
      v-for="module in modules"
      :key="module.to"
      :label="module.label"
      :detail="module.detail"
      :to="`/jobs/${jobId}/${module.to}`"
      :test-id="`job-dashboard-module-${module.to}`"
    />
  </div>
</template>

<style scoped>
.module-launcher-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
}

@media (max-width: 1100px) {
  .module-launcher-grid {
    grid-template-columns: 1fr;
  }
}
</style>
