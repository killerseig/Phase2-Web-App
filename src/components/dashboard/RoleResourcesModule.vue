<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from './DashboardButton.vue'
import { RouterLink, onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { CURRENT_EDITABLE_USER_ROLE_KEYS, CURRENT_ROLE_LABELS } from '@/auth/roles'
import { sdsCommand, sdsErrorMessage } from '@/services/sds'
import type { RoleResource } from '@/features/sds/types'
import type { RawRoleKey } from '@/types/domain'

const props = defineProps<{ fixedRole?: RawRoleKey }>()
const auth = useAuthStore()
const role = ref<RawRoleKey>(props.fixedRole || auth.rawRole)
const isAdmin = computed(() => auth.rawRole === 'admin')
const resources = ref<RoleResource[]>([])
const loading = ref(false)
const error = ref('')
const busy = ref(false)
const editing = ref(false)
const title = ref('')
const description = ref('')
const url = ref('')
const id = ref('')
let generation = 0
const message = sdsErrorMessage
function beforeUnload(event: BeforeUnloadEvent) {
  if (editing.value || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(
  () =>
    !(editing.value || busy.value) ||
    window.confirm('Discard this shared resource draft and leave?'),
)
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
async function load() {
  const request = ++generation
  loading.value = true
  error.value = ''
  resources.value = []
  try {
    const result = await sdsCommand<{ resources: RoleResource[] }>('listResources', {
      role: role.value,
    })
    if (request === generation)
      resources.value = result.resources.sort((a, b) => a.title.localeCompare(b.title))
  } catch (e) {
    if (request === generation) error.value = message(e)
  } finally {
    if (request === generation) loading.value = false
  }
}
function edit(resource?: RoleResource) {
  id.value = resource?.id ?? ''
  title.value = resource?.title ?? ''
  description.value = resource?.description ?? ''
  url.value = resource?.url ?? ''
  editing.value = true
}
async function save() {
  busy.value = true
  error.value = ''
  try {
    await sdsCommand('saveResource', {
      role: role.value,
      id: id.value,
      title: title.value,
      description: description.value,
      url: url.value,
    })
    editing.value = false
    await load()
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}
async function remove(resource: RoleResource) {
  if (
    !window.confirm(`Remove “${resource.title}” from ${CURRENT_ROLE_LABELS[role.value]} resources?`)
  )
    return
  busy.value = true
  try {
    await sdsCommand('deleteResource', { role: role.value, id: resource.id })
    await load()
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}
function changeRole(event: Event) {
  const input = event.target as HTMLSelectElement
  if (editing.value && !window.confirm('Discard this resource draft?')) {
    input.value = role.value
    return
  }
  editing.value = false
  role.value = input.value as RawRoleKey
}
watch(role, () => void load(), { immediate: true })
watch(
  () => props.fixedRole,
  (value) => {
    if (value) {
      editing.value = false
      role.value = value
    }
  },
)
watch(
  () => auth.rawRole,
  (value) => {
    editing.value = false
    role.value = props.fixedRole || value
  },
)
onBeforeUnmount(() => {
  generation++
})
</script>

<template>
  <section class="role-resources" aria-labelledby="role-resources-heading">
    <header>
      <div>
        <h2 id="role-resources-heading">{{ CURRENT_ROLE_LABELS[role] }} resources</h2>
        <p>Shared references and guidance for everyone in this role.</p>
      </div>
      <Button v-if="isAdmin" label="Add resource" :disabled="busy || editing" @click="edit()" />
    </header>
    <label v-if="isAdmin && !fixedRole" class="role-resources__role"
      >Manage resources for<select :value="role" :disabled="busy" @change="changeRole">
        <option v-for="key in CURRENT_EDITABLE_USER_ROLE_KEYS" :key="key" :value="key">
          {{ CURRENT_ROLE_LABELS[key] }}
        </option>
      </select></label
    >
    <div v-if="error" role="alert">
      {{ error }} <Button label="Retry" severity="secondary" @click="load" />
    </div>
    <p v-if="loading" role="status">Loading shared resources…</p>
    <p v-else-if="!resources.length && !error">
      No shared resources have been added for this role yet. Admin can add links and guidance here.
    </p>
    <ul v-else class="role-resources__list">
      <li v-for="resource in resources" :key="resource.id">
        <h3>
          <RouterLink v-if="resource.url.startsWith('/')" :to="resource.url">{{
            resource.title
          }}</RouterLink
          ><a
            v-else-if="resource.url"
            :href="resource.url"
            target="_blank"
            rel="noopener noreferrer"
            >{{ resource.title }} ↗</a
          ><span v-else>{{ resource.title }}</span>
        </h3>
        <p>{{ resource.description }}</p>
        <div v-if="isAdmin" class="role-resources__actions">
          <Button
            label="Edit"
            size="small"
            severity="secondary"
            :disabled="busy"
            @click="edit(resource)"
          /><Button
            label="Remove"
            size="small"
            severity="secondary"
            :disabled="busy"
            @click="remove(resource)"
          />
        </div>
      </li>
    </ul>
    <form v-if="editing" @submit.prevent="save">
      <fieldset :disabled="busy">
        <legend>{{ id ? 'Edit shared resource' : 'Add shared resource' }}</legend>
        <label>Title<input v-model="title" required maxlength="160" /></label
        ><label
          >Link (optional)<input
            v-model="url"
            placeholder="https://… or /safety/sds"
            maxlength="2000" /></label
        ><label
          >Guidance or description<textarea v-model="description" rows="4" maxlength="2000" />
        </label>
        <div class="role-resources__actions">
          <Button type="submit" :label="busy ? 'Saving…' : 'Save resource'" /><Button
            label="Cancel"
            severity="secondary"
            @click="editing = false"
          />
        </div>
      </fieldset>
    </form>
  </section>
</template>

<style scoped>
.role-resources {
  border: 1px solid var(--border, #cbd5e1);
  padding: 1.25rem;
  border-radius: 8px;
  background: var(--panel-background, white);
}
header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
h2,
h3 {
  margin-top: 0;
}
p {
  white-space: pre-wrap;
}
a {
  color: var(--accent, #1e608b);
}
.role-resources__list {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 1rem;
}
li {
  padding: 1rem;
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 5px;
  overflow-wrap: anywhere;
}
label {
  display: grid;
  gap: 0.4rem;
  margin-bottom: 0.8rem;
}
input,
textarea,
select {
  font: inherit;
  color: inherit;
  background: var(--panel-background, white);
  border: 1px solid var(--border, #cbd5e1);
  padding: 0.6rem;
  border-radius: 5px;
  width: 100%;
  box-sizing: border-box;
}
fieldset {
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 5px;
  padding: 1rem;
}
.role-resources__role {
  max-width: 350px;
}
.role-resources__actions {
  display: flex;
  gap: 0.5rem;
}
</style>
