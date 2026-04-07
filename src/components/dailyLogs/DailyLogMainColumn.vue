<script setup lang="ts">
import { computed } from 'vue'
import DailyLogAttachments from '@/components/dailyLogs/DailyLogAttachments.vue'
import DailyLogIndoorClimateCard from '@/components/dailyLogs/DailyLogIndoorClimateCard.vue'
import DailyLogManpower from '@/components/dailyLogs/DailyLogManpower.vue'
import DailyLogQualityControlCard from '@/components/dailyLogs/DailyLogQualityControlCard.vue'
import DailyLogActionPanel from '@/components/dailyLogs/DailyLogActionPanel.vue'
import DailyLogSiteInfoCard from '@/components/dailyLogs/DailyLogSiteInfoCard.vue'
import DailyLogTextSectionCard, { type DailyLogTextSectionField } from '@/components/dailyLogs/DailyLogTextSectionCard.vue'
import type { DailyLogDraftInput, DailyLogStatus } from '@/services'

type DailyLogEditableField =
  | 'jobSiteNumbers'
  | 'foremanOnSite'
  | 'siteForemanAssistant'
  | 'weeklySchedule'
  | 'manpowerAssessment'
  | 'safetyConcerns'
  | 'ahaReviewed'
  | 'scheduleConcerns'
  | 'budgetConcerns'
  | 'deliveriesReceived'
  | 'deliveriesNeeded'
  | 'newWorkAuthorizations'
  | 'qcAssignedTo'
  | 'qcAreasInspected'
  | 'qcIssuesIdentified'
  | 'qcIssuesResolved'
  | 'notesCorrespondence'
  | 'actionItems'

type DailyLogUploadType = 'photo' | 'ptp' | 'qc'

type DailyLogManpowerLine = {
  trade?: string
  areas?: string
  count?: number
  addedByUserId?: string
}

const props = defineProps<{
  jobName: string
  form: DailyLogDraftInput
  canEdit: boolean
  uploading: boolean
  photoFileName: string
  ptpFileName: string
  qcFileName: string
  currentStatus: DailyLogStatus
  saving: boolean
  hasEmailRecipients: boolean
  hasSubmittedToday: boolean
  error?: string
  canDeleteManpowerLine: (line: DailyLogManpowerLine) => boolean
  isAdminAddedLine: (line: DailyLogManpowerLine) => boolean
}>()

const emit = defineEmits<{
  'update-field': [payload: { key: DailyLogEditableField; value: string }]
  'add-manpower-line': []
  'update-manpower-field': [payload: { index: number; field: 'trade' | 'areas'; value: string }]
  'update-manpower-count': [payload: { index: number; value: number }]
  'remove-manpower-line': [index: number]
  'add-indoor-climate-reading': []
  'update-indoor-climate-field': [
    payload: { index: number; field: 'area' | 'high' | 'low' | 'humidity'; value: string },
  ]
  'remove-indoor-climate-reading': [index: number]
  upload: [payload: { event: Event; type: DailyLogUploadType }]
  'delete-attachment': [path: string]
  submit: []
  'send-email': []
}>()

const scheduleAssessmentFields = computed<DailyLogTextSectionField[]>(() => [
  { key: 'weeklySchedule', label: 'Weekly Schedule', value: props.form.weeklySchedule, rows: 4 },
  { key: 'manpowerAssessment', label: 'Manpower Assessment', value: props.form.manpowerAssessment, rows: 3 },
])

const safetyFields = computed<DailyLogTextSectionField[]>(() => [
  { key: 'safetyConcerns', label: 'Safety Concerns', value: props.form.safetyConcerns, rows: 3 },
  {
    key: 'ahaReviewed',
    label: 'AHA Reviewed',
    value: props.form.ahaReviewed,
    rows: 2,
    placeholder: 'Enter AHA review notes',
  },
  { key: 'scheduleConcerns', label: 'Schedule Concerns', value: props.form.scheduleConcerns, rows: 3 },
  { key: 'budgetConcerns', label: 'Budget Concerns', value: props.form.budgetConcerns, rows: 3 },
])

const deliveryFields = computed<DailyLogTextSectionField[]>(() => [
  { key: 'deliveriesReceived', label: 'Deliveries Received', value: props.form.deliveriesReceived, rows: 3 },
  { key: 'deliveriesNeeded', label: 'Deliveries Needed', value: props.form.deliveriesNeeded, rows: 3 },
  {
    key: 'newWorkAuthorizations',
    label: 'New Work Authorizations',
    value: props.form.newWorkAuthorizations,
    rows: 3,
  },
])

