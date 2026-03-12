<script setup lang="ts">
import { computed, ref } from 'vue'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import Toast from '@/components/Toast.vue'
import { useAuthStore } from '@/stores/auth'
import { downloadTimecardsForWeek } from '@/services/Email'
import {
  formatWeekRange,
  getSaturdayFromSunday,
  snapToSunday,
} from '@/utils/modelValidation'

const auth = useAuthStore()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const displayName = computed(() => auth.user?.displayName || auth.user?.email || 'Controller')

const selectedDateInWeek = ref(getLastCompletedSaturday())

const selectedWeekStart = computed(() => {
  if (!isValidDateValue(selectedDateInWeek.value)) return ''
  return snapToSunday(selectedDateInWeek.value)
})

const selectedWeekEnding = computed(() => {
  if (!selectedWeekStart.value) return ''
  return getSaturdayFromSunday(selectedWeekStart.value)
})

const selectedWeekLabel = computed(() => {
  if (!selectedWeekStart.value || !selectedWeekEnding.value) return 'Invalid date'
  return formatWeekRange(selectedWeekStart.value, selectedWeekEnding.value)
})

const downloadingCsv = ref(false)
const downloadingPdf = ref(false)
const isDownloading = computed(() => downloadingCsv.value || downloadingPdf.value)

const weekPickerConfig = computed(() => ({
  dateFormat: 'Y-m-d',
  disableMobile: true,
  prevArrow: '<i class="bi bi-chevron-left"></i>',
  nextArrow: '<i class="bi bi-chevron-right"></i>',
  maxDate: getLastCompletedSaturday(),
}))

function formatErr(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message?: unknown }).message || err)
  return String(err || 'Unknown error')
}

function formatDateValue(value: Date): string {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return formatDateValue(parsed) === value
}

function getLastCompletedSaturday(): string {
  const today = new Date()
  const utcDay = today.getUTCDay()
  const daysToSubtract = utcDay === 6 ? 0 : utcDay + 1
  const lastSaturday = new Date(today)
  lastSaturday.setUTCDate(lastSaturday.getUTCDate() - daysToSubtract)
  return formatDateValue(lastSaturday)
}

function onWeekDateChange(selectedDates: Date[]) {
  const selected = Array.isArray(selectedDates) && selectedDates.length ? selectedDates[0] : null
  if (!selected) return
  selectedDateInWeek.value = formatDateValue(selected)
}

function base64ToBlob(contentBase64: string, contentType: string): Blob {
  const binary = atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return new Blob([bytes.buffer], { type: contentType || 'application/octet-stream' })
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleDownload(format: 'csv' | 'pdf') {
  if (isDownloading.value) return

  if (!selectedWeekStart.value || !selectedWeekEnding.value) {
    toastRef.value?.show('Please select a valid date.', 'error')
    return
  }

  if (format === 'csv') downloadingCsv.value = true
  if (format === 'pdf') downloadingPdf.value = true

  try {
    const result = await downloadTimecardsForWeek(selectedWeekStart.value, format)
    if (!result.contentBase64) throw new Error('No file content returned')

    const blob = base64ToBlob(result.contentBase64, result.contentType)
    triggerDownload(blob, result.fileName)

    toastRef.value?.show(
      `Downloaded ${result.timecardCount} submitted timecard(s) for week ending ${result.weekEnding}`,
      'success'
    )
  } catch (err) {
    toastRef.value?.show(formatErr(err), 'error')
  } finally {
    downloadingCsv.value = false
    downloadingPdf.value = false
  }
}
</script>

<template>
  <Toast ref="toastRef" />

  <div class="container-fluid py-4 wide-container-1200">
    <div class="controller-hero mb-4">
      <div class="text-muted small mb-1">Controller Workspace</div>
      <h2 class="h3 mb-1">Timecard Exports</h2>
      <p class="mb-0 text-muted small">Signed in as {{ displayName }}</p>
    </div>

    <div class="card controller-card">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-md-5 col-lg-4">
            <label class="form-label small text-muted mb-1">Select Any Date In Week</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-calendar-date"></i></span>
              <flat-pickr
                v-model="selectedDateInWeek"
                :config="weekPickerConfig"
                @on-change="onWeekDateChange"
                class="form-control"
                aria-label="Select week for timecard export"
              />
            </div>
          </div>

          <div class="col-md-7 col-lg-5">
            <div class="small text-muted">Week Range</div>
            <div class="fw-semibold">{{ selectedWeekLabel }}</div>
            <div class="small text-muted">Week ending Saturday: {{ selectedWeekEnding }}</div>
          </div>

          <div class="col-lg-3">
            <div class="d-grid gap-2">
              <button
                type="button"
                class="btn btn-primary"
                :disabled="isDownloading"
                @click="handleDownload('pdf')"
              >
                <span v-if="downloadingPdf" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-file-earmark-pdf me-2"></i>
                Download PDF
              </button>

              <button
                type="button"
                class="btn btn-outline-primary"
                :disabled="isDownloading"
                @click="handleDownload('csv')"
              >
                <span v-if="downloadingCsv" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-filetype-csv me-2"></i>
                Download CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.wide-container-1200 {
  max-width: 1200px;
}

.controller-hero {
  border-bottom: 1px solid $border-color;
  padding-bottom: 0.75rem;
}

.controller-card {
  background: $surface-2;
  border: 1px solid $border-color;
  color: $body-color;
}
</style>
