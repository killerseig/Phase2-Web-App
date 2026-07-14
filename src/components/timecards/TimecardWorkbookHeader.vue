<script setup lang="ts">
import {
  formatMaskedTimecardWage,
  formatTimecardCurrency,
  formatTimecardEmployeeHeaderName,
  formatTimecardWeekEnding,
} from '@/features/timecards/cardDisplayHelpers'
import type { TimecardCardRecord } from '@/types/domain'
import { readInputValue } from '@/utils/domEvents'

type TimecardWorkbookHeaderField =
  | 'firstName'
  | 'lastName'
  | 'employeeNumber'
  | 'occupation'

defineProps<{
  card: TimecardCardRecord
  weekEndDate: string
  readOnly: boolean
  employeeHeaderLocked: boolean
  showEmployeeWage: boolean
  wageInputValue: string
}>()

const emit = defineEmits<{
  'update-field': [field: TimecardWorkbookHeaderField, value: string]
  'update-wage': [value: string]
  'commit-wage': []
  'filter-wage-key': [event: KeyboardEvent]
}>()

</script>

<template>
  <div class="timecard-card__brand">PHASE 2 COMPANY</div>

  <div class="timecard-card__field-row timecard-card__field-row--name">
    <span class="timecard-card__field-label timecard-card__field-label--name">EMP. NAME:</span>
    <div v-if="employeeHeaderLocked" class="timecard-card__field-value timecard-card__field-value--name">
      {{ formatTimecardEmployeeHeaderName(card) }}
    </div>
    <div v-else class="timecard-card__field-value timecard-card__field-value--name timecard-card__field-value--split">
      <input
        class="timecard-card__inline-input"
        :disabled="readOnly"
        :value="card.lastName"
        type="text"
        placeholder="Last Name"
        @input="emit('update-field', 'lastName', readInputValue($event))"
      />
      <input
        class="timecard-card__inline-input"
        :disabled="readOnly"
        :value="card.firstName"
        type="text"
        placeholder="First Name"
        @input="emit('update-field', 'firstName', readInputValue($event))"
      />
    </div>

    <span class="timecard-card__field-label timecard-card__field-label--employee-number">EMPLOYEE#</span>
    <div class="timecard-card__field-value timecard-card__field-value--employee-number">
      <template v-if="employeeHeaderLocked">
        {{ card.employeeNumber || '-' }}
      </template>
      <template v-else>
        <input
          class="timecard-card__header-input timecard-card__header-input--center"
          :disabled="readOnly"
          :value="card.employeeNumber"
          type="text"
          @input="emit('update-field', 'employeeNumber', readInputValue($event))"
        />
      </template>
    </div>
  </div>

  <div class="timecard-card__field-row timecard-card__field-row--occupation">
    <span class="timecard-card__field-label timecard-card__field-label--occupation">OCCUPATION:</span>
    <div class="timecard-card__field-value timecard-card__field-value--occupation">
      <template v-if="employeeHeaderLocked">
        {{ card.occupation || '-' }}
      </template>
      <input
        v-else
        class="timecard-card__header-input"
        :disabled="readOnly"
        :value="card.occupation"
        type="text"
        @input="emit('update-field', 'occupation', readInputValue($event))"
      />
    </div>

    <span class="timecard-card__field-label timecard-card__field-label--wage">WAGE</span>
    <div class="timecard-card__field-value timecard-card__field-value--wage">
      <template v-if="showEmployeeWage">
        <template v-if="readOnly">
          <span data-testid="timecard-wage-display">{{ formatTimecardCurrency(card.wageRate) || '-' }}</span>
        </template>
        <input
          v-else
          class="timecard-card__header-input timecard-card__header-input--center"
          data-testid="timecard-wage-input"
          :disabled="readOnly"
          :value="wageInputValue"
          type="text"
          inputmode="decimal"
          @keydown="emit('filter-wage-key', $event)"
          @input="emit('update-wage', readInputValue($event))"
          @blur="emit('commit-wage')"
        />
      </template>
      <template v-else>
        {{ formatMaskedTimecardWage() }}
      </template>
    </div>
  </div>

  <div class="timecard-card__field-row timecard-card__field-row--week-ending">
    <div class="timecard-card__field-filler"></div>
    <span class="timecard-card__field-label timecard-card__field-label--week-ending">WEEK ENDING</span>
    <div class="timecard-card__field-value timecard-card__field-value--week-ending">
      {{ formatTimecardWeekEnding(weekEndDate) }}
    </div>
  </div>
</template>

<style scoped>
.timecard-card__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 21.853pt;
  padding: 0 0.3rem;
  text-align: center;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 1.08rem;
  font-weight: 700;
  line-height: 1;
}

.timecard-card__field-row {
  display: grid;
  grid-template-columns: var(--timecard-column-template);
  align-items: end;
  height: 11.849pt;
  min-width: 0;
  padding: 0 0.3rem;
  box-sizing: border-box;
}

.timecard-card__field-label {
  display: flex;
  justify-content: flex-start;
  align-items: end;
  min-width: 0;
  white-space: nowrap;
  padding: 0 0.08rem 0.03rem 0;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.54rem;
  font-style: italic;
  font-weight: 400;
  line-height: 1;
}

.timecard-card__field-value {
  display: flex;
  min-width: 0;
  align-items: stretch;
  border-bottom: 1px solid #111;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.63rem;
  font-weight: 700;
  overflow: hidden;
  padding: 0 0.08rem 0.03rem;
  line-height: 1;
}

.timecard-card__field-value--split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.22rem;
  padding: 0;
}

.timecard-card__field-value--employee-number,
.timecard-card__field-value--wage {
  font-size: 0.69rem;
}

.timecard-card__field-row--week-ending {
  align-items: end;
}

.timecard-card__field-label--name,
.timecard-card__field-label--occupation {
  grid-column: 1 / 4;
  justify-content: flex-end;
  text-align: right;
  padding-right: 0.16rem;
}

.timecard-card__field-value--name,
.timecard-card__field-value--occupation {
  grid-column: 4 / 11;
  justify-content: flex-start;
  text-align: left;
}

.timecard-card__field-label--employee-number,
.timecard-card__field-label--wage {
  grid-column: 12 / 13;
  justify-content: flex-end;
  padding-right: 0.14rem;
}

.timecard-card__field-label--week-ending {
  grid-column: 12 / 13;
  justify-content: flex-end;
  padding-right: 0.08rem;
  align-self: end;
}

.timecard-card__field-value--employee-number,
.timecard-card__field-value--wage,
.timecard-card__field-value--week-ending {
  grid-column: 13 / 15;
  justify-content: center;
  text-align: center;
}

.timecard-card__field-filler {
  grid-column: 4 / 11;
  min-height: 0;
  border-bottom: 0;
  align-self: end;
}

.timecard-card__field-value--week-ending {
  align-self: end;
}

.timecard-card__inline-input,
.timecard-card__header-input {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  outline: none;
  caret-color: #111;
  font-family: 'Times New Roman', Times, serif;
  font-size: inherit;
  font-weight: 700;
  line-height: 1;
}

.timecard-card__header-input--center {
  text-align: center;
}

.timecard-card__inline-input:focus,
.timecard-card__header-input:focus {
  background: rgba(255, 245, 196, 0.48);
  box-shadow: inset 0 -1px 0 rgba(146, 117, 24, 0.5);
}

.timecard-card__inline-input:disabled,
.timecard-card__header-input:disabled {
  color: inherit;
  -webkit-text-fill-color: currentColor;
  opacity: 1;
}
</style>
