<script setup lang="ts">
import TimecardButton from '@/components/timecards/TimecardButton.vue'

defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  select: []
}>()
</script>

<template>
  <div class="timecard-one-off-action">
    <span>Employee not listed?</span>
    <TimecardButton
      data-testid="timecards-show-one-off-card"
      :disabled="disabled"
      @click="emit('select')"
    >
      Create a One-Off Card
    </TimecardButton>
  </div>
</template>

<style scoped>
.timecard-one-off-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-top: 0.7rem;
  border-top: 1px solid rgba(71, 82, 41, 0.18);
  color: rgba(38, 43, 23, 0.72);
  font-size: 0.86rem;
}

@media (max-width: 640px) {
  .timecard-one-off-action {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
