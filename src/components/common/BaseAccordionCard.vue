<script setup lang="ts">
import { computed } from 'vue'
import { useCollapseMeasure } from '@/composables/useCollapseMeasure'

interface Props {
  open: boolean
  title: string
  subtitle?: string
  bodyClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  bodyClass: 'p-2',
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

function onHeaderKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  toggle()
}
</script>

<template>
  <div :class="['card mb-4 accordion-card', { 'accordion-card--open': open }]">
    <div
      class="card-header accordion-card__header d-flex align-items-center justify-content-between cursor-pointer"
      role="button"
      tabindex="0"
      @click="toggle"
      @keydown="onHeaderKeydown"
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
    <div class="card-body accordion-card__body inline-collapse" :style="collapseStyle" :ref="setContentRef">
      <div class="collapse-inner accordion-card__inner" :class="bodyClass">
        <slot />
      </div>
    </div>
  </div>
</template>
