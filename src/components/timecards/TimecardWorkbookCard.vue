<script setup lang="ts">
import { computed, reactive } from 'vue'
import TimecardWorkbookHeader from '@/components/timecards/TimecardWorkbookHeader.vue'
import TimecardWorkbookFooter from '@/components/timecards/TimecardWorkbookFooter.vue'
import {
  TIMECARD_LINE_ROW_KINDS as lineRowKinds,
  formatTimecardCurrency as formatCurrency,
  formatTimecardHours as formatHours,
  getTimecardLineDayDisplayValue,
  getTimecardLineDiffValue,
  getTimecardLineHoursTotal,
  getTimecardLineOffDisplayValue,
  getTimecardLineProductionDisplayValue,
  parseNullableTimecardNumber as parseNullableNumber,
  parseTimecardNumericDraft as parseNumericDraft,
  sanitizeTimecardWageInputValue as sanitizeWageInputValue,
  type TimecardLineDayField as LineDayField,
  type TimecardLineOffField as LineOffField,
  type TimecardLineRowKind as LineRowKind,
} from '@/features/timecards/cardDisplayHelpers'
import {
  findNextGridTimecardInput as findNextGridInput,
  findNextTimecardInputByGeometry as findNextInputByGeometry,
  focusAndSelectTimecardInput as focusAndSelectInput,
  getTimecardNavigationDirection as getNavigationDirection,
  isTimecardNavigableInput as isNavigableInput,
  shouldUseHorizontalTimecardNavigation as shouldUseHorizontalNavigation,
  type TimecardNavigableInputElement as NavigableInputElement,
} from '@/features/timecards/workbookNavigation'
import {
  TIMECARD_VISIBLE_DAY_INDEXES,
  TIMECARD_VISIBLE_DAY_LABELS,
  buildCardDisplayName,
  calculateRegularAndOvertimeHours,
} from '@/features/timecards/workbook'
import type { TimecardCardRecord } from '@/types/domain'
import { readInputValue } from '@/utils/domEvents'

const props = withDefaults(defineProps<{
  card: TimecardCardRecord
  weekEndDate: string
  burden?: number
  compact?: boolean
  readOnly?: boolean
  employeeHeaderLocked?: boolean
  showEmployeeWage?: boolean
  showCostValues?: boolean
}>(), {
  burden: undefined,
  compact: false,
  readOnly: false,
  employeeHeaderLocked: true,
  showEmployeeWage: true,
  showCostValues: true,
})

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const dayLabels = TIMECARD_VISIBLE_DAY_LABELS
const visibleDayIndexes = TIMECARD_VISIBLE_DAY_INDEXES
const visibleLineRowKinds = computed(() => (
  props.showCostValues ? lineRowKinds : lineRowKinds.filter((row) => row.key !== 'cost')
))

const visibleHoursByDay = computed(() => visibleDayIndexes.map((dayIndex) => Number(props.card.totals.hoursByDay[dayIndex] ?? 0)))
const visibleProductionByDay = computed(() => visibleDayIndexes.map((dayIndex) => Number(props.card.totals.productionByDay[dayIndex] ?? 0)))
const hoursBreakdown = computed(() => calculateRegularAndOvertimeHours(
  props.card.totals.hoursTotal,
  props.card.regularHoursOverride,
  props.card.overtimeHoursOverride,
))
const numericDrafts = reactive<Record<string, string>>({})
const pendingMouseSelectInputs = new WeakSet<NavigableInputElement>()

function hasNumericDraft(key: string) {
  return Object.prototype.hasOwnProperty.call(numericDrafts, key)
}

function getNumericFieldValue(key: string, fallback: string) {
  return hasNumericDraft(key) ? (numericDrafts[key] ?? '') : fallback
}

function clearNumericDraft(key: string) {
  delete numericDrafts[key]
}

function filterWageKey(event: KeyboardEvent) {
  const key = event.key
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (/^[0-9]$/.test(key) || key === '.' || key === ',') return
  if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab', 'Enter', 'Escape'].includes(key)) return
  event.preventDefault()
}

function lineOffDraftKey(lineIndex: number, field: LineOffField) {
  return `line:${lineIndex}:off:${field}`
}

