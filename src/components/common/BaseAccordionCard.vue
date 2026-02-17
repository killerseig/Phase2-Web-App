<script setup lang="ts">
import { computed } from 'vue'
import { useCollapseMeasure } from '@/composables/useCollapseMeasure'

const props = defineProps({
  open: { type: Boolean, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  bodyClass: { type: String, default: 'p-3' },
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'toggle', value: boolean): void
}>()

const { setContentRef, collapseStyle, measure } = useCollapseMeasure(computed(() => props.open))

function toggle() {
  emit('update:open', !props.open)
  emit('toggle', !props.open)
  if (!props.open) measure()
}
</script>

<template>
  <div class="card mb-4">
    <div
      class="card-header d-flex align-items-center justify-content-between cursor-pointer"
      role="button"
      @click="toggle"
      :aria-expanded="open"
    >
      <div class="flex-fill">
        <slot v-if="$slots.header" name="header" />
        <template v-else>
          <h5 class="mb-1">{{ title }}</h5>
          <p v-if="subtitle" class="text-muted small mb-0">{{ subtitle }}</p>
        </template>
      </div>
      <div class="d-flex align-items-center gap-2 ms-3 flex-shrink-0">
        <slot name="header-actions" />
        <i class="bi bi-chevron-down chevron" :class="{ open }" aria-hidden="true"></i>
      </div>
    </div>
    <div class="card-body border-top inline-collapse" :style="collapseStyle" :ref="setContentRef">
      <div class="collapse-inner" :class="bodyClass">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.chevron {
  transition: transform 0.3s ease-in-out;
}

.chevron.open {
  transform: rotate(180deg);
}

.inline-collapse {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  padding: 0;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}

.collapse-inner {
  padding: 1rem 1.25rem;
}
</style>
