<script setup lang="ts">
import { computed, ref } from 'vue'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import { useRoute } from 'vue-router'
import Toast from '../components/Toast.vue'
import DailyLogAttachments from '../components/dailyLogs/DailyLogAttachments.vue'
import DailyLogList from '../components/dailyLogs/DailyLogList.vue'
import DailyLogManpower from '../components/dailyLogs/DailyLogManpower.vue'
import DailyLogRecipients from '../components/dailyLogs/DailyLogRecipients.vue'
import DailyLogTextField from '../components/dailyLogs/DailyLogTextField.vue'
import { EMAIL_UI_ENABLED } from '../config'
import { useDailyLog } from '../composables/useDailyLog'

defineProps<{ jobId?: string }>()

const route = useRoute()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const jobId = computed(() => String(route.params.jobId))

const {
  auth,
  jobName,
  jobCode,
  today,
  loading,
  saving,
  uploading,
  err,
  logDate,
  datePickerConfig,
  logsForSelectedDate,
  currentId,
  currentStatus,
  currentSubmittedAt,
  jobEmailRecipients,
  newEmailRecipient,
  savingRecipients,
  canEditDraft,
  photoFileName,
  ptpFileName,
  form,
  creatingDraft,
  formatTimestamp,
  loadLogById,
  loadForDate,
  startNewDraftForToday,
  saveDraft,
  submit,
  deleteDraft,
  deleteLogById,
  handleFileChange,
  addEmailRecipient,
  removeEmailRecipient,
  sendEmail,
  addManpowerLine,
  updateManpowerField,
  updateManpowerCount,
  removeManpowerLine,
  addIndoorClimateReading,
  updateIndoorClimateField,
  removeIndoorClimateReading,
  canDeleteManpowerLine,
  isAdminAddedLine,
  deleteAttachment,
  autoSave,
} = useDailyLog(jobId, { toastRef })

