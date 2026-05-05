<script setup lang="ts">
import { computed } from 'vue'
import {
  TIMECARD_VISIBLE_DAY_INDEXES,
  TIMECARD_VISIBLE_DAY_LABELS,
  buildCardDisplayName,
  calculateLineSummaryUnitCost,
  calculateRegularAndOvertimeHours,
} from '@/features/timecards/workbook'
import type { TimecardCardRecord } from '@/types/domain'

const props = withDefaults(defineProps<{
  card: TimecardCardRecord
  weekEndDate: string
  burden?: number
}>(), {
  burden: undefined,
})

const dayLabels = TIMECARD_VISIBLE_DAY_LABELS
const visibleDayIndexes = TIMECARD_VISIBLE_DAY_INDEXES
const lineRowKinds = [
  { key: 'hours', label: 'H', diffField: 'difH' },
  { key: 'production', label: 'P', diffField: 'difP' },
  { key: 'cost', label: 'C', diffField: 'difC' },
] as const

type LineRowKind = (typeof lineRowKinds)[number]['key']

const visibleHoursByDay = computed(() =>
  visibleDayIndexes.map((dayIndex) => Number(props.card.totals.hoursByDay[dayIndex] ?? 0)),
)
const hoursBreakdown = computed(() => calculateRegularAndOvertimeHours(
  props.card.totals.hoursTotal,
  props.card.regularHoursOverride,
  props.card.overtimeHoursOverride,
))

function formatWeekEnding(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}

function formatEmployeeHeaderName(card: Pick<TimecardCardRecord, 'fullName' | 'firstName' | 'lastName' | 'employeeNumber'>) {
  const firstName = card.firstName.trim()
  const lastName = card.lastName.trim()
  if (lastName && firstName) return `${lastName}, ${firstName}`
  if (lastName || firstName) return lastName || firstName
  return card.fullName.trim() || buildCardDisplayName(card)
}

function formatCurrency(value: number | null | undefined) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return ''
  return `$${safe.toFixed(2)}`
}

function formatHours(value: number | null | undefined, blankWhenZero = false) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return blankWhenZero ? '' : '0.0'
  if (blankWhenZero && safe === 0) return ''
  return safe.toFixed(1)
}

function formatFixedNumber(value: number | null | undefined, decimals = 2, blankWhenZero = false) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return blankWhenZero ? '' : (0).toFixed(decimals)
  if (blankWhenZero && safe === 0) return ''
  return safe.toFixed(decimals)
}

function formatTrimmedNumber(value: number | null | undefined, decimals = 2, blankWhenZero = false) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return blankWhenZero ? '' : (0).toFixed(decimals)
  if (blankWhenZero && safe === 0) return ''
  return safe.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function lineHoursTotal(lineIndex: number) {
  return props.card.lines[lineIndex]?.days.reduce((sum, day) => sum + Number(day.hours ?? 0), 0) ?? 0
}

function lineProductionTotal(lineIndex: number) {
  return props.card.lines[lineIndex]?.days.reduce((sum, day) => sum + Number(day.production ?? 0), 0) ?? 0
}

function lineSummaryCost(lineIndex: number) {
  const line = props.card.lines[lineIndex]
  if (!line) return 0
  return calculateLineSummaryUnitCost(line, props.card.wageRate, props.burden)
}

function lineDiffValue(lineIndex: number, rowKind: LineRowKind) {
  const line = props.card.lines[lineIndex]
  if (!line) return ''
  if (rowKind === 'hours') return line.difH
  if (rowKind === 'production') return line.difP
  return line.difC
}

function lineDayValue(lineIndex: number, rowKind: LineRowKind, dayIndex: number) {
  const line = props.card.lines[lineIndex]
  const day = line?.days[dayIndex]
  if (!line || !day) return ''
  if (rowKind === 'hours') return formatFixedNumber(day.hours, 2, true)
  if (rowKind === 'production') return formatFixedNumber(day.production, 2, true)
  return formatFixedNumber(day.unitCostOverride ?? day.unitCost, 2, true)
}