function lineDayDraftKey(lineIndex: number, dayIndex: number, field: LineDayField) {
  return `line:${lineIndex}:day:${dayIndex}:${field}`
}

function lineRowStart(lineIndex: number) {
  return lineIndex * visibleLineRowKinds.value.length
}

function lineRowEnd(lineIndex: number) {
  return lineRowStart(lineIndex) + visibleLineRowKinds.value.length - 1
}

function lineRowPosition(lineIndex: number, rowKindIndex: number) {
  return lineRowStart(lineIndex) + rowKindIndex
}

function lineHoursTotal(lineIndex: number) {
  return getTimecardLineHoursTotal(props.card.lines[lineIndex])
}

function lineDiffValue(lineIndex: number, rowKind: LineRowKind) {
  return getTimecardLineDiffValue(props.card.lines[lineIndex], rowKind)
}

function lineDayValue(lineIndex: number, rowKind: LineRowKind, dayIndex: number) {
  const line = props.card.lines[lineIndex]
  const day = line?.days[dayIndex]
  if (!line || !day) return ''
  if (rowKind === 'hours') {
    return getNumericFieldValue(lineDayDraftKey(lineIndex, dayIndex, 'hours'), getTimecardLineDayDisplayValue(line, rowKind, dayIndex))
  }
  if (rowKind === 'production') {
    return getNumericFieldValue(lineDayDraftKey(lineIndex, dayIndex, 'production'), getTimecardLineDayDisplayValue(line, rowKind, dayIndex))
  }
  return getNumericFieldValue(
    lineDayDraftKey(lineIndex, dayIndex, 'unitCostOverride'),
    getTimecardLineDayDisplayValue(line, rowKind, dayIndex),
  )
}

function getLineDayField(rowKind: LineRowKind): LineDayField {
  if (rowKind === 'hours') return 'hours'
  if (rowKind === 'production') return 'production'
  return 'unitCostOverride'
}

function lineProductionValue(lineIndex: number, rowKind: LineRowKind) {
  return getTimecardLineProductionDisplayValue(props.card.lines[lineIndex], rowKind, props.card.wageRate, props.burden, true)
}

function lineOffValue(lineIndex: number, rowKind: LineRowKind) {
  const line = props.card.lines[lineIndex]
  if (!line) return ''
  if (rowKind === 'hours') {
    return getNumericFieldValue(lineOffDraftKey(lineIndex, 'offHours'), getTimecardLineOffDisplayValue(line, rowKind))
  }
  if (rowKind === 'production') {
    return getNumericFieldValue(lineOffDraftKey(lineIndex, 'offProduction'), getTimecardLineOffDisplayValue(line, rowKind))
  }
  return getNumericFieldValue(lineOffDraftKey(lineIndex, 'offCost'), getTimecardLineOffDisplayValue(line, rowKind))
}

function getLineOffField(rowKind: LineRowKind): LineOffField {
  if (rowKind === 'hours') return 'offHours'
  if (rowKind === 'production') return 'offProduction'
  return 'offCost'
}

function setCardField(
  field:
    | 'firstName'
    | 'lastName'
    | 'employeeNumber'
    | 'occupation'
    | 'wageRate'
    | 'notes'
    | 'footerJobOrGl'
    | 'footerAccount'
    | 'footerOffice'
    | 'footerAmount'
    | 'footerSecondJobOrGl'
    | 'footerSecondAccount'
    | 'footerSecondOffice'
    | 'footerSecondAmount',
  value: string,
) {
  if (field === 'wageRate') {
    props.card.wageRate = parseNullableNumber(value)
  } else if (field === 'notes' || field.startsWith('footer')) {
    props.card[field] = value
  } else {
    props.card[field] = value
    props.card.fullName = buildCardDisplayName(props.card)
  }
  emit('changed')
}

function setWageRateField(value: string) {
  const sanitized = sanitizeWageInputValue(value)
  numericDrafts['card:wageRate'] = sanitized
  const parsed = parseNumericDraft(sanitized)

  if (parsed.kind === 'empty') {
    if (props.card.wageRate == null) return
    props.card.wageRate = null
    emit('changed')
    return
  }

  if (parsed.kind !== 'value' || Object.is(props.card.wageRate, parsed.value)) return
  props.card.wageRate = parsed.value
  emit('changed')
}