function onDateChange(_dates: Date[], dateStr: string) {
  if (!dateStr) return
  logDate.value = dateStr
  loadForDate(dateStr)
}
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4 wide-container-1200">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4 header-hero">
      <div>
        <div class="text-muted small mb-1">Job Daily Log</div>
        <h2 class="h3 mb-1">{{ jobName }}</h2>
        <div class="text-muted small d-flex align-items-center gap-2">
          <span v-if="jobCode">Job Number: {{ jobCode }}</span>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge rounded-pill text-bg-secondary">{{ logsForSelectedDate.length }} for {{ logDate }}</span>
        <span v-if="currentStatus === 'draft'" class="badge rounded-pill text-bg-warning">Draft</span>
        <span v-else class="badge rounded-pill text-bg-success">Submitted</span>
      </div>
    </div>

    <!-- Date & Status Controls -->
    <div class="card mb-4 status-card">
      <div class="card-body">
        <div class="row align-items-center g-3">
          <div class="col-md-4">
            <label class="form-label small text-muted mb-1">Date</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-light"><i class="bi bi-calendar-date"></i></span>
              <flat-pickr
                v-model="logDate"
                :config="datePickerConfig"
                @on-change="onDateChange"
                class="form-control"
                aria-label="Daily log date"
              />
            </div>
          </div>
          <div class="col-md-4 d-flex flex-column gap-1">
            <div class="text-muted small">Status</div>
            <div class="d-flex flex-wrap gap-2">
              <span v-if="currentStatus === 'draft'" class="badge rounded-pill text-bg-warning">Draft (auto-saved)</span>
              <span v-else class="badge rounded-pill text-bg-success">Submitted</span>
              <span v-if="logDate !== today && currentStatus === 'draft'" class="badge rounded-pill text-bg-danger"><i class="bi bi-exclamation-triangle me-1"></i>{{ logDate > today ? 'Future' : 'Past' }} draft</span>
              <span v-if="logDate !== today && currentStatus === 'submitted'" class="badge rounded-pill text-bg-info"><i class="bi bi-eye me-1"></i>View only</span>
            </div>
            <div v-if="currentStatus === 'submitted' && currentSubmittedAt" class="text-muted small">Submitted: {{ new Date(currentSubmittedAt.toDate?.() || currentSubmittedAt).toLocaleString() }}</div>
          </div>
          <div class="col-md-4 d-flex justify-content-md-end align-items-center gap-2">
            <button v-if="logDate === today && currentStatus === 'submitted'" type="button" class="btn btn-outline-primary btn-sm" @click="startNewDraftForToday" :disabled="creatingDraft">
              <span v-if="creatingDraft" class="spinner-border spinner-border-sm me-2"></span>
              New draft for today
            </button>
            <span v-if="saving" class="text-muted small d-flex align-items-center gap-1"><i class="bi bi-hourglass-split"></i>Saving…</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Past/Future Draft Warning -->
    <div v-if="logDate !== today && currentStatus === 'draft'" class="alert alert-warning">
      <i class="bi bi-exclamation-triangle-fill me-2"></i><strong>{{ logDate > today ? 'Future' : 'Past' }} Draft:</strong> This daily log is from a {{ logDate > today ? 'future' : 'previous' }} date and cannot be edited.
    </div>

    <!-- Form Grid -->
    <div class="row g-4">
      <!-- Main Form -->
      <div class="col-lg-8">
        <!-- Site Information -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-briefcase me-2"></i>Site Information</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Project Name</label>
                <input type="text" class="form-control" :value="jobName" disabled />
              </div>
              <div class="col-12">
                <label class="form-label">Job Site Numbers / Other Notes</label>
                <input type="text" class="form-control" v-model="form.jobSiteNumbers" @input="autoSave" :disabled="!canEditDraft" />
              </div>
              <div class="col-12">
                <label class="form-label">Foreman on Site</label>
                <input type="text" class="form-control" v-model="form.foremanOnSite" @input="autoSave" :disabled="!canEditDraft" />
              </div>
              <div class="col-12">
                <label class="form-label">Site Foreman Assistant</label>
                <input type="text" class="form-control" v-model="form.siteForemanAssistant" @input="autoSave" :disabled="!canEditDraft" />
              </div>
            </div>
          </div>
        </div>

        <!-- Manpower -->
        <DailyLogManpower
          :lines="form.manpowerLines"
          :can-edit="canEditDraft"
          :can-delete-line="canDeleteManpowerLine"
          :is-admin-line="isAdminAddedLine"
          @add-line="addManpowerLine"
          @remove-line="removeManpowerLine"
          @update-field="updateManpowerField"
          @update-count="updateManpowerCount"
        />
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-calendar-event me-2"></i>Schedule & Assessment</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12">
                <DailyLogTextField
                  label="Weekly Schedule"
                  :rows="4"
                  :model-value="form.weeklySchedule"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.weeklySchedule = val; autoSave(); }"
                />
              </div>
              <div class="col-12">
                <DailyLogTextField
                  label="Manpower Assessment"
                  :rows="3"
                  :model-value="form.manpowerAssessment"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.manpowerAssessment = val; autoSave(); }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Indoor Climate -->
        <div class="card mb-4">
          <div class="card-header bg-light d-flex justify-content-between align-items-center">
            <h5 class="mb-0"><i class="bi bi-thermometer-half me-2"></i>Indoor Temperature Readings</h5>
            <button
              type="button"
              class="btn btn-sm btn-outline-primary"
              :disabled="!canEditDraft"
              @click="addIndoorClimateReading"
            >
              <i class="bi bi-plus-lg me-1"></i>Add Floor / Area
            </button>
          </div>
          <div class="card-body">
            <div
              v-for="(reading, idx) in form.indoorClimateReadings"
              :key="`indoor-climate-${idx}`"
              class="row g-2 align-items-end mb-2"
            >
              <div class="col-md-4">
                <label class="form-label">Floor / Area</label>
                <input
                  type="text"
                  class="form-control"
                  :value="reading.area"
                  :disabled="!canEditDraft"
                  placeholder="e.g., Level 2"
                  @input="(e) => updateIndoorClimateField({ index: idx, field: 'area', value: (e.target as HTMLInputElement).value })"
                />
              </div>
              <div class="col-md-2">
                <label class="form-label">High (°F)</label>
                <input
                  type="text"
                  class="form-control"
                  :value="reading.high"
                  :disabled="!canEditDraft"
                  placeholder="High"
                  @input="(e) => updateIndoorClimateField({ index: idx, field: 'high', value: (e.target as HTMLInputElement).value })"
                />
              </div>
              <div class="col-md-2">
                <label class="form-label">Low (°F)</label>
                <input
                  type="text"
                  class="form-control"
                  :value="reading.low"
                  :disabled="!canEditDraft"
                  placeholder="Low"
                  @input="(e) => updateIndoorClimateField({ index: idx, field: 'low', value: (e.target as HTMLInputElement).value })"
                />
              </div>
              <div class="col-md-2">
                <label class="form-label">Humidity (%)</label>
                <input
                  type="text"
                  class="form-control"
                  :value="reading.humidity"
                  :disabled="!canEditDraft"
                  placeholder="Humidity"
                  @input="(e) => updateIndoorClimateField({ index: idx, field: 'humidity', value: (e.target as HTMLInputElement).value })"
                />
              </div>
              <div class="col-md-2 d-grid">
                <button
                  type="button"
                  class="btn btn-outline-danger"
                  :disabled="!canEditDraft"
                  @click="removeIndoorClimateReading(idx)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Safety & Concerns -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Safety & Concerns</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12">
                <DailyLogTextField
                  label="Safety Concerns"
                  :rows="3"
                  :model-value="form.safetyConcerns"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.safetyConcerns = val; autoSave(); }"
                />
              </div>
              <div class="col-12">
                <DailyLogTextField
                  label="AHA Reviewed"
                  :rows="2"
                  placeholder="Enter AHA review notes"
                  :model-value="form.ahaReviewed"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.ahaReviewed = val; autoSave(); }"
                />
              </div>
              <div class="col-12">
                <DailyLogTextField
                  label="Schedule Concerns"
                  :rows="3"
                  :model-value="form.scheduleConcerns"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.scheduleConcerns = val; autoSave(); }"
                />
              </div>
              <div class="col-12">
                <DailyLogTextField
                  label="Budget Concerns"
                  :rows="3"
                  :model-value="form.budgetConcerns"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.budgetConcerns = val; autoSave(); }"
                />
              </div>
            </div>
          </div>
        </div>

        <DailyLogAttachments
          :attachments="form.attachments"
          :can-edit="canEditDraft"
          :uploading="uploading"
          :photo-file-name="photoFileName"
          :ptp-file-name="ptpFileName"
          @upload="({ event, type }) => handleFileChange(event, type)"
          @delete="deleteAttachment"
        />

        <!-- Deliveries -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-box-seam me-2"></i>Deliveries & Materials</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12">
                <DailyLogTextField
                  label="Deliveries Received"
                  :rows="3"
                  :model-value="form.deliveriesReceived"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.deliveriesReceived = val; autoSave(); }"
                />
              </div>
              <div class="col-12">
                <DailyLogTextField
                  label="Deliveries Needed"
                  :rows="3"
                  :model-value="form.deliveriesNeeded"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.deliveriesNeeded = val; autoSave(); }"
                />
              </div>
              <div class="col-12">
                <DailyLogTextField
                  label="New Work Authorizations"
                  :rows="3"
                  :model-value="form.newWorkAuthorizations"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.newWorkAuthorizations = val; autoSave(); }"
                />
              </div>
              <div class="col-12">
                <DailyLogTextField
                  label="QC Inspection"
                  :rows="3"
                  :model-value="form.qcInspection"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.qcInspection = val; autoSave(); }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-chat-left-text me-2"></i>Notes & Action Items</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12">
                <DailyLogTextField
                  label="Notes & Correspondence"
                  :rows="3"
                  :model-value="form.notesCorrespondence"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.notesCorrespondence = val; autoSave(); }"
                />
              </div>
              <div class="col-12">
                <DailyLogTextField
                  label="Action Items"
                  :rows="3"
                  :model-value="form.actionItems"
                  :disabled="!canEditDraft"
                  @update:model-value="(val) => { form.actionItems = val; autoSave(); }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Error Alert -->
        <div v-if="err" class="alert alert-danger"><strong>Error:</strong> {{ err }}</div>

        <!-- Action Buttons -->
        <div class="d-grid gap-2">
          <button v-if="currentStatus === 'draft'" @click="submit" :disabled="saving" class="btn btn-success"><i class="bi bi-send me-2"></i>Submit</button>
          <button v-if="currentStatus === 'draft'" @click="deleteDraft" :disabled="saving" class="btn btn-outline-danger"><i class="bi bi-trash me-2"></i>Delete Draft</button>
          <div v-if="currentStatus !== 'draft' && logsForSelectedDate.some(r => r.logDate === today && r.status === 'submitted')" class="alert alert-info mb-0"><small><i class="bi bi-info-circle me-1"></i>Daily log already submitted for today</small></div>
          <button v-if="currentStatus === 'submitted' && jobEmailRecipients.length" @click="sendEmail" :disabled="saving" class="btn btn-info"><i class="bi bi-envelope me-2"></i>Send Email</button>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="col-lg-4">
        <DailyLogList
          :title="`Logs for ${logDate}`"
          :logs="logsForSelectedDate"
          :current-user-id="auth.user?.uid || null"
          :format-timestamp="formatTimestamp"
          :selected-id="currentId"
          @select="loadLogById"
        />

        <DailyLogRecipients
          :recipients="jobEmailRecipients"
          :new-email="newEmailRecipient"
          :saving="savingRecipients"
          @add="addEmailRecipient"
          @remove="removeEmailRecipient"
          @update:new-email="(val) => (newEmailRecipient = val)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
