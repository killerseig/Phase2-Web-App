<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseTableCellInput from '@/components/common/BaseTableCellInput.vue'
import type { DiffField, WorkbookFooterField, WorkbookOffField } from '@/types/timecards'
import { getTimecardOccupationOptions } from '@/constants/timecards'
import {
  calculateRegularAndOvertimeHours,
  type TimecardModel,
} from '@/utils/timecardUtils'
import {
  TIMECARD_WORKBOOK_DAY_INDEXES,
  TIMECARD_WORKBOOK_DAY_LABELS,
  buildWorkbookTimecardLines,
  calculateWorkbookSummaryCost,
  getWorkbookJobHoursTotal,
  getWorkbookJobProductionTotal,
  getWorkbookWeekHoursByDay,
  getWorkbookWeekHoursTotal,
} from '@/utils/timecardWorkbook'

defineOptions({
  name: 'TimecardWorkspaceCard',
})

const props = withDefaults(defineProps<{
  itemKey: string
  timecard: TimecardModel
  jobFieldsLocked: boolean
  notesLocked: boolean
  headerEditable?: boolean
  headerEmployeeName?: string
  headerEmployeeNumber?: string
  headerOccupation?: string
  headerEmployeeWage?: string
  fitToViewport?: boolean
}>(), {
  headerEditable: false,
  headerEmployeeName: undefined,
  headerEmployeeNumber: undefined,
  headerOccupation: undefined,
  headerEmployeeWage: undefined,
  fitToViewport: false,
})

const emit = defineEmits<{
  (e: 'update-employee-name', value: string): void
  (e: 'update-employee-number', value: string): void
  (e: 'update-occupation', value: string): void
  (e: 'update-employee-wage', value: string): void
  (e: 'update-job-number', payload: { jobIndex: number; value: string }): void
  (e: 'update-subsection-area', payload: { jobIndex: number; value: string }): void
  (e: 'update-account', payload: { jobIndex: number; value: string }): void
  (e: 'update-diff-value', payload: { jobIndex: number; field: DiffField; value: string }): void
  (e: 'update-off-value', payload: { jobIndex: number; field: WorkbookOffField; value: number }): void
  (e: 'update-hours', payload: { jobIndex: number; dayIndex: number; value: number }): void
  (e: 'update-production', payload: { jobIndex: number; dayIndex: number; value: number }): void
  (e: 'update-unit-cost', payload: { jobIndex: number; dayIndex: number; value: number | null }): void
  (e: 'update-footer-field', payload: { field: WorkbookFooterField; value: string }): void
  (e: 'update-notes', value: string): void
}>()

const workbookLines = computed(() => buildWorkbookTimecardLines(props.timecard))
const weekHoursByDay = computed(() => getWorkbookWeekHoursByDay(props.timecard))
const weekHoursTotal = computed(() => getWorkbookWeekHoursTotal(props.timecard))
const fitContainerRef = ref<HTMLElement | null>(null)
const fitSheetRef = ref<HTMLElement | null>(null)
const fitScale = ref(1)
const fitHeight = ref<number | null>(null)
const WORKBOOK_COLUMN_WIDTHS = ['11.5%', '5.5%', '4%', '9.5%', '5.5%', '6.5%', '6.5%', '6.5%', '6.5%', '6.5%', '6.5%', '8.5%', '8.5%', '8.5%'] as const
const lastWorkbookDayIndex = TIMECARD_WORKBOOK_DAY_INDEXES[TIMECARD_WORKBOOK_DAY_INDEXES.length - 1] ?? 6
const hoursBreakdown = computed(() => calculateRegularAndOvertimeHours(
  weekHoursTotal.value,
  props.timecard.regularHoursOverride ?? null,
  props.timecard.overtimeHoursOverride ?? null,
))
let resizeObserver: ResizeObserver | null = null

const fitContainerStyle = computed(() => (
  fitHeight.value == null
    ? undefined
    : { height: `${fitHeight.value}px` }
))

const fitSheetStyle = computed(() => ({
  transform: `scale(${fitScale.value})`,
}))

