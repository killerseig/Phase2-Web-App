<script setup lang="ts">
export interface TimecardToolbarTab<Key extends string = string> {
  key: Key
  label: string
}

const props = withDefaults(defineProps<{
  tabs: readonly TimecardToolbarTab[]
  activeKey: string
  toolbarLabel: string
  tabIdPrefix: string
  panelIdPrefix: string
  collapseAt?: '900' | '960'
}>(), {
  collapseAt: '960',
})

const emit = defineEmits<{
  selectTab: [key: string]
}>()
</script>

<template>
  <div
    class="timecard-toolbar-tabs"
    :class="`timecard-toolbar-tabs--at-${props.collapseAt}`"
    role="tablist"
    :aria-label="toolbarLabel"
  >
    <button
      v-for="tab in tabs"
      :id="`${tabIdPrefix}-${tab.key}`"
      :key="tab.key"
      class="timecard-toolbar-tabs__tab"
      :class="{ 'timecard-toolbar-tabs__tab--active': activeKey === tab.key }"
      type="button"
      role="tab"
      :aria-selected="activeKey === tab.key"
      :aria-controls="`${panelIdPrefix}-${tab.key}`"
      @click="emit('selectTab', tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.timecard-toolbar-tabs {
  display: none;
  min-width: 0;
}

@media (max-width: 960px) {
  .timecard-toolbar-tabs--at-960 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
  }
}

@media (max-width: 900px) {
  .timecard-toolbar-tabs--at-900 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
  }
}

@media (max-width: 960px) {
  .timecard-toolbar-tabs__tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 2.35rem;
    padding: 0 0.95rem;
    border: 1px solid rgba(71, 82, 41, 0.48);
    background: linear-gradient(180deg, #ffffff 0%, #e6ead4 100%);
    color: #191b13;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-align: center;
    text-transform: uppercase;
  }

  .timecard-toolbar-tabs__tab--active {
    border-color: rgba(46, 109, 61, 0.48);
    background: linear-gradient(180deg, #f7fff6 0%, #d9efcc 100%);
    color: #1b3f17;
  }
}

@media (max-width: 560px) {
  .timecard-toolbar-tabs--at-900,
  .timecard-toolbar-tabs--at-960 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
