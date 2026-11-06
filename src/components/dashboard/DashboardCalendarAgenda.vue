<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import type { SharedCalendarEntry } from '@/features/dashboard/sharedDashboards'
const props = defineProps<{ events: SharedCalendarEntry[] }>()
const id = useId()
const view = ref('all')
function localToday() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}
const today = ref(localToday())
function refreshToday() { today.value = localToday() }
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  window.addEventListener('focus', refreshToday)
  timer = setInterval(refreshToday, 60000)
})
onBeforeUnmount(() => { window.removeEventListener('focus', refreshToday); clearInterval(timer) })
const dates = computed(() => [...props.events]
  .filter(event => view.value === 'all' || event.date >= today.value)
  .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)))
</script>

<template>
  <div class="dashboard-calendar-agenda">
    <template v-if="events.length">
      <label :for="id">Calendar view
        <select :id="id" v-model="view">
          <option value="all">All dates</option>
          <option value="upcoming">Today and upcoming</option>
        </select>
      </label>
      <p class="dashboard-calendar-count" role="status">{{ dates.length }} of {{ events.length }} dates</p>
      <ul v-if="dates.length" class="shared-dates" tabindex="0" aria-label="Calendar dates">
        <li v-for="(date, index) in dates" :key="date.id + ':' + index">
          <time :datetime="date.date" :aria-current="date.date === today ? 'date' : undefined">{{ date.date }}</time>
          <span>{{ date.title }}</span>
          <small v-if="date.date === today">Today</small>
          <small v-else-if="date.date < today">Past</small>
        </li>
      </ul>
      <p v-else>No upcoming dates. Choose All dates to view earlier entries.</p>
    </template>
    <p v-else>No calendar dates yet.</p>
  </div>
</template>

<style scoped>
.dashboard-calendar-agenda label { display: grid; gap: .5rem; }
.shared-dates { max-height: 24rem; overflow-y: auto; scrollbar-gutter: stable; }
.shared-dates:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.shared-dates li { overflow-wrap: anywhere; }
.shared-dates small { color: var(--text-muted); }
.shared-dates [aria-current='date'] { font-weight: 700; }
.dashboard-calendar-count { color: var(--text-muted); font-size: var(--font-size-sm); }
</style>
