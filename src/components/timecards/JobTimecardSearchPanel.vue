<script setup lang="ts">
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'

defineProps<{
  cardSearchTerm: string
  mobileActive: boolean
}>()

const emit = defineEmits<{
  updateCardSearchTerm: [value: string]
}>()
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecards-toolbar-panel-search"
    title="Card Filters"
    labelled-by="timecards-toolbar-tab-search"
    :mobile-active="mobileActive"
    :modifiers="['search']"
  >
    <label class="timecards-toolbar__search">
      <span>Employee Search</span>
      <AppSearchInput
        :model-value="cardSearchTerm"
        placeholder="Search all cards"
        @update:model-value="emit('updateCardSearchTerm', $event)"
      />
    </label>
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>

<style scoped>
@media (max-width: 900px) {
  .timecards-toolbar__search {
    gap: 0.4rem;
  }
}
</style>
