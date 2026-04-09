<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type SearchSelectOption = {
  id: string
  label: string
}

defineOptions({
  name: 'SearchSelectField',
})

interface Props {
  modelValue: string
  options: SearchSelectOption[]
  label: string
  disabled?: boolean
  placeholder?: string
  prependIcon?: string
  clearLabel?: string
  clearAriaLabel?: string
  emptyMessagePrefix?: string
  inputAriaLabel?: string
  inputId?: string
  size?: 'sm' | 'lg'
  labelClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search...',
  disabled: false,
  prependIcon: '',
  clearLabel: 'All options',
  clearAriaLabel: 'Clear selection',
  emptyMessagePrefix: 'No options match',
  inputAriaLabel: '',
  inputId: '',
  size: 'sm',
  labelClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const menuOpen = ref(false)
const query = ref('')

let queuedMenuCloseTimer: ReturnType<typeof setTimeout> | null = null

const selectedOption = computed(() => (
  props.options.find((option) => option.id === props.modelValue) || null
))

const filteredOptions = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  if (!normalizedQuery) return props.options
  return props.options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
})

const inputClass = computed(() => (
  props.size === 'lg' ? 'form-control form-control-lg' : 'form-control form-control-sm'
))

const buttonClass = computed(() => (
  props.size === 'lg' ? 'btn btn-outline-secondary btn-lg' : 'btn btn-outline-secondary btn-sm'
))

watch(
  () => [props.modelValue, props.options],
  () => {
    const nextLabel = selectedOption.value?.label || ''
    if (!menuOpen.value || props.modelValue) {
      query.value = nextLabel
    }
  },
  { deep: true, immediate: true }
)

function clearQueuedMenuClose() {
  if (!queuedMenuCloseTimer) return
  clearTimeout(queuedMenuCloseTimer)
  queuedMenuCloseTimer = null
}

function openMenu() {
  if (props.disabled) return
  clearQueuedMenuClose()
  menuOpen.value = true
}

function scheduleMenuClose() {
  clearQueuedMenuClose()
  queuedMenuCloseTimer = setTimeout(() => {
    menuOpen.value = false
    queuedMenuCloseTimer = null
  }, 120)
}

function handleInput(event: Event) {
  if (props.disabled) return
  const nextValue = String((event.target as HTMLInputElement)?.value || '')
  query.value = nextValue
  openMenu()

  if (!nextValue.trim()) {
    emit('update:modelValue', '')
    return
  }

  if (selectedOption.value && nextValue.trim() !== selectedOption.value.label) {
    emit('update:modelValue', '')
  }
}

function selectOption(optionId: string) {
  if (props.disabled) return
  emit('update:modelValue', optionId)
  query.value = props.options.find((option) => option.id === optionId)?.label || ''
  menuOpen.value = false
}

function clearSelection() {
  if (props.disabled) return
  emit('update:modelValue', '')
  query.value = ''
  menuOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === 'Escape') {
    menuOpen.value = false
    return
  }

  if (event.key === 'Enter' && filteredOptions.value.length) {
    event.preventDefault()
    const [firstMatch] = filteredOptions.value
    if (firstMatch) selectOption(firstMatch.id)
  }
}

onBeforeUnmount(() => {
  clearQueuedMenuClose()
})
</script>

<template>
  <label :class="labelClass || 'form-label small text-muted mb-1'">{{ label }}</label>
  <div class="search-select">
    <div class="input-group" :class="size === 'lg' ? 'input-group-lg' : 'input-group-sm'">
      <span v-if="prependIcon" class="input-group-text"><i :class="prependIcon"></i></span>
      <input
        :id="inputId || undefined"
        :value="query"
        type="search"
        :class="inputClass"
        :disabled="disabled"
        :placeholder="placeholder"
        :aria-label="inputAriaLabel || label"
        autocomplete="off"
        @input="handleInput"
        @focus="openMenu"
        @blur="scheduleMenuClose"
        @keydown="handleKeydown"
      />
      <button
        v-if="modelValue || query"
        type="button"
        :class="buttonClass"
        :disabled="disabled"
        :aria-label="clearAriaLabel"
        @mousedown.prevent="clearSelection"
      >
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <div v-if="menuOpen && !disabled" class="search-select__menu">
      <button
        type="button"
        class="search-select__option"
        :class="{ 'is-selected': !modelValue }"
        @mousedown.prevent="clearSelection"
      >
        <span class="fw-semibold">{{ clearLabel }}</span>
      </button>

      <button
        v-for="option in filteredOptions"
        :key="option.id"
        type="button"
        class="search-select__option"
        :class="{ 'is-selected': modelValue === option.id }"
        @mousedown.prevent="selectOption(option.id)"
      >
        {{ option.label }}
      </button>

      <div v-if="!filteredOptions.length" class="search-select__empty">
        {{ emptyMessagePrefix }} "{{ query.trim() }}".
      </div>
    </div>
  </div>
</template>