/* Make disabled form controls appear more clearly as read-only */
.form-control:disabled,
.form-control[readonly],
textarea:disabled,
textarea[readonly],
input:disabled,
input[readonly] {
  background-color: $surface-3;
  color: $text-muted-2;
  border-color: $border-color;
  cursor: not-allowed;
  opacity: 1;
}

.form-check-input:disabled {
  opacity: 0.5;
}

/* Dark theme for file pickers */
input[type='file'].form-control {
  background-color: $surface-2;
  color: $body-color;
  border-color: $border-color;
}

input[type='file'].form-control::file-selector-button {
  background-color: $surface-3;
  color: $body-color;
  border-color: $border-color;
}

input[type='file'].form-control:hover::file-selector-button,
input[type='file'].form-control:focus::file-selector-button {
  background-color: lighten($surface-3, 4%);
}

/* File input feedback */
[data-filename]::after {
  content: attr(data-filename);
  color: $success;
  font-weight: 500;
}

.manpower-table td {
  vertical-align: middle;
}

.count-input {
  min-width: 90px;
}

@media (max-width: 768px) {
  .count-input {
    min-width: 80px;
    font-size: 0.95rem;
  }
  .manpower-table td {
    padding: 0.35rem;
  }
}

.header-hero {
  background: linear-gradient(140deg, rgba($primary, 0.24) 0%, rgba($primary-200, 0.8) 55%, $surface-2 100%);
  border: 1px solid rgba(230, 237, 247, 0.12);
  border-radius: 12px;
  padding: 16px 20px;
}

