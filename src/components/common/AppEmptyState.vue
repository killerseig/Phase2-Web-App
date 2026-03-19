<script setup lang="ts">
import { computed, useSlots } from 'vue'

const props = withDefaults(defineProps<{
  icon?: string
  title?: string
  message?: string
  compact?: boolean
  iconClass?: string
  titleClass?: string
  messageClass?: string
}>(), {
  icon: '',
  title: '',
  message: '',
  compact: false,
  iconClass: 'fs-3',
  titleClass: 'fw-semibold mb-1',
  messageClass: 'mb-0',
})

const slots = useSlots()
const hasMessage = computed(() => Boolean(props.message || slots.default))
</script>

<template>
  <div :class="['app-empty-state', 'text-center', 'text-muted', compact ? 'py-3' : 'py-5']">
    <i
      v-if="icon"
      :class="['app-empty-state-icon', icon, iconClass]"
      aria-hidden="true"
    />
    <div v-if="title" :class="['app-empty-state-title', titleClass]">{{ title }}</div>
    <div v-if="hasMessage" :class="['app-empty-state-message', messageClass]">
      <slot>{{ message }}</slot>
    </div>
  </div>
</template>

<style scoped>
.app-empty-state-icon {
  display: block;
  margin-bottom: 0.75rem;
}
</style>
