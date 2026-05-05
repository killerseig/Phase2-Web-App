<script setup lang="ts">
import { computed, reactive } from 'vue'
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
const lineRowKinds = [
  { key: 'hours', label: 'H', diffField: 'difH' },
  { key: 'production', label: 'P', diffField: 'difP' },
  { key: 'cost', label: 'C', diffField: 'difC' },
] as const
const visibleLineRowKinds = computed(() => (
  props.showCostValues ? lineRowKinds : lineRowKinds.filter((row) => row.key !== 'cost')
))

type LineRowKind = (typeof lineRowKinds)[number]['key']
type LineOffField = 'offHours' | 'offProduction' | 'offCost'
type LineDayField = 'hours' | 'production' | 'unitCostOverride'
type NumericDraftResult =
  | { kind: 'empty' }
  | { kind: 'incomplete' }
  | { kind: 'invalid' }
  | { kind: 'value'; value: number }

const visibleHoursByDay = computed(() => visibleDayIndexes.map((dayIndex) => Number(props.card.totals.hoursByDay[dayIndex] ?? 0)))
const visibleProductionByDay = computed(() => visibleDayIndexes.map((dayIndex) => Number(props.card.totals.productionByDay[dayIndex] ?? 0)))
const hoursBreakdown = computed(() => calculateRegularAndOvertimeHours(
  props.card.totals.hoursTotal,
  props.card.regularHoursOverride,
  props.card.overtimeHoursOverride,
))
const numericDrafts = reactive<Record<string, string>>({})

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

