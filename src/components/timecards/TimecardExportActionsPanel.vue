<script setup lang="ts">
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'

defineProps<{
  canUseTimecardExport: boolean
  actionLoading: boolean
  showCreateTray: boolean
  mobileActive: boolean
}>()

const emit = defineEmits<{
  setAllCardsCompact: [value: boolean]
  exportPdf: []
  exportCsv: []
  toggleCreateTray: []
}>()
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecard-export-panel-actions"
    title="Workspace Actions"
    labelled-by="timecard-export-tab-actions"
    :mobile-active="mobileActive"
    :modifiers="['actions']"
    collapse-at="960"
  >
    <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
    <div class="timecards-toolbar__controls">
      <div class="timecards-toolbar__matrix">
        <TimecardButton @click="emit('setAllCardsCompact', false)">
          Expand All
        </TimecardButton>
        <TimecardButton @click="emit('setAllCardsCompact', true)">
          Compact All
        </TimecardButton>
        <TimecardButton variant="primary" @click="emit('exportPdf')">
          Export PDF
        </TimecardButton>
        <TimecardButton variant="primary" @click="emit('exportCsv')">
          Export CSV
        </TimecardButton>
        <TimecardButton
          v-if="canUseTimecardExport"
          :disabled="actionLoading"
          @click="emit('toggleCreateTray')"
        >
          {{ showCreateTray ? 'Close Create' : 'Create Card' }}
        </TimecardButton>
      </div>
    </div>
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>
