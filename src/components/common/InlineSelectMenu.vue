<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({
  name: 'InlineSelectMenu',
})

type SelectValue = string | number | boolean | null | undefined

type SelectOption = {
  value: string | number | boolean
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: SelectValue
  options: readonly SelectOption[]
  disabled?: boolean
  placeholder?: string
  buttonClass?: string
  menuClass?: string
  stopPointer?: boolean
  align?: 'start' | 'end'
}>(), {
  disabled: false,
  placeholder: 'Select',
  buttonClass: 'form-select form-select-sm app-table-cell-input',
  menuClass: '',
  stopPointer: true,
  align: 'start',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
  escape: []
}>()

const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const menuStyle = ref<Record<string, string>>({})

const selectedOption = computed(() => (
  props.options.find((option) => option.value === props.modelValue) || null
))

const triggerClass = computed(() => [
  'inline-select__trigger',
  props.buttonClass,
  {
    'is-open': menuOpen.value,
    'is-placeholder': !selectedOption.value,
  },
])

const menuClass = computed(() => [
  'dropdown-menu',
  'show',
  'inline-select__menu',
  props.align === 'end' ? 'inline-select__menu--end' : '',
  props.menuClass,
])

function stopPointer(event: Event) {
  if (props.stopPointer) {
    event.stopPropagation()
  }
}

function syncMenuPosition() {
  const trigger = triggerRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const minWidth = Math.max(rect.width, 176)
  const maxLeft = Math.max(8, window.innerWidth - minWidth - 8)
  const left = props.align === 'end'
    ? Math.min(Math.max(8, rect.right - minWidth), maxLeft)
    : Math.min(Math.max(8, rect.left), maxLeft)

  menuStyle.value = {
    left: `${left}px`,
    minWidth: `${minWidth}px`,
    top: `${Math.min(window.innerHeight - 8, rect.bottom + 6)}px`,
  }
}

function closeMenu() {
  menuOpen.value = false
}

async function openMenu() {
  if (props.disabled) return
  menuOpen.value = true
  await nextTick()
  syncMenuPosition()
}

function toggleMenu() {
  if (menuOpen.value) {
    closeMenu()
    return
  }

  void openMenu()
}

function selectOption(option: SelectOption) {
  emit('update:modelValue', option.value)
  closeMenu()
  triggerRef.value?.focus()
}

function handleEscape() {
  closeMenu()
  emit('escape')
  triggerRef.value?.focus()
}

function handleTriggerKeydown(event: KeyboardEvent) {
  stopPointer(event)

  if (event.key === 'Escape') {
    event.preventDefault()
    handleEscape()
    return
  }

  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!menuOpen.value) {
      void openMenu()
    }
  }
}

function handleDocumentPointerDown(event: Event) {
  if (!menuOpen.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (triggerRef.value?.contains(target) || menuRef.value?.contains(target)) return
  closeMenu()
}

function handleViewportChange() {
  if (!menuOpen.value) return
  syncMenuPosition()
}

watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<template>
  <div class="inline-select" @click="stopPointer" @mousedown="stopPointer">
    <button
      ref="triggerRef"
      type="button"
      :class="triggerClass"
      :disabled="disabled"
      :aria-expanded="menuOpen"
      aria-haspopup="listbox"
      @click.prevent="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <span class="inline-select__label">
        {{ selectedOption?.label || placeholder }}
      </span>
    </button>

    <teleport to="body">
      <div
        v-if="menuOpen"
        ref="menuRef"
        :class="menuClass"
        :style="menuStyle"
        role="listbox"
        @click="stopPointer"
        @mousedown="stopPointer"
      >
        <button
          v-for="option in options"
          :key="String(option.value)"
          type="button"
          class="dropdown-item inline-select__option"
          :class="{ active: selectedOption?.value === option.value }"
          @click.stop="selectOption(option)"
          @keydown.esc.prevent.stop="handleEscape"
        >
          <span class="inline-select__option-label">{{ option.label }}</span>
        </button>
      </div>
    </teleport>
  </div>
</template>
