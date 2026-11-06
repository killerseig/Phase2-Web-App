<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import { sharedDashboardCommand } from '@/services/sharedDashboards'
import { dashboardError } from '@/services/dashboard'
const props = defineProps<{ modelValue: string[]; disabled: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [ids: string[]] }>()
type Recipient = { uid: string; name: string; email: string; role: string }
const id = useId(), query = ref(''), searched = ref('')
const people = ref<Recipient[]>([]), names = ref<Record<string, string>>(Object.create(null))
const loading = ref(false), error = ref(''), cursor = ref<string | null>(null)
let generation = 0
async function load(reset = true) {
  const request = ++generation
  if (reset) { people.value = []; cursor.value = null; searched.value = query.value }
  loading.value = true
  error.value = ''
  try {
    const result = await sharedDashboardCommand('list-announcement-recipients', { scope: 'personal', search: searched.value, ...(cursor.value ? {cursor: cursor.value} : {}) })
    if (request !== generation) return
    people.value = [...new Map([...people.value, ...result.items].map(person => [person.uid, person])).values()]
    for (const person of result.items) names.value[person.uid] = person.name
    cursor.value = result.nextCursor
  } catch (reason) { if (request === generation) error.value = dashboardError(reason) }
  finally { if (request === generation) loading.value = false }
}
function toggle(uid: string) {
  if (props.disabled) return
  if (props.modelValue.includes(uid)) emit('update:modelValue', props.modelValue.filter(id => id !== uid))
  else if (props.modelValue.length < 25) emit('update:modelValue', [...props.modelValue, uid])
}
onMounted(() => { void load() })
onBeforeUnmount(() => { generation++ })
</script>
<template>
  <fieldset class="announcement-recipients" :disabled="disabled">
    <legend>Specific people</legend>
    <label :for="id">Find announcement recipients</label>
    <div class="recipient-search">
      <input :id="id" v-model="query" maxlength="100" @keydown.enter.prevent="load()" />
      <AppButton type="button" :disabled="loading" @click="load()">Search people</AppButton>
    </div>
    <p role="status">{{ modelValue.length }} of 25 people selected</p>
    <ul v-if="modelValue.length" aria-label="Selected announcement recipients">
      <li v-for="uid in modelValue" :key="uid">{{ names[uid] || uid }} <AppButton type="button" :aria-label="'Remove recipient ' + (names[uid] || uid)" @click="toggle(uid)">Remove</AppButton></li>
    </ul>
    <p v-if="loading" role="status">Loading people.</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="recipient-results" role="group" aria-label="Available announcement recipients">
      <label v-for="person in people" :key="person.uid">
        <input type="checkbox" :checked="modelValue.includes(person.uid)" :disabled="!modelValue.includes(person.uid) && modelValue.length >= 25" @change="toggle(person.uid)" />
        <span>{{ person.name }} <small>{{ person.email }} · {{ person.role }}</small></span>
      </label>
    </div>
    <p v-if="!loading && !people.length && !error">No matching active dashboard users on this page.</p>
    <AppButton v-if="error" type="button" :disabled="loading" @click="load()">Retry people</AppButton>
    <AppButton v-if="cursor" type="button" :disabled="loading" @click="load(false)">Load more people</AppButton>
  </fieldset>
</template>
<style scoped>
.announcement-recipients { border: 1px solid var(--border); border-radius: .5rem; padding: .75rem; min-width: 0; }
.recipient-search { display: flex; gap: .5rem; flex-wrap: wrap; }
.recipient-search input { flex: 1; min-width: 0; }
.recipient-results { max-height: 18rem; overflow-y: auto; margin-block: .75rem; }
.recipient-results label { display: flex; gap: .5rem; align-items: start; margin-block: .75rem; overflow-wrap: anywhere; }
.recipient-results input { width: auto; flex: none; }
.recipient-results small { display: block; }
ul { padding-left: 1rem; overflow-wrap: anywhere; }
</style>
