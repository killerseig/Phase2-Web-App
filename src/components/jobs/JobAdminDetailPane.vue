<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppPane from '@/components/common/AppPane.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import SaveStatusIndicator from '@/components/common/SaveStatusIndicator.vue'
import JobDetailsFormFields from '@/components/jobs/JobDetailsFormFields.vue'
import JobFieldUserAssignmentPanel from '@/components/jobs/JobFieldUserAssignmentPanel.vue'
import JobNotificationRecipientsPanel from '@/components/jobs/JobNotificationRecipientsPanel.vue'
import {
  getJobDisplayName,
  type JobFormState,
  type JobFormTextField,
} from '@/features/jobs/jobViewHelpers'
import type {
  GlobalNotificationModuleKey,
  GlobalNotificationRecipients,
  JobRecord,
  NotificationModuleKey,
  NotificationRecipients,
  UserProfile,
} from '@/types/domain'

defineProps<{
  archiveLoading: boolean
  canDeleteOrArchiveJobs: boolean
  canEditSelectedJob: boolean
  createForm: JobFormState
  createLoading: boolean
  createNotificationRecipients: NotificationRecipients
  createRecipientInputs: Record<NotificationModuleKey, string>
  deleteLoading: boolean
  detailForm: JobFormState
  detailInfo: string
  detailNotificationRecipients: NotificationRecipients
  detailRecipientInputs: Record<NotificationModuleKey, string>
  filteredForemen: UserProfile[]
  foremanSearchTerm: string
  globalNotificationRecipients: GlobalNotificationRecipients
  globalRecipientInputs: Record<GlobalNotificationModuleKey, string>
  isAllJobsMode: boolean
  isCreateMode: boolean
  globalNotificationModules: ReadonlyArray<{ key: GlobalNotificationModuleKey; label: string }>
  jobNotificationModules: ReadonlyArray<{ key: NotificationModuleKey; label: string }>
  jobTypeOptions: string[]
  recipientSaving: boolean
  saveLoading: boolean
  selectedJob: JobRecord | null
  usersLoading: boolean
}>()

const emit = defineEmits<{
  addCreateRecipient: [moduleKey: NotificationModuleKey]
  addDetailRecipient: [moduleKey: NotificationModuleKey]
  addGlobalRecipient: [moduleKey: GlobalNotificationModuleKey]
  createJob: []
  deleteJob: []
  requestToggleArchive: []
  removeCreateRecipient: [moduleKey: NotificationModuleKey, email: string]
  removeDetailRecipient: [moduleKey: NotificationModuleKey, email: string]
  removeGlobalRecipient: [moduleKey: GlobalNotificationModuleKey, email: string]
  saveJob: []
  toggleCreateForeman: [userId: string]
  toggleDetailForeman: [userId: string]
  updateCreateField: [field: JobFormTextField, value: string]
  updateCreateRecipientInput: [moduleKey: NotificationModuleKey, value: string]
  updateDetailField: [field: JobFormTextField, value: string]
  updateDetailRecipientInput: [moduleKey: NotificationModuleKey, value: string]
  updateForemanSearchTerm: [value: string]
  updateGlobalRecipientInput: [moduleKey: GlobalNotificationModuleKey, value: string]
}>()

function isJobNotificationModuleKey(
  moduleKey: GlobalNotificationModuleKey,
): moduleKey is NotificationModuleKey {
  return moduleKey === 'dailyLogs' || moduleKey === 'timecards' || moduleKey === 'shopOrders'
}

function forwardCreateRecipientInput(moduleKey: GlobalNotificationModuleKey, value: string) {
  if (isJobNotificationModuleKey(moduleKey)) emit('updateCreateRecipientInput', moduleKey, value)
}

function forwardDetailRecipientInput(moduleKey: GlobalNotificationModuleKey, value: string) {
  if (isJobNotificationModuleKey(moduleKey)) emit('updateDetailRecipientInput', moduleKey, value)
}

function forwardCreateRecipientAdd(moduleKey: GlobalNotificationModuleKey) {
  if (isJobNotificationModuleKey(moduleKey)) emit('addCreateRecipient', moduleKey)
}

function forwardDetailRecipientAdd(moduleKey: GlobalNotificationModuleKey) {
  if (isJobNotificationModuleKey(moduleKey)) emit('addDetailRecipient', moduleKey)
}

function forwardCreateRecipientRemove(moduleKey: GlobalNotificationModuleKey, email: string) {
  if (isJobNotificationModuleKey(moduleKey)) emit('removeCreateRecipient', moduleKey, email)
}

function forwardDetailRecipientRemove(moduleKey: GlobalNotificationModuleKey, email: string) {
  if (isJobNotificationModuleKey(moduleKey)) emit('removeDetailRecipient', moduleKey, email)
}
</script>