function commitWageRateField() {
  if (!hasNumericDraft('card:wageRate')) return
  const draft = sanitizeWageInputValue(numericDrafts['card:wageRate'] ?? '')
  clearNumericDraft('card:wageRate')

  const parsed = parseNumericDraft(draft)
  if (parsed.kind === 'value') {
    if (!Object.is(props.card.wageRate, parsed.value)) {
      props.card.wageRate = parsed.value
      emit('changed')
    }
    return
  }

  const normalized = draft.trim().replace(/[$,]/g, '')
  const fallback = Number(normalized)
  if (parsed.kind === 'incomplete' && Number.isFinite(fallback) && normalized !== '.' && normalized !== '') {
    const value = Math.max(0, fallback)
    if (!Object.is(props.card.wageRate, value)) {
      props.card.wageRate = value
      emit('changed')
    }
    return
  }

  if (props.card.wageRate == null) return
  props.card.wageRate = null
  emit('changed')
}

function cascadeLineFieldValue(
  lineIndex: number,
  field: 'jobNumber',
  previousValue: string,
  nextValue: string,
) {
  for (let nextIndex = lineIndex + 1; nextIndex < props.card.lines.length; nextIndex += 1) {
    const nextLine = props.card.lines[nextIndex]
    if (!nextLine) break
    if (nextLine[field] !== previousValue && nextLine[field].trim() !== '') break
    nextLine[field] = nextValue
  }
}

function setLineField(lineIndex: number, field: 'jobNumber' | 'subsectionArea' | 'account' | 'difH' | 'difP' | 'difC', value: string) {
  const line = props.card.lines[lineIndex]
  if (!line) return
  const previousValue = line[field]
  if (previousValue === value) return
  line[field] = value
  if (field === 'jobNumber') {
    cascadeLineFieldValue(lineIndex, field, previousValue, value)
  }
  emit('changed')
}

function setOffField(lineIndex: number, field: 'offHours' | 'offProduction' | 'offCost', value: string) {
  const line = props.card.lines[lineIndex]
  if (!line) return
  const key = lineOffDraftKey(lineIndex, field)
  numericDrafts[key] = value

  const parsed = parseNumericDraft(value)
  if (parsed.kind === 'empty') {
    if (line[field] === 0) return
    line[field] = 0
    emit('changed')
    return
  }

  if (parsed.kind !== 'value' || Object.is(line[field], parsed.value)) return
  line[field] = parsed.value
  emit('changed')
}

function commitOffField(lineIndex: number, field: LineOffField) {
  const line = props.card.lines[lineIndex]
  if (!line) return

  const key = lineOffDraftKey(lineIndex, field)
  if (!hasNumericDraft(key)) return
  const draft = numericDrafts[key] ?? ''
  clearNumericDraft(key)

  const parsed = parseNumericDraft(draft)
  if (parsed.kind === 'empty') {
    if (line[field] === 0) return
    line[field] = 0
    emit('changed')
    return
  }

  if (parsed.kind !== 'value' || Object.is(line[field], parsed.value)) return
  line[field] = parsed.value
  emit('changed')
}

function setDayField(
  lineIndex: number,
  dayIndex: number,
  field: 'hours' | 'production' | 'unitCostOverride',
  value: string,
) {
  const line = props.card.lines[lineIndex]
  const day = line?.days[dayIndex]
  if (!line || !day) return
  const key = lineDayDraftKey(lineIndex, dayIndex, field)
  numericDrafts[key] = value
  const parsed = parseNumericDraft(value)

  if (field === 'unitCostOverride') {
    const currentValue = day.unitCostOverride ?? null
    if (parsed.kind === 'empty') {
      if (currentValue == null) return
      day.unitCostOverride = null
      emit('changed')
      return
    }

    if (parsed.kind !== 'value' || Object.is(currentValue, parsed.value)) return
    day.unitCostOverride = parsed.value
    emit('changed')
    return
  }

  if (parsed.kind === 'empty') {
    if (day[field] === 0) return
    day[field] = 0
    emit('changed')
    return
  }

  if (parsed.kind !== 'value' || Object.is(day[field], parsed.value)) return
  day[field] = parsed.value
  emit('changed')
}

