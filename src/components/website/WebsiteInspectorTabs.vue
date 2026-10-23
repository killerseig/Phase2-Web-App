<script setup lang="ts">
import BuilderSettingsTabs from '@/components/builder/BuilderSettingsTabs.vue'
export type InspectorTab = 'content' | 'appearance' | 'layout'
defineProps<{ modelValue: InspectorTab }>()
const emit = defineEmits<{ 'update:modelValue': [value: InspectorTab] }>()
const tabs: { id: InspectorTab; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'layout', label: 'Layout' },
]
</script>
<template>
  <BuilderSettingsTabs class="inspector-tabs" :model-value="modelValue" :tabs="tabs" label="Widget settings" id-prefix="widget" @update:model-value="emit('update:modelValue', $event)" />
</template>
