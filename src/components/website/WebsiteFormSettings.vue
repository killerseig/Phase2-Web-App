<script setup lang="ts">
import { computed } from 'vue'
import {
  validateForm,
  type WebsiteFormDefinition,
  type WebsiteFormField,
} from '../../../functions/src/websiteForms'
const props = defineProps<{ form: WebsiteFormDefinition }>()
const emit = defineEmits<{ update: [form: WebsiteFormDefinition] }>()
const issue = computed(() => {
  try {
    validateForm(props.form)
    return ''
  } catch (reason) {
    return reason instanceof Error ? reason.message : 'Check the form settings.'
  }
})
function change(operation: (form: WebsiteFormDefinition) => void) {
  const copy = JSON.parse(JSON.stringify(props.form))
  operation(copy)
  emit('update', copy)
}
function text(
  key: 'name' | 'description' | 'buttonLabel' | 'successMessage' | 'replyToField',
  event: Event,
) {
  change((form) => {
    form[key] = (event.target as HTMLInputElement).value
  })
}
function recipients(key: 'to' | 'cc', event: Event) {
  change((form) => {
    ;(form.delivery ||= { to: [], cc: [], subject: 'Website inquiry' })[key] = (
      event.target as HTMLTextAreaElement
    ).value
      .split(/[\n,;]/)
      .map((value) => value.trim())
      .filter(Boolean)
  })
}
function field(index: number, key: 'label' | 'type', event: Event) {
  change((form) => {
    const value = (event.target as HTMLInputElement).value
    Object.assign(form.fields[index]!, { [key]: value })
    if (key === 'type') {
      if (value === 'select' && !form.fields[index]!.options.length)
        form.fields[index]!.options = ['Option 1']
      if (value !== 'email' && form.replyToField === form.fields[index]!.id) form.replyToField = ''
    }
  })
}
function add() {
  change((form) => {
    form.fields.push({
      id: crypto.randomUUID(),
      label: 'New field',
      type: 'text',
      required: false,
      options: [],
    })
  })
}
function remove(index: number) {
  change((form) => {
    const [removed] = form.fields.splice(index, 1)
    if (form.replyToField === removed?.id) form.replyToField = ''
  })
}
function move(index: number, direction: number) {
  change((form) => {
    const [entry] = form.fields.splice(index, 1)
    form.fields.splice(index + direction, 0, entry!)
  })
}
const fieldTypes: WebsiteFormField['type'][] = [
  'text',
  'email',
  'tel',
  'textarea',
  'select',
  'checkbox',
]
</script>
<template>
  <section aria-label="Form settings" class="form-settings">
    <h3>Form settings</h3>
    <p>
      Settings are shared by every placement of this form. Save draft, then publish to apply them.
    </p>
    <label
      >Form name<input :value="form.name" maxlength="100" @input="text('name', $event)"
    /></label>
    <label
      >Form description<textarea
        :value="form.description"
        maxlength="1000"
        @input="text('description', $event)"
      />
    </label>
    <label
      >Submit button label<input
        :value="form.buttonLabel"
        maxlength="80"
        @input="text('buttonLabel', $event)"
    /></label>
    <label
      >Confirmation message<textarea
        :value="form.successMessage"
        maxlength="500"
        @input="text('successMessage', $event)"
      />
    </label>
    <h3>Email delivery</h3>
    <p>
      Uses the same sending account as app emails. Recipients stay private. Separate addresses with
      commas.
    </p>
    <label
      >To recipients<textarea
        data-form-recipients
        :value="form.delivery?.to.join(', ') || ''"
        @change="recipients('to', $event)"
      />
    </label>
    <label
      >CC recipients<textarea
        :value="form.delivery?.cc.join(', ') || ''"
        @change="recipients('cc', $event)"
      />
    </label>
    <label
      >Email subject<input
        :value="form.delivery?.subject || ''"
        maxlength="160"
        @input="
          change((form) => {
            ;(form.delivery ||= { to: [], cc: [], subject: '' }).subject = (
              $event.target as HTMLInputElement
            ).value
          })
        "
    /></label>
    <label
      >Reply-To field<select
        aria-label="Reply-To field"
        :value="form.replyToField"
        @change="text('replyToField', $event)"
      >
        <option value="">No visitor reply address</option>
        <option
          v-for="field in form.fields.filter((entry) => entry.type === 'email')"
          :key="field.id"
          :value="field.id"
        >
          {{ field.label }}
        </option>
      </select></label
    >
    <h3>Fields</h3>
    <fieldset v-for="(entry, index) in form.fields" :key="entry.id">
      <legend>Field {{ index + 1 }}</legend>
      <label
        >Field label<input
          :value="entry.label"
          maxlength="100"
          @input="field(index, 'label', $event)"
      /></label>
      <label
        >Field type<select
          aria-label="Field type"
          :value="entry.type"
          @change="field(index, 'type', $event)"
        >
          <option v-for="type in fieldTypes" :key="type" :value="type">{{ type }}</option>
        </select></label
      >
      <label class="check"
        ><input
          type="checkbox"
          :checked="entry.required"
          @change="
            change((form) => {
              form.fields[index]!.required = ($event.target as HTMLInputElement).checked
            })
          "
        />Required</label
      >
      <label v-if="entry.type === 'select'"
        >Choices, one per line<textarea
          :value="entry.options.join('\n')"
          @change="
            change((form) => {
              form.fields[index]!.options = ($event.target as HTMLTextAreaElement).value
                .split('\n')
                .map((value) => value.trim())
                .filter(Boolean)
            })
          "
        />
      </label>
      <button :disabled="index === 0" @click="move(index, -1)">Move field up</button
      ><button :disabled="index === form.fields.length - 1" @click="move(index, 1)">
        Move field down</button
      ><button :disabled="form.fields.length <= 1" @click="remove(index)">Remove field</button>
    </fieldset>
    <button :disabled="form.fields.length >= 12" @click="add">Add form field</button>
    <p v-if="issue" role="alert">{{ issue }}</p>
  </section>
</template>
<style scoped>
.form-settings {
  display: grid;
  gap: 0.5rem;
}
label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.8rem;
}
p {
  font-size: 0.8rem;
}
input,
textarea,
select {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  font: inherit;
  padding: 0.5rem;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
}
fieldset {
  min-width: 0;
  display: grid;
  gap: 0.5rem;
  border: 1px solid var(--border);
}
button {
  font-size: 0.8rem;
  padding: 0.4rem;
}
.check {
  display: flex;
  align-items: center;
}
.check input {
  width: auto;
}
</style>
