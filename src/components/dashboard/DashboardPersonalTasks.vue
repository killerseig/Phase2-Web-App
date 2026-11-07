<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import type { PersonalTask } from '@/features/dashboard/sharedDashboards'
const props = defineProps<{ items: PersonalTask[]; busy: boolean; layoutEditing: boolean }>()
const emit = defineEmits<{ save: [items: PersonalTask[]] }>()
const root = ref<HTMLElement>()
function focus(selector: string) { void nextTick(() => root.value?.querySelectorAll<HTMLElement>(selector).item(draft.value.length - 1)?.focus()) }
const editing = ref(false)
const draft = ref<PersonalTask[]>([])
const dirty = computed(() => editing.value && JSON.stringify(draft.value) !== JSON.stringify(props.items))
const completed = computed(() => props.items.filter(item => item.done).length)
function edit() {
  if (props.busy || props.layoutEditing) return
  draft.value = props.items.map(item => ({ ...item }))
  editing.value = true
  void nextTick(() => root.value?.querySelector<HTMLElement>('[data-add-item]')?.focus())
}
function addTask() { draft.value.push({ id: crypto.randomUUID(), title: '', done: false }); focus('.personal-task-row label input') }
function discard() { editing.value = false; draft.value = [] }
defineExpose({ dirty, editing, discard })
</script>
<template>
  <div ref="root" class="shared-widget-tools dashboard-personal-tasks">
    <p>Private to you.</p>
    <p v-if="layoutEditing">Save your layout to manage your tasks.</p>
    <form v-else-if="editing" @submit.prevent="emit('save', draft.map(item => ({ ...item })))">
      <fieldset :disabled="busy">
        <legend>Edit my tasks</legend>
        <div v-for="(item, index) in draft" :key="item.id" class="personal-task-row">
          <input v-model="item.done" type="checkbox" :aria-label="'Completed task ' + (index + 1)" />
          <label>Task {{ index + 1 }}<input v-model="item.title" required maxlength="200" /></label>
          <AppButton type="button" :aria-label="'Remove task ' + (index + 1)" @click="draft.splice(index, 1)">Remove</AppButton>
        </div>
        <div class="personal-task-actions">
        <AppButton data-add-item type="button" :disabled="draft.length >= 100" @click="addTask">Add task</AppButton>
        <AppButton type="submit" variant="primary" :disabled="!dirty">Save tasks</AppButton>
        <AppButton type="button" @click="discard">Cancel tasks</AppButton>
        </div>
      </fieldset>
    </form>
    <template v-else>
      <p role="status">{{ completed }} of {{ items.length }} completed</p>
      <ul v-if="items.length" aria-label="My task list" tabindex="0">
        <li v-for="item in items" :key="item.id"><span>{{ item.done ? 'Completed: ' : 'To do: ' }}</span><span :class="{ completed: item.done }">{{ item.title }}</span></li>
      </ul>
      <p v-else>No tasks yet.</p>
      <AppButton type="button" :disabled="busy" @click="edit">Edit tasks</AppButton>
    </template>
  </div>
</template>
<style scoped>
.personal-task-row { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-bottom: .75rem; }
.personal-task-row label { flex: 1 1 10rem; min-width: 0; }
.personal-task-row input[type=checkbox] { width: auto; flex: none; }
ul { max-height: 24rem; overflow-y: auto; overflow-wrap: anywhere; }
.completed { text-decoration: line-through; }
fieldset { min-width: 0; border: 0; padding: 0; }
legend { margin-bottom: .75rem; }
.personal-task-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
</style>
