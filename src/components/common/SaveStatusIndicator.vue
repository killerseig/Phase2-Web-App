<script setup lang="ts">
import { computed } from 'vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  idleMessage?: string
  message?: string
  savedMessage?: string
  saving?: boolean
  savingMessage?: string
}>(), {
  idleMessage: '',
  message: '',
  savedMessage: 'All changes saved.',
  saving: false,
  savingMessage: 'Saving changes...',
})

const displayMessage = computed(() => {
  if (props.saving) return props.savingMessage
  return props.message || props.idleMessage
})

const shouldRender = computed(() => props.saving || !!displayMessage.value)

const tone = computed(() => (
  !props.saving && displayMessage.value === props.savedMessage ? 'success' : 'default'
))
</script>

<template>
  <AppStatusMessage
    v-if="shouldRender"
    v-bind="$attrs"
    class="save-status-indicator"
    :tone="tone"
  >
    <slot :message="displayMessage" :saving="saving">
      {{ displayMessage }}
    </slot>
  </AppStatusMessage>
</template>

<style scoped>
.save-status-indicator {
  padding: 0.35rem 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  font-size: var(--font-size-sm);
}
</style>