function lineProductionValue(lineIndex: number, rowKind: LineRowKind) {
  if (rowKind === 'hours') return ''
  if (rowKind === 'production') return formatTrimmedNumber(lineProductionTotal(lineIndex), 3, false)
  return formatFixedNumber(lineSummaryCost(lineIndex), 3, true)
}

function lineOffValue(lineIndex: number, rowKind: LineRowKind) {
  const line = props.card.lines[lineIndex]
  if (!line) return ''
  if (rowKind === 'hours') return formatTrimmedNumber(line.offHours, 2, true)
  if (rowKind === 'production') return formatTrimmedNumber(line.offProduction, 2, true)
  return formatTrimmedNumber(line.offCost, 2, true)
}

function displayText(value: string | null | undefined, fallback = '') {
  const next = typeof value === 'string' ? value.trim() : ''
  return next || fallback
}
</script>

<template>
  <div class="timecard-print-card">
    <div class="timecard-print-card__brand">PHASE 2 COMPANY</div>

    <div class="timecard-print-card__field-row timecard-print-card__field-row--name">
      <span class="timecard-print-card__field-label timecard-print-card__field-label--name">EMP. NAME:</span>
      <div class="timecard-print-card__field-value timecard-print-card__field-value--name">
        {{ formatEmployeeHeaderName(card) }}
      </div>

      <span class="timecard-print-card__field-label timecard-print-card__field-label--employee-number">EMPLOYEE#</span>
      <div class="timecard-print-card__field-value timecard-print-card__field-value--employee-number">
        {{ displayText(card.employeeNumber, '-') }}
      </div>
    </div>

    <div class="timecard-print-card__field-row timecard-print-card__field-row--occupation">
      <span class="timecard-print-card__field-label timecard-print-card__field-label--occupation">OCCUPATION:</span>
      <div class="timecard-print-card__field-value timecard-print-card__field-value--occupation">
        {{ displayText(card.occupation, '-') }}
      </div>

      <span class="timecard-print-card__field-label timecard-print-card__field-label--wage">WAGE</span>
      <div class="timecard-print-card__field-value timecard-print-card__field-value--wage">
        {{ formatCurrency(card.wageRate) || '-' }}
      </div>
    </div>

    <div class="timecard-print-card__field-row timecard-print-card__field-row--week-ending">
      <div class="timecard-print-card__field-filler"></div>
      <span class="timecard-print-card__field-label timecard-print-card__field-label--week-ending">WEEK ENDING</span>
      <div class="timecard-print-card__field-value timecard-print-card__field-value--week-ending">
        {{ formatWeekEnding(weekEndDate) }}
      </div>
    </div>

    <div class="timecard-print-card__header-gap" aria-hidden="true"></div>

    <div class="timecard-print-card__table-wrap">
      <div class="timecard-print-card__table-scale">
        <table class="timecard-print-grid">
          <colgroup>
            <col class="timecard-print-grid__col timecard-print-grid__col--a" />
            <col class="timecard-print-grid__col timecard-print-grid__col--b" />
            <col class="timecard-print-grid__col timecard-print-grid__col--c" />
            <col class="timecard-print-grid__col timecard-print-grid__col--d" />
            <col class="timecard-print-grid__col timecard-print-grid__col--e" />
            <col class="timecard-print-grid__col timecard-print-grid__col--f" />
            <col class="timecard-print-grid__col timecard-print-grid__col--g" />
            <col class="timecard-print-grid__col timecard-print-grid__col--h" />
            <col class="timecard-print-grid__col timecard-print-grid__col--i" />
            <col class="timecard-print-grid__col timecard-print-grid__col--j" />
            <col class="timecard-print-grid__col timecard-print-grid__col--k" />
            <col class="timecard-print-grid__col timecard-print-grid__col--l" />
            <col class="timecard-print-grid__col timecard-print-grid__col--m" />
            <col class="timecard-print-grid__col timecard-print-grid__col--n" />
          </colgroup>
          <thead>
            <tr>
              <th>JOB #</th>
              <th>1</th>
              <th></th>
              <th>ACCT</th>
              <th>DIF</th>
              <th
                v-for="label in dayLabels"
                :key="label"
                class="timecard-print-grid__day-header"
              >
                {{ label }}
              </th>
              <th>TOTAL</th>
              <th>PROD</th>
              <th>OFF</th>
            </tr>
          </thead>

          <tbody>
            <template v-for="(line, lineIndex) in card.lines" :key="lineIndex">
              <tr
                v-for="(rowKind, rowKindIndex) in lineRowKinds"
                :key="`${lineIndex}-${rowKind.key}`"
                class="timecard-print-grid__body-row"
                :class="`timecard-print-grid__body-row--${rowKind.key}`"
              >
                <td v-if="rowKindIndex === 0" :rowspan="lineRowKinds.length" class="timecard-print-grid__rowspan-cell">
                  {{ line.jobNumber }}
                </td>
                <td v-if="rowKindIndex === 0" :rowspan="lineRowKinds.length" class="timecard-print-grid__rowspan-cell">
                  {{ line.subsectionArea }}
                </td>
                <td class="timecard-print-grid__label-cell">{{ rowKind.label }}</td>
                <td v-if="rowKindIndex === 0" :rowspan="lineRowKinds.length" class="timecard-print-grid__rowspan-cell">
                  {{ line.account }}
                </td>
                <td class="timecard-print-grid__diff-cell">
                  {{ lineDiffValue(lineIndex, rowKind.key) }}
                </td>

                <td
                  v-for="dayIndex in visibleDayIndexes"
                  :key="dayIndex"
                  class="timecard-print-grid__day-cell timecard-print-grid__body-day-cell"
                >
                  {{ lineDayValue(lineIndex, rowKind.key, dayIndex) }}
                </td>

                <td
                  v-if="rowKindIndex === 0"
                  :rowspan="lineRowKinds.length"
                  class="timecard-print-grid__rowspan-cell timecard-print-grid__rowspan-cell--summary"
                >
                  {{ formatHours(lineHoursTotal(lineIndex)) }}
                </td>

                <td class="timecard-print-grid__prod-cell">
                  {{ lineProductionValue(lineIndex, rowKind.key) }}
                </td>
                <td class="timecard-print-grid__off-cell">
                  {{ lineOffValue(lineIndex, rowKind.key) }}
                </td>
              </tr>
            </template>

              <tr class="timecard-print-grid__total-row">
                <td colspan="5" class="timecard-print-grid__total-label">TOTAL HOURS</td>
                <td
                  v-for="(value, index) in visibleHoursByDay"
                  :key="`hours-${index}`"
                  class="timecard-print-grid__total-day timecard-print-grid__day-cell"
                >
                  {{ formatHours(value) }}
                </td>
              <td>{{ formatHours(card.totals.hoursTotal) }}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="timecard-print-card__footer-grid">
      <div class="timecard-print-card__footer-label timecard-print-card__footer-label--job">JOB or GL</div>
      <div class="timecard-print-card__footer-label timecard-print-card__footer-label--acct">ACCT</div>
      <div class="timecard-print-card__footer-label timecard-print-card__footer-label--office">OFFICE</div>
      <div class="timecard-print-card__footer-label timecard-print-card__footer-label--amt">AMT</div>
      <div class="timecard-print-card__footer-stat-label timecard-print-card__footer-stat-label--ot">OT</div>
      <div class="timecard-print-card__footer-stat-line timecard-print-card__footer-stat-line--ot">
        <span class="timecard-print-card__footer-stat-value">{{ formatTrimmedNumber(hoursBreakdown.overtimeHours, 1) }}</span>
      </div>
      <div class="timecard-print-card__footer-stat-label timecard-print-card__footer-stat-label--reg">REG</div>
      <div class="timecard-print-card__footer-stat-line timecard-print-card__footer-stat-line--reg">
        <span class="timecard-print-card__footer-stat-value">{{ formatTrimmedNumber(hoursBreakdown.regularHours, 1) }}</span>
      </div>

      <div class="timecard-print-card__footer-box timecard-print-card__footer-box--job">{{ card.footerJobOrGl }}</div>
      <div class="timecard-print-card__footer-box timecard-print-card__footer-box--acct">{{ card.footerAccount }}</div>
      <div class="timecard-print-card__footer-box timecard-print-card__footer-box--office">{{ card.footerOffice }}</div>
      <div class="timecard-print-card__footer-box timecard-print-card__footer-box--amount">{{ card.footerAmount }}</div>

      <div class="timecard-print-card__footer-box timecard-print-card__footer-box--job-second">{{ card.footerSecondJobOrGl }}</div>
      <div class="timecard-print-card__footer-box timecard-print-card__footer-box--acct-second">{{ card.footerSecondAccount }}</div>
      <div class="timecard-print-card__footer-box timecard-print-card__footer-box--office-second">{{ card.footerSecondOffice }}</div>
      <div class="timecard-print-card__footer-box timecard-print-card__footer-box--amount-second">{{ card.footerSecondAmount }}</div>

      <div class="timecard-print-card__notes-label">NOTES:</div>
      <div class="timecard-print-card__notes-line">{{ card.notes }}</div>
    </div>

    <div class="timecard-print-card__bottom-spacer" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.timecard-print-card {
  position: relative;
  width: 100%;
  min-height: 8in;
  height: 8in;
  display: grid;
  grid-template-rows:
    21.853pt
    11.849pt
    11.849pt
    11.849pt
    9.8pt
    430.745pt
    67.855pt
    10.2pt;
  box-sizing: border-box;
  border: 0;
  box-shadow: inset 0 0 0 2px #111;
  background: #fff;
  color: #111;
  overflow: hidden;
  --timecard-print-table-row-scale: 0.929;
  --timecard-print-table-body-row-scale: 0.79;
  --timecard-print-total-row-scale: 0.86;
  --timecard-print-column-template:
    5.7109375fr
    2.7109375fr
    2.7109375fr
    7fr
    3.42578125fr
    5.7109375fr
    5.7109375fr
    5.7109375fr
    5.7109375fr
    5.7109375fr
    5.7109375fr
    7.42578125fr
    7.42578125fr
    7.42578125fr;
}

