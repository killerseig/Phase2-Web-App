<script setup lang="ts">
import { useAttrs } from 'vue'
import BaseFieldShell from '@/components/common/BaseFieldShell.vue'

defineOptions({
  name: 'BaseFileUploadField',
  inheritAttrs: false,
})

interface Props {
  id?: string
  label?: string
  labelClass?: string
  wrapperClass?: string
  helperText?: string
  helperClass?: string
  inputClass?: string
  accept?: string
  disabled?: boolean
  multiple?: boolean
  icon?: string
  inputAriaLabel?: string
}

withDefaults(defineProps<Props>(), {
  id: '',
  label: '',
  labelClass: '',
  wrapperClass: '',
  helperText: '',
  helperClass: '',
  inputClass: 'form-control form-control-sm app-file-input',
  accept: '',
  disabled: false,
  multiple: false,
  icon: '',
  inputAriaLabel: '',
})

const attrs = useAttrs()

const emit = defineEmits<{
  change: [event: Event]
}>()

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
    :helper-text="helperText"
    :helper-class="helperClass"
  >
    <template v-if="icon" #label>
      <i :class="[icon, 'me-2']" aria-hidden="true" />
      <span>{{ label }}</span>
    </template>

    <input
      v-bind="attrs"
      :id="id || undefined"
      :class="inputClass"
      type="file"
      :accept="accept || undefined"
      :disabled="disabled"
      :multiple="multiple"
      :aria-label="inputAriaLabel || undefined"
      @change="handleChange"
    />
  </BaseFieldShell>
</template>
