<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import RadioButton from 'primevue/radiobutton'
import MultiSelect from 'primevue/multiselect'
import {
  isFieldRequired,
  type FormAnswers,
  type FormDefinition,
  type FormField,
} from '../../../functions/src/formModel'
withDefaults(
  defineProps<{
    definition: FormDefinition
    modelValue: FormAnswers
    readonly?: boolean
    disabled?: boolean
    photosEnabled?: boolean
    photoPreviews?: Record<string, string>
    invalidField?: string
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
function update(answers: FormAnswers, id: string, answer: boolean | string | string[] | null) {
  emit('update:modelValue', { ...answers, [id]: answer === null ? [] : answer })
}
function selected(answers: FormAnswers, id: string): string[] {
  return Array.isArray(answers[id]) ? (answers[id] as string[]) : []
}
function accessibility(field: FormField, answers: FormAnswers, invalid?: string) {
  return {
    'aria-required': isFieldRequired(field, answers),
    'aria-invalid': invalid === field.id || undefined,
    'aria-describedby':
      [
        field.hint && 'help-' + field.id,
        field.requiredWhen && 'condition-' + field.id,
        invalid === field.id && 'form-validation-message',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
  }
}
const multiStyle = {
  labelContainer: { style: { minWidth: 0, flex: '1' } },
  label: { style: { whiteSpace: 'normal', overflowWrap: 'anywhere', padding: '0.65rem' } },
  dropdown: { style: { display: 'flex', alignItems: 'center', padding: '0.65rem' } },
  overlay: {
    style: {
      background: 'var(--surface)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: '0.4rem',
      maxWidth: 'calc(100vw - 2rem)',
      boxShadow: '0 6px 20px #0005',
    },
  },
  listContainer: { style: { maxHeight: '16rem', overflow: 'auto' } },
  list: { style: { listStyle: 'none', margin: 0, padding: '0.35rem' } },
  option: ({ context }: { context: { focused: boolean; selected: boolean } }) => ({
    style: {
      padding: '0.7rem',
      minHeight: '44px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      background: context.focused ? 'var(--field-hover)' : undefined,
      fontWeight: context.selected ? '700' : undefined,
    },
  }),
  pcOptionCheckbox: { root: { style: { display: 'none' } } },
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
      <label
        :id="'label-' + field.id"
        :for="field.kind === 'radio' ? undefined : 'answer-' + field.id"
        >{{ field.label }}<span v-if="isFieldRequired(field, modelValue)"> *</span></label
      >
      <p v-if="field.hint" :id="'help-' + field.id" class="hint">{{ field.hint }}</p>
      <p v-if="field.requiredWhen" :id="'condition-' + field.id" class="hint">
        Notes required for {{ field.requiredWhen.values.join(' or ') }}.
      </p>
      <Checkbox
        v-if="field.kind === 'checkbox'"
        :input-id="'answer-' + field.id"
        :model-value="modelValue[field.id] === true"
        binary
        :disabled="disabled || readonly"
        :invalid="invalidField === field.id"
        class="form-check-control"
        :input-class="{ 'choice-native-input': true }"
        :pt="{
          input: accessibility(field, modelValue, invalidField),
          box: { style: { display: 'none' } },
        }"
        @update:model-value="update(modelValue, field.id, $event)"
      />
      <div
        v-else-if="field.kind === 'radio'"
        role="radiogroup"
        :aria-labelledby="'label-' + field.id"
        v-bind="accessibility(field, modelValue, invalidField)"
        class="radio-options"
      >
        <label
          v-for="(option, optionIndex) in field.options"
          :key="option"
          class="radio-option"
          :for="'answer-' + field.id + (optionIndex ? '-' + optionIndex : '')"
        >
          <RadioButton
            :input-id="'answer-' + field.id + (optionIndex ? '-' + optionIndex : '')"
            :name="'answer-' + field.id"
            :model-value="value(modelValue, field.id)"
            :value="option"
            :disabled="disabled || readonly"
            :invalid="invalidField === field.id"
            class="form-check-control"
            :input-class="{ 'choice-native-input': true }"
            :pt="{
              input: accessibility(field, modelValue, invalidField),
              box: { style: { display: 'none' } },
            }"
            @update:model-value="update(modelValue, field.id, $event)"
          />
          {{ option }}
        </label>
      </div>
      <MultiSelect
        v-else-if="field.kind === 'multiselect'"
        :input-id="'answer-' + field.id"
        :model-value="selected(modelValue, field.id)"
        :options="field.options"
        :disabled="disabled || readonly"
        :invalid="invalidField === field.id"
        :show-toggle-all="false"
        placeholder="Choose options"
        class="form-multiselect"
        :pt="{ ...multiStyle, hiddenInput: accessibility(field, modelValue, invalidField) }"
        @update:model-value="update(modelValue, field.id, $event)"
      >
        <template #option="{ option, selected }"
          ><span aria-hidden="true" class="selection-marker">{{ selected ? '✓' : '' }}</span
          ><span>{{ option }}</span></template
        >
      </MultiSelect>
      <textarea
        v-else-if="field.kind === 'textarea'"
        :id="'answer-' + field.id"
        :aria-required="isFieldRequired(field, modelValue)"
        :aria-invalid="invalidField === field.id || undefined"
        :aria-describedby="
          [
            field.hint && 'help-' + field.id,
            field.requiredWhen && 'condition-' + field.id,
            invalidField === field.id && 'form-validation-message',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        "
        :value="value(modelValue, field.id)"
        @input="set(modelValue, field.id, $event)"
      />
      <select
        v-else-if="field.kind === 'choice'"
        :id="'answer-' + field.id"
        :aria-required="isFieldRequired(field, modelValue)"
        :aria-invalid="invalidField === field.id || undefined"
        :aria-describedby="
          [
            field.hint && 'help-' + field.id,
            field.requiredWhen && 'condition-' + field.id,
            invalidField === field.id && 'form-validation-message',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        "
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
          :aria-required="isFieldRequired(field, modelValue)"
          :aria-invalid="invalidField === field.id || undefined"
          :aria-describedby="
            [
              field.hint && 'help-' + field.id,
              field.requiredWhen && 'condition-' + field.id,
              invalidField === field.id && 'form-validation-message',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          "
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
        :aria-required="isFieldRequired(field, modelValue)"
        :aria-invalid="invalidField === field.id || undefined"
        :aria-describedby="
          [
            field.hint && 'help-' + field.id,
            field.requiredWhen && 'condition-' + field.id,
            invalidField === field.id && 'form-validation-message',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        "
        :value="value(modelValue, field.id)"
        :type="field.kind === 'phone' ? 'tel' : field.kind"
        :inputmode="
          field.kind === 'phone'
            ? 'tel'
            : field.kind === 'email'
              ? 'email'
              : field.kind === 'number'
                ? 'decimal'
                : undefined
        "
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
.radio-options {
  display: grid;
  gap: 0.5rem;
}
.radio-option {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 44px;
  cursor: pointer;
  font-weight: 400;
}
.form-check-control {
  display: inline-flex;
  align-items: center;
  width: 1.3rem;
}
.form-check-control :deep(.choice-native-input) {
  position: static;
  opacity: 1;
  width: 1.25rem;
  height: 1.25rem;
  padding: 0;
  margin: 0;
  accent-color: var(--brand-sky, #58bae9);
}
.form-check-control :deep(.choice-native-input:focus-visible) {
  outline: 2px solid var(--brand-sky, #58bae9);
  outline-offset: 3px;
}
.form-multiselect {
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.form-multiselect:focus-within {
  outline: 2px solid var(--brand-sky, #58bae9);
  outline-offset: 2px;
}
.form-multiselect[data-p-disabled='true'] {
  opacity: 0.7;
  cursor: default;
}
.selection-marker {
  display: inline-block;
  min-width: 1.1rem;
}
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
input[type='file'] {
  font: inherit;
  color: var(--text);
  min-width: 0;
}
input[type='file']::file-selector-button {
  font: inherit;
  color: #edf4f8;
  background: #204661;
  border: 1px solid #7894a7;
  border-radius: 5px;
  padding: 7px 10px;
  margin-right: 10px;
  opacity: 1;
  cursor: pointer;
}
input[type='file']:disabled::file-selector-button {
  color: #edf4f8;
  -webkit-text-fill-color: #edf4f8;
  cursor: default;
}
input[type='file']:focus-visible {
  outline: 2px solid #91c9ed;
  outline-offset: 2px;
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
