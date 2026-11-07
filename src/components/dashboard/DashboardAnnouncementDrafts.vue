<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import AnnouncementRecipientPicker from './AnnouncementRecipientPicker.vue'
import AppButton from '@/components/common/AppButton.vue'
import type { JobRecord } from '@/types/domain'
import type { AnnouncementDraft } from '@/features/dashboard/sharedDashboards'
const props = defineProps<{
  items: AnnouncementDraft[]
  busy: boolean
  layoutEditing: boolean
  jobs: JobRecord[]
  publishedDraftIds: string[]
}>()
const emit = defineEmits<{ save: [items: AnnouncementDraft[]]; publish: [draftId: string] }>()
const root = ref<HTMLElement>()
function focus(selector: string) {
  void nextTick(() => root.value?.querySelector<HTMLElement>(selector)?.focus())
}
const editing = ref(false)
const draft = ref<AnnouncementDraft[]>([])
const dirty = computed(
  () => editing.value && JSON.stringify(draft.value) !== JSON.stringify(props.items),
)
function edit() {
  if (props.busy || props.layoutEditing) return
  draft.value = props.items.map((item) => ({ ...item }))
  editing.value = true
  focus('[data-add-item]')
}
function changeAudience(item: AnnouncementDraft) {
  delete item.jobId
  delete item.recipientIds
}
const recipientsMissing = computed(() =>
  draft.value.some((item) => item.audience === 'people' && !item.recipientIds?.length),
)
function addDraft() {
  draft.value.push({ id: crypto.randomUUID(), title: '', body: '' })
  focus('.announcement-draft:last-of-type input')
}
function discard() {
  editing.value = false
  draft.value = []
}
defineExpose({ dirty, editing, discard })
</script>
<template>
  <div ref="root" class="shared-widget-tools dashboard-announcement-drafts">
    <p>
      Drafts stay private until you choose Publish. Published updates appear when recipients enter
      the app or a job.
    </p>
    <p v-if="layoutEditing">Save your layout to edit announcement drafts.</p>
    <form
      v-else-if="editing"
      @submit.prevent="
        emit(
          'save',
          draft.map((item) => ({ ...item })),
        )
      "
    >
      <fieldset :disabled="busy">
        <legend>Edit announcement drafts</legend>
        <section v-for="(item, index) in draft" :key="item.id" class="announcement-draft">
          <label
            >Draft title {{ index + 1 }}<input v-model="item.title" required maxlength="200"
          /></label>
          <label
            >Draft message {{ index + 1 }}<textarea v-model="item.body" required maxlength="8000" />
          </label>
          <label
            >Audience {{ index + 1
            }}<select v-model="item.audience" required @change="changeAudience(item)">
              <option disabled :value="undefined">Choose audience</option>
              <option value="everyone">Everyone</option>
              <option value="job">People assigned to a job</option>
              <option value="people">Specific people</option>
            </select></label
          >
          <label v-if="item.audience === 'job'"
            >Announcement job {{ index + 1
            }}<select v-model="item.jobId" required>
              <option disabled :value="undefined">Choose job</option>
              <option v-for="job in jobs" :key="job.id" :value="job.id">
                {{ job.code }} · {{ job.name }}
              </option>
            </select></label
          >
          <AnnouncementRecipientPicker
            v-if="item.audience === 'people'"
            :model-value="item.recipientIds || []"
            :disabled="busy"
            @update:model-value="item.recipientIds = $event"
          />
          <AppButton
            type="button"
            :aria-label="'Remove announcement draft ' + (index + 1)"
            @click="draft.splice(index, 1)"
            >Remove draft</AppButton
          >
        </section>
        <div class="announcement-draft-actions">
          <AppButton data-add-item type="button" :disabled="draft.length >= 25" @click="addDraft"
            >Add announcement draft</AppButton
          >
          <AppButton type="submit" variant="primary" :disabled="!dirty || recipientsMissing"
            >Save announcement drafts</AppButton
          >
          <AppButton type="button" @click="discard">Cancel announcement drafts</AppButton>
        </div>
      </fieldset>
    </form>
    <template v-else>
      <p v-if="!items.length">No announcement drafts yet.</p>
      <section v-for="item in items" :key="item.id" class="announcement-draft">
        <h3>{{ item.title }}</h3>
        <p class="announcement-draft-body">{{ item.body }}</p>
        <p>
          Audience:
          {{
            item.audience === 'everyone'
              ? 'Everyone'
              : item.audience === 'job'
                ? 'Assigned job — ' +
                  (jobs.find((job) => job.id === item.jobId)?.name || item.jobId)
                : item.audience === 'people'
                  ? `${item.recipientIds?.length || 0} selected people`
                  : 'Choose an audience before publishing'
          }}
        </p>
        <p v-if="publishedDraftIds.includes(item.id)">
          Published snapshot. Editing this draft does not change the published announcement.
        </p>
        <AppButton
          v-else
          type="button"
          :disabled="busy || !item.audience"
          :aria-label="'Publish ' + item.title"
          @click="emit('publish', item.id)"
          >Publish</AppButton
        >
      </section>
      <AppButton type="button" :disabled="busy" @click="edit">Edit announcement drafts</AppButton>
    </template>
  </div>
</template>
<style scoped>
fieldset {
  min-width: 0;
  border: 0;
  padding: 0;
}
legend {
  margin-bottom: 0.75rem;
}
.announcement-draft {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1rem;
  overflow-wrap: anywhere;
}
.announcement-draft label {
  display: grid;
  gap: 0.4rem;
}
.announcement-draft :deep(input:not([type='checkbox'])),
.announcement-draft select,
.announcement-draft textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0.65rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--control-background);
  color: var(--text);
  font: inherit;
}
.announcement-draft textarea {
  min-height: 8rem;
  resize: vertical;
}
.announcement-draft-body {
  white-space: pre-wrap;
}
.announcement-draft-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
