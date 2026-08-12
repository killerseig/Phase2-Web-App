<script setup lang="ts">
import AppTextInput from '@/components/common/AppTextInput.vue'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
}>()
</script>

<template>
  <AppTextInput
    v-bind="$attrs"
    :model-value="modelValue"
    type="date"
    @update:model-value="emit('update:modelValue', $event)"
    @input="emit('input', $event)"
  />
</template>
