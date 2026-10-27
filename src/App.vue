<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import { watch } from 'vue'
import { useIdleSessionTimeout } from '@/composables/useIdleSessionTimeout'
import { useAuthStore } from '@/stores/auth'
import { useUsageAnalytics } from '@/features/analytics/useUsageAnalytics'
import UsageAnalyticsNotice from '@/components/common/UsageAnalyticsNotice.vue'

useIdleSessionTimeout()
const route = useRoute(), auth = useAuthStore(), analytics = useUsageAnalytics('employee')
// Names and a boolean access gate only. Never pass paths, params, profiles or record data.
watch([() => route.name, () => auth.hasWorkspaceAccess], ([name, access]) => {
  analytics.controller.setAuthorized(access)
  analytics.controller.view(name)
}, { immediate: true })
</script>

<template>
  <div class="app-theme-dark">
    <RouterView />
    <UsageAnalyticsNotice :available="analytics.controller.available && auth.hasWorkspaceAccess" scope="employee" :choice="analytics.choice.value" @consent="analytics.setConsent" />
  </div>
</template>
