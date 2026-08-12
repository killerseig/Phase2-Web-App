<script setup lang="ts">
import { computed } from 'vue'
import Select from 'primevue/select'

interface JobOption {
  id: string
  label: string
}

interface ForemanOption {
  id: string
  label: string
}

const props = defineProps<{
  jobId: string
  jobOptions: JobOption[]
  foremanId: string
  foremanOptions: ForemanOption[]
  targetWeekExists: boolean
}>()

const emit = defineEmits<{
  updateJobId: [value: string]
  updateForemanId: [value: string]
}>()

const showForemanWarning = computed(() => (
  Boolean(props.jobId) && !props.targetWeekExists && !props.foremanOptions.length
))
</script>

<template>
  <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--job">
    <legend class="timecards-toolbar__legend">Week Target</legend>
    <h2 class="timecards-create__title">Pick The Job And Foreman</h2>

    <div class="timecards-create__target-grid">
      <label class="timecards-toolbar__search timecards-create__target-field">
        <span>Linked Job</span>
        <Select
          :model-value="jobId"
          class="timecards-toolbar__select timecards-create__control"
          :options="jobOptions"
          option-label="label"
          option-value="id"
          overlay-class="timecards-toolbar__select-overlay"
          placeholder="Select linked job"
          :unstyled="false"
          fluid
          @update:model-value="emit('updateJobId', String($event ?? ''))"
        />
      </label>

      <label class="timecards-toolbar__search timecards-create__target-field">
        <span>Foreman Owner</span>
        <Select
          :model-value="foremanId"
          class="timecards-toolbar__select timecards-create__control"
          :options="foremanOptions"
          option-label="label"
          option-value="id"
          overlay-class="timecards-toolbar__select-overlay"
          placeholder="Select foreman"
          :disabled="!jobId || !foremanOptions.length"
          :unstyled="false"
          fluid
          @update:model-value="emit('updateForemanId', String($event ?? ''))"
        />
      </label>
    </div>

    <p v-if="showForemanWarning" class="timecards-create__warning">
      No foremen are assigned to this job. Assign a foreman before creating a card for it.
    </p>

    <p class="timecards-create__hint">
      New export cards use this job and foreman target. If the saved week does not exist yet, export will open it under that foreman first.
    </p>
  </fieldset>
</template>

<style src="./timecard-primevue-select.css" scoped></style>
<style src="./timecard-create-tray.css" scoped></style>
<style src="./timecard-toolbar-content.css" scoped></style>

<style scoped>
.timecards-create__panel--job {
  grid-column: 1 / -1;
  align-content: start;
}

.timecards-create__target-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(17rem, 22rem));
  gap: 0.7rem 0.9rem;
  align-items: start;
}

.timecards-create__target-field {
  width: 100%;
  max-width: 22rem;
}

.timecards-create__hint {
  margin: 0;
  max-width: 44rem;
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.84rem;
  line-height: 1.35;
}

.timecards-create__warning {
  margin: -0.1rem 0 0;
  max-width: 34rem;
  color: #8a2828;
  font-size: 0.84rem;
  line-height: 1.35;
}

.timecards-create__control.p-disabled {
  border-color: rgba(196, 204, 176, 0.92);
  background: rgba(242, 245, 233, 0.94);
  color: rgba(95, 104, 74, 0.82);
  box-shadow: none;
}

.timecards-create__control.p-disabled :deep(.p-select-label),
.timecards-create__control.p-disabled :deep(.p-select-dropdown) {
  background: transparent;
  color: rgba(95, 104, 74, 0.82);
}

@media (max-width: 960px) {
  .timecards-create__target-grid {
    grid-template-columns: 1fr;
  }
}
</style>