function commitDayField(lineIndex: number, dayIndex: number, field: LineDayField) {
  const line = props.card.lines[lineIndex]
  const day = line?.days[dayIndex]
  if (!line || !day) return

  const key = lineDayDraftKey(lineIndex, dayIndex, field)
  if (!hasNumericDraft(key)) return
  const draft = numericDrafts[key] ?? ''
  clearNumericDraft(key)

  const parsed = parseNumericDraft(draft)
  if (field === 'unitCostOverride') {
    const currentValue = day.unitCostOverride ?? null
    if (parsed.kind === 'empty') {
      if (currentValue == null) return
      day.unitCostOverride = null
      emit('changed')
      return
    }

    if (parsed.kind !== 'value' || Object.is(currentValue, parsed.value)) return
    day.unitCostOverride = parsed.value
    emit('changed')
    return
  }

  if (parsed.kind === 'empty') {
    if (day[field] === 0) return
    day[field] = 0
    emit('changed')
    return
  }

  if (parsed.kind !== 'value' || Object.is(day[field], parsed.value)) return
  day[field] = parsed.value
  emit('changed')
}

function handleSheetMouseDown(event: MouseEvent) {
  if (props.readOnly || event.button !== 0 || !isNavigableInput(event.target)) return
  pendingMouseSelectInputs.add(event.target)
}

function handleSheetMouseUp(event: MouseEvent) {
  if (!isNavigableInput(event.target) || !pendingMouseSelectInputs.has(event.target)) return
  pendingMouseSelectInputs.delete(event.target)
  if (props.readOnly) return
  if (event.cancelable) {
    event.preventDefault()
  }
  focusAndSelectInput(event.target)
}

function handleSheetFocusIn(event: FocusEvent) {
  if (props.readOnly || !isNavigableInput(event.target)) return
  focusAndSelectInput(event.target)
}

function handleSheetKeydown(event: KeyboardEvent) {
  if (props.readOnly || event.ctrlKey || event.metaKey || event.altKey || !isNavigableInput(event.target)) return

  const direction = getNavigationDirection(event.key)
  if (!direction) return

  if ((direction === 'left' || direction === 'right') && !shouldUseHorizontalNavigation(event.target, direction)) {
    return
  }

  const nextInput = findNextGridInput(event.target, direction) ?? findNextInputByGeometry(event.target, direction)
  if (!nextInput) return

  event.preventDefault()
  focusAndSelectInput(nextInput)
}
</script>

