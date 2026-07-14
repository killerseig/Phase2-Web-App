<script setup lang="ts">
import { formatTimecardTrimmedNumber } from '@/features/timecards/cardDisplayHelpers'
import type { TimecardCardRecord } from '@/types/domain'
import { readInputValue } from '@/utils/domEvents'

type TimecardWorkbookFooterField =
  | 'footerJobOrGl'
  | 'footerAccount'
  | 'footerOffice'
  | 'footerAmount'
  | 'footerSecondJobOrGl'
  | 'footerSecondAccount'
  | 'footerSecondOffice'
  | 'footerSecondAmount'
  | 'notes'

defineProps<{
  card: Pick<TimecardCardRecord, TimecardWorkbookFooterField>
  readOnly: boolean
  overtimeHours: number
  regularHours: number
}>()

const emit = defineEmits<{
  'update-field': [field: TimecardWorkbookFooterField, value: string]
}>()

</script>

<template>
  <div class="timecard-card__footer-grid">
    <div class="timecard-card__footer-label timecard-card__footer-label--job">JOB or GL</div>
    <div class="timecard-card__footer-label timecard-card__footer-label--acct">ACCT</div>
    <div class="timecard-card__footer-label timecard-card__footer-label--office">OFFICE</div>
    <div class="timecard-card__footer-label timecard-card__footer-label--amt">AMT</div>
    <div class="timecard-card__footer-stat-label timecard-card__footer-stat-label--ot">OT</div>
    <div class="timecard-card__footer-stat-line timecard-card__footer-stat-line--ot">
      <span class="timecard-card__footer-stat-value" data-testid="timecard-overtime-hours">
        {{ formatTimecardTrimmedNumber(overtimeHours, 1) }}
      </span>
    </div>
    <div class="timecard-card__footer-stat-label timecard-card__footer-stat-label--reg">REG</div>
    <div class="timecard-card__footer-stat-line timecard-card__footer-stat-line--reg">
      <span class="timecard-card__footer-stat-value" data-testid="timecard-regular-hours">
        {{ formatTimecardTrimmedNumber(regularHours, 1) }}
      </span>
    </div>

    <div class="timecard-card__footer-box timecard-card__footer-box--job">
      <input
        class="timecard-card__footer-input"
        :disabled="readOnly"
        :value="card.footerJobOrGl"
        type="text"
        @input="emit('update-field', 'footerJobOrGl', readInputValue($event))"
      />
    </div>
    <div class="timecard-card__footer-box timecard-card__footer-box--acct">
      <input
        class="timecard-card__footer-input"
        :disabled="readOnly"
        :value="card.footerAccount"
        type="text"
        @input="emit('update-field', 'footerAccount', readInputValue($event))"
      />
    </div>
    <div class="timecard-card__footer-box timecard-card__footer-box--office">
      <input
        class="timecard-card__footer-input"
        :disabled="readOnly"
        :value="card.footerOffice"
        type="text"
        @input="emit('update-field', 'footerOffice', readInputValue($event))"
      />
    </div>
    <div class="timecard-card__footer-box timecard-card__footer-box--amount">
      <input
        class="timecard-card__footer-input"
        :disabled="readOnly"
        :value="card.footerAmount"
        type="text"
        @input="emit('update-field', 'footerAmount', readInputValue($event))"
      />
    </div>

    <div class="timecard-card__footer-box timecard-card__footer-box--job-second">
      <input
        class="timecard-card__footer-input"
        :disabled="readOnly"
        :value="card.footerSecondJobOrGl"
        type="text"
        @input="emit('update-field', 'footerSecondJobOrGl', readInputValue($event))"
      />
    </div>
    <div class="timecard-card__footer-box timecard-card__footer-box--acct-second">
      <input
        class="timecard-card__footer-input"
        :disabled="readOnly"
        :value="card.footerSecondAccount"
        type="text"
        @input="emit('update-field', 'footerSecondAccount', readInputValue($event))"
      />
    </div>
    <div class="timecard-card__footer-box timecard-card__footer-box--office-second">
      <input
        class="timecard-card__footer-input"
        :disabled="readOnly"
        :value="card.footerSecondOffice"
        type="text"
        @input="emit('update-field', 'footerSecondOffice', readInputValue($event))"
      />
    </div>
    <div class="timecard-card__footer-box timecard-card__footer-box--amount-second">
      <input
        class="timecard-card__footer-input"
        :disabled="readOnly"
        :value="card.footerSecondAmount"
        type="text"
        @input="emit('update-field', 'footerSecondAmount', readInputValue($event))"
      />
    </div>

    <div class="timecard-card__notes-label">NOTES:</div>
    <div class="timecard-card__notes-line">
      <input
        class="timecard-card__notes-input"
        data-testid="timecard-notes-input"
        :disabled="readOnly"
        :value="card.notes"
        type="text"
        @input="emit('update-field', 'notes', readInputValue($event))"
      />
    </div>

    <div class="timecard-card__footer-gap" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.timecard-card__footer-input,