.status-card {
  border: 1px solid rgba(230, 237, 247, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba($primary-50, 0.9) 0%, $surface-2 100%);
}

.panel-muted {
  border: 1px solid rgba(230, 237, 247, 0.12);
  background: $surface;
}

.panel-muted .list-group-item {
  border-color: rgba(230, 237, 247, 0.08);
}

:deep(.panel-muted) {
  border: 1px solid rgba(230, 237, 247, 0.12);
  background: $surface;
}

:deep(.panel-muted .list-group-item) {
  border-color: rgba(230, 237, 247, 0.08);
}

.card-header.bg-light {
  background: $surface-2 !important;
}

.wide-container-1200 {
  max-width: 1200px;
}

.col-trade { width: 40%; }
.col-count { width: 20%; }
.col-areas { width: 35%; }
.col-actions { width: 5%; }

.badge-admin {
  white-space: nowrap;
  font-size: 0.75rem;
  padding: 4px 6px;
}

.thumb-image {
  height: 150px;
  object-fit: cover;
}

:deep(.manpower-table td) {
  vertical-align: middle;
}

:deep(.count-input) {
  min-width: 90px;
}

@media (max-width: 768px) {
  :deep(.count-input) {
    min-width: 80px;
    font-size: 0.95rem;
  }
  :deep(.manpower-table td) {
    padding: 0.35rem;
  }
}

:deep(.badge-admin) {
  white-space: nowrap;
  font-size: 0.75rem;
  padding: 4px 6px;
}

:deep(.thumb-image) {
  height: 150px;
  object-fit: cover;
}
</style>
