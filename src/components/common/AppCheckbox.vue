<script setup lang="ts">
import { readCheckboxChecked } from '@/utils/domEvents'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [event: Event]
}>()

function handleChange(event: Event) {
  emit('update:modelValue', readCheckboxChecked(event))
  emit('change', event)
}
</script>

<template>
  <input
    v-bind="$attrs"
    class="app-checkbox"
    type="checkbox"
    :checked="modelValue"
    @change="handleChange"
  />
</template>

<style scoped>
.app-checkbox {
  accent-color: var(--app-checkbox-accent-color, var(--accent-strong));
}

.app-checkbox:disabled {
  cursor: not-allowed;
}
</style>