<template>
  <div class="timecard-card">
    <div
      class="timecard-card__sheet"
      @focusin.capture="handleSheetFocusIn"
      @keydown.capture="handleSheetKeydown"
      @mousedown.capture="handleSheetMouseDown"
      @mouseup.capture="handleSheetMouseUp"
    >
      <TimecardWorkbookHeader
        :card="card"
        :week-end-date="weekEndDate"
        :read-only="readOnly"
        :employee-header-locked="employeeHeaderLocked"
        :show-employee-wage="showEmployeeWage"
        :wage-input-value="getNumericFieldValue('card:wageRate', card.wageRate == null ? '' : (formatCurrency(card.wageRate) ?? ''))"
        @update-field="setCardField"
        @update-wage="setWageRateField"
        @commit-wage="commitWageRateField"
        @filter-wage-key="filterWageKey"
      />

      <template v-if="!compact">
        <div class="timecard-card__header-gap" aria-hidden="true"></div>

        <div class="timecard-card__table-wrap">
          <table class="timecard-grid">
            <colgroup>
              <col class="timecard-grid__col timecard-grid__col--a" />
              <col class="timecard-grid__col timecard-grid__col--b" />
              <col class="timecard-grid__col timecard-grid__col--c" />
              <col class="timecard-grid__col timecard-grid__col--d" />
              <col class="timecard-grid__col timecard-grid__col--e" />
              <col class="timecard-grid__col timecard-grid__col--f" />
              <col class="timecard-grid__col timecard-grid__col--g" />
              <col class="timecard-grid__col timecard-grid__col--h" />
              <col class="timecard-grid__col timecard-grid__col--i" />
              <col class="timecard-grid__col timecard-grid__col--j" />
              <col class="timecard-grid__col timecard-grid__col--k" />
              <col class="timecard-grid__col timecard-grid__col--l" />
              <col class="timecard-grid__col timecard-grid__col--m" />
              <col class="timecard-grid__col timecard-grid__col--n" />
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
                  class="timecard-grid__day-header"
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
                  v-for="(rowKind, rowKindIndex) in visibleLineRowKinds"
                  :key="`${lineIndex}-${rowKind.key}`"
                  class="timecard-grid__body-row"
                  :class="`timecard-grid__body-row--${rowKind.key}`"
                >
                  <td v-if="rowKindIndex === 0" :rowspan="visibleLineRowKinds.length" class="timecard-grid__rowspan-cell">
                    <input
                      class="timecard-grid__input"
                      :data-testid="`timecard-job-number-${lineIndex}`"
                      :data-nav-row-start="lineRowStart(lineIndex)"
                      :data-nav-row-end="lineRowEnd(lineIndex)"
                      data-nav-col="0"
                      :disabled="readOnly"
                      :value="line.jobNumber"
                      type="text"
                      @input="setLineField(lineIndex, 'jobNumber', readInputValue($event))"
                    />
                  </td>
                  <td v-if="rowKindIndex === 0" :rowspan="visibleLineRowKinds.length" class="timecard-grid__rowspan-cell">
                    <input
                      class="timecard-grid__input"
                      :data-nav-row-start="lineRowStart(lineIndex)"
                      :data-nav-row-end="lineRowEnd(lineIndex)"
                      data-nav-col="1"
                      :disabled="readOnly"
                      :value="line.subsectionArea"
                      type="text"
                      @input="setLineField(lineIndex, 'subsectionArea', readInputValue($event))"
                    />
                  </td>
                  <td class="timecard-grid__label-cell" :data-testid="`timecard-row-label-${lineIndex}-${rowKind.key}`">{{ rowKind.label }}</td>
                  <td v-if="rowKindIndex === 0" :rowspan="visibleLineRowKinds.length" class="timecard-grid__rowspan-cell">
                    <input
                      class="timecard-grid__input"
                      :data-testid="`timecard-account-${lineIndex}`"
                      :data-nav-row-start="lineRowStart(lineIndex)"
                      :data-nav-row-end="lineRowEnd(lineIndex)"
                      data-nav-col="2"
                      :disabled="readOnly"
                      :value="line.account"
                      type="text"
                      @input="setLineField(lineIndex, 'account', readInputValue($event))"
                    />
                  </td>
                  <td class="timecard-grid__diff-cell">
                    <input
                      class="timecard-grid__input"
                      :data-nav-row-start="lineRowPosition(lineIndex, rowKindIndex)"
                      :data-nav-row-end="lineRowPosition(lineIndex, rowKindIndex)"
                      data-nav-col="3"
                      :disabled="readOnly"
                      :value="lineDiffValue(lineIndex, rowKind.key)"
                      type="text"
                      @input="setLineField(lineIndex, rowKind.diffField, readInputValue($event))"
                    />
                  </td>

                  <td
                    v-for="(dayIndex, dayOffset) in visibleDayIndexes"
                    :key="dayIndex"
                    class="timecard-grid__day-cell"
                    :class="{
                      'timecard-grid__day-cell--dotted': dayOffset < visibleDayIndexes.length - 1,
                      'timecard-grid__day-cell--no-left': dayOffset > 0,
                    }"
                  >
                    <input
                      class="timecard-grid__input"
                      :data-nav-row-start="lineRowPosition(lineIndex, rowKindIndex)"
                      :data-nav-row-end="lineRowPosition(lineIndex, rowKindIndex)"
                      :data-nav-col="4 + dayOffset"
                      :disabled="readOnly"
                      :value="lineDayValue(lineIndex, rowKind.key, dayIndex)"
                      type="text"
                      inputmode="decimal"
                      @input="setDayField(
                        lineIndex,
                        dayIndex,
                        getLineDayField(rowKind.key),
                        readInputValue($event),
                      )"
                      @blur="commitDayField(
                        lineIndex,
                        dayIndex,
                        getLineDayField(rowKind.key),
                      )"
                    />
                  </td>

                  <td
                    v-if="rowKindIndex === 0"
                    :rowspan="visibleLineRowKinds.length"
                    class="timecard-grid__rowspan-cell timecard-grid__rowspan-cell--summary"
                  >
                    {{ formatHours(lineHoursTotal(lineIndex)) }}
                  </td>

                  <td class="timecard-grid__prod-cell">
                    {{ lineProductionValue(lineIndex, rowKind.key) }}
                  </td>
                  <td class="timecard-grid__off-cell">
                    <input
                      class="timecard-grid__input"
                      :data-nav-row-start="lineRowPosition(lineIndex, rowKindIndex)"
                      :data-nav-row-end="lineRowPosition(lineIndex, rowKindIndex)"
                      data-nav-col="11"
                      :disabled="readOnly"
                      :value="lineOffValue(lineIndex, rowKind.key)"
                      type="text"
                      inputmode="decimal"
                      @input="setOffField(
                        lineIndex,
                        getLineOffField(rowKind.key),
                        readInputValue($event),
                      )"
                      @blur="commitOffField(
                        lineIndex,
                        getLineOffField(rowKind.key),
                      )"
                    />
                  </td>
                </tr>
              </template>

              <tr class="timecard-grid__total-row">
                <td colspan="5" class="timecard-grid__total-label">TOTAL HOURS</td>
                <td
                  v-for="(value, index) in visibleHoursByDay"
                  :key="`hours-${index}`"
                  :data-testid="`timecard-total-hours-day-${index}`"
                  class="timecard-grid__total-day"
                >
                  {{ formatHours(value) }}
                </td>
                <td data-testid="timecard-total-hours">{{ formatHours(card.totals.hoursTotal) }}</td>
                <td></td>
                <td></td>
              </tr>

            </tbody>
          </table>
        </div>

        <TimecardWorkbookFooter
          :card="card"
          :read-only="readOnly"
          :overtime-hours="hoursBreakdown.overtimeHours"
          :regular-hours="hoursBreakdown.regularHours"
          @update-field="setCardField"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.timecard-card {
  width: 34rem;
  max-width: none;
  overflow: visible;
}

