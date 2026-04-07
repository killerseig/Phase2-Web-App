<script setup lang="ts">
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
</script>

<template>
  <div class="app-page">
    <AppPageHeader
      eyebrow="Admin Panel"
      title="Email Settings"
      subtitle="Configure recipients for daily logs, timecards, and shop orders."
    />

    <AdminEmailPurgeCard
      v-model:purgeEmail="purgeEmail"
      :purging="purging"
      @remove-everywhere="removeEmailEverywhere"
    />

    <AdminEmailRecipientCard
      class="mt-4"
      title="Timecard Submission Recipients"
      icon="clock"
      subtitle="These recipients will receive all submitted timecards."
      :emails="timecardSubmitRecipients"
      label="Timecard recipients"
      input-name="timecard-recipient"
      autocomplete-section="timecard"
      :disabled="saving"
      @add="addTimecardRecipient"
      @remove="removeTimecardRecipient"
    />

    <AdminEmailRecipientCard
      class="mt-4"
      title="Shop Order Submission Recipients"
      icon="box-seam"
      subtitle="These recipients will receive all submitted shop orders."
      :emails="shopOrderSubmitRecipients"
      label="Shop order recipients"
      input-name="shop-order-recipient"
      autocomplete-section="shop-order"
      :disabled="saving"
      @add="addShopOrderRecipient"
      @remove="removeShopOrderRecipient"
    />

    <AdminEmailRecipientCard
      class="mt-4"
      title="Daily Log Global Defaults"
      icon="envelope"
      subtitle="These email addresses will receive daily logs from all jobs (unless overridden at the job level)."
      :emails="globalDefaultRecipients"
      label="Global recipients"
      input-name="daily-log-global-recipient"
      autocomplete-section="daily-log-global"
      :disabled="saving"
      @add="addGlobalRecipient"
      @remove="removeGlobalRecipient"
    />

    <AdminEmailJobRecipientsCard
      class="mt-4"
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
</template>

