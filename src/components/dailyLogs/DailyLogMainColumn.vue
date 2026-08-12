<script setup lang="ts">
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import DailyLogAttachmentCard from '@/components/dailyLogs/DailyLogAttachmentCard.vue'
import DailyLogAttachmentSections from '@/components/dailyLogs/DailyLogAttachmentSections.vue'
import DailyLogIndoorClimateCard from '@/components/dailyLogs/DailyLogIndoorClimateCard.vue'
import DailyLogManpowerCard from '@/components/dailyLogs/DailyLogManpowerCard.vue'
import DailyLogSiteInfoCard from '@/components/dailyLogs/DailyLogSiteInfoCard.vue'
import DailyLogTextSectionCard from '@/components/dailyLogs/DailyLogTextSectionCard.vue'
import {
  DAILY_LOG_INDOOR_CLIMATE_COLUMNS,
  DAILY_LOG_MANPOWER_COLUMNS,
  DAILY_LOG_SITE_INFO_FIELDS,
  getDailyLogTextSection,
  type DailyLogIndoorClimateFieldKey,
  type DailyLogManpowerFieldKey,
  type DailyLogTextFieldKey,
} from '@/features/dailyLogs/schema'
import {
  getSavedDailyLogFieldValue,
  savedDailyLogFieldKeys,
  type DailyLogSiteInfoDisplay,
} from '@/features/dailyLogs/viewHelpers'
import type {
  DailyLogAttachmentRecord,
  DailyLogPayload,
  DailyLogRecord,
} from '@/types/domain'

type AttachmentUploadHandler = (entries: Array<{ file: File; description: string }>) => Promise<void>
type AttachmentDescriptionPayload = { path: string; description: string }
type ManpowerFieldUpdate = { index: number; field: DailyLogManpowerFieldKey; value: string | number }
type IndoorClimateFieldUpdate = { index: number; field: DailyLogIndoorClimateFieldKey; value: string }

defineProps<{
  canEditSelectedLog: boolean
  form: DailyLogPayload
  photoAttachmentBusy: boolean
  photoAttachments: DailyLogAttachmentRecord[]
  ptpAttachmentBusy: boolean
  ptpAttachments: DailyLogAttachmentRecord[]
  qcAttachmentBusy: boolean
  qcAttachments: DailyLogAttachmentRecord[]
  savingDraft: boolean
  selectedLog: DailyLogRecord | null
  siteInfo: DailyLogSiteInfoDisplay
  submittingLog: boolean
  uploadPhotoAttachments: AttachmentUploadHandler
  uploadPtpAttachments: AttachmentUploadHandler
  uploadQcAttachments: AttachmentUploadHandler
}>()

const emit = defineEmits<{
  addIndoorClimateReading: []
  addManpowerLine: []
  blurTextField: [fieldKey: DailyLogTextFieldKey]
  removeAttachment: [path: string]
  removeIndoorClimateReading: [index: number]
  removeManpowerLine: [index: number]
  submit: []
  updateAttachmentDescription: [payload: AttachmentDescriptionPayload]
  updateIndoorClimateField: [payload: IndoorClimateFieldUpdate]
  updateManpowerField: [payload: ManpowerFieldUpdate]
  updateTextField: [fieldKey: DailyLogTextFieldKey, value: string]
}>()

const scheduleSection = getDailyLogTextSection('schedule-assessment')
const safetySection = getDailyLogTextSection('safety-concerns')
const deliveriesSection = getDailyLogTextSection('deliveries-materials')
const qualityControlSection = getDailyLogTextSection('quality-control')
const notesSection = getDailyLogTextSection('notes-actions')
</script>

