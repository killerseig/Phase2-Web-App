<script setup lang="ts">
defineProps<{
  message: string
  tone?: 'default' | 'error'
}>()
</script>

<template>
  <div
    v-if="message"
    class="timecard-page-message"
    :class="{ 'timecard-page-message--error': tone === 'error' }"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    {{ message }}
  </div>
</template>

<style scoped>
.timecard-page-message {
  padding: 0.85rem 1rem;
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  color: #1b2114;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.timecard-page-message--error {
  border-color: rgba(167, 53, 53, 0.36);
  background: rgba(248, 224, 220, 0.92);
  color: #7c2222;
}
</style>