<template>
  <AppPane class="jobs-detail">
    <template v-if="isCreateMode">
      <AppPaneHeader eyebrow="Create" title="New Job" title-tag="h2" />

      <div class="jobs-detail__body">
        <form class="jobs-form" @submit.prevent="emit('createJob')">
          <JobDetailsFormFields
            :model="createForm"
            :job-type-options="jobTypeOptions"
            test-id-prefix="jobs-create"
            @update-field="(field, value) => emit('updateCreateField', field, value)"
          />

          <JobFieldUserAssignmentPanel
            :selected-ids="createForm.assignedForemanIds"
            :users="filteredForemen"
            :search-term="foremanSearchTerm"
            :loading="usersLoading"
            row-test-id-prefix="jobs-foreman"
            @update-search-term="emit('updateForemanSearchTerm', $event)"
            @toggle-user="emit('toggleCreateForeman', $event)"
          />

          <JobNotificationRecipientsPanel
            description="Applies only to this new job"
            :modules="jobNotificationModules"
            :recipients="createNotificationRecipients"
            :inputs="createRecipientInputs"
            @update-input="forwardCreateRecipientInput"
            @add-recipient="forwardCreateRecipientAdd"
            @remove-recipient="forwardCreateRecipientRemove"
          />

          <div class="jobs-detail__actions">
            <AppLoadingButton
              label="Create Job"
              loading-label="Creating..."
              variant="primary"
              :loading="createLoading"
              data-testid="jobs-create-button"
              type="submit"
            />
          </div>
        </form>
      </div>
    </template>

    <template v-else-if="isAllJobsMode">
      <AppPaneHeader eyebrow="Global Scope" title="All Jobs" title-tag="h2">
        <template #actions>
          <div class="jobs-detail__status-group">
            <AppBadge tone="accent">Defaults</AppBadge>
          </div>
        </template>
      </AppPaneHeader>

      <div class="jobs-detail__body">
        <JobNotificationRecipientsPanel
          description="Global recipients for submitted forms and job activity across all jobs"
          :modules="globalNotificationModules"
          :recipients="globalNotificationRecipients"
          :inputs="globalRecipientInputs"
          :disabled="recipientSaving"
          @update-input="(moduleKey, value) => emit('updateGlobalRecipientInput', moduleKey, value)"
          @add-recipient="emit('addGlobalRecipient', $event)"
          @remove-recipient="(moduleKey, email) => emit('removeGlobalRecipient', moduleKey, email)"
        />
      </div>
    </template>

    <template v-else-if="selectedJob && canEditSelectedJob">
      <AppPaneHeader eyebrow="Selected Job" :title="getJobDisplayName(selectedJob)" title-tag="h2">
        <template #actions>
          <div class="jobs-detail__status-group">
            <AppBadge :tone="selectedJob.active ? 'success' : 'danger'">
              {{ selectedJob.active ? 'Active' : 'Archived' }}
            </AppBadge>
          </div>
        </template>
      </AppPaneHeader>

      <div class="jobs-detail__body">
        <form class="jobs-form" @submit.prevent="emit('saveJob')">
          <JobDetailsFormFields
            :model="detailForm"
            :job-type-options="jobTypeOptions"
            @update-field="(field, value) => emit('updateDetailField', field, value)"
          />

          <JobFieldUserAssignmentPanel
            :selected-ids="detailForm.assignedForemanIds"
            :users="filteredForemen"
            :search-term="foremanSearchTerm"
            :loading="usersLoading"
            @update-search-term="emit('updateForemanSearchTerm', $event)"
            @toggle-user="emit('toggleDetailForeman', $event)"
          />

          <JobNotificationRecipientsPanel
            description="Added on top of All Jobs defaults for this job only"
            :modules="jobNotificationModules"
            :recipients="detailNotificationRecipients"
            :inputs="detailRecipientInputs"
            :disabled="recipientSaving"
            @update-input="forwardDetailRecipientInput"
            @add-recipient="forwardDetailRecipientAdd"
            @remove-recipient="forwardDetailRecipientRemove"
          />

          <div v-if="canDeleteOrArchiveJobs" class="jobs-detail__actions">
            <AppLoadingButton
              :label="selectedJob.active ? 'Archive Job' : 'Restore Job'"
              loading-label="Updating..."
              :loading="archiveLoading"
              :disabled="archiveLoading"
              @click="emit('requestToggleArchive')"
            />
            <AppLoadingButton
              label="Delete Job"
              loading-label="Deleting..."
              variant="danger"
              :loading="deleteLoading"
              :disabled="deleteLoading"
              @click="emit('deleteJob')"
            />
          </div>
        </form>
        <SaveStatusIndicator
          v-if="saveLoading || detailInfo === 'All changes saved.'"
          :saving="saveLoading"
          :message="detailInfo"
          saving-message="Saving..."
        />
      </div>
    </template>

    <template v-else-if="selectedJob">
      <AppPaneHeader eyebrow="Selected Job" :title="getJobDisplayName(selectedJob)" title-tag="h2">
        <template #actions>
          <div class="jobs-detail__status-group">
            <AppBadge :tone="selectedJob.active ? 'success' : 'danger'">
              {{ selectedJob.active ? 'Active' : 'Archived' }}
            </AppBadge>
          </div>
        </template>
      </AppPaneHeader>

      <div class="jobs-detail__body">
        <AppEmptyState
          class="jobs-browser__empty"
          message="This role can view this job, but cannot edit its setup."
        />
      </div>
    </template>

    <template v-else>
      <div class="jobs-detail__body">
        <AppEmptyState
          class="jobs-browser__empty"
          message="Select a job to edit, or create a new one."
        />
      </div>
    </template>
  </AppPane>
</template>

<style scoped>
.jobs-detail {
  --app-pane-grid-template-rows: auto minmax(0, 1fr);
  --app-pane-gap: 1rem;
  --app-pane-padding: 1rem;
}

.jobs-detail__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 0.15rem;
}

.jobs-detail__status-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--field-gap);
}

.jobs-form {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.jobs-browser__empty {
  color: var(--text-muted);
  display: grid;
  place-content: center;
  min-height: 12rem;
  padding: 1.5rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
}

.jobs-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--action-gap);
}
</style>