.timecard-print-card__bottom-spacer {
  height: 100%;
}

.timecard-print-card__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 0.08in;
  text-align: center;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.18in;
  font-weight: 700;
  line-height: 1;
}

.timecard-print-card__field-row {
  display: grid;
  grid-template-columns: var(--timecard-print-column-template);
  align-items: end;
  height: 100%;
  min-width: 0;
  padding: 0 0.08in;
  box-sizing: border-box;
}

.timecard-print-card__field-row--name,
.timecard-print-card__field-row--occupation,
.timecard-print-card__field-row--week-ending {
  min-height: 0;
}

.timecard-print-card__field-label {
  display: flex;
  justify-content: flex-start;
  align-items: end;
  min-width: 0;
  white-space: nowrap;
  padding: 0 0.03in 0.02in 0;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.09in;
  font-style: italic;
  font-weight: 400;
  line-height: 1;
}

.timecard-print-card__field-value {
  min-width: 0;
  overflow: hidden;
  border-bottom: 1px solid #111;
  padding: 0 0.03in 0.02in;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.105in;
  font-weight: 700;
  line-height: 1;
}

.timecard-print-card__field-label--name,
.timecard-print-card__field-label--occupation {
  grid-column: 1 / 4;
  justify-content: flex-end;
  text-align: right;
}