const resolvedHeaderEmployeeName = computed(() => (
  props.headerEmployeeName ?? props.timecard.employeeName ?? ''
))
const resolvedHeaderEmployeeNumber = computed(() => (
  props.headerEmployeeNumber ?? props.timecard.employeeNumber ?? ''
))
const resolvedHeaderOccupation = computed(() => (
  props.headerOccupation ?? props.timecard.occupation ?? ''
))
const resolvedHeaderOccupationOptions = computed(() => (
  getTimecardOccupationOptions(resolvedHeaderOccupation.value || props.timecard.occupation)
))
const resolvedHeaderEmployeeWage = computed(() => {
  if (props.headerEmployeeWage != null) return props.headerEmployeeWage
  if (props.timecard.employeeWage == null || Number.isNaN(Number(props.timecard.employeeWage))) return ''
  return String(props.timecard.employeeWage)
})

function formatWeekEnding(value: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  const parsed = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return normalized
  return `${parsed.getUTCMonth() + 1}/${parsed.getUTCDate()}/${parsed.getUTCFullYear()}`
}

function formatWage(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return ''
  return `$${Number(value).toFixed(2)}`
}

function formatTrimmedNumber(value: number | null | undefined, decimals = 2, blankWhenZero = false): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return blankWhenZero ? '' : '0'
  if (blankWhenZero && numeric === 0) return ''
  return numeric.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function formatHoursCell(value: number | null | undefined, blankWhenZero = false): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return blankWhenZero ? '' : '0.0'
  if (blankWhenZero && numeric === 0) return ''
  return numeric.toFixed(1)
}

function formatWorkbookEntry(value: number | null | undefined, decimals = 2, blankWhenZero = true): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return blankWhenZero ? '' : (0).toFixed(decimals)
  if (blankWhenZero && numeric === 0) return ''
  return numeric.toFixed(decimals)
}

function formatCostCell(value: number | null | undefined, blankWhenZero = true): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return blankWhenZero ? '' : '0.00'
  if (blankWhenZero && numeric === 0) return ''
  return numeric.toFixed(2)
}

function formatSummaryCost(value: number | null | undefined): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric) || numeric === 0) return ''
  return numeric.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function parseNumericInput(value: string): number {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return 0
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return parsed
}

function parseNullableNumericInput(value: string): number | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null
  return parsed
}

function getDayHours(jobIndex: number, dayIndex: number): number {
  return Number(workbookLines.value[jobIndex]?.days?.[dayIndex]?.hours ?? 0)
}

function getDayProduction(jobIndex: number, dayIndex: number): number {
  return Number(workbookLines.value[jobIndex]?.days?.[dayIndex]?.production ?? 0)
}

function getDayCost(jobIndex: number, dayIndex: number): number {
  return Number(workbookLines.value[jobIndex]?.days?.[dayIndex]?.unitCost ?? 0)
}

function getLineHoursTotal(jobIndex: number): number {
  return getWorkbookJobHoursTotal(workbookLines.value[jobIndex])
}

function getLineProductionTotal(jobIndex: number): number {
  return getWorkbookJobProductionTotal(workbookLines.value[jobIndex])
}

function getLineSummaryCost(jobIndex: number): number {
  return calculateWorkbookSummaryCost(
    props.timecard.employeeWage,
    getLineHoursTotal(jobIndex),
    getLineProductionTotal(jobIndex),
    props.timecard.productionBurden,
  )
}

function getFooterValue(field: WorkbookFooterField): string {
  return String(props.timecard[field] ?? '')
}

function handleNotesInput(event: Event) {
  emit('update-notes', (event.target as HTMLTextAreaElement).value)
}

function updateFitScale() {
  const container = fitContainerRef.value
  const sheet = fitSheetRef.value
  if (!container || !sheet) return

  const naturalWidth = sheet.offsetWidth
  const naturalHeight = sheet.offsetHeight
  const availableWidth = container.clientWidth

  if (!naturalWidth || !naturalHeight || !availableWidth) {
    fitScale.value = 1
    fitHeight.value = null
    return
  }

  const availableHeight = props.fitToViewport
    ? Math.max(0, window.innerHeight - container.getBoundingClientRect().top - 16)
    : Number.POSITIVE_INFINITY
  const nextScale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight)
  fitScale.value = nextScale
  fitHeight.value = naturalHeight * nextScale
}

onMounted(async () => {
  await nextTick()
  updateFitScale()

  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', updateFitScale)
    return
  }

  resizeObserver = new ResizeObserver(() => {
    updateFitScale()
  })

  if (fitContainerRef.value) {
    resizeObserver.observe(fitContainerRef.value)
  }

  if (fitSheetRef.value) {
    resizeObserver.observe(fitSheetRef.value)
  }

  window.addEventListener('resize', updateFitScale)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', updateFitScale)
})

watch(
  () => [props.itemKey, props.fitToViewport],
  async () => {
    await nextTick()
    updateFitScale()
  },
)
</script>

