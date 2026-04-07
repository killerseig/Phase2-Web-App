<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AppSelectableListItem',
  inheritAttrs: false,
})

interface Props {
  as?: 'button' | 'div'
  type?: 'button' | 'submit' | 'reset'
  selected?: boolean
  disabled?: boolean
  tone?: 'default' | 'muted'
}

const props = withDefaults(defineProps<Props>(), {
  as: 'div',
  type: 'button',
  selected: false,
  disabled: false,
  tone: 'default',
})

const emit = defineEmits<{
  activate: [event: MouseEvent | KeyboardEvent]
}>()

const itemClasses = computed(() => [
  'app-selectable-list-item',
  'list-group-item',
  'list-group-item-action',
  props.selected ? 'app-selectable-list-item--selected' : '',
  props.tone === 'muted' ? 'app-selectable-list-item--muted' : '',
  props.disabled ? 'disabled' : '',
].filter(Boolean))

const buttonRole = computed(() => (props.as === 'button' ? undefined : 'button'))
const tabIndex = computed(() => (props.as === 'button' ? undefined : props.disabled ? -1 : 0))

function handleActivate(event: MouseEvent | KeyboardEvent) {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  emit('activate', event)
}

function handleKeydown(event: KeyboardEvent) {
  if (props.as === 'button') return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  handleActivate(event)
}
</script>

<template>
  <component
    :is="as"
    v-bind="$attrs"
    :type="as === 'button' ? type : undefined"
    :class="itemClasses"
    :role="buttonRole"
    :tabindex="tabIndex"
    :aria-disabled="as === 'button' ? undefined : disabled ? 'true' : undefined"
    :disabled="as === 'button' ? disabled : undefined"
    @click="handleActivate"
    @keydown="handleKeydown"
  >
    <slot />
  </component>
</template>
