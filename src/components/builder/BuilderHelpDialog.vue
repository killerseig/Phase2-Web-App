<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'

export interface BuilderHelpGroup {
  title: string
  items: { action: string; keys?: string; detail: string }[]
}
defineProps<{ title: string; introduction: string; groups: BuilderHelpGroup[] }>()
const dialog = ref<HTMLDialogElement>()
const closeButton = ref<HTMLButtonElement>()
const id = useId()
let opener: HTMLElement | null = null
async function open(event?: Event) {
  if (dialog.value?.open) return
  opener =
    event?.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  await nextTick()
  if (!dialog.value?.isConnected) return
  dialog.value.showModal()
  closeButton.value?.focus()
}
function close() {
  dialog.value?.close()
  opener?.focus({ preventScroll: true })
  opener = null
}
function keyboard(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const buttons = dialog.value?.querySelectorAll<HTMLButtonElement>('button')
  const first = buttons?.[0],
    last = buttons?.[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
onBeforeUnmount(() => dialog.value?.close())
defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="builder-controls builder-dialog builder-help"
      :aria-labelledby="`${id}-title`"
      :aria-describedby="`${id}-intro`"
      @cancel.prevent="close"
      @keydown.stop="keyboard"
    >
      <header>
        <div>
          <h2 :id="`${id}-title`">{{ title }}</h2>
          <p :id="`${id}-intro`">{{ introduction }}</p>
        </div>
        <button
          ref="closeButton"
          type="button"
          aria-label="Close guide"
          title="Close guide (Escape)"
          @click="close"
        >
          <i class="pi pi-times" aria-hidden="true" />
        </button>
      </header>
      <div class="help-body">
        <section v-for="group in groups" :key="group.title" :aria-label="group.title">
          <h3>{{ group.title }}</h3>
          <dl>
            <div v-for="item in group.items" :key="item.action" class="help-row">
              <dt>
                {{ item.action }}<kbd v-if="item.keys">{{ item.keys }}</kbd>
              </dt>
              <dd>{{ item.detail }}</dd>
            </div>
          </dl>
        </section>
      </div>
      <footer>
        <span>Escape closes this guide.</span><button type="button" @click="close">Done</button>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.builder-help {
  box-sizing: border-box;
  width: min(760px, calc(100vw - 24px));
  max-height: min(780px, calc(100dvh - 24px));
}
.builder-help[open] {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex: 0 0 auto;
}
header > div {
  flex: 1;
  min-width: 0;
}
header > button {
  flex: 0 0 auto;
}
h2 {
  margin: 0;
}
.help-body {
  overflow: auto;
  min-height: 0;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  padding-right: 6px;
}
h3 {
  font:
    600 13px/1.5 'Source Sans 3',
    sans-serif;
  color: var(--editor-accent);
  margin: 0 0 8px;
}
dl {
  margin: 0;
}
.help-row {
  padding: 9px 0;
  border-top: 1px solid var(--editor-border);
}
dt {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 8px;
  font-weight: 600;
}
dd {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--editor-muted);
}
kbd {
  font:
    11px/1.5 'Source Sans 3',
    sans-serif;
  padding: 1px 5px;
  border: 1px solid var(--editor-border);
  border-radius: 4px;
  background: var(--editor-field);
  white-space: nowrap;
}
footer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}
footer span {
  font-size: 12px;
  color: var(--editor-muted);
}
@media (max-width: 600px) {
  .help-body {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
