<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AdminEmailJobRecipientsCard from '@/components/admin/AdminEmailJobRecipientsCard.vue'
import AdminEmailPurgeCard from '@/components/admin/AdminEmailPurgeCard.vue'
import AdminEmailRecipientCard from '@/components/admin/AdminEmailRecipientCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { useAdminEmailSettings } from '@/composables/admin/useAdminEmailSettings'

const {
  jobs,
  loading,
  err,
  purgeEmail,
  purging,
  saving,
  globalDefaultRecipients,
  timecardSubmitRecipients,
  shopOrderSubmitRecipients,
  jobRecipients,
  openJobId,
  addGlobalRecipient,
  removeGlobalRecipient,
  addJobRecipient,
  removeJobRecipient,
  addTimecardRecipient,
  removeTimecardRecipient,
  addShopOrderRecipient,
  removeShopOrderRecipient,
  removeEmailEverywhere,
} = useAdminEmailSettings()

const jobsWithOverridesCount = computed(() => (
  jobs.value.filter((job) => (jobRecipients.value.get(job.id)?.length ?? 0) > 0).length
))

const routedSubmissionCount = computed(() => (
  timecardSubmitRecipients.value.length + shopOrderSubmitRecipients.value.length
))
</script>

<template>
  <div class="app-page app-page--wide admin-email-settings-page">
    <AppPageHeader
      eyebrow="Admin Workspace"
      title="Email Settings"
      subtitle="Manage who receives submitted timecards, shop orders, and daily logs."
      compact
    >
      <template #badges>
        <AppBadge :label="`${jobs.length} jobs`" variant-class="text-bg-secondary" />
        <AppBadge :label="`${jobsWithOverridesCount} overrides`" variant-class="text-bg-info" />
        <AppBadge :label="`${globalDefaultRecipients.length} daily log defaults`" variant-class="text-bg-success" />
        <AppBadge :label="`${routedSubmissionCount} submit recipients`" variant-class="text-bg-warning" />
      </template>
    </AppPageHeader>

    <div class="admin-email-settings-page__content">
      <div class="admin-email-settings-page__routing-grid">
        <AdminEmailRecipientCard
          title="Timecard Submission Recipients"
          icon="clock"
          subtitle="Receives every submitted timecard."
          :emails="timecardSubmitRecipients"
          label="Timecard recipients"
          input-name="timecard-recipient"
          autocomplete-section="timecard"
          :disabled="saving"
          @add="addTimecardRecipient"
          @remove="removeTimecardRecipient"
        />

        <AdminEmailRecipientCard
          title="Shop Order Submission Recipients"
          icon="box-seam"
          subtitle="Receives every submitted shop order."
          :emails="shopOrderSubmitRecipients"
          label="Shop order recipients"
          input-name="shop-order-recipient"
          autocomplete-section="shop-order"
          :disabled="saving"
          @add="addShopOrderRecipient"
          @remove="removeShopOrderRecipient"
        />

        <AdminEmailRecipientCard
          title="Daily Log Global Defaults"
          icon="envelope"
          subtitle="Used for all jobs unless a job-specific recipient list overrides it."
          :emails="globalDefaultRecipients"
          label="Global recipients"
          input-name="daily-log-global-recipient"
          autocomplete-section="daily-log-global"
          :disabled="saving"
          @add="addGlobalRecipient"
          @remove="removeGlobalRecipient"
        />

        <AdminEmailPurgeCard
          class="admin-email-settings-page__purge-card admin-email-settings-page__routing-span"
          v-model:purgeEmail="purgeEmail"
          :purging="purging"
          @remove-everywhere="removeEmailEverywhere"
        />
      </div>

      <AdminEmailJobRecipientsCard
        :jobs="jobs"
        :loading="loading"
        :error="err"
        :saving="saving"
        :job-recipients="jobRecipients"
        :open-job-id="openJobId"
        @update:open-job-id="openJobId = $event"
        @add-job-recipient="addJobRecipient($event.jobId, $event.email)"
        @remove-job-recipient="removeJobRecipient($event.jobId, $event.email)"
      />
    </div>
  </div>
</template>