const notesFields = computed<DailyLogTextSectionField[]>(() => [
  { key: 'notesCorrespondence', label: 'Notes & Correspondence', value: props.form.notesCorrespondence, rows: 3 },
  { key: 'actionItems', label: 'Action Items', value: props.form.actionItems, rows: 3 },
])

function emitFieldUpdate(key: DailyLogEditableField, value: string) {
  emit('update-field', { key, value })
}
</script>

<template>
  <div class="daily-log-main-column">
    <DailyLogSiteInfoCard
      :job-name="jobName"
      :job-site-numbers="form.jobSiteNumbers"
      :foreman-on-site="form.foremanOnSite"
      :site-foreman-assistant="form.siteForemanAssistant"
      :can-edit="canEdit"
      @update:job-site-numbers="(value) => emitFieldUpdate('jobSiteNumbers', value)"
      @update:foreman-on-site="(value) => emitFieldUpdate('foremanOnSite', value)"
      @update:site-foreman-assistant="(value) => emitFieldUpdate('siteForemanAssistant', value)"
    />

    <DailyLogManpower
      :lines="form.manpowerLines ?? []"
      :can-edit="canEdit"
      :can-delete-line="canDeleteManpowerLine"
      :is-admin-line="isAdminAddedLine"
      @add-line="emit('add-manpower-line')"
      @remove-line="(index) => emit('remove-manpower-line', index)"
      @update-field="(payload) => emit('update-manpower-field', payload)"
      @update-count="(payload) => emit('update-manpower-count', payload)"
    />

    <DailyLogTextSectionCard
      title="Schedule & Assessment"
      icon="bi bi-calendar-event"
      :fields="scheduleAssessmentFields"
      :can-edit="canEdit"
      @update-field="(payload) => emitFieldUpdate(payload.key as DailyLogEditableField, payload.value)"
    />

    <DailyLogIndoorClimateCard
      :readings="form.indoorClimateReadings"
      :can-edit="canEdit"
      @add-reading="emit('add-indoor-climate-reading')"
      @remove-reading="(index) => emit('remove-indoor-climate-reading', index)"
      @update-field="(payload) => emit('update-indoor-climate-field', payload)"
    />

    <DailyLogTextSectionCard
      title="Safety & Concerns"
      icon="bi bi-exclamation-triangle"
      :fields="safetyFields"
      :can-edit="canEdit"
      @update-field="(payload) => emitFieldUpdate(payload.key as DailyLogEditableField, payload.value)"
    />

    <DailyLogAttachments
      :attachments="form.attachments"
      :can-edit="canEdit"
      :uploading="uploading"
      :photo-file-name="photoFileName"
      :ptp-file-name="ptpFileName"
      @upload="(payload) => emit('upload', payload)"
      @delete="(path) => emit('delete-attachment', path)"
    />

    <DailyLogTextSectionCard
      title="Deliveries & Materials"
      icon="bi bi-box-seam"
      :fields="deliveryFields"
      :can-edit="canEdit"
      @update-field="(payload) => emitFieldUpdate(payload.key as DailyLogEditableField, payload.value)"
    />

    <DailyLogQualityControlCard
      :attachments="form.attachments"
      :can-edit="canEdit"
      :uploading="uploading"
      :file-name="qcFileName"
      :qc-assigned-to="form.qcAssignedTo ?? ''"
      :qc-areas-inspected="form.qcAreasInspected ?? ''"
      :qc-issues-identified="form.qcIssuesIdentified ?? ''"
      :qc-issues-resolved="form.qcIssuesResolved ?? ''"
      @update:qc-assigned-to="(value) => emitFieldUpdate('qcAssignedTo', value)"
      @update:qc-areas-inspected="(value) => emitFieldUpdate('qcAreasInspected', value)"
      @update:qc-issues-identified="(value) => emitFieldUpdate('qcIssuesIdentified', value)"
      @update:qc-issues-resolved="(value) => emitFieldUpdate('qcIssuesResolved', value)"
      @upload="(event) => emit('upload', { event, type: 'qc' })"
      @delete-attachment="(path) => emit('delete-attachment', path)"
    />

    <DailyLogTextSectionCard
      title="Notes & Action Items"
      icon="bi bi-chat-left-text"
      :fields="notesFields"
      :can-edit="canEdit"
      @update-field="(payload) => emitFieldUpdate(payload.key as DailyLogEditableField, payload.value)"
    />

    <DailyLogActionPanel
      :current-status="currentStatus"
      :saving="saving"
      :has-email-recipients="hasEmailRecipients"
      :has-submitted-today="hasSubmittedToday"
      :error="error"
      @submit="emit('submit')"
      @send-email="emit('send-email')"
    />
  </div>
</template>