.timecard-print-card__field-value--name,
.timecard-print-card__field-value--occupation {
  grid-column: 4 / 11;
  text-align: left;
}

.timecard-print-card__field-label--employee-number,
.timecard-print-card__field-label--wage,
.timecard-print-card__field-label--week-ending {
  grid-column: 12 / 13;
  justify-content: flex-end;
  text-align: right;
}

.timecard-print-card__field-value--employee-number,
.timecard-print-card__field-value--wage,
.timecard-print-card__field-value--week-ending {
  grid-column: 13 / 15;
  text-align: center;
}

.timecard-print-card__field-value--employee-number,
.timecard-print-card__field-value--wage {
  font-size: 0.115in;
}

.timecard-print-card__field-filler {
  grid-column: 4 / 11;
  min-height: 0;
}

.timecard-print-card__header-gap {
  height: 100%;
}

.timecard-print-card__table-wrap {
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.timecard-print-card__table-scale {
  display: flex;
  height: 100%;
}

.timecard-print-grid {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.098in;
}

.timecard-print-grid__col--a,
.timecard-print-grid__col--f,
.timecard-print-grid__col--g,
.timecard-print-grid__col--h,
.timecard-print-grid__col--i,
.timecard-print-grid__col--j,
.timecard-print-grid__col--k {
  width: 7.33%;
}

.timecard-print-grid__col--b,
.timecard-print-grid__col--c {
  width: 3.49%;
}

.timecard-print-grid__col--d {
  width: 8.96%;
}

.timecard-print-grid__col--e {
  width: 4.35%;
}

.timecard-print-grid__col--l,
.timecard-print-grid__col--m,
.timecard-print-grid__col--n {
  width: 9.46%;
}

.timecard-print-grid th,
.timecard-print-grid td {
  border: 1px solid #111;
  color: #111;
  padding: 0;
  text-align: center;
  vertical-align: middle;
  line-height: 1;
}

.timecard-print-grid th {
  height: calc(13.079pt * var(--timecard-print-table-row-scale));
  font-size: 0.086in;
  font-style: italic;
  font-weight: 400;
  line-height: 1;
}

.timecard-print-grid__body-row td {
  height: calc(10.168pt * var(--timecard-print-table-body-row-scale));
}

.timecard-print-grid__body-row--hours .timecard-print-grid__rowspan-cell,
.timecard-print-grid__body-row--hours .timecard-print-grid__label-cell,
.timecard-print-grid__body-row--hours .timecard-print-grid__diff-cell,
.timecard-print-grid__body-row--hours .timecard-print-grid__day-cell,
.timecard-print-grid__body-row--hours .timecard-print-grid__prod-cell,
.timecard-print-grid__body-row--hours .timecard-print-grid__off-cell {
  border-top-width: 1.5px;
}

.timecard-print-grid__body-row--hours .timecard-print-grid__diff-cell,
.timecard-print-grid__body-row--hours .timecard-print-grid__day-cell,
.timecard-print-grid__body-row--hours .timecard-print-grid__prod-cell,
.timecard-print-grid__body-row--hours .timecard-print-grid__off-cell {
  border-bottom: 0;
}

.timecard-print-grid__body-row--production .timecard-print-grid__diff-cell,
.timecard-print-grid__body-row--production .timecard-print-grid__day-cell,
.timecard-print-grid__body-row--production .timecard-print-grid__prod-cell,
.timecard-print-grid__body-row--production .timecard-print-grid__off-cell {
  border-top: 0;
  border-bottom: 0;
}

.timecard-print-grid__body-row--cost .timecard-print-grid__diff-cell,
.timecard-print-grid__body-row--cost .timecard-print-grid__day-cell,
.timecard-print-grid__body-row--cost .timecard-print-grid__prod-cell,
.timecard-print-grid__body-row--cost .timecard-print-grid__off-cell {
  border-top: 0;
}

.timecard-print-grid__body-row--hours .timecard-print-grid__label-cell {
  border-bottom: 0;
}

.timecard-print-grid__body-row--cost .timecard-print-grid__label-cell {
  border-top: 0;
}

.timecard-print-grid__rowspan-cell {
  vertical-align: middle;
}

.timecard-print-grid__rowspan-cell--summary {
  vertical-align: top;
  padding-top: 0.015in;
  font-weight: 700;
}

.timecard-print-grid__label-cell {
  font-weight: 700;
}

.timecard-print-grid__day-cell {
  position: relative;
}

.timecard-print-grid__total-day {
  border-left: 1px solid #111 !important;
  border-right: 1px solid #111 !important;
}

.timecard-print-grid__total-row td {
  height: calc(18.614pt * var(--timecard-print-total-row-scale));
  font-size: 0.105in;
  font-weight: 700;
  border-top-width: 1.5px;
  border-bottom-width: 1.5px;
}

.timecard-print-grid__total-label {
  text-align: right !important;
  padding-right: 0.08in !important;
}

.timecard-print-card__footer-grid {
  display: grid;
  grid-template-columns: var(--timecard-print-column-template);
  grid-template-rows: 13.079pt 15.539pt 13.079pt 13.079pt 13.079pt;
  align-items: stretch;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
}

.timecard-print-card__footer-label,
.timecard-print-card__footer-stat-label,
.timecard-print-card__notes-label {
  align-self: end;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.09in;
  font-weight: 400;
  line-height: 1;
}

.timecard-print-card__footer-label {
  justify-self: center;
  text-align: center;
}

.timecard-print-card__footer-label--job {
  grid-column: 1 / 4;
  grid-row: 1;
}

.timecard-print-card__footer-label--acct {
  grid-column: 4 / 6;
  grid-row: 1;
}

.timecard-print-card__footer-label--office {
  grid-column: 6 / 8;
  grid-row: 1;
}

.timecard-print-card__footer-label--amt {
  grid-column: 8 / 10;
  grid-row: 1;
}

.timecard-print-card__footer-stat-label--ot {
  grid-column: 11 / 12;
  grid-row: 1;
  justify-self: center;
}

.timecard-print-card__footer-stat-label--reg {
  grid-column: 11 / 12;
  grid-row: 2;
  justify-self: center;
}

.timecard-print-card__footer-stat-line {
  position: relative;
  align-self: end;
  margin: 0 0.03in 0.03in;
  border-bottom: 1px solid #111;
}

.timecard-print-card__footer-stat-line--ot {
  grid-column: 12 / 13;
  grid-row: 1;
}

.timecard-print-card__footer-stat-line--reg {
  grid-column: 12 / 13;
  grid-row: 2;
}

.timecard-print-card__footer-stat-value {
  position: absolute;
  inset: auto 0 -0.01in 0;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.1in;
  font-weight: 700;
  text-align: center;
  line-height: 1;
}

.timecard-print-card__footer-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  border: 1px solid #111;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.095in;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  padding: 0.01in 0.02in;
}

