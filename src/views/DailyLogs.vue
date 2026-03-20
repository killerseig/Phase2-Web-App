<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import DatePickerField from '@/components/common/DatePickerField.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import DailyLogAttachments from '@/components/dailyLogs/DailyLogAttachments.vue'
import DailyLogIndoorClimateCard from '@/components/dailyLogs/DailyLogIndoorClimateCard.vue'
import DailyLogList from '@/components/dailyLogs/DailyLogList.vue'
import DailyLogManpower from '@/components/dailyLogs/DailyLogManpower.vue'
import DailyLogQualityControlCard from '@/components/dailyLogs/DailyLogQualityControlCard.vue'
import DailyLogRecipients from '@/components/dailyLogs/DailyLogRecipients.vue'
import DailyLogStatusBadge from '@/components/dailyLogs/DailyLogStatusBadge.vue'
import DailyLogTextField from '@/components/dailyLogs/DailyLogTextField.vue'
import { useDailyLog } from '@/composables/useDailyLog'
import { formatDateTime } from '@/utils/datetime'

const props = defineProps<{ jobId?: string }>()

const jobId = computed(() => String(props.jobId ?? ''))

const {
  auth,
  jobName,
  jobCode,
  today,
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
  globalDailyLogRecipients,
  savingRecipients,
  canEditDraft,
  photoFileName,
  ptpFileName,
  qcFileName,
  form,
  creatingDraft,
  formatTimestamp,
  loadLogById,
  loadForDate,
  startNewDraftForToday,
  submit,
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
} = useDailyLog(jobId)

const hasEmailRecipients = computed(() =>
  Array.from(new Set([...globalDailyLogRecipients.value, ...jobEmailRecipients.value].filter(Boolean))).length > 0
)
const isDatedDraft = computed(() => logDate.value !== today.value && currentStatus.value === 'draft')
const isSubmittedViewOnly = computed(() => logDate.value !== today.value && currentStatus.value === 'submitted')
const datedDraftLabel = computed(() => `${logDate.value > today.value ? 'Future' : 'Past'} draft`)
const datedDraftMessageTense = computed(() => (logDate.value > today.value ? 'future' : 'previous'))

function handleLogDateChange(dateStr: string) {
  if (!dateStr) return
  void loadForDate(dateStr)
}

function formatSubmittedAt(value: unknown): string {
  return formatDateTime(value)
}
</script>

