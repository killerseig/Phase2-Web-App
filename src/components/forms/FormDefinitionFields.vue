<script setup lang="ts">
import { watch } from 'vue'
import Checkbox from 'primevue/checkbox'
import RadioButton from 'primevue/radiobutton'
import MultiSelect from 'primevue/multiselect'
import {
  isFieldRequired,
  type FormAnswers,
  type FormDefinition,
  type FormField,
  type FormGroupInstance,
} from '../../../functions/src/formModel'
const props = withDefaults(
  defineProps<{
    definition: FormDefinition
    modelValue: FormAnswers
    readonly?: boolean
    disabled?: boolean
    photosEnabled?: boolean
    photoPreviews?: Record<string, string>
    idPrefix?: string
    invalidField?: string
  }>(),
  { readonly: false, disabled: false, photosEnabled: false, idPrefix: '' },
)
const emit = defineEmits<{
  'update:modelValue': [answers: FormAnswers]
  upload: [fieldId: string, files: File[], groupId?: string, instanceId?: string]
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
        field.hint && 'help-' + props.idPrefix + field.id,
        field.requiredWhen && 'condition-' + props.idPrefix + field.id,
        invalid === field.id && 'form-validation-message',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
  }
}
function matrixSelection(field: FormField, rowIndex: number, option: string) {
  const answers = Array.isArray(props.modelValue[field.id])
    ? [...(props.modelValue[field.id] as string[])]
    : (field.rows || []).map(() => '')
  answers[rowIndex] = option
  update(props.modelValue, field.id, answers)
}
function instances(field: FormField): FormGroupInstance[] {
  const existing = props.modelValue[field.id]
  return Array.isArray(existing) && existing.length
    ? (existing as FormGroupInstance[])
    : Array.from({ length: field.minInstances ?? 1 }, (_, index) => ({
        instanceId: 'initial-' + index,
        answers: {},
      }))
}
watch(
  () => [props.definition, props.modelValue, props.readonly],
  () => {
    if (props.readonly) return
    const answers = { ...props.modelValue }
    let changed = false
    for (const field of props.definition.fields) {
      const current = answers[field.id]
      if (
        field.kind === 'repeat' &&
        (current === undefined || (Array.isArray(current) && !current.length && (field.minInstances ?? 1) > 0))
      ) {
        answers[field.id] = instances(field)
        changed = true
      }
    }
    if (changed) emit('update:modelValue', answers)
  },
  { immediate: true },
)
function updateInstance(field: FormField, instanceId: string, answers: FormAnswers) {
  emit('update:modelValue', {
    ...props.modelValue,
    [field.id]: instances(field).map((instance) =>
      instance.instanceId === instanceId ? { ...instance, answers } : instance,
    ),
  })
}
function addInstance(field: FormField) {
  emit('update:modelValue', {
    ...props.modelValue,
    [field.id]: [...instances(field), { instanceId: crypto.randomUUID(), answers: {} }],
  })
}
function removeInstance(field: FormField, instanceId: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    [field.id]: instances(field).filter((instance) => instance.instanceId !== instanceId),
  })
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
  <fieldset :disabled="disabled" class="form-fields">
    <div v-for="(field, index) in definition.fields" :key="field.id" class="form-field">
      <h3 v-if="field.section && definition.fields[index - 1]?.section !== field.section">
        {{ field.section }}
      </h3>
      <label
        :id="'label-' + idPrefix + field.id"
        :for="field.kind === 'radio' ? undefined : 'answer-' + idPrefix + field.id"
        >{{ field.label }}<span v-if="isFieldRequired(field, modelValue)"> *</span></label
      >
      <p v-if="field.hint" :id="'help-' + idPrefix + field.id" class="hint">{{ field.hint }}</p>
      <p v-if="field.requiredWhen" :id="'condition-' + idPrefix + field.id" class="hint">
        Notes required for {{ field.requiredWhen.values.join(' or ') }}.
      </p>
      <div v-if="field.kind === 'matrix'" class="matrix-rows">
        <fieldset
          v-for="(row, rowIndex) in field.rows"
          :key="row.id"
          :disabled="disabled || readonly"
        >
          <legend>{{ row.label }}</legend>
          <label v-for="(option, optionIndex) in field.options" :key="option" class="radio-option">
            <input
              type="radio"
              :name="idPrefix + field.id + '-' + row.id"
              :id="'answer-' + idPrefix + field.id + '-' + row.id + '-' + optionIndex"
              :checked="selected(modelValue, field.id)[rowIndex] === option"
              :value="option"
              @change="matrixSelection(field, rowIndex, option)"
            />{{ option }}
          </label>
          <button
            v-if="!readonly && selected(modelValue, field.id)[rowIndex]"
            type="button"
            @click="matrixSelection(field, rowIndex, '')"
          >
            Clear {{ row.label }}
          </button>
        </fieldset>
      </div>
      <section v-else-if="field.kind === 'repeat'" :aria-label="field.label">
        <section v-for="(instance, instanceIndex) in instances(field)" :key="instance.instanceId">
          <h4>{{ field.label }} {{ instanceIndex + 1 }}</h4>
          <FormDefinitionFields
            :id-prefix="idPrefix + field.id + '-' + instance.instanceId + '-'"
            :definition="{ ...definition, fields: field.fields || [] }"
            :model-value="instance.answers"
            :readonly="readonly"
            :disabled="disabled"
            :photos-enabled="photosEnabled"
            :photo-previews="photoPreviews"
            @update:model-value="updateInstance(field, instance.instanceId, $event)"
            @upload="
              (childId, files) => emit('upload', childId, files, field.id, instance.instanceId)
            "
            @view-photo="emit('viewPhoto', $event)"
          />
          <button
            v-if="!readonly"
            type="button"
            :disabled="disabled || instances(field).length <= (field.minInstances ?? 1)"
            @click="removeInstance(field, instance.instanceId)"
          >
            Remove {{ field.label }}
          </button>
        </section>
        <button
          v-if="!readonly"
          type="button"
          :disabled="disabled || instances(field).length >= (field.maxInstances ?? 20)"
          @click="addInstance(field)"
        >
          Add another {{ field.label }}
        </button>
      </section>
      <Checkbox
        v-else-if="field.kind === 'checkbox'"
        :input-id="'answer-' + idPrefix + field.id"
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
        :aria-labelledby="'label-' + idPrefix + field.id"
        v-bind="accessibility(field, modelValue, invalidField)"
        class="radio-options"
      >
        <label
          v-for="(option, optionIndex) in field.options"
          :key="option"
          class="radio-option"
          :for="'answer-' + idPrefix + field.id + (optionIndex ? '-' + optionIndex : '')"
        >
          <RadioButton
            :input-id="'answer-' + idPrefix + field.id + (optionIndex ? '-' + optionIndex : '')"
            :name="'answer-' + idPrefix + field.id"
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
        :input-id="'answer-' + idPrefix + field.id"
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
        :readonly="readonly"
        v-else-if="field.kind === 'recipients'"
        :id="'answer-' + idPrefix + field.id"
        :value="selected(modelValue, field.id).join('\n')"
        placeholder="One email address per line"
        @input="
          update(
            modelValue,
            field.id,
            ($event.target as HTMLTextAreaElement).value
              .split(/[\n,;]+/)
              .map((email) => email.trim())
              .filter(Boolean),
          )
        "
      />
      <textarea
        :readonly="readonly"
        v-else-if="field.kind === 'textarea'"
        :id="'answer-' + idPrefix + field.id"
        :aria-required="isFieldRequired(field, modelValue)"
        :aria-invalid="invalidField === field.id || undefined"
        :aria-describedby="
          [
            field.hint && 'help-' + idPrefix + field.id,
            field.requiredWhen && 'condition-' + idPrefix + field.id,
            invalidField === field.id && 'form-validation-message',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        "
        :value="value(modelValue, field.id)"
        @input="set(modelValue, field.id, $event)"
      />
      <select
        :disabled="readonly"
        v-else-if="field.kind === 'choice'"
        :id="'answer-' + idPrefix + field.id"
        :aria-required="isFieldRequired(field, modelValue)"
        :aria-invalid="invalidField === field.id || undefined"
        :aria-describedby="
          [
            field.hint && 'help-' + idPrefix + field.id,
            field.requiredWhen && 'condition-' + idPrefix + field.id,
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
          :id="'answer-' + idPrefix + field.id"
          :aria-required="isFieldRequired(field, modelValue)"
          :aria-invalid="invalidField === field.id || undefined"
          :aria-describedby="
            [
              field.hint && 'help-' + idPrefix + field.id,
              field.requiredWhen && 'condition-' + idPrefix + field.id,
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
        <p v-else>Photos stay in the private form record.</p>
        <p v-if="photosEnabled" class="hint">
          JPEG, PNG or WebP up to 20 MB are resized on this device before upload. Up to five photos
          per field, 20 per record.
        </p>
      </template>
      <input
        :readonly="readonly"
        v-else
        :id="'answer-' + idPrefix + field.id"
        :aria-required="isFieldRequired(field, modelValue)"
        :aria-invalid="invalidField === field.id || undefined"
        :aria-describedby="
          [
            field.hint && 'help-' + idPrefix + field.id,
            field.requiredWhen && 'condition-' + idPrefix + field.id,
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
