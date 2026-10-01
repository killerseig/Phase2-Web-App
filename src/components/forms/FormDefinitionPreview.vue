<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { FormDefinition } from '@/features/forms/model'
const props = defineProps<{ definition: FormDefinition }>()
const answers = reactive<Record<string, string>>({})
const errors = ref<string[]>([])
watch(
  () => props.definition,
  () => {
    errors.value = []
    Object.keys(answers).forEach((key) => delete answers[key])
  },
  { deep: true },
)
function validate() {
  errors.value = props.definition.fields
    .filter((field) => field.required && field.kind !== 'photo' && !answers[field.id]?.trim())
    .map((field) => field.label + ' is required.')
  if (props.definition.fields.some((field) => field.required && field.kind === 'photo'))
    errors.value.push(
      'Photo upload validation will be available with the durable submission workflow.',
    )
}
</script>
<template>
  <section class="form-preview" aria-label="Full-page form preview">
    <h2>{{ definition.title }}</h2>
    <p>{{ definition.description }}</p>
    <form @submit.prevent="validate">
      <div v-for="field in definition.fields" :key="field.id" class="preview-field">
        <label :for="'preview-' + field.id"
          >{{ field.label }}<span v-if="field.required"> *</span></label
        >
        <textarea
          v-if="field.kind === 'textarea'"
          :id="'preview-' + field.id"
          v-model="answers[field.id]"
        />
        <select
          v-else-if="field.kind === 'choice'"
          :id="'preview-' + field.id"
          v-model="answers[field.id]"
        >
          <option value="">Choose an option</option>
          <option v-for="option in field.options" :key="option">{{ option }}</option>
        </select>
        <p v-else-if="field.kind === 'photo'">
          Photo uploads will be enabled with the durable submission workflow.
        </p>
        <input v-else :id="'preview-' + field.id" v-model="answers[field.id]" :type="field.kind" />
      </div>
      <button type="submit">Check required fields</button>
      <ul v-if="errors.length" role="alert">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
      <p v-else-if="Object.keys(answers).length" role="status">
        Preview only. No submission or email is created.
      </p>
    </form>
  </section>
</template>
<style scoped>
.form-preview {
  max-width: 48rem;
  margin: auto;
  padding: clamp(1rem, 3vw, 2.5rem);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
}
.preview-field {
  display: grid;
  gap: 0.4rem;
  margin: 1rem 0;
}
label {
  font-weight: 600;
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
button {
  padding: 0.65rem 1rem;
}
p {
  color: var(--muted);
}
</style>
