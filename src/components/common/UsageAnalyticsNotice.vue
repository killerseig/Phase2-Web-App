<script setup lang="ts">
import AppButton from './AppButton.vue'
import type { AnalyticsScope, Consent } from '@/features/analytics/usageAnalytics'
defineProps<{ available: boolean; scope: AnalyticsScope; choice: Consent }>()
const emit = defineEmits<{ consent: [choice: Consent] }>()
</script>
<template>
  <aside v-if="available" class="usage-analytics-notice" :aria-label="scope === 'public' ? 'Website analytics choices' : 'Employee analytics choices'">
    <template v-if="choice === 'unknown'">
      <p>Allow optional {{ scope === 'public' ? 'website' : 'feature usage' }} analytics for this visit? Google Analytics receives usage and browser/device metadata and may use cookies. Names, form answers and private record identifiers are excluded.</p>
      <div><AppButton @click="emit('consent', 'denied')">No thanks</AppButton><AppButton @click="emit('consent', 'granted')">Allow analytics</AppButton></div>
    </template>
    <template v-else><span>Optional analytics {{ choice === 'granted' ? 'on' : 'off' }} for this visit.</span><AppButton @click="emit('consent', choice === 'granted' ? 'denied' : 'unknown')">{{ choice === 'granted' ? 'Turn off analytics' : 'Review choice' }}</AppButton></template>
  </aside>
</template>
<style scoped>
.usage-analytics-notice { padding: .65rem 1rem; border-top: 1px solid var(--border, #bbc7cf); background: var(--bg-panel, #fff); color: var(--text, #172c40); font-size: .85rem; }
.usage-analytics-notice p { margin: 0 0 .5rem; max-width: 60rem; }
.usage-analytics-notice div { display: flex; flex-wrap: wrap; gap: .5rem; }
.usage-analytics-notice > span { margin-right: .7rem; }
</style>
