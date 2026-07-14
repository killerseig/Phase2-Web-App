<script setup lang="ts">
export type TimecardSortMode = 'name' | 'number'

withDefaults(defineProps<{
  modelValue: TimecardSortMode
  name?: string
}>(), {
  name: 'timecard-sort-mode',
})

const emit = defineEmits<{
  'update:modelValue': [value: TimecardSortMode]
}>()
</script>

<template>
  <div class="timecard-sort-mode">
    <label class="timecard-sort-mode__option">
      <input
        :checked="modelValue === 'number'"
        :name="name"
        type="radio"
        value="number"
        @change="emit('update:modelValue', 'number')"
      />
      <span>Employee#</span>
    </label>
    <label class="timecard-sort-mode__option">
      <input
        :checked="modelValue === 'name'"
        :name="name"
        type="radio"
        value="name"
        @change="emit('update:modelValue', 'name')"
      />
      <span>Name</span>
    </label>
  </div>
</template>

<style scoped>
.timecard-sort-mode {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.timecard-sort-mode__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
  font-weight: 600;
  box-shadow: none;
}

.timecard-sort-mode__option:has(input:checked) {
  border-color: rgba(63, 120, 67, 0.46);
  background: var(--timecards-toolbar-control-bg-active);
}

.timecard-sort-mode__option:has(input:focus-visible) {
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecard-sort-mode__option input {
  accent-color: #3d7a43;
}
</style>
