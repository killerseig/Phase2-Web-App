<script setup lang="ts">
import WebsiteImagePicker from './WebsiteImagePicker.vue'
import type { WebsiteBranding } from '@/features/website/types'
const props = defineProps<{ branding: WebsiteBranding; hideFooter?: boolean }>()
const emit = defineEmits<{ update: [value: WebsiteBranding]; uploading: [busy: boolean] }>()
function updateLogo(value: { imageId: string; alt: string }) {
  emit('update', { ...props.branding, logoId: value.imageId, logoAlt: value.alt })
}
function updateLink(index: number, field: 'label' | 'url', value: string) {
  emit('update', {
    ...props.branding,
    footerLinks: props.branding.footerLinks.map((link, i) =>
      i === index ? { ...link, [field]: value } : link,
    ),
  })
}
function removeLink(index: number) {
  emit('update', {
    ...props.branding,
    footerLinks: props.branding.footerLinks.filter((_, i) => i !== index),
  })
}
function addLink() {
  emit('update', {
    ...props.branding,
    footerLinks: [...props.branding.footerLinks, { id: crypto.randomUUID(), label: '', url: '' }],
  })
}
</script>
<template>
  <section class="branding-fields" aria-label="Website branding">
    <h3>Website logo</h3>
    <WebsiteImagePicker
      :image-id="branding.logoId"
      :alt="branding.logoAlt"
      logo
      @update="updateLogo"
      @uploading="emit('uploading', $event)"
    />
    <template v-if="!hideFooter">
      <h3>Footer</h3>
      <label
        >Footer text<textarea
          :value="branding.footerText"
          maxlength="2000"
          rows="4"
          placeholder="Company details, address, or copyright notice"
          @input="
            emit('update', {
              ...branding,
              footerText: ($event.target as HTMLTextAreaElement).value,
            })
          "
        />
      </label>
      <fieldset v-for="(link, index) in branding.footerLinks" :key="link.id">
        <legend>Footer link {{ index + 1 }}</legend>
        <label
          >Link label<input
            :value="link.label"
            maxlength="80"
            @input="updateLink(index, 'label', ($event.target as HTMLInputElement).value)" /></label
        ><label
          >Link address<input
            :value="link.url"
            maxlength="1000"
            placeholder="https://, mailto:, tel:, or /website/page"
            @input="updateLink(index, 'url', ($event.target as HTMLInputElement).value)" /></label
        ><button type="button" @click="removeLink(index)">Remove footer link</button>
      </fieldset>
      <button type="button" :disabled="branding.footerLinks.length >= 8" @click="addLink">
        + Add footer link
      </button></template
    ><small
      >The logo is available to navigation and footer widgets. Save and publish to update the public
      website.</small
    >
  </section>
</template>
<style scoped>
.branding-fields,
label,
fieldset {
  display: grid;
  gap: 0.5rem;
}
.branding-fields {
  gap: 0.8rem;
}
h3 {
  font-size: 0.9rem;
  margin: 0.4rem 0;
}
label,
small,
legend {
  font-size: 0.8rem;
}
input,
textarea {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  padding: 0.55rem;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: 4px;
}
fieldset {
  min-width: 0;
  border: 1px solid var(--border);
  margin: 0;
}
button {
  font: inherit;
  font-size: 0.8rem;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.5rem;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
}
textarea {
  resize: vertical;
}
</style>