<template>
  <div ref="fitContainerRef" class="timecard-workbook-fit" :style="fitContainerStyle">
    <div ref="fitSheetRef" class="timecard-workbook-fit__sheet" :style="fitSheetStyle">
      <BaseCard card-class="timecard-workbook-card" body-class="p-0">
        <div class="timecard-workbook-card__inner">
          <div class="timecard-workbook-card__brand">PHASE 2 COMPANY</div>

          <div class="timecard-workbook-card__field-row">
            <div class="timecard-workbook-card__field-main">
              <span class="timecard-workbook-card__field-label">EMP. NAME:</span>
              <template v-if="headerEditable">
                <BaseTableCellInput
                  type="text"
                  variant="ghost"
                  :model-value="resolvedHeaderEmployeeName"
                  input-class="timecard-workbook-card__header-input"
                  :aria-label="`Workbook employee name for ${itemKey}`"
                  @update:model-value="emit('update-employee-name', $event)"
                />
              </template>
              <span v-else class="timecard-workbook-card__field-value">
                {{ timecard.employeeName || 'Unnamed Employee' }}
              </span>
            </div>
            <div class="timecard-workbook-card__field-side">
              <span class="timecard-workbook-card__field-label">EMPLOYEE#</span>
              <template v-if="headerEditable">
                <BaseTableCellInput
                  type="text"
                  variant="ghost"
                  :model-value="resolvedHeaderEmployeeNumber"
                  input-class="timecard-workbook-card__header-input text-end"
                  :aria-label="`Workbook employee number for ${itemKey}`"
                  @update:model-value="emit('update-employee-number', $event)"
                />
              </template>
              <span v-else class="timecard-workbook-card__field-value">{{ timecard.employeeNumber || '-' }}</span>
            </div>
          </div>

          <div class="timecard-workbook-card__field-row">
            <div class="timecard-workbook-card__field-main">
              <span class="timecard-workbook-card__field-label">OCCUPATION:</span>
              <template v-if="headerEditable">
                <select
                  class="form-select form-select-sm timecard-workbook-card__header-select"
                  :aria-label="`Workbook occupation for ${itemKey}`"
                  :value="resolvedHeaderOccupation"
                  @change="emit('update-occupation', String(($event.target as HTMLSelectElement).value || ''))"
                >
                  <option value="">Select occupation</option>
                  <option
                    v-for="occupation in resolvedHeaderOccupationOptions"
                    :key="occupation"
                    :value="occupation"
                  >
                    {{ occupation }}
                  </option>
                </select>
              </template>
              <span v-else class="timecard-workbook-card__field-value">{{ timecard.occupation || '-' }}</span>
            </div>
            <div class="timecard-workbook-card__field-side">
              <span class="timecard-workbook-card__field-label">Wage</span>
              <template v-if="headerEditable">
                <BaseTableCellInput
                  type="text"
                  variant="ghost"
                  :model-value="resolvedHeaderEmployeeWage"
                  inputmode="decimal"
                  input-class="timecard-workbook-card__header-input text-end"
                  :aria-label="`Workbook wage for ${itemKey}`"
                  @update:model-value="emit('update-employee-wage', $event)"
                />
              </template>
              <span v-else class="timecard-workbook-card__field-value">{{ formatWage(timecard.employeeWage) || '-' }}</span>
            </div>
          </div>

          <div class="timecard-workbook-card__field-row timecard-workbook-card__field-row--week-ending">
            <div class="timecard-workbook-card__field-main timecard-workbook-card__field-main--blank">
              <span class="timecard-workbook-card__field-label">&nbsp;</span>
              <span class="timecard-workbook-card__field-value timecard-workbook-card__field-value--blank"></span>
            </div>
            <div class="timecard-workbook-card__field-side">
              <span class="timecard-workbook-card__field-label">WEEK ENDING</span>
              <span class="timecard-workbook-card__field-value">{{ formatWeekEnding(timecard.weekEndingDate) || '-' }}</span>
            </div>
          </div>

          <div class="table-responsive">
            <table class="table table-sm mb-0 timecard-workbook-grid">
              <colgroup>
                <col
                  v-for="(columnWidth, columnIndex) in WORKBOOK_COLUMN_WIDTHS"
                  :key="`workbook-col-${columnIndex}`"
                  :style="{ width: columnWidth }"
                />
              </colgroup>
              <thead>
                <tr>
                  <th>JOB #</th>
                  <th>1</th>
                  <th></th>
                  <th>ACCT</th>
                  <th>DIF</th>
                  <th
                    v-for="(dayLabel, index) in TIMECARD_WORKBOOK_DAY_LABELS"
                    :key="dayLabel"
                    :class="{ 'timecard-workbook-grid__dotted-right': index < TIMECARD_WORKBOOK_DAY_LABELS.length - 1 }"
                  >
                    {{ dayLabel }}
                  </th>
                  <th>TOTAL</th>
                  <th>PROD</th>
                  <th>OFF</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="(job, jobIdx) in workbookLines"
                  :key="`${itemKey}-line-${jobIdx}`"
                  class="timecard-workbook-grid__row"
                >
                  <td class="timecard-workbook-grid__input-cell timecard-workbook-grid__merged-cell">
                    <BaseTableCellInput
                      type="text"
                      variant="ghost"
                      :model-value="job.jobNumber || ''"
                      :disabled="jobFieldsLocked"
                      input-class="text-center timecard-workbook-grid__input"
                      :aria-label="`Workbook line ${jobIdx + 1} job number`"
                      @update:model-value="emit('update-job-number', { jobIndex: jobIdx, value: $event })"
                    />
                  </td>
                  <td class="timecard-workbook-grid__input-cell timecard-workbook-grid__merged-cell">
                    <BaseTableCellInput
                      type="text"
                      variant="ghost"
                      :model-value="job.subsectionArea ?? job.area ?? ''"
                      :disabled="jobFieldsLocked"
                      input-class="text-center timecard-workbook-grid__input"
                      :aria-label="`Workbook line ${jobIdx + 1} area`"
                      @update:model-value="emit('update-subsection-area', { jobIndex: jobIdx, value: $event })"
                    />
                  </td>
                  <td class="timecard-workbook-grid__stacked-label-cell">
                    <div class="timecard-workbook-grid__stacked-label">
                      <div class="timecard-workbook-grid__stacked-label-slot">H</div>
                      <div class="timecard-workbook-grid__stacked-label-slot">P</div>
                      <div class="timecard-workbook-grid__stacked-label-slot">C</div>
                    </div>
                  </td>
                  <td class="timecard-workbook-grid__input-cell timecard-workbook-grid__merged-cell">
                    <BaseTableCellInput
                      type="text"
                      variant="ghost"
                      :model-value="job.account ?? job.acct ?? ''"
                      :disabled="jobFieldsLocked"
                      input-class="text-center timecard-workbook-grid__input"
                      :aria-label="`Workbook line ${jobIdx + 1} account`"
                      @update:model-value="emit('update-account', { jobIndex: jobIdx, value: $event })"
                    />
                  </td>
                  <td class="timecard-workbook-grid__input-cell timecard-workbook-grid__stacked-group-cell">
                    <div class="timecard-workbook-grid__stacked-group">
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          type="text"
                          variant="ghost"
                          :model-value="job.difH || ''"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          :aria-label="`Workbook line ${jobIdx + 1} H diff`"
                          @update:model-value="emit('update-diff-value', { jobIndex: jobIdx, field: 'difH', value: $event })"
                        />
                      </div>
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          type="text"
                          variant="ghost"
                          :model-value="job.difP || ''"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          :aria-label="`Workbook line ${jobIdx + 1} P diff`"
                          @update:model-value="emit('update-diff-value', { jobIndex: jobIdx, field: 'difP', value: $event })"
                        />
                      </div>
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          type="text"
                          variant="ghost"
                          :model-value="job.difC || ''"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          :aria-label="`Workbook line ${jobIdx + 1} C diff`"
                          @update:model-value="emit('update-diff-value', { jobIndex: jobIdx, field: 'difC', value: $event })"
                        />
                      </div>
                    </div>
                  </td>
                  <td
                    v-for="dayIndex in TIMECARD_WORKBOOK_DAY_INDEXES"
                    :key="`stack-${jobIdx}-${dayIndex}`"
                    :class="[
                      'timecard-workbook-grid__input-cell',
                      'timecard-workbook-grid__stacked-group-cell',
                      dayIndex < lastWorkbookDayIndex
                        ? 'timecard-workbook-grid__dotted-right'
                        : null,
                    ]"
                  >
                    <div class="timecard-workbook-grid__stacked-group">
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          :model-value="formatWorkbookEntry(getDayHours(jobIdx, dayIndex))"
                          type="text"
                          variant="ghost"
                          inputmode="decimal"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          select-on-focus
                          :aria-label="`Workbook line ${jobIdx + 1} ${TIMECARD_WORKBOOK_DAY_LABELS[dayIndex - 1]} hours`"
                          @update:model-value="emit('update-hours', { jobIndex: jobIdx, dayIndex, value: parseNumericInput($event) })"
                        />
                      </div>
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          :model-value="formatWorkbookEntry(getDayProduction(jobIdx, dayIndex))"
                          type="text"
                          variant="ghost"
                          inputmode="decimal"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          select-on-focus
                          :aria-label="`Workbook line ${jobIdx + 1} ${TIMECARD_WORKBOOK_DAY_LABELS[dayIndex - 1]} production`"
                          @update:model-value="emit('update-production', { jobIndex: jobIdx, dayIndex, value: parseNumericInput($event) })"
                        />
                      </div>
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          :model-value="formatCostCell(getDayCost(jobIdx, dayIndex))"
                          type="text"
                          variant="ghost"
                          inputmode="decimal"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          select-on-focus
                          :aria-label="`Workbook line ${jobIdx + 1} ${TIMECARD_WORKBOOK_DAY_LABELS[dayIndex - 1]} cost`"
                          @update:model-value="emit('update-unit-cost', { jobIndex: jobIdx, dayIndex, value: parseNullableNumericInput($event) })"
                        />
                      </div>
                    </div>
                  </td>
                  <td class="timecard-workbook-grid__summary-cell timecard-workbook-grid__stacked-group-cell">
                    <div class="timecard-workbook-grid__stacked-group">
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        {{ formatHoursCell(getLineHoursTotal(jobIdx)) }}
                      </div>
                      <div class="timecard-workbook-grid__stacked-group-slot"></div>
                      <div class="timecard-workbook-grid__stacked-group-slot"></div>
                    </div>
                  </td>
                  <td class="timecard-workbook-grid__summary-cell timecard-workbook-grid__stacked-group-cell">
                    <div class="timecard-workbook-grid__stacked-group">
                      <div class="timecard-workbook-grid__stacked-group-slot"></div>
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        {{ formatTrimmedNumber(getLineProductionTotal(jobIdx), 3) }}
                      </div>
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        {{ formatSummaryCost(getLineSummaryCost(jobIdx)) }}
                      </div>
                    </div>
                  </td>
                  <td class="timecard-workbook-grid__input-cell timecard-workbook-grid__stacked-group-cell">
                    <div class="timecard-workbook-grid__stacked-group">
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          :model-value="formatWorkbookEntry(workbookLines[jobIdx]?.offHours, 2, true)"
                          type="text"
                          variant="ghost"
                          inputmode="decimal"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          select-on-focus
                          :aria-label="`Workbook line ${jobIdx + 1} off hours`"
                          @update:model-value="emit('update-off-value', { jobIndex: jobIdx, field: 'offHours', value: parseNumericInput($event) })"
                        />
                      </div>
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          :model-value="formatWorkbookEntry(workbookLines[jobIdx]?.offProduction, 2, true)"
                          type="text"
                          variant="ghost"
                          inputmode="decimal"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          select-on-focus
                          :aria-label="`Workbook line ${jobIdx + 1} off production`"
                          @update:model-value="emit('update-off-value', { jobIndex: jobIdx, field: 'offProduction', value: parseNumericInput($event) })"
                        />
                      </div>
                      <div class="timecard-workbook-grid__stacked-group-slot">
                        <BaseTableCellInput
                          :model-value="formatWorkbookEntry(workbookLines[jobIdx]?.offCost, 2, true)"
                          type="text"
                          variant="ghost"
                          inputmode="decimal"
                          :disabled="jobFieldsLocked"
                          input-class="text-center timecard-workbook-grid__input"
                          select-on-focus
                          :aria-label="`Workbook line ${jobIdx + 1} off cost`"
                          @update:model-value="emit('update-off-value', { jobIndex: jobIdx, field: 'offCost', value: parseNumericInput($event) })"
                        />
                      </div>
                    </div>
                  </td>
                </tr>

                <tr class="timecard-workbook-grid__totals-row">
                  <td colspan="5" class="timecard-workbook-grid__totals-label">TOTAL HOURS</td>
                  <td
                    v-for="(hoursTotal, index) in weekHoursByDay"
                    :key="`day-total-${index}`"
                    :class="[
                      'timecard-workbook-grid__summary-cell',
                      index < weekHoursByDay.length - 1 ? 'timecard-workbook-grid__dotted-right' : null,
                    ]"
                  >
                    {{ formatHoursCell(hoursTotal) }}
                  </td>
                  <td class="timecard-workbook-grid__summary-cell">{{ formatHoursCell(weekHoursTotal) }}</td>
                  <td class="timecard-workbook-grid__blank-cell"></td>
                  <td class="timecard-workbook-grid__blank-cell"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="timecard-workbook-card__footer">
            <div class="timecard-workbook-card__footer-grid">
              <div class="timecard-workbook-card__footer-label timecard-workbook-card__footer-label--job">JOB or GL</div>
              <div class="timecard-workbook-card__footer-label timecard-workbook-card__footer-label--account">ACCT</div>
              <div class="timecard-workbook-card__footer-label timecard-workbook-card__footer-label--office">OFFICE</div>
              <div class="timecard-workbook-card__footer-label timecard-workbook-card__footer-label--amount">AMT</div>

              <div class="timecard-workbook-card__footer-input timecard-workbook-card__footer-input--job">
                <BaseTableCellInput
                  type="text"
                  variant="ghost"
                  :model-value="getFooterValue('footerJobOrGl')"
                  :disabled="jobFieldsLocked"
                  input-class="text-center timecard-workbook-grid__input"
                  aria-label="Workbook footer job or GL"
                  @update:model-value="emit('update-footer-field', { field: 'footerJobOrGl', value: $event })"
                />
              </div>
              <div class="timecard-workbook-card__footer-input timecard-workbook-card__footer-input--account">
                <BaseTableCellInput
                  type="text"
                  variant="ghost"
                  :model-value="getFooterValue('footerAccount')"
                  :disabled="jobFieldsLocked"
                  input-class="text-center timecard-workbook-grid__input"
                  aria-label="Workbook footer account"
                  @update:model-value="emit('update-footer-field', { field: 'footerAccount', value: $event })"
                />
              </div>
              <div class="timecard-workbook-card__footer-input timecard-workbook-card__footer-input--office">
                <BaseTableCellInput
                  type="text"
                  variant="ghost"
                  :model-value="getFooterValue('footerOffice')"
                  :disabled="jobFieldsLocked"
                  input-class="text-center timecard-workbook-grid__input"
                  aria-label="Workbook footer office"
                  @update:model-value="emit('update-footer-field', { field: 'footerOffice', value: $event })"
                />
              </div>
              <div class="timecard-workbook-card__footer-input timecard-workbook-card__footer-input--amount">
                <BaseTableCellInput
                  type="text"
                  variant="ghost"
                  :model-value="getFooterValue('footerAmount')"
                  :disabled="jobFieldsLocked"
                  input-class="text-center timecard-workbook-grid__input"
                  aria-label="Workbook footer amount"
                  @update:model-value="emit('update-footer-field', { field: 'footerAmount', value: $event })"
                />
              </div>
              <div class="timecard-workbook-card__footer-input timecard-workbook-card__footer-input--job-secondary"></div>
              <div class="timecard-workbook-card__footer-input timecard-workbook-card__footer-input--account-secondary"></div>
              <div class="timecard-workbook-card__footer-input timecard-workbook-card__footer-input--office-secondary"></div>
              <div class="timecard-workbook-card__footer-input timecard-workbook-card__footer-input--amount-secondary"></div>

              <div class="timecard-workbook-card__footer-underlined-label-cell timecard-workbook-card__footer-underlined-label-cell--ot">
                OT
              </div>
              <div class="timecard-workbook-card__footer-underlined-value-cell timecard-workbook-card__footer-underlined-value-cell--ot">
                {{ formatHoursCell(hoursBreakdown.overtimeHours) }}
              </div>
              <div class="timecard-workbook-card__footer-underlined-label-cell timecard-workbook-card__footer-underlined-label-cell--reg">
                REG
              </div>
              <div class="timecard-workbook-card__footer-underlined-value-cell timecard-workbook-card__footer-underlined-value-cell--reg">
                {{ formatHoursCell(hoursBreakdown.regularHours) }}
              </div>
            </div>

            <div class="timecard-workbook-card__notes-row">
              <div class="timecard-workbook-card__notes-label">NOTES:</div>
              <div class="timecard-workbook-card__notes-line">
                <textarea
                  class="form-control form-control-sm timecard-workbook-card__notes-input"
                  :value="timecard.notes"
                  rows="1"
                  :disabled="notesLocked"
                  :aria-label="`Workbook notes for ${timecard.employeeName}`"
                  @input="handleNotesInput"
                />
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
