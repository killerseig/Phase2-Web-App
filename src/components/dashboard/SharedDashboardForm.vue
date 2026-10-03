<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import FormResponseWorkspace from '@/components/forms/FormResponseWorkspace.vue'
import type { SharedDashboardWidget } from '@/features/dashboard/sharedDashboards'
defineProps<{ widget: SharedDashboardWidget; jobId?: string; canRespond: boolean }>()
const workspace = ref<InstanceType<typeof FormResponseWorkspace>>()
defineExpose({
  prepareNavigation: () => workspace.value?.prepareNavigation() ?? Promise.resolve(true),
})
</script>
<template>
  <p v-if="!widget.form">Choose an issued form in Edit.</p>
  <p v-else-if="!canRespond">Your account cannot use this form workflow.</p>
  <FormResponseWorkspace
    v-else-if="widget.form.presentation === 'inline'"
    ref="workspace"
    :key="widget.form.templateId + ':' + widget.form.version + ':' + (jobId || '')"
    :template-id="widget.form.templateId"
    :template-version="widget.form.version"
    inline
    dashboard-scope="role"
    :dashboard-job-id="jobId"
    :dashboard-return="jobId ? 'shared-job' : 'shared-role'"
  />
  <RouterLink
    v-else
    :to="{
      name: 'form-response',
      params: { templateId: widget.form.templateId },
      query: {
        version: String(widget.form.version),
        dashboard: 'role',
        dashboardReturn: jobId ? 'shared-job' : 'shared-role',
        ...(jobId ? { dashboardJob: jobId } : {}),
      },
    }"
    >Open full-page form</RouterLink
  >
</template>
