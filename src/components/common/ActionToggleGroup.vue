<script setup lang="ts">
withDefaults(defineProps<{
  open?: boolean
  toggleDisabled?: boolean
  toggleTitle?: string
  toggleAriaLabel?: string
  toggleIcon?: string
  wrapperClass?: string
  groupClass?: string
  toggleButtonClass?: string
}>(), {
  open: false,
  toggleDisabled: false,
  toggleTitle: 'Toggle edit mode',
  toggleAriaLabel: 'Toggle edit mode',
  toggleIcon: 'bi bi-pencil',
  wrapperClass: 'd-flex align-items-center justify-content-end gap-1 flex-nowrap',
  groupClass: 'btn-group btn-group-sm flex-nowrap',
  toggleButtonClass: 'btn btn-sm btn-outline-secondary btn-icon',
})

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <div :class="wrapperClass">
    <div v-if="open" :class="groupClass" role="group">
      <slot />
    </div>

    <button
      type="button"
      :class="toggleButtonClass"
      :aria-label="toggleAriaLabel"
      :aria-pressed="open"
      :disabled="toggleDisabled"
      :title="toggleTitle"
      @click.stop="emit('toggle')"
    >
      <i :class="toggleIcon"></i>
    </button>
  </div>
</template>
