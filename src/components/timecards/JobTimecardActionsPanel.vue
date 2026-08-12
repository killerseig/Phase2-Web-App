<script setup lang="ts">
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'

defineProps<{
  canCreateSelectedWeek: boolean
  actionLoading: boolean
  ensuringWeek: boolean
  canEditWeek: boolean
  hasSelectedWeek: boolean
  cardCount: number
  showCreateTray: boolean
  mobileActive: boolean
}>()

const emit = defineEmits<{
  createWeek: []
  toggleCreateTray: []
  submitWeek: []
  expandAll: []
  compactAll: []
}>()
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecards-toolbar-panel-actions"
    title="Workspace Actions"
    labelled-by="timecards-toolbar-tab-actions"
    :mobile-active="mobileActive"
    :modifiers="['actions']"
  >
    <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
    <div class="timecards-toolbar__controls">
      <div class="timecards-toolbar__matrix">
        <TimecardButton
          v-if="canCreateSelectedWeek"
          variant="primary"
          data-testid="create-week"
          :disabled="actionLoading || ensuringWeek"
          @click="emit('createWeek')"
        >
          {{ ensuringWeek ? 'Opening Week' : 'Create Week' }}
        </TimecardButton>
        <TimecardButton
          data-testid="create-card"
          :disabled="actionLoading || !canEditWeek || !hasSelectedWeek"
          @click="emit('toggleCreateTray')"
        >
          {{ showCreateTray ? 'Close Create' : 'Create Card' }}
        </TimecardButton>
        <TimecardButton
          variant="primary"
          :disabled="actionLoading || !hasSelectedWeek || !cardCount || !canEditWeek"
          @click="emit('submitWeek')"
        >
          Submit Week
        </TimecardButton>
        <TimecardButton :disabled="!cardCount" @click="emit('expandAll')">
          Expand All
        </TimecardButton>
        <TimecardButton :disabled="!cardCount" @click="emit('compactAll')">
          Compact All
        </TimecardButton>
      </div>
    </div>
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>

<style scoped>
@media (max-width: 900px) {
  .timecards-toolbar__matrix {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .timecards-toolbar__matrix {
    grid-template-columns: 1fr;
  }
}
</style>