.timecard-print-card__footer-box--job,
.timecard-print-card__footer-box--job-second {
  grid-column: 1 / 4;
}

.timecard-print-card__footer-box--acct,
.timecard-print-card__footer-box--acct-second {
  grid-column: 4 / 6;
}

.timecard-print-card__footer-box--office,
.timecard-print-card__footer-box--office-second {
  grid-column: 6 / 8;
}

.timecard-print-card__footer-box--amount,
.timecard-print-card__footer-box--amount-second {
  grid-column: 8 / 10;
}

.timecard-print-card__footer-box--job,
.timecard-print-card__footer-box--acct,
.timecard-print-card__footer-box--office,
.timecard-print-card__footer-box--amount {
  grid-row: 2;
}

.timecard-print-card__footer-box--job-second,
.timecard-print-card__footer-box--acct-second,
.timecard-print-card__footer-box--office-second,
.timecard-print-card__footer-box--amount-second {
  grid-row: 3;
}

.timecard-print-card__notes-label {
  grid-column: 2 / 4;
  grid-row: 4;
  justify-self: end;
  padding-right: 0.02in;
}

.timecard-print-card__notes-line {
  grid-column: 4 / 14;
  grid-row: 4;
  align-self: end;
  min-width: 0;
  border-bottom: 1px solid #111;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.095in;
  line-height: 1;
  padding-bottom: 0.01in;
}
</style>
