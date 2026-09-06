<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  sourceType: string
  testId?: string
}>()

const isOneOff = computed(() => props.sourceType === 'custom')
const label = computed(() => (isOneOff.value ? 'ONE-OFF' : 'EMPLOYEE'))
</script>

<template>
  <span
    class="timecard-source-badge"
    :class="isOneOff ? 'timecard-source-badge--one-off' : 'timecard-source-badge--employee'"
    :data-testid="testId"
    :aria-label="`Card type: ${label}`"
  >
    {{ label }}
  </span>
</template>

<style scoped>
.timecard-source-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0 0.65rem;
  border: 1px solid;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.timecard-source-badge--employee {
  border-color: rgba(50, 103, 116, 0.28);
  background: rgba(229, 242, 242, 0.88);
  color: #285967;
}

.timecard-source-badge--one-off {
  border-color: rgba(157, 102, 24, 0.34);
  background: rgba(253, 241, 207, 0.92);
  color: #76500f;
}
</style>
