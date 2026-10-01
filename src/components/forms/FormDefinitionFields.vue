<script setup lang="ts">
import {
  isFieldRequired,
  type FormAnswers,
  type FormDefinition,
} from '../../../functions/src/formModel'
withDefaults(
  defineProps<{
    definition: FormDefinition
    modelValue: FormAnswers
    readonly?: boolean
    disabled?: boolean
    photosEnabled?: boolean
    photoPreviews?: Record<string, string>
  }>(),
  { readonly: false, disabled: false, photosEnabled: false },
)
const emit = defineEmits<{
  'update:modelValue': [answers: FormAnswers]
  upload: [fieldId: string, files: File[]]
  viewPhoto: [id: string]
}>()
function value(answers: FormAnswers, id: string): string {
  const answer = answers[id]
  return Array.isArray(answer) ? '' : String(answer ?? '')
}
function set(answers: FormAnswers, id: string, event: Event) {
  emit('update:modelValue', { ...answers, [id]: (event.target as HTMLInputElement).value })
}
function photos(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  emit('upload', id, Array.from(input.files || []))
  input.value = ''
}
</script>
<template>
  <fieldset :disabled="disabled || readonly" class="form-fields">
    <div v-for="(field, index) in definition.fields" :key="field.id" class="form-field">
      <h3 v-if="field.section && definition.fields[index - 1]?.section !== field.section">
        {{ field.section }}
      </h3>
      <label :for="'answer-' + field.id"
        >{{ field.label }}<span v-if="isFieldRequired(field, modelValue)"> *</span></label
      >
      <p v-if="field.hint" class="hint">{{ field.hint }}</p>
      <p v-if="field.requiredWhen" class="hint">
        Notes required for {{ field.requiredWhen.values.join(' or ') }}.
      </p>
      <textarea
        v-if="field.kind === 'textarea'"
        :id="'answer-' + field.id"
        :value="value(modelValue, field.id)"
        @input="set(modelValue, field.id, $event)"
      />
      <select
        v-else-if="field.kind === 'choice'"
        :id="'answer-' + field.id"
        :value="value(modelValue, field.id)"
        @change="set(modelValue, field.id, $event)"
      >
        <option value="">Choose an option</option>
        <option v-for="option in field.options" :key="option">{{ option }}</option>
      </select>
      <template v-else-if="field.kind === 'photo'">
        <input
          v-if="photosEnabled && !readonly"
          :id="'answer-' + field.id"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          @change="photos(field.id, $event)"
        />
        <p v-else>Photos stay in the authenticated form record.</p>
        <p v-if="photosEnabled" class="hint">
          Up to five photos per field, 20 per record; 2 MB per photo.
        </p>
      </template>
      <input
        v-else
        :id="'answer-' + field.id"
        :value="value(modelValue, field.id)"
        :type="field.kind"
        :min="field.minimum"
        :step="field.integer ? 1 : 'any'"
        @input="set(modelValue, field.id, $event)"
      />
    </div>
  </fieldset>
  <section v-if="photosEnabled" aria-label="Attached photos">
    <template
      v-for="field in definition.fields.filter((field) => field.kind === 'photo')"
      :key="field.id"
      ><div v-for="id in (modelValue[field.id] as string[]) || []" :key="id">
        <button type="button" :disabled="disabled" @click="emit('viewPhoto', id)">
          View {{ field.label }}</button
        ><img v-if="photoPreviews?.[id]" :src="photoPreviews[id]" :alt="field.label" /></div
    ></template>
  </section>
</template>
<style scoped>
.form-fields {
  border: 0;
  padding: 0;
  min-width: 0;
}
.form-field {
  display: grid;
  gap: 0.4rem;
  margin: 1rem 0;
}
label {
  font-weight: 600;
}
.hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}
h3 {
  border-top: 1px solid var(--border);
  padding-top: 1.2rem;
}
input,
textarea,
select {
  width: 100%;
  padding: 0.65rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
}
textarea {
  min-height: 7rem;
}
img {
  max-width: 100%;
  max-height: 24rem;
  object-fit: contain;
}
button {
  margin: 0.5rem 0;
}
</style>