<template>
  <div class="app-page">
    <!-- Header -->
    <AppPageHeader eyebrow="Job Daily Log" :title="jobName">
      <template #meta>
        <span v-if="jobCode">Job Number: {{ jobCode }}</span>
      </template>
      <template #badges>
        <AppBadge :label="`${logsForSelectedDate.length} for ${logDate}`" variant-class="text-bg-secondary" class="app-page-chip" />
        <DailyLogStatusBadge :status="currentStatus" class="app-page-chip" />
      </template>
    </AppPageHeader>

    <!-- Date & Status Controls -->
    <AppToolbarCard class="mb-4">
      <div class="row align-items-center g-3">
        <div class="col-md-4">
          <DatePickerField
            v-model="logDate"
            :config="datePickerConfig"
            label="Date"
            label-class="form-label small text-muted mb-1"
            input-aria-label="Daily log date"
            prepend-icon="bi bi-calendar-date"
            size="sm"
            show-open-button
            open-on-focus
            @change="handleLogDateChange"
          />
        </div>
        <div class="col-md-4 d-flex flex-column gap-1">
          <div class="text-muted small">Status</div>
          <div class="d-flex flex-wrap gap-2">
            <DailyLogStatusBadge :status="currentStatus" :auto-saved="currentStatus === 'draft'" />
            <AppBadge v-if="isDatedDraft" variant-class="text-bg-danger">
              <i class="bi bi-exclamation-triangle me-1"></i>{{ datedDraftLabel }}
            </AppBadge>
            <AppBadge v-if="isSubmittedViewOnly" variant-class="text-bg-info">
              <i class="bi bi-eye me-1"></i>View only
            </AppBadge>
          </div>
          <div v-if="currentStatus === 'submitted' && currentSubmittedAt" class="text-muted small">Submitted: {{ formatSubmittedAt(currentSubmittedAt) }}</div>
        </div>
        <div class="col-md-4 d-flex justify-content-md-end align-items-center gap-2">
          <button v-if="logDate === today && currentStatus === 'submitted'" type="button" class="btn btn-outline-primary btn-sm" @click="startNewDraftForToday" :disabled="creatingDraft">
            <span v-if="creatingDraft" class="spinner-border spinner-border-sm me-2"></span>
            New draft for today
          </button>
          <span v-if="saving" class="text-muted small d-flex align-items-center gap-1"><i class="bi bi-hourglass-split"></i>Saving...</span>
        </div>
      </div>
    </AppToolbarCard>

    <!-- Past/Future Draft Warning -->
    <AppAlert v-if="isDatedDraft" variant="warning">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      <strong>{{ datedDraftLabel }}:</strong>
      This daily log is from a {{ datedDraftMessageTense }} date and cannot be edited.
    </AppAlert>

    <!-- Form Grid -->
    <div class="row g-4">
      <!-- Main Form -->
      <div class="col-lg-8">
        <!-- Site Information -->
        <div class="card mb-4 app-section-card">
          <div class="card-header panel-header"><h5 class="mb-0"><i class="bi bi-briefcase me-2"></i>Site Information</h5></div>
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
          :lines="form.manpowerLines ?? []"
          :can-edit="canEditDraft"
          :can-delete-line="canDeleteManpowerLine"
          :is-admin-line="isAdminAddedLine"
          @add-line="addManpowerLine"
          @remove-line="removeManpowerLine"
          @update-field="updateManpowerField"
          @update-count="updateManpowerCount"
        />
        <div class="card mb-4 app-section-card">
          <div class="card-header panel-header"><h5 class="mb-0"><i class="bi bi-calendar-event me-2"></i>Schedule & Assessment</h5></div>
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

        <DailyLogIndoorClimateCard
          :readings="form.indoorClimateReadings"
          :can-edit="canEditDraft"
          @add-reading="addIndoorClimateReading"
          @remove-reading="removeIndoorClimateReading"
          @update-field="updateIndoorClimateField"
        />

        <!-- Safety & Concerns -->
        <div class="card mb-4 app-section-card">
          <div class="card-header panel-header"><h5 class="mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Safety & Concerns</h5></div>
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
        <div class="card mb-4 app-section-card">
          <div class="card-header panel-header"><h5 class="mb-0"><i class="bi bi-box-seam me-2"></i>Deliveries & Materials</h5></div>
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
            </div>
          </div>
        </div>

        <DailyLogQualityControlCard
          :attachments="form.attachments"
          :can-edit="canEditDraft"
          :uploading="uploading"
          :file-name="qcFileName"
          :qc-assigned-to="form.qcAssignedTo ?? ''"
          :qc-areas-inspected="form.qcAreasInspected ?? ''"
          :qc-issues-identified="form.qcIssuesIdentified ?? ''"
          :qc-issues-resolved="form.qcIssuesResolved ?? ''"
          @update:qc-assigned-to="(val) => { form.qcAssignedTo = val; autoSave(); }"
          @update:qc-areas-inspected="(val) => { form.qcAreasInspected = val; autoSave(); }"
          @update:qc-issues-identified="(val) => { form.qcIssuesIdentified = val; autoSave(); }"
          @update:qc-issues-resolved="(val) => { form.qcIssuesResolved = val; autoSave(); }"
          @upload="(event) => handleFileChange(event, 'qc')"
          @delete-attachment="deleteAttachment"
        />

        <!-- Notes -->
        <div class="card mb-4 app-section-card">
          <div class="card-header panel-header"><h5 class="mb-0"><i class="bi bi-chat-left-text me-2"></i>Notes & Action Items</h5></div>
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
        <AppAlert v-if="err" variant="danger" title="Error:" :message="err" />

        <!-- Action Buttons -->
        <div class="d-grid gap-2">
          <button v-if="currentStatus === 'draft'" @click="submit" :disabled="saving" class="btn btn-success"><i class="bi bi-send me-2"></i>Submit</button>
          <AppAlert
            v-if="currentStatus !== 'draft' && logsForSelectedDate.some(r => r.logDate === today && r.status === 'submitted')"
            variant="info"
            class="mb-0"
            icon="bi bi-info-circle"
            message="Daily log already submitted for today"
            body-class="small"
          />
          <button v-if="currentStatus === 'submitted' && hasEmailRecipients" @click="sendEmail" :disabled="saving" class="btn btn-info"><i class="bi bi-envelope me-2"></i>Send Email</button>
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
          :deleting="saving"
          @select="loadLogById"
          @delete="deleteLogById"
        />

        <DailyLogRecipients
          :recipients="jobEmailRecipients"
          :global-recipients="globalDailyLogRecipients"
          :saving="savingRecipients"
          @add="addEmailRecipient"
          @remove="removeEmailRecipient"
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
  color: $text-muted;
  border-color: $border-color;
  cursor: not-allowed;
  opacity: 1;
}

.form-check-input:disabled {
  opacity: 0.5;
}

.col-trade { width: 40%; }
.col-count { width: 20%; }
.col-areas { width: 35%; }
.col-actions { width: 5%; }

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
</style>
