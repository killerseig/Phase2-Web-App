<script setup lang="ts">
import { computed, ref } from 'vue'
import FormResponseWorkspace from '@/components/forms/FormResponseWorkspace.vue'
import type { DashboardWidget } from '@/features/dashboard/widgets'
import { isFormServerEnabled } from '@/services/forms'
import { useAuthStore } from '@/stores/auth'
const canRespond = computed(() =>
  ['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(useAuthStore().rawRole),
)
defineProps<{ widget: DashboardWidget; scope: 'personal' | 'role' }>()
const workspace = ref<InstanceType<typeof FormResponseWorkspace>>()
defineExpose({
  prepareNavigation: () => workspace.value?.prepareNavigation() ?? Promise.resolve(true),
})
</script>
<template>
  <section aria-label="Dashboard form">
    <p v-if="!widget.form">Choose an issued form in Edit layout.</p>
    <p v-else-if="!canRespond" role="alert">Your account cannot use this form workflow.</p>
    <p v-else-if="!isFormServerEnabled()">
      Start the local Forms emulator profile to use this form.
    </p>
    <FormResponseWorkspace
      v-else-if="widget.form.presentation === 'inline'"
      ref="workspace"
      :key="widget.form.templateId + ':' + widget.form.version"
      :template-id="widget.form.templateId"
      :template-version="widget.form.version"
      inline
      :dashboard-scope="scope"
    />
    <template v-else>
      <h2>{{ widget.title || 'Form' }}</h2>
      <RouterLink
        :to="{
          name: 'form-response',
          params: { templateId: widget.form.templateId },
          query: { version: String(widget.form.version), dashboard: scope },
        }"
        >Open full-page form</RouterLink
      >
      <p>Version {{ widget.form.version }} · Opening creates no draft.</p>
    </template>
  </section>
</template>