function formatMaskedWage() {
  return '----'
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

function parseNumber(value: string) {
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return Math.max(0, parsed)
}

function parseNullableNumber(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null
  return Math.max(0, parsed)
}

function hasNumericDraft(key: string) {
  return Object.prototype.hasOwnProperty.call(numericDrafts, key)
}

function getNumericFieldValue(key: string, fallback: string) {
  return hasNumericDraft(key) ? numericDrafts[key] : fallback
}

function clearNumericDraft(key: string) {
  delete numericDrafts[key]
}

function parseNumericDraft(value: string): NumericDraftResult {
  const trimmed = value.trim()
  if (!trimmed) return { kind: 'empty' }
  if (trimmed === '.' || /^\d+\.$/.test(trimmed)) return { kind: 'incomplete' }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return { kind: 'invalid' }

  return {
    kind: 'value',
    value: Math.max(0, parsed),
  }
}

function lineOffDraftKey(lineIndex: number, field: LineOffField) {
  return `line:${lineIndex}:off:${field}`
}

function lineDayDraftKey(lineIndex: number, dayIndex: number, field: LineDayField) {
  return `line:${lineIndex}:day:${dayIndex}:${field}`
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
  if (rowKind === 'hours') {
    return getNumericFieldValue(lineDayDraftKey(lineIndex, dayIndex, 'hours'), formatFixedNumber(day.hours, 2, true))
  }
  if (rowKind === 'production') {
    return getNumericFieldValue(lineDayDraftKey(lineIndex, dayIndex, 'production'), formatFixedNumber(day.production, 2, true))
  }
  return getNumericFieldValue(
    lineDayDraftKey(lineIndex, dayIndex, 'unitCostOverride'),
    formatFixedNumber(day.unitCostOverride ?? day.unitCost, 2, true),
  )
}

function lineProductionValue(lineIndex: number, rowKind: LineRowKind) {
  if (rowKind === 'hours') return ''
  if (rowKind === 'production') return formatTrimmedNumber(lineProductionTotal(lineIndex), 3, true)
  return formatFixedNumber(lineSummaryCost(lineIndex), 3, true)
}

function lineOffValue(lineIndex: number, rowKind: LineRowKind) {
  const line = props.card.lines[lineIndex]
  if (!line) return ''
  if (rowKind === 'hours') {
    return getNumericFieldValue(lineOffDraftKey(lineIndex, 'offHours'), formatTrimmedNumber(line.offHours, 2, true))
  }
  if (rowKind === 'production') {
    return getNumericFieldValue(lineOffDraftKey(lineIndex, 'offProduction'), formatTrimmedNumber(line.offProduction, 2, true))
  }
  return getNumericFieldValue(lineOffDraftKey(lineIndex, 'offCost'), formatTrimmedNumber(line.offCost, 2, true))
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
  numericDrafts['card:wageRate'] = value
  const parsed = parseNumericDraft(value)
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
  const draft = numericDrafts['card:wageRate'] ?? ''
  clearNumericDraft('card:wageRate')

  const parsed = parseNumericDraft(draft)
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

function cascadeLineFieldValue(
  lineIndex: number,
  field: 'jobNumber',
  previousValue: string,
  nextValue: string,
) {
  for (let nextIndex = lineIndex + 1; nextIndex < props.card.lines.length; nextIndex += 1) {
    const nextLine = props.card.lines[nextIndex]
    if (!nextLine) break
    if (nextLine[field] !== previousValue) break
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
</script>

<template>
  <div class="timecard-card">
    <div class="timecard-card__sheet">
      <div class="timecard-card__brand">PHASE 2 COMPANY</div>

      <div class="timecard-card__field-row timecard-card__field-row--name">
        <span class="timecard-card__field-label timecard-card__field-label--name">EMP. NAME:</span>
        <div v-if="employeeHeaderLocked" class="timecard-card__field-value timecard-card__field-value--name">
          {{ formatEmployeeHeaderName(card) }}
        </div>
        <div v-else class="timecard-card__field-value timecard-card__field-value--name timecard-card__field-value--split">
          <input
            class="timecard-card__inline-input"
            :disabled="readOnly"
            :value="card.lastName"
            type="text"
            placeholder="Last Name"
            @input="setCardField('lastName', ($event.target as HTMLInputElement).value)"
          />
          <input
            class="timecard-card__inline-input"
            :disabled="readOnly"
            :value="card.firstName"
            type="text"
            placeholder="First Name"
            @input="setCardField('firstName', ($event.target as HTMLInputElement).value)"
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
              @input="setCardField('employeeNumber', ($event.target as HTMLInputElement).value)"
            />
          </template>
        </div>
      </div>

      <div class="timecard-card__field-row timecard-card__field-row--occupation">
        <span class="timecard-card__field-label timecard-card__field-label--occupation">OCCUPATION:</span>
        <div
          class="timecard-card__field-value timecard-card__field-value--occupation"
        >
          <template v-if="employeeHeaderLocked">
            {{ card.occupation || '-' }}
          </template>
          <input
            v-else
            class="timecard-card__header-input"
            :disabled="readOnly"
            :value="card.occupation"
            type="text"
            @input="setCardField('occupation', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <span class="timecard-card__field-label timecard-card__field-label--wage">WAGE</span>
        <div class="timecard-card__field-value timecard-card__field-value--wage">
          <template v-if="showEmployeeWage">
            <template v-if="employeeHeaderLocked">
              {{ formatCurrency(card.wageRate) || '-' }}
            </template>
            <input
              v-else
              class="timecard-card__header-input timecard-card__header-input--center"
              :disabled="readOnly"
              :value="getNumericFieldValue('card:wageRate', card.wageRate == null ? '' : String(card.wageRate))"
              type="text"
              inputmode="decimal"
              @input="setWageRateField(($event.target as HTMLInputElement).value)"
              @blur="commitWageRateField"
            />
          </template>
          <template v-else>
            {{ formatMaskedWage() }}
          </template>
        </div>
      </div>

      <div class="timecard-card__field-row timecard-card__field-row--week-ending">
        <div class="timecard-card__field-filler"></div>
        <span class="timecard-card__field-label timecard-card__field-label--week-ending">WEEK ENDING</span>
        <div class="timecard-card__field-value timecard-card__field-value--week-ending">
          {{ formatWeekEnding(weekEndDate) }}
        </div>
      </div>

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
                      :disabled="readOnly"
                      :value="line.jobNumber"
                      type="text"
                      @input="setLineField(lineIndex, 'jobNumber', ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <td v-if="rowKindIndex === 0" :rowspan="visibleLineRowKinds.length" class="timecard-grid__rowspan-cell">
                    <input
                      class="timecard-grid__input"
                      :disabled="readOnly"
                      :value="line.subsectionArea"
                      type="text"
                      @input="setLineField(lineIndex, 'subsectionArea', ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <td class="timecard-grid__label-cell" :data-testid="`timecard-row-label-${lineIndex}-${rowKind.key}`">{{ rowKind.label }}</td>
                  <td v-if="rowKindIndex === 0" :rowspan="visibleLineRowKinds.length" class="timecard-grid__rowspan-cell">
                    <input
                      class="timecard-grid__input"
                      :disabled="readOnly"
                      :value="line.account"
                      type="text"
                      @input="setLineField(lineIndex, 'account', ($event.target as HTMLInputElement).value)"
                    />
                  </td>
                  <td class="timecard-grid__diff-cell">
                    <input
                      class="timecard-grid__input"
                      :disabled="readOnly"
                      :value="lineDiffValue(lineIndex, rowKind.key)"
                      type="text"
                      @input="setLineField(lineIndex, rowKind.diffField, ($event.target as HTMLInputElement).value)"
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
                      :disabled="readOnly"
                      :value="lineDayValue(lineIndex, rowKind.key, dayIndex)"
                      type="text"
                      inputmode="decimal"
                      @input="setDayField(
                        lineIndex,
                        dayIndex,
                        rowKind.key === 'hours'
                          ? 'hours'
                          : rowKind.key === 'production'
                            ? 'production'
                            : 'unitCostOverride',
                        ($event.target as HTMLInputElement).value,
                      )"
                      @blur="commitDayField(
                        lineIndex,
                        dayIndex,
                        rowKind.key === 'hours'
                          ? 'hours'
                          : rowKind.key === 'production'
                            ? 'production'
                            : 'unitCostOverride',
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
                      :disabled="readOnly"
                      :value="lineOffValue(lineIndex, rowKind.key)"
                      type="text"
                      inputmode="decimal"
                      @input="setOffField(
                        lineIndex,
                        rowKind.key === 'hours'
                          ? 'offHours'
                          : rowKind.key === 'production'
                            ? 'offProduction'
                            : 'offCost',
                        ($event.target as HTMLInputElement).value,
                      )"
                      @blur="commitOffField(
                        lineIndex,
                        rowKind.key === 'hours'
                          ? 'offHours'
                          : rowKind.key === 'production'
                            ? 'offProduction'
                            : 'offCost',
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
                  class="timecard-grid__total-day"
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

        <div class="timecard-card__footer-grid">
          <div class="timecard-card__footer-label timecard-card__footer-label--job">JOB or GL</div>
          <div class="timecard-card__footer-label timecard-card__footer-label--acct">ACCT</div>
          <div class="timecard-card__footer-label timecard-card__footer-label--office">OFFICE</div>
          <div class="timecard-card__footer-label timecard-card__footer-label--amt">AMT</div>
          <div class="timecard-card__footer-stat-label timecard-card__footer-stat-label--ot">OT</div>
          <div class="timecard-card__footer-stat-line timecard-card__footer-stat-line--ot">
            <span class="timecard-card__footer-stat-value">{{ formatTrimmedNumber(hoursBreakdown.overtimeHours, 1) }}</span>
          </div>
          <div class="timecard-card__footer-stat-label timecard-card__footer-stat-label--reg">REG</div>
          <div class="timecard-card__footer-stat-line timecard-card__footer-stat-line--reg">
            <span class="timecard-card__footer-stat-value">{{ formatTrimmedNumber(hoursBreakdown.regularHours, 1) }}</span>
          </div>

          <div class="timecard-card__footer-box timecard-card__footer-box--job">
            <input
              class="timecard-card__footer-input"
              :disabled="readOnly"
              :value="card.footerJobOrGl"
              type="text"
              @input="setCardField('footerJobOrGl', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="timecard-card__footer-box timecard-card__footer-box--acct">
            <input
              class="timecard-card__footer-input"
              :disabled="readOnly"
              :value="card.footerAccount"
              type="text"
              @input="setCardField('footerAccount', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="timecard-card__footer-box timecard-card__footer-box--office">
            <input
              class="timecard-card__footer-input"
              :disabled="readOnly"
              :value="card.footerOffice"
              type="text"
              @input="setCardField('footerOffice', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="timecard-card__footer-box timecard-card__footer-box--amount">
            <input
              class="timecard-card__footer-input"
              :disabled="readOnly"
              :value="card.footerAmount"
              type="text"
              @input="setCardField('footerAmount', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="timecard-card__footer-box timecard-card__footer-box--job-second">
            <input
              class="timecard-card__footer-input"
              :disabled="readOnly"
              :value="card.footerSecondJobOrGl"
              type="text"
              @input="setCardField('footerSecondJobOrGl', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="timecard-card__footer-box timecard-card__footer-box--acct-second">
            <input
              class="timecard-card__footer-input"
              :disabled="readOnly"
              :value="card.footerSecondAccount"
              type="text"
              @input="setCardField('footerSecondAccount', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="timecard-card__footer-box timecard-card__footer-box--office-second">
            <input
              class="timecard-card__footer-input"
              :disabled="readOnly"
              :value="card.footerSecondOffice"
              type="text"
              @input="setCardField('footerSecondOffice', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="timecard-card__footer-box timecard-card__footer-box--amount-second">
            <input
              class="timecard-card__footer-input"
              :disabled="readOnly"
              :value="card.footerSecondAmount"
              type="text"
              @input="setCardField('footerSecondAmount', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="timecard-card__notes-label">NOTES:</div>
          <div class="timecard-card__notes-line">
            <input
              class="timecard-card__notes-input"
              :disabled="readOnly"
              :value="card.notes"
              type="text"
              @input="setCardField('notes', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="timecard-card__footer-gap" aria-hidden="true"></div>
        </div>
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

.timecard-card__field-value--occupation-full {
  grid-column: 4 / 15;
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

.timecard-card__header-gap {
  height: 9.8pt;
}

.timecard-card__inline-input,
.timecard-card__header-input,
.timecard-card__footer-input,
.timecard-card__notes-input,
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

.timecard-card__inline-input,
.timecard-card__header-input {
  font-family: 'Times New Roman', Times, serif;
  font-size: inherit;
  font-weight: 700;
  line-height: 1;
}

.timecard-card__header-input--center {
  text-align: center;
}

.timecard-card__inline-input:focus,
.timecard-card__header-input:focus,
.timecard-card__footer-input:focus,
.timecard-card__notes-input:focus,
.timecard-grid__input:focus {
  background: rgba(255, 245, 196, 0.48);
  box-shadow: inset 0 -1px 0 rgba(146, 117, 24, 0.5);
}

.timecard-card__inline-input:disabled,
.timecard-card__header-input:disabled,
.timecard-card__footer-input:disabled,
.timecard-card__notes-input:disabled,
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
