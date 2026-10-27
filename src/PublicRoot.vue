<script setup lang="ts">
import { provide } from 'vue'
import { RouterView } from 'vue-router'
import { publicUsageKey, useUsageAnalytics } from '@/features/analytics/useUsageAnalytics'
import UsageAnalyticsNotice from '@/components/common/UsageAnalyticsNotice.vue'
const analytics = useUsageAnalytics('public')
provide(publicUsageKey, analytics.controller)
</script>
<template><div class="app-theme-dark"><RouterView /><UsageAnalyticsNotice :available="analytics.controller.available" scope="public" :choice="analytics.choice.value" @consent="analytics.setConsent" /></div></template>
