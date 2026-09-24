<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { widgetIcons } from '../../../functions/src/websiteBlocks'
import type { WebsiteItem } from '@/features/website/types'
import WebsiteImagePicker from './WebsiteImagePicker.vue'
import WebsiteTextEditor from './WebsiteTextEditor.vue'
import WebsiteRichField from './WebsiteRichField.vue'
import WebsiteImageControls from './WebsiteImageControls.vue'
const props = defineProps<{
  designTools?: boolean
  item: WebsiteItem
  imageOnly?: boolean
  menuOnly?: boolean
  kind?: string
  contentOnly?: boolean
  collectionItem?: boolean
}>()
const richHeading = ref(Boolean(props.item.titleRichText))
const richBody = ref(Boolean(props.item.textRichText))
watch(
  () => props.item.id,
  () => {
    richHeading.value = Boolean(props.item.titleRichText)
    richBody.value = Boolean(props.item.textRichText)
  },
)
watch(
  () => props.item.titleRichText,
  (value) => {
    if (value) richHeading.value = true
  },
)
watch(
  () => props.item.textRichText,
  (value) => {
    if (value) richBody.value = true
  },
)
const simple = computed(() =>
  ['button', 'icon', 'divider', 'spacer', 'badge'].includes(props.kind || ''),
)
const decorationOnly = computed(
  () => props.designTools === false && ['divider', 'spacer'].includes(props.kind || ''),
)
const noImage = computed(
  () =>
    simple.value ||
    [
      'video',
      'downloads',
      'list',
      'chart',
      'progress',
      'statistics',
      'timeline',
      'alert',
      'metric',
      'progress-ring',
      'sparkline',
      'data-table',
    ].includes(props.kind || ''),
)
const noLink = computed(() =>
  [
    'divider',
    'spacer',
    'badge',
    'chart',
    'progress',
    'statistics',
    'progress-ring',
    'sparkline',
    'data-table',
  ].includes(props.kind || ''),
)
const emit = defineEmits<{ update: [item: WebsiteItem]; uploading: [busy: boolean] }>()
function update(key: keyof WebsiteItem, event: Event) {
  const value = { ...props.item, [key]: (event.target as HTMLInputElement).value }
  if (key === 'linkLabel') delete value.linkRichText
  emit('update', value)
}
</script>
<template>
  <div class="item-fields" :data-item-id="item.id">
    <p v-if="decorationOnly" class="field-hint">
      This is a layout element with no editable content. Use Design mode to adjust its appearance or
      spacing.
    </p>
    <WebsiteRichField
      v-if="richHeading"
      :text="item.title"
      :rich="item.titleRichText"
      heading
      @update="(title, _format, titleRichText) => emit('update', { ...item, title, titleRichText })"
    />
    <label v-else-if="designTools !== false || (!imageOnly && !menuOnly && !decorationOnly)"
      >{{ menuOnly ? 'Widget name' : 'Heading'
      }}<input :value="item.title" maxlength="160" @input="update('title', $event)"
    /></label>
    <WebsiteRichField
      v-if="richBody"
      :text="item.text"
      :rich="item.textRichText"
      :format="item.textFormat"
      @update="
        (text, textFormat, textRichText) =>
          emit('update', { ...item, text, textFormat, textRichText })
      "
    />
    <WebsiteTextEditor
      v-else-if="
        !imageOnly &&
        !simple &&
        !(collectionItem && ['chart', 'progress', 'sparkline'].includes(kind || ''))
      "
      :text="item.text"
      :format="item.textFormat"
      @update="(text, textFormat) => emit('update', { ...item, text, textFormat })"
    />
    <details
      v-if="!contentOnly && !noImage"
      class="field-group"
      :open="designTools !== false || imageOnly || !!item.imageId"
    >
      <summary>{{ menuOnly ? 'Logo' : 'Image' }}</summary>
      <p v-if="menuOnly" class="field-hint">
        Choose a logo for this widget. Remove it to use the website logo.
      </p>
      <WebsiteImagePicker
        :logo="menuOnly"
        :image-id="item.imageId"
        :alt="item.alt"
        @update="emit('update', { ...item, ...$event })"
        @uploading="emit('uploading', $event)"
      />
      <WebsiteImageControls
        v-show="designTools !== false"
        v-if="item.imageId && !menuOnly && !contentOnly && !noImage"
        :value="item.imageSettings"
        @update="emit('update', { ...item, imageSettings: $event })"
      />
    </details>
    <details
      v-if="!imageOnly && !menuOnly && !contentOnly && !noLink"
      class="field-group"
      :open="
        designTools !== false ||
        !!item.linkLabel ||
        !!item.linkUrl ||
        ['button', 'video', 'downloads'].includes(kind || '')
      "
    >
      <summary>
        {{ kind === 'video' ? 'Video' : kind === 'downloads' ? 'Download' : 'Button' }}
      </summary>
      <label
        >{{
          kind === 'video'
            ? 'Open video label'
            : kind === 'downloads'
              ? 'Download label'
              : 'Button label'
        }}<input :value="item.linkLabel" maxlength="80" @input="update('linkLabel', $event)"
      /></label>
      <label
        >{{
          kind === 'video' ? 'Video link' : kind === 'downloads' ? 'Document link' : 'Button link'
        }}<input
          :value="item.linkUrl"
          data-link-url
          maxlength="1000"
          :placeholder="
            kind === 'video'
              ? 'YouTube, Vimeo, or https://.../video.mp4'
              : kind === 'downloads'
                ? 'https://.../document.pdf'
                : 'https:// or /website/contact'
          "
          @input="update('linkUrl', $event)"
      /></label>
    </details>
    <label
      v-if="
        (collectionItem &&
          ['team', 'testimonials', 'statistics', 'timeline'].includes(kind || '')) ||
        (!collectionItem &&
          ['profile-card', 'card', 'metric', 'progress-ring', 'sparkline'].includes(kind || ''))
      "
      >{{
        ['team', 'profile-card'].includes(kind || '')
          ? 'Role / title'
          : kind === 'testimonials'
            ? 'Company / role'
            : kind === 'timeline'
              ? 'Date / milestone'
              : 'Unit / description'
      }}
      <input :value="item.subtitle || ''" maxlength="160" @input="update('subtitle', $event)" />
    </label>
    <label
      v-if="
        (collectionItem &&
          ['chart', 'statistics', 'progress', 'sparkline', 'data-table'].includes(kind || '')) ||
        (!collectionItem && ['metric', 'progress-ring'].includes(kind || ''))
      "
      >{{ ['progress', 'progress-ring'].includes(kind || '') ? 'Percentage' : 'Value' }}
      <input
        type="number"
        :value="item.value"
        :min="['progress', 'progress-ring'].includes(kind || '') ? 0 : -1e9"
        :max="['progress', 'progress-ring'].includes(kind || '') ? 100 : 1e9"
        step="any"
        @input="
          emit('update', {
            ...item,
            value:
              ($event.target as HTMLInputElement).value === ''
                ? undefined
                : ($event.target as HTMLInputElement).valueAsNumber,
          })
        "
      />
    </label>
    <label v-if="['icon', 'alert'].includes(kind || '')"
      >Icon
      <select
        aria-label="Icon"
        :value="item.icon || 'info-circle'"
        @change="update('icon', $event)"
      >
        <option v-for="icon in widgetIcons" :key="icon" :value="icon">
          {{ icon.replaceAll('-', ' ') }}
        </option>
      </select>
    </label>
    <small v-if="kind === 'video'"
      >Use a public YouTube, Vimeo, MP4 or WebM link. Visitors click to load the player.</small
    >
    <small v-if="kind === 'downloads' && !contentOnly"
      >Link to a publicly accessible document. Its host determines whether it downloads or opens in
      the browser.</small
    >
  </div>
</template>
<style scoped>
.item-fields,
label {
  display: grid;
  gap: 0.4rem;
}
.item-fields {
  gap: 0.8rem;
}
.field-group {
  border-top: 1px solid var(--border);
  padding-top: 0.6rem;
  min-width: 0;
}
.field-group summary {
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.6rem;
}
.field-group > label + label {
  margin-top: 0.6rem;
}
.field-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}
label,
small {
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
textarea {
  resize: vertical;
}
input[type='file'] {
  font-size: 0.75rem;
}
.image-sample {
  height: 120px;
  overflow: hidden;
}
button {
  justify-self: start;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 0.4rem;
  cursor: pointer;
}
[role='alert'] {
  color: var(--danger);
}
</style>
