<script setup lang="ts">
type JobOption = {
  id: string
  name: string
  code?: string | null
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    jobs?: JobOption[]
    disabled?: boolean
  }>(),
  {
    modelValue: null,
    jobs: () => [],
    disabled: false,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onChange(event: Event) {
  const nextValue = (event.target as HTMLSelectElement).value
  emit('update:modelValue', nextValue)
}
</script>

<template>
  <label class="form-label small mb-1">Job</label>
  <select class="form-select form-select-sm" :value="props.modelValue ?? ''" :disabled="props.disabled" @change="onChange">
    <option disabled value="">Select a job</option>
    <option v-for="job in props.jobs" :key="job.id" :value="job.id">
      {{ job.code ? `${job.code} - ${job.name}` : job.name }}
    </option>
  </select>
</template>
