<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import TimecardPrintRouteContent from '@/components/timecards/TimecardPrintRouteContent.vue'
import { clearTimecardPdfExports, loadTimecardPdfExportPayload } from '@/features/timecards/pdf-export'
import { useTimecardPrintRoute } from '@/features/timecards/useTimecardPrintRoute'

const route = useRoute()

const {
  loadError,
  loadPrintPayload,
  pagedCards,
  payload,
  triggerPrint,
} = useTimecardPrintRoute({
  loadPayload: loadTimecardPdfExportPayload,
  query: route.query,
})

onMounted(async () => {
  await loadPrintPayload()
  clearTimecardPdfExports()
})
</script>

<template>
  <TimecardPrintRouteContent
    :load-error="loadError"
    :paged-cards="pagedCards"
    :payload="payload"
    :trigger-print="triggerPrint"
  />
</template>
