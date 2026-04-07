<script setup lang="ts">
import { computed, ref, useAttrs, watch } from 'vue'

defineOptions({
  name: 'BaseTableCellInput',
  inheritAttrs: false,
})

type TableCellInputValue = string | number | null | undefined
type TableCellInputVariant = 'default' | 'ghost'

interface Props {
  modelValue: TableCellInputValue
  type?: 'text' | 'email' | 'number' | 'date' | 'password'
  inputClass?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  variant?: TableCellInputVariant
  selectOnFocus?: boolean
  stopPointer?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  inputClass: '',
  placeholder: '',
  disabled: false,
  readonly: false,
  variant: 'default',
  selectOnFocus: false,
  stopPointer: true,
})

const attrs = useAttrs()
const isFocused = ref(false)
const draftValue = ref(props.modelValue == null ? '' : String(props.modelValue))

watch(
  () => props.modelValue,
  (value) => {
    if (isFocused.value) return
    draftValue.value = value == null ? '' : String(value)
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  change: [event: Event]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const classes = computed(() => [
  'app-table-cell-input',
  'form-control',
  'form-control-sm',
  props.variant === 'ghost' ? 'app-table-cell-input--ghost' : null,
  props.inputClass,
])

const displayValue = computed(() => (
  isFocused.value
    ? draftValue.value
    : (props.modelValue == null ? '' : String(props.modelValue))
))

function handleInput(event: Event) {
  const nextValue = (event.target as HTMLInputElement).value
  draftValue.value = nextValue
  emit('update:modelValue', nextValue)
  emit('input', event)
}

function handleChange(event: Event) {
  emit('change', event)
}

function handleFocus(event: FocusEvent) {
  isFocused.value = true
  draftValue.value = (event.target as HTMLInputElement).value
  if (props.selectOnFocus) {
    (event.target as HTMLInputElement).select()
  }
  emit('focus', event)
}

function handleBlur(event: FocusEvent) {
  isFocused.value = false
  draftValue.value = props.modelValue == null ? '' : String(props.modelValue)
  emit('blur', event)
}

function stopPointerEvent(event: Event) {
  if (props.stopPointer) {
    event.stopPropagation()
  }
}
</script>

<template>
  <input
    v-bind="attrs"
    :value="displayValue"
    :type="type"
    :class="classes"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    @input="handleInput"
    @change="handleChange"
    @focus="handleFocus"
    @blur="handleBlur"
    @click="stopPointerEvent"
    @mousedown="stopPointerEvent"
  />
</template>