.timecard-card__sheet {
  position: relative;
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 0;
  background: #fff;
  color: #111;
  box-shadow: inset 0 0 0 2px #111;
  box-sizing: border-box;
  overflow: hidden;
  font-variant-numeric: tabular-nums lining-nums;
  --timecard-table-row-scale: 0.929;
  --timecard-total-row-scale: 0.86;
  --timecard-column-template:
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

.timecard-card__header-gap {
  height: 9.8pt;
}

.timecard-grid__input {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  outline: none;
  caret-color: #111;
}

.timecard-grid__input:focus {
  background: rgba(255, 245, 196, 0.48);
  box-shadow: inset 0 -1px 0 rgba(146, 117, 24, 0.5);
}

.timecard-grid__input:disabled {
  color: inherit;
  -webkit-text-fill-color: currentColor;
  opacity: 1;
}

.timecard-card__table-wrap {
  overflow: hidden;
}

.timecard-grid {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.59rem;
}

.timecard-grid__col--a,
.timecard-grid__col--f,
.timecard-grid__col--g,
.timecard-grid__col--h,
.timecard-grid__col--i,
.timecard-grid__col--j,
.timecard-grid__col--k {
  width: 7.33%;
}

.timecard-grid__col--b,
.timecard-grid__col--c {
  width: 3.49%;
}

.timecard-grid__col--d {
  width: 8.96%;
}

.timecard-grid__col--e {
  width: 4.35%;
}

.timecard-grid__col--l,
.timecard-grid__col--m,
.timecard-grid__col--n {
  width: 9.46%;
}

.timecard-grid th,
.timecard-grid td {
  border: 1px solid #111;
  color: #111;
  padding: 0;
  text-align: center;
  vertical-align: middle;
  line-height: 1;
}

.timecard-grid th {
  height: calc(13.079pt * var(--timecard-table-row-scale));
  padding: 0.02rem 0.03rem 0;
  font-size: 0.52rem;
  font-style: italic;
  font-weight: 400;
  line-height: 1;
}

.timecard-grid__merged-cell {
  padding: 0;
}

.timecard-grid__body-row td {
  height: 0.84rem;
}

.timecard-grid__body-row--hours .timecard-grid__rowspan-cell,
.timecard-grid__body-row--hours .timecard-grid__label-cell,
.timecard-grid__body-row--hours .timecard-grid__diff-cell,
.timecard-grid__body-row--hours .timecard-grid__day-cell,
.timecard-grid__body-row--hours .timecard-grid__prod-cell,
.timecard-grid__body-row--hours .timecard-grid__off-cell {
  border-top-width: 1.5px;
}

.timecard-grid__body-row--hours .timecard-grid__diff-cell,
.timecard-grid__body-row--hours .timecard-grid__day-cell,
.timecard-grid__body-row--hours .timecard-grid__prod-cell,
.timecard-grid__body-row--hours .timecard-grid__off-cell {
  border-bottom: 0;
}

.timecard-grid__body-row--production .timecard-grid__diff-cell,
.timecard-grid__body-row--production .timecard-grid__day-cell,
.timecard-grid__body-row--production .timecard-grid__prod-cell,
.timecard-grid__body-row--production .timecard-grid__off-cell {
  border-top: 0;
  border-bottom: 0;
}

.timecard-grid__body-row--cost .timecard-grid__diff-cell,
.timecard-grid__body-row--cost .timecard-grid__day-cell,
.timecard-grid__body-row--cost .timecard-grid__prod-cell,
.timecard-grid__body-row--cost .timecard-grid__off-cell {
  border-top: 0;
}

.timecard-grid__body-row--hours .timecard-grid__label-cell {
  border-bottom: 0;
}

.timecard-grid__body-row--cost .timecard-grid__label-cell {
  border-top: 0;
}

.timecard-grid__label-cell,
.timecard-grid__diff-cell,
.timecard-grid__day-cell,
.timecard-grid__prod-cell,
.timecard-grid__off-cell,
.timecard-grid__rowspan-cell {
  padding: 0;
}

.timecard-grid__day-cell {
  position: relative;
}

.timecard-grid__day-cell--dotted::after,
.timecard-grid__total-day.timecard-grid__day-cell--dotted::after {
  content: '';
  position: absolute;
  top: 0;
  right: -1px;
  bottom: 0;
  width: 1px;
  background-image: repeating-linear-gradient(
    to bottom,
    #111 0 1px,
    transparent 1px 3px
  );
  pointer-events: none;
}

.timecard-grid__rowspan-cell {
  vertical-align: middle;
  border-bottom-width: 1px;
}

.timecard-grid__rowspan-cell .timecard-grid__input {
  display: block;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
}

.timecard-grid__rowspan-cell--summary {
  vertical-align: top;
  font-weight: 700;
  padding-top: 0.05rem;
  font-size: 0.54rem;
}

.timecard-grid__label-cell {
  font-weight: 700;
}

.timecard-grid__day-cell--dotted {
  border-right-style: dotted;
}

.timecard-grid__day-cell--no-left {
  border-left: 0;
}

.timecard-grid__input {
  min-height: 0.84rem;
  padding: 0.01rem 0.04rem;
  text-align: center;
  font-size: 0.52rem;
  font-weight: 700;
  font-family: 'Times New Roman', Times, serif;
}

.timecard-grid__total-row td {
  height: calc(18.614pt * var(--timecard-total-row-scale));
  padding: 0.03rem 0.08rem;
  font-family: 'Times New Roman', Times, serif;
  font-size: 0.63rem;
  font-weight: 700;
  border-top-width: 1.5px;
  border-bottom-width: 1.5px;
}

.timecard-grid__total-label {
  text-align: right !important;
  padding-right: 0.24rem !important;
}

</style>
