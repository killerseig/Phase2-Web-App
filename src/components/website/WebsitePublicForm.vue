<script setup lang="ts">
import { websiteRuntimeKey } from '@/features/website/runtimeServices'
import { inject, nextTick, ref, useId, watch } from 'vue'
import type { WebsiteFormDefinition, WebsiteFormValues } from '../../../functions/src/websiteForms'
import { submitWebsiteForm } from '@/services/website'
const props = defineProps<{ form?: WebsiteFormDefinition; preview?: boolean }>()
const runtime = inject(websiteRuntimeKey, undefined)
const values = ref<WebsiteFormValues>({}),
  website = ref(''),
  sending = ref(false),
  received = ref(false),
  error = ref('')
const success = ref<HTMLElement>()
const prefix = useId()
let submissionId = crypto.randomUUID()
watch(
  () => props.form?.id,
  () => {
    values.value = {}
    received.value = false
    error.value = ''
    submissionId = crypto.randomUUID()
  },
)
async function submit() {
  if (!props.form || props.preview || runtime?.preview || sending.value || received.value) return
  sending.value = true
  error.value = ''
  try {
    await (runtime?.submit || submitWebsiteForm)({
      formId: props.form.id,
      submissionId,
      values: { ...values.value },
      website: website.value,
    })
    received.value = true
    await nextTick()
    success.value?.focus()
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : 'Your message could not be sent. Please try again.'
  } finally {
    sending.value = false
  }
}
function change() {
  if (!sending.value) {
    submissionId = crypto.randomUUID()
    error.value = ''
  }
}
</script>
<template>
  <div class="website-form-widget" @pointerdown.stop>
    <p v-if="!form">Choose a form in the editor.</p>
    <template v-else>
      <h2 class="widget-title">{{ form.name }}</h2>
      <p v-if="form.description">{{ form.description }}</p>
      <p v-if="received" ref="success" role="status" tabindex="-1">{{ form.successMessage }}</p>
      <form v-else :aria-label="form.name" @submit.prevent="submit">
        <fieldset
          :disabled="sending || preview || runtime?.preview"
          @input="change"
          @change="change"
        >
          <template v-for="field in form.fields" :key="field.id">
            <label :for="prefix + '-' + field.id" :class="{ check: field.type === 'checkbox' }">
              <input
                v-if="field.type === 'checkbox'"
                :id="prefix + '-' + field.id"
                v-model="values[field.id]"
                type="checkbox"
                :required="field.required"
              />
              {{ field.label }}{{ field.required ? ' *' : '' }}
            </label>
            <textarea
              v-if="field.type === 'textarea'"
              :id="prefix + '-' + field.id"
              :value="String(values[field.id] ?? '')"
              @input="values[field.id] = ($event.target as HTMLTextAreaElement).value"
              :required="field.required"
              maxlength="5000"
              rows="5"
            />
            <select
              v-else-if="field.type === 'select'"
              :id="prefix + '-' + field.id"
              v-model="values[field.id]"
              :required="field.required"
            >
              <option value="">Choose an option</option>
              <option v-for="option in field.options" :key="option" :value="option">
                {{ option }}
              </option>
            </select>
            <input
              v-else-if="field.type !== 'checkbox'"
              :id="prefix + '-' + field.id"
              v-model="values[field.id]"
              :type="field.type"
              :required="field.required"
              :maxlength="field.type === 'email' ? 254 : 500"
              :autocomplete="
                field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'off'
              "
            />
          </template>
          <div class="form-trap" aria-hidden="true">
            <label :for="prefix + '-website'">Website</label
            ><input
              :id="prefix + '-website'"
              v-model="website"
              type="text"
              tabindex="-1"
              autocomplete="off"
            />
          </div>
          <p v-if="error" role="alert">{{ error }}</p>
          <button class="widget-button" type="submit">
            {{ sending ? 'Sending...' : form.buttonLabel }}
          </button>
        </fieldset>
        <small v-if="preview">Preview only. Visitors can submit after publication.</small>
      </form>
    </template>
  </div>
</template>
<style scoped>
.website-form-widget {
  width: 100%;
  color: inherit;
}
h2 {
  margin-top: 0;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.6rem;
  min-width: 0;
}
label {
  font-weight: 600;
}
.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
input:not([type='checkbox']),
textarea,
select {
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  font: inherit;
  padding: 0.65rem;
  border: 1px solid #a9b6c3;
  border-radius: 4px;
  color: #172c40;
  background: #fff;
}
button {
  justify-self: start;
  padding: 0.7rem 1.1rem;
  background: var(--website-accent, #174878);
  color: white;
  border: 0;
  border-radius: 4px;
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
}
.form-trap {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
small {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.8rem;
}
[role='alert'] {
  color: #a42121;
}
</style>