.timecard-card__notes-input {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  outline: none;
  caret-color: #111;
}

.timecard-card__footer-input:focus,
.timecard-card__notes-input:focus {
  background: rgba(255, 245, 196, 0.48);
  box-shadow: inset 0 -1px 0 rgba(146, 117, 24, 0.5);
}

.timecard-card__footer-input:disabled,
.timecard-card__notes-input:disabled {
  color: inherit;
  -webkit-text-fill-color: currentColor;
  opacity: 1;
}

.timecard-card__footer-grid {
  display: grid;
  grid-template-columns: var(--timecard-column-template);
  grid-template-rows: 13.079pt 15.539pt 13.079pt 13.079pt 13.079pt;
  align-items: stretch;
  padding: 0;
  box-sizing: border-box;
}

.timecard-card__footer-label {
  align-self: end;
  justify-self: center;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.09in;
  font-style: normal;
  font-weight: 400;
  text-align: center;
  line-height: 1;
  padding-bottom: 0;
}

.timecard-card__footer-label--job {
  grid-column: 1 / 4;
  grid-row: 1;
}

.timecard-card__footer-label--acct {
  grid-column: 4 / 6;
  grid-row: 1;
}

.timecard-card__footer-label--office {
  grid-column: 6 / 8;
  grid-row: 1;
}

.timecard-card__footer-label--amt {
  grid-column: 8 / 10;
  grid-row: 1;
}

.timecard-card__footer-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  border: 1px solid #111;
  padding: 0.01in 0.02in;
  overflow: hidden;
  box-sizing: border-box;
}

.timecard-card__footer-box:focus-within {
  background: rgba(255, 245, 196, 0.48);
  box-shadow: inset 0 0 0 1px rgba(146, 117, 24, 0.36);
}

.timecard-card__footer-input {
  min-width: 0;
  min-height: 0;
  text-align: center;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.095in;
  font-weight: 700;
  line-height: 1;
  padding: 0;
}

.timecard-card__footer-box .timecard-card__footer-input:focus,
.timecard-card__notes-line .timecard-card__notes-input:focus {
  background: transparent;
  box-shadow: none;
}

.timecard-card__footer-stat-label {
  align-self: end;
  justify-self: center;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.09in;
  font-style: normal;
  font-weight: 400;
  text-align: center;
  line-height: 1;
}

.timecard-card__footer-stat-label--ot {
  grid-column: 11 / 12;
  grid-row: 1;
}

.timecard-card__footer-stat-label--reg {
  grid-column: 11 / 12;
  grid-row: 2;
}

.timecard-card__footer-stat-line {
  position: relative;
  align-self: end;
  margin: 0 0.03in 0.03in;
  border-bottom: 1px solid #111;
}

.timecard-card__footer-stat-line--ot {
  grid-column: 12 / 13;
  grid-row: 1;
}

.timecard-card__footer-stat-line--reg {
  grid-column: 12 / 13;
  grid-row: 2;
}

.timecard-card__footer-stat-value {
  position: absolute;
  inset: auto 0 -0.01in 0;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.1in;
  font-weight: 700;
  line-height: 1;
  text-align: center;
}

.timecard-card__footer-box--job,
.timecard-card__footer-box--job-second {
  grid-column: 1 / 4;
}

.timecard-card__footer-box--acct,
.timecard-card__footer-box--acct-second {
  grid-column: 4 / 6;
}

.timecard-card__footer-box--office,
.timecard-card__footer-box--office-second {
  grid-column: 6 / 8;
}

.timecard-card__footer-box--amount,
.timecard-card__footer-box--amount-second {
  grid-column: 8 / 10;
}

.timecard-card__footer-box--job,
.timecard-card__footer-box--acct,
.timecard-card__footer-box--office,
.timecard-card__footer-box--amount {
  grid-row: 2;
}

.timecard-card__footer-box--job-second,
.timecard-card__footer-box--acct-second,
.timecard-card__footer-box--office-second,
.timecard-card__footer-box--amount-second {
  grid-row: 3;
}

.timecard-card__notes-label {
  grid-column: 2 / 4;
  grid-row: 4;
  align-self: end;
  justify-self: end;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.09in;
  font-style: normal;
  font-weight: 400;
  text-align: right;
  padding: 0 0.02in 0 0;
}

.timecard-card__notes-line {
  grid-column: 4 / 14;
  grid-row: 4;
  display: flex;
  align-items: flex-end;
  min-width: 0;
  align-self: end;
  border-bottom: 1px solid #111;
  padding-bottom: 0.01in;
}

.timecard-card__notes-line:focus-within {
  background: rgba(255, 245, 196, 0.35);
}

.timecard-card__notes-input {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 0;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.095in;
  line-height: 1;
  padding: 0;
}

.timecard-card__footer-gap {
  grid-column: 1 / -1;
  grid-row: 5;
}
</style>
