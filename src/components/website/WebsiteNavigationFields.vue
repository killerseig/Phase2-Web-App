<script setup lang="ts">
import type { NavigationSettings, MenuLink } from '../../../functions/src/websiteContent'
import WebsiteRichField from './WebsiteRichField.vue'
const props = defineProps<{ value?: NavigationSettings; footer?: boolean; siteName?: string }>()
const emit = defineEmits<{ update: [value: NavigationSettings] }>()
function change(operation: (next: NavigationSettings) => void) {
  const next: NavigationSettings = JSON.parse(
    JSON.stringify(
      props.value || { showBrand: true, showPages: !props.footer, showLogin: false, links: [] },
    ),
  )
  operation(next)
  emit('update', next)
}
function add(parent = -1) {
  change((next) => {
    const entry: MenuLink = { id: crypto.randomUUID(), label: 'New link', url: '' }
    if (parent < 0) next.links.push(entry)
    else (next.links[parent]!.children ||= []).push(entry)
  })
}
</script>
<template>
  <fieldset>
    <legend>{{ footer ? 'Footer links' : 'Navigation menu' }}</legend>
    <div class="brand-fields" v-if="value?.showBrand !== false">
      <WebsiteRichField
        v-if="value?.brandRichText"
        :text="value.brandText ?? siteName ?? ''"
        :rich="value.brandRichText"
        heading
        label="Brand name"
        @update="
          (text, _format, rich) =>
            change((next) => {
              next.brandText = text
              if (rich) next.brandRichText = rich
              else delete next.brandRichText
            })
        "
      />
      <label v-else
        >Brand name<input
          :value="value?.brandText ?? siteName ?? ''"
          maxlength="160"
          @input="
            change((next) => {
              next.brandText = ($event.target as HTMLInputElement).value
            })
          "
      /></label>
      <button
        v-if="value?.brandText !== undefined || value?.brandRichText"
        type="button"
        @click="
          change((next) => {
            delete next.brandText
            delete next.brandRichText
          })
        "
      >
        Use website name
      </button>
      <p class="field-hint">
        Click the name, logo or text on the page to edit it. This widget follows the website name
        and logo until you customize them.
      </p>
    </div>
    <label
      v-for="[key, label] in [
        ['showBrand', 'Show website name and logo'],
        ['showPages', 'Include pages marked for navigation'],
        ['showLogin', 'Include employee login'],
      ] as const"
      :key="key"
      class="menu-toggle"
      ><input
        type="checkbox"
        :data-menu-link="
          key === 'showPages'
            ? 'automatic-pages'
            : key === 'showLogin'
              ? 'employee-login'
              : undefined
        "
        :checked="value?.[key] ?? (key === 'showBrand' || (key === 'showPages' && !footer))"
        @change="
          change((next) => {
            next[key] = ($event.target as HTMLInputElement).checked
          })
        "
      />
      {{ label }}</label
    >
    <div v-if="value?.pageLabels?.length || value?.loginLabel" class="label-overrides">
      <p class="field-hint">
        Link wording edited on this widget. Page titles and destinations are unchanged.
      </p>
      <button
        v-if="value.pageLabels?.length"
        type="button"
        @click="
          change((next) => {
            delete next.pageLabels
          })
        "
      >
        Use page titles for links
      </button>
      <button
        v-if="value.loginLabel"
        type="button"
        @click="
          change((next) => {
            delete next.loginLabel
          })
        "
      >
        Use default login label
      </button>
    </div>
    <article v-for="(link, index) in value?.links || []" :key="link.id">
      <label
        >Menu label<input
          :data-menu-link="`custom:${link.id}`"
          :value="link.label"
          maxlength="80"
          @input="
            change((next) => {
              next.links[index]!.label = ($event.target as HTMLInputElement).value
              delete next.links[index]!.labelRichText
            })
          "
      /></label>
      <label
        >Menu URL<input
          :value="link.url"
          maxlength="1000"
          placeholder="/website/contact"
          @input="
            change((next) => {
              next.links[index]!.url = ($event.target as HTMLInputElement).value
            })
          "
      /></label>
      <div v-for="(child, childIndex) in link.children || []" :key="child.id" class="submenu">
        <label
          >Dropdown label<input
            :data-menu-link="`custom:${link.id}/${child.id}`"
            :value="child.label"
            maxlength="80"
            @input="
              change((next) => {
                next.links[index]!.children![childIndex]!.label = (
                  $event.target as HTMLInputElement
                ).value
                delete next.links[index]!.children![childIndex]!.labelRichText
              })
            "
        /></label>
        <label
          >Dropdown URL<input
            :value="child.url"
            maxlength="1000"
            @input="
              change((next) => {
                next.links[index]!.children![childIndex]!.url = (
                  $event.target as HTMLInputElement
                ).value
              })
            "
        /></label>
        <button
          type="button"
          @click="
            change((next) => {
              next.links[index]!.children!.splice(childIndex, 1)
            })
          "
        >
          Remove dropdown link
        </button>
      </div>
      <div class="menu-actions">
        <button type="button" :disabled="(link.children?.length || 0) >= 8" @click="add(index)">
          Add dropdown link
        </button>
        <button
          type="button"
          :disabled="index === 0"
          @click="
            change((next) => {
              const entry = next.links.splice(index, 1)[0]!
              next.links.splice(index - 1, 0, entry)
            })
          "
        >
          Move link up
        </button>
        <button
          type="button"
          :disabled="index === (value?.links.length || 0) - 1"
          @click="
            change((next) => {
              const entry = next.links.splice(index, 1)[0]!
              next.links.splice(index + 1, 0, entry)
            })
          "
        >
          Move link down
        </button>
        <button
          type="button"
          @click="
            change((next) => {
              next.links.splice(index, 1)
            })
          "
        >
          Remove menu link
        </button>
      </div>
    </article>
    <button type="button" :disabled="(value?.links.length || 0) >= 12" @click="add()">
      Add menu link
    </button>
  </fieldset>
</template>
<style scoped>
fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  font-weight: 600;
  margin-bottom: 0.4rem;
}
.menu-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.brand-fields {
  display: grid;
  gap: 0.4rem;
}
.brand-fields > button {
  justify-self: start;
}
.menu-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.5rem 0;
}
.field-hint {
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
}
label {
  display: block;
  font-size: 0.8rem;
  margin: 0.5rem 0;
}
input:not([type='checkbox']) {
  width: 100%;
  box-sizing: border-box;
}
article {
  border-top: 1px solid var(--border);
  margin-top: 0.5rem;
  padding: 0.3rem;
}
button {
  font-size: 0.75rem;
  padding: 0.3rem;
}
.submenu {
  margin-left: 0.7rem;
  border-left: 2px solid var(--border);
  padding-left: 0.4rem;
}
</style>