<template>
  <section class="daily-logs-main">
    <DailyLogSiteInfoCard
      :fields="DAILY_LOG_SITE_INFO_FIELDS"
      :site-info="siteInfo"
    />

    <DailyLogManpowerCard
      :columns="DAILY_LOG_MANPOWER_COLUMNS"
      :disabled="!canEditSelectedLog"
      :lines="form.manpowerLines"
      @add="emit('addManpowerLine')"
      @remove="emit('removeManpowerLine', $event)"
      @update-field="emit('updateManpowerField', $event)"
    />

    <DailyLogTextSectionCard
      eyebrow="Schedule"
      :disabled="!canEditSelectedLog"
      :section="scheduleSection"
      :values="form"
      @update-field="(fieldKey, value) => emit('updateTextField', fieldKey, value)"
      @blur-field="emit('blurTextField', $event)"
    />

    <DailyLogIndoorClimateCard
      :columns="DAILY_LOG_INDOOR_CLIMATE_COLUMNS"
      :disabled="!canEditSelectedLog"
      :readings="form.indoorClimateReadings"
      @add="emit('addIndoorClimateReading')"
      @remove="emit('removeIndoorClimateReading', $event)"
      @update-field="emit('updateIndoorClimateField', $event)"
    />

    <DailyLogTextSectionCard
      eyebrow="Safety"
      :disabled="!canEditSelectedLog"
      :section="safetySection"
      :values="form"
      @update-field="(fieldKey, value) => emit('updateTextField', fieldKey, value)"
      @blur-field="emit('blurTextField', $event)"
    />

    <DailyLogAttachmentSections
      :disabled="!canEditSelectedLog"
      :photo-attachments="photoAttachments"
      :photo-busy="photoAttachmentBusy"
      :ptp-attachments="ptpAttachments"
      :ptp-busy="ptpAttachmentBusy"
      :upload-photo="uploadPhotoAttachments"
      :upload-ptp="uploadPtpAttachments"
      @update-description="emit('updateAttachmentDescription', $event)"
      @remove="emit('removeAttachment', $event)"
    />

    <DailyLogTextSectionCard
      eyebrow="Deliveries"
      :disabled="!canEditSelectedLog"
      :section="deliveriesSection"
      :values="form"
      @update-field="(fieldKey, value) => emit('updateTextField', fieldKey, value)"
      @blur-field="emit('blurTextField', $event)"
    />

    <DailyLogTextSectionCard
      eyebrow="QC"
      :disabled="!canEditSelectedLog"
      :section="qualityControlSection"
      :values="form"
      @update-field="(fieldKey, value) => emit('updateTextField', fieldKey, value)"
      @blur-field="emit('blurTextField', $event)"
    />

    <DailyLogAttachmentCard
      title="QC Photos"
      choose-label="Choose QC Photos"
      description-label="Description"
      empty-label="Drag and drop QC photos here to upload."
      helper-text="Choose one or more QC photos. Photos upload right away. Click Save Draft after editing descriptions."
      :attachments="qcAttachments"
      :disabled="!canEditSelectedLog"
      :busy="qcAttachmentBusy"
      :upload-handler="uploadQcAttachments"
      @update-description="emit('updateAttachmentDescription', $event)"
      @remove="emit('removeAttachment', $event)"
    />

    <DailyLogTextSectionCard
      eyebrow="Notes"
      :disabled="!canEditSelectedLog"
      :section="notesSection"
      :values="form"
      @update-field="(fieldKey, value) => emit('updateTextField', fieldKey, value)"
      @blur-field="emit('blurTextField', $event)"
    />

    <div class="daily-logs-submit-row">
      <AppLoadingButton
        class="daily-logs-submit-button"
        label="Submit Daily Log"
        loading-label="Submitting..."
        variant="success"
        :loading="submittingLog"
        :disabled="!canEditSelectedLog || submittingLog || savingDraft"
        @click="emit('submit')"
      />
    </div>

    <div v-if="selectedLog" class="sr-only" aria-hidden="true">
      <div
        v-for="fieldKey in savedDailyLogFieldKeys"
        :key="fieldKey"
        :data-testid="`dailylog-saved-${fieldKey}`"
      >
        {{ getSavedDailyLogFieldValue(selectedLog, fieldKey) }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.daily-logs-main {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-height: 0;
}

.daily-logs-submit-row {
  display: block;
}

.daily-logs-submit-button {
  width: 100%;
  min-height: 3.4rem;
  border-radius: 16px;
  font-weight: 700;
  font-size: 1rem;
}

@media (max-width: 920px) {
  .daily-logs-submit-button {
    width: 100%;
  }
}
</style>
