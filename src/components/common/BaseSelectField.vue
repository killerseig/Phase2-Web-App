<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import BaseFieldShell from '@/components/common/BaseFieldShell.vue'

defineOptions({
  name: 'BaseSelectField',
  inheritAttrs: false,
})

type SelectValue = string | number | boolean | null | undefined

type SelectOption = {
  value: string | number | boolean
  label: string
}

interface Props {
  id?: string
  modelValue: SelectValue
  options: readonly SelectOption[]
  label?: string
  labelClass?: string
  wrapperClass?: string
  helperText?: string
  helperClass?: string
  selectClass?: string
  disabled?: boolean
  required?: boolean
  includeEmptyOption?: boolean
  emptyOptionLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  label: '',
  labelClass: '',
  wrapperClass: '',
  helperText: '',
  helperClass: '',
  selectClass: 'form-select',
  disabled: false,
  required: false,
  includeEmptyOption: false,
  emptyOptionLabel: '-- Select --',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean]
  change: [event: Event]
}>()

const attrs = useAttrs()

const model = computed({
  get: () => props.modelValue ?? '',
  set: (value: string | number | boolean) => emit('update:modelValue', value),
})

function handleChange(event: Event) {
  emit('change', event)
}
</script>

<template>
  <BaseFieldShell
    :id="id"
    :label="label"
    :label-class="labelClass"
    :wrapper-class="wrapperClass"
    :required="required"
    :helper-text="helperText"
    :helper-class="helperClass"
  >
    <select
      v-bind="attrs"
      :id="id || undefined"
      v-model="model"
      :class="selectClass"
      :disabled="disabled"
      :required="required"
      @change="handleChange"
    >
      <option v-if="includeEmptyOption" value="">
        {{ emptyOptionLabel }}
      </option>
      <option
        v-for="option in options"
        :key="String(option.value)"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </BaseFieldShell>
</template>
