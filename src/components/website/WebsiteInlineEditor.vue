<script setup lang="ts">
import { Editor, EditorContent, Extension } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Plugin } from '@tiptap/pm/state'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { inlineDocument, inlineValue } from '@/features/website/inlineText'
import { safeWebsiteLink } from '../../../functions/src/websiteContent'
import {
  textFonts,
  textSizes,
  lineHeights,
  richTextPlain,
  type RichTextNode,
} from '../../../functions/src/websiteRichText'

const props = defineProps<{
  text: string
  format?: 'markdown'
  rich?: RichTextNode
  heading: boolean
  allowLinks?: boolean
  maxLength?: number
  label?: string
  linkSettings?: boolean
}>()
const emit = defineEmits<{
  update: [text: string, format?: 'markdown', rich?: RichTextNode]
  done: [focus?: boolean]
  'link-settings': []
}>()
const root = ref<HTMLElement>()
const toolbar = ref<HTMLElement>()
const linkInput = ref<HTMLInputElement>()
const linkOpen = ref(false)
const moreOpen = ref(false)
const url = ref('')
const error = ref('')
const toolbarStyle = ref({ left: '8px', top: '8px', maxHeight: '440px' })
const revision = ref(0)
let lastValue = { text: props.text, format: props.format }
let lastRich = JSON.stringify(props.rich)
let finished = false
function done(focus = false) {
  if (!finished) {
    finished = true
    emit('done', focus)
  }
}
const editor = new Editor({
  content: inlineDocument(props.text, props.heading ? undefined : props.format, props.rich),
  extensions: [
    StarterKit.configure({
      blockquote: props.heading ? false : {},
      codeBlock: props.heading ? false : {},
      horizontalRule: props.heading ? false : {},
      trailingNode: false,
      hardBreak: props.heading ? false : {},
      dropcursor: false,
      gapcursor: false,
      heading: props.heading ? false : { levels: [1, 2, 3, 4, 5, 6] },
      bulletList: props.heading ? false : {},
      orderedList: props.heading ? false : {},
      listItem: props.heading ? false : {},
      listKeymap: props.heading ? false : {},
      link:
        props.allowLinks === false
          ? false
          : {
              openOnClick: false,
              autolink: false,
              linkOnPaste: false,
              isAllowedUri: (value) => safeWebsiteLink(value),
            },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ['paragraph', 'heading'] }),
    Subscript,
    Superscript,
    Extension.create({
      name: 'paragraphSpacing',
      addGlobalAttributes() {
        return [
          {
            types: ['paragraph', 'heading'],
            attributes: {
              indent: {
                default: 0,
                renderHTML: (attrs) =>
                  attrs.indent
                    ? { style: `padding-inline-start: ${Number(attrs.indent) * 1.5}em` }
                    : {},
              },
              lineHeight: {
                default: null,
                renderHTML: (attrs) =>
                  attrs.lineHeight ? { style: `line-height: ${Number(attrs.lineHeight)}` } : {},
              },
            },
          },
        ]
      },
    }),
  ],
  enableInputRules: false,
  enablePasteRules: false,
  editorProps: {
    attributes: {
      role: 'textbox',
      'aria-label': props.label || (props.heading ? 'Edit heading on page' : 'Edit text on page'),
      'aria-multiline': String(!props.heading),
      spellcheck: 'true',
    },
    handleKeyDown: (_view, event) => {
      if (
        event.key === 'Escape' ||
        (props.heading && event.key === 'Enter' && !event.isComposing)
      ) {
        event.preventDefault()
        done(true)
        return true
      }
      // Keep text formatting reachable without canvas shortcuts handling the key.
      if (event.key === 'Tab') {
        event.preventDefault()
        toolbar.value?.querySelector<HTMLButtonElement>('[aria-label="Bold"]')?.focus()
        return true
      }
      return false
    },
    handlePaste: (_view, event) => {
      const text = event.clipboardData?.getData('text/plain')
      if (text === undefined) return false
      event.preventDefault()
      editor.commands.insertContent(
        inlineDocument(props.heading ? text.replace(/\s*\n\s*/g, ' ') : text).content!,
      )
      return true
    },
    handleDrop: () => true,
  },
  onUpdate: () => {
    const value = inlineValue(editor.getJSON(), props.heading, props.format === 'markdown')
    lastValue = { text: value.text, format: value.format }
    lastRich = JSON.stringify(value.rich)
    emit('update', value.text, value.format, value.rich)
    void nextTick(positionToolbar)
  },
  onTransaction: () => {
    revision.value++
  },
})
editor.registerPlugin(
  new Plugin({
    filterTransaction(transaction) {
      if (!transaction.docChanged) return true
      try {
        const value = inlineValue(
          transaction.doc.toJSON(),
          props.heading,
          props.format === 'markdown',
        )
        if (props.maxLength && value.text.length > props.maxLength)
          throw new Error(`Keep this label within ${props.maxLength} characters.`)
        error.value = ''
        return true
      } catch (issue) {
        error.value = issue instanceof Error ? issue.message : 'Unable to apply this text change.'
        return false
      }
    },
  }),
)
const block = computed(() => {
  void revision.value
  return editor.isActive('heading') ? 'h' + editor.getAttributes('heading').level : 'p'
})
function setBlock(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const chain = editor.chain().focus().clearNodes()
  if (value === 'p') chain.setParagraph().run()
  else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run()
}
const markOptions = [
  { name: 'bold', label: 'Bold', glyph: 'B' },
  { name: 'italic', label: 'Italic', glyph: 'I' },
  { name: 'underline', label: 'Underline', glyph: 'U' },
  { name: 'strike', label: 'Strikethrough', glyph: 'S' },
  { name: 'subscript', label: 'Subscript', glyph: 'x₂' },
  { name: 'superscript', label: 'Superscript', glyph: 'x²' },
  { name: 'code', label: 'Inline code', glyph: '</>' },
]
const alignments = ['left', 'center', 'right', 'justify']
function mark(name: string) {
  const chain = editor.chain().focus()
  if (name === 'subscript') chain.unsetSuperscript()
  if (name === 'superscript') chain.unsetSubscript()
  chain.toggleMark(name).run()
}
function font(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const chain = editor.chain().focus()
  if (value) chain.setFontFamily(value).run()
  else chain.unsetFontFamily().run()
}
const sizeDraft = ref('')
const sizeEditing = ref(false)
watch(
  () => {
    void revision.value
    return editor.getAttributes('textStyle').fontSize
  },
  (value) => {
    // Editor blur/selection transactions must not erase an uncommitted input.
    if (!sizeEditing.value) sizeDraft.value = String(parseFloat(value) || '')
  },
  { immediate: true },
)
function size(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.validity.valid) {
    input.reportValidity()
    return
  }
  const value = input.value
  const chain = editor.chain().focus()
  if (value) chain.setFontSize(value + 'px').run()
  else chain.unsetFontSize().run()
}
function color(event: Event, highlight = false) {
  const value = (event.target as HTMLInputElement).value
  const chain = editor.chain().focus()
  if (highlight) chain.setBackgroundColor(value).run()
  else chain.setColor(value).run()
}
function paragraphStyle(
  key: 'indent' | 'lineHeight',
  value: number | string | null,
  delta = false,
) {
  editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
        if (!['paragraph', 'heading'].includes(node.type.name)) return
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          [key]: delta
            ? Math.min(8, Math.max(0, Number(node.attrs[key] || 0) + Number(value)))
            : value,
        })
      })
      return true
    })
    .run()
}
function indent(delta: -1 | 1) {
  if (editor.isActive('listItem')) {
    const chain = editor.chain().focus()
    if (delta > 0) chain.sinkListItem('listItem').run()
    else chain.liftListItem('listItem').run()
  } else paragraphStyle('indent', delta, true)
}
function clearFormatting() {
  editor
    .chain()
    .focus()
    .unsetAllMarks()
    .clearNodes()
    .resetAttributes('paragraph', ['textAlign', 'indent', 'lineHeight'])
    .run()
}
const blockAttributes = () =>
  editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph')
const textCount = computed(() => {
  void revision.value
  return richTextPlain(editor.getJSON() as RichTextNode).length
})
async function openLink() {
  url.value = String(editor.getAttributes('link').href || '')
  linkOpen.value = !linkOpen.value
  error.value = ''
  await nextTick()
  positionToolbar()
  if (linkOpen.value) linkInput.value?.focus()
}
function applyLink() {
  const href = url.value.trim()
  if (!safeWebsiteLink(href)) {
    error.value = 'Enter an HTTPS, email, phone, or website page link.'
    return
  }
  if (editor.state.selection.empty && !editor.isActive('link')) {
    error.value = 'Select the words you want to link first.'
    return
  }
  error.value = ''
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  if (error.value) return
  linkOpen.value = false
  error.value = ''
}
function closeLink() {
  linkOpen.value = false
  editor.commands.focus()
}
function removeLink() {
  editor.chain().focus().extendMarkRange('link').unsetLink().run()
  linkOpen.value = false
}
function positionToolbar() {
  const rect = root.value?.getBoundingClientRect()
  const bar = toolbar.value?.getBoundingClientRect()
  if (!rect || !bar) return
  const viewport = window.visualViewport
  const left = viewport?.offsetLeft || 0,
    top = viewport?.offsetTop || 0
  const width = viewport?.width || innerWidth,
    height = viewport?.height || innerHeight
  toolbarStyle.value = {
    maxHeight: `${Math.max(80, Math.min(440, height - 16))}px`,
    left: `${Math.max(left + 8, Math.min(rect.left, left + width - bar.width - 8))}px`,
    top: `${Math.max(top + 8, Math.min(rect.top - bar.height - 10 >= top + 8 ? rect.top - bar.height - 10 : rect.bottom + 10, top + height - bar.height - 8))}px`,
  }
}
function inside(target: EventTarget | null) {
  return target instanceof Node && (root.value?.contains(target) || toolbar.value?.contains(target))
}
function outside(event: Event) {
  if (!inside(event.target)) done()
}
watch(
  () => [props.text, props.format, props.rich] as const,
  ([text, format, rich]) => {
    if (
      text !== lastValue.text ||
      format !== lastValue.format ||
      JSON.stringify(rich) !== lastRich
    ) {
      lastValue = { text, format }
      lastRich = JSON.stringify(rich)
      editor.commands.setContent(inlineDocument(text, props.heading ? undefined : format, rich), {
        emitUpdate: false,
      })
    }
  },
)
let observer: ResizeObserver | undefined
onMounted(async () => {
  // EditorContent attaches its DOM on the next tick.
  await nextTick()
  if (editor.isDestroyed) return
  // Set selection and focus together; a deferred focus can overwrite a selection
  // made immediately after opening another field.
  editor.commands.setTextSelection(editor.state.doc.content.size)
  editor.view.focus()
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('focusin', outside)
  window.addEventListener('scroll', positionToolbar, true)
  window.addEventListener('resize', positionToolbar)
  window.visualViewport?.addEventListener('resize', positionToolbar)
  window.visualViewport?.addEventListener('scroll', positionToolbar)
  observer = new ResizeObserver(positionToolbar)
  if (root.value) observer.observe(root.value)
  if (toolbar.value) observer.observe(toolbar.value)
  await nextTick()
  positionToolbar()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('focusin', outside)
  window.removeEventListener('scroll', positionToolbar, true)
  window.removeEventListener('resize', positionToolbar)
  window.visualViewport?.removeEventListener('resize', positionToolbar)
  window.visualViewport?.removeEventListener('scroll', positionToolbar)
  editor.destroy()
})
</script>
<template>
  <div
    ref="root"
    class="inline-text-editor"
    :class="{ 'heading-editor': heading }"
    @pointerdown.stop
    @click.stop
    @dblclick.stop
    @keydown.stop
    @contextmenu.stop
  >
    <EditorContent :editor="editor" />
  </div>
  <Teleport to="body">
    <div
      ref="toolbar"
      class="inline-text-toolbar"
      :class="{ expanded: moreOpen }"
      :style="toolbarStyle"
      role="group"
      aria-label="Text formatting"
      :data-revision="revision"
      @pointerdown.stop
      @keydown.stop
      @keydown.esc.prevent="done(true)"
    >
      <div class="inline-primary-actions">
        <select
          aria-label="Text style"
          class="inline-style-picker"
          :value="block"
          :disabled="heading"
          @change="setBlock"
        >
          <option value="p">{{ heading ? 'Heading' : 'Paragraph' }}</option>
          <option v-for="level in 6" :key="level" :value="'h' + level">Heading {{ level }}</option>
        </select>
        <button
          v-for="option in markOptions.slice(0, 3)"
          :key="option.name"
          type="button"
          :aria-label="option.label"
          :title="option.label"
          :class="'format-' + option.name"
          :aria-pressed="editor.isActive(option.name)"
          @pointerdown.prevent
          @click="mark(option.name)"
        >
          {{ option.glyph }}
        </button>
        <button
          v-if="allowLinks !== false"
          type="button"
          aria-label="Link"
          title="Add or edit link"
          :aria-expanded="linkOpen"
          @pointerdown.prevent
          @click="openLink"
        >
          <i class="pi pi-link" aria-hidden="true" />
        </button>
        <button
          v-if="linkSettings"
          type="button"
          aria-label="Edit link destination"
          title="Edit link destination"
          @pointerdown.prevent
          @click="emit('link-settings')"
        >
          <i class="pi pi-link" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Bulleted list"
          title="Bulleted list"
          :disabled="heading"
          :aria-pressed="editor.isActive('bulletList')"
          @pointerdown.prevent
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <i class="pi pi-list" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          title="Numbered list"
          :disabled="heading"
          :aria-pressed="editor.isActive('orderedList')"
          @pointerdown.prevent
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          1.
        </button>
        <button
          type="button"
          aria-label="Clear formatting"
          title="Clear formatting"
          @pointerdown.prevent
          @click="clearFormatting"
        >
          <i class="pi pi-eraser" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="More formatting"
          title="More formatting"
          :aria-expanded="moreOpen"
          @pointerdown.prevent
          @click="moreOpen = !moreOpen"
        >
          <i class="pi pi-ellipsis-h" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="inline-done"
          aria-label="Done"
          title="Finish editing"
          @click="done(true)"
        >
          <i class="pi pi-check" aria-hidden="true" />
        </button>
      </div>
      <div v-show="moreOpen" class="inline-more-options">
        <div class="inline-text-actions" aria-label="Font and text style">
          <select
            aria-label="Font family"
            :value="editor.getAttributes('textStyle').fontFamily || ''"
            @change="font"
          >
            <option value="">Page font</option>
            <option v-for="family in textFonts" :key="family" :value="family">{{ family }}</option>
          </select>
          <label class="inline-size"
            >Size
            <input
              type="number"
              aria-label="Font size"
              min="8"
              max="160"
              list="inline-font-sizes"
              placeholder="Auto"
              v-model="sizeDraft"
              @focus="sizeEditing = true"
              @blur="sizeEditing = false"
              @change="size"
            />
          </label>
          <datalist id="inline-font-sizes">
            <option v-for="size in textSizes" :key="size" :value="size" />
          </datalist>
          <label class="inline-color" title="Text color"
            >A
            <input
              type="color"
              aria-label="Text color"
              :value="editor.getAttributes('textStyle').color || '#172c40'"
              @input="color($event)"
            />
          </label>
          <button
            type="button"
            aria-label="Reset text color"
            title="Reset text color"
            @pointerdown.prevent
            @click="editor.chain().focus().unsetColor().run()"
          >
            A×
          </button>
          <label class="inline-color" title="Highlight color"
            >Highlight
            <input
              type="color"
              aria-label="Highlight color"
              :value="editor.getAttributes('textStyle').backgroundColor || '#fff59d'"
              @input="color($event, true)"
            />
          </label>
          <button
            type="button"
            aria-label="Remove highlight"
            title="Remove highlight"
            @pointerdown.prevent
            @click="editor.chain().focus().unsetBackgroundColor().run()"
          >
            ×
          </button>
        </div>
        <div class="inline-text-actions" aria-label="Character formatting">
          <button
            v-for="option in markOptions.slice(3)"
            :key="option.name"
            type="button"
            :aria-label="option.label"
            :title="option.label"
            :class="'format-' + option.name"
            :aria-pressed="editor.isActive(option.name)"
            @pointerdown.prevent
            @click="mark(option.name)"
          >
            {{ option.glyph }}
          </button>
          <span class="inline-separator" aria-hidden="true" />
          <button
            type="button"
            aria-label="Remove link"
            title="Remove link"
            :disabled="!editor.isActive('link')"
            @pointerdown.prevent
            @click="removeLink"
          >
            <i class="pi pi-times" aria-hidden="true" />
          </button>
          <span class="inline-separator" aria-hidden="true" />
          <button
            type="button"
            aria-label="Undo text edit"
            title="Undo text edit"
            :disabled="!editor.can().undo()"
            @pointerdown.prevent
            @click="editor.chain().focus().undo().run()"
          >
            <i class="pi pi-undo" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Redo text edit"
            title="Redo text edit"
            :disabled="!editor.can().redo()"
            @pointerdown.prevent
            @click="editor.chain().focus().redo().run()"
          >
            <i class="pi pi-refresh" aria-hidden="true" />
          </button>
        </div>
        <div class="inline-text-actions" aria-label="Paragraph formatting">
          <button
            v-for="alignment in alignments"
            :key="alignment"
            type="button"
            :aria-label="'Align ' + alignment"
            :title="'Align ' + alignment"
            :aria-pressed="editor.isActive({ textAlign: alignment })"
            @pointerdown.prevent
            @click="editor.chain().focus().setTextAlign(alignment).run()"
          >
            <i :class="'pi pi-align-' + alignment" aria-hidden="true" />
          </button>
          <select
            aria-label="Line spacing"
            :value="blockAttributes().lineHeight || ''"
            @change="
              paragraphStyle('lineHeight', ($event.target as HTMLSelectElement).value || null)
            "
          >
            <option value="">Page spacing</option>
            <option v-for="height in lineHeights" :key="height" :value="height">
              {{ height }}× spacing
            </option>
          </select>
          <button
            type="button"
            aria-label="Decrease indent"
            title="Decrease indent"
            @pointerdown.prevent
            @click="indent(-1)"
          >
            <i class="pi pi-arrow-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Increase indent"
            title="Increase indent"
            @pointerdown.prevent
            @click="indent(1)"
          >
            <i class="pi pi-arrow-right" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Block quote"
            title="Block quote"
            :disabled="heading"
            :aria-pressed="editor.isActive('blockquote')"
            @pointerdown.prevent
            @click="editor.chain().focus().toggleBlockquote().run()"
          >
            “ ”
          </button>
          <button
            type="button"
            aria-label="Code block"
            title="Code block"
            :disabled="heading"
            :aria-pressed="editor.isActive('codeBlock')"
            @pointerdown.prevent
            @click="editor.chain().focus().toggleCodeBlock().run()"
          >
            { }
          </button>
          <button
            type="button"
            aria-label="Horizontal rule"
            title="Horizontal rule"
            :disabled="heading"
            @pointerdown.prevent
            @click="editor.chain().focus().setHorizontalRule().run()"
          >
            ―
          </button>
        </div>
        <span class="inline-count"
          >{{ textCount }} / {{ maxLength || (heading ? '160' : '8,000') }}</span
        >
      </div>
      <form v-if="linkOpen" class="inline-link-form" @submit.prevent="applyLink">
        <input
          ref="linkInput"
          v-model="url"
          aria-label="Link address"
          placeholder="https://example.com"
          @keydown.esc.stop.prevent="closeLink"
        />
        <button type="submit">Apply</button>
        <button type="button" @click="removeLink">Remove link</button>
      </form>
      <p v-if="error" role="alert">{{ error }}</p>
    </div>
  </Teleport>
</template>
<style scoped>
.inline-text-editor {
  user-select: text;
  touch-action: auto;
  cursor: text;
}
.inline-text-editor :deep(.tiptap) {
  outline: none;
  min-height: 1em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.inline-text-editor :deep(p) {
  margin: 0 0 0.8rem;
  min-height: 1em;
}
.inline-text-editor :deep(p:last-child) {
  margin-bottom: 0;
}
.inline-text-editor :deep(h2),
.inline-text-editor :deep(h3) {
  margin: 0.7rem 0;
}
.inline-text-editor :deep(a) {
  color: var(--website-accent);
  text-decoration: underline;
}
.heading-editor :deep(p) {
  font: inherit;
  line-height: inherit;
  margin: 0;
}
.inline-text-toolbar {
  position: fixed;
  z-index: 10000;
  width: max-content;
  max-width: calc(100vw - 16px);
  max-height: min(440px, 55dvh);
  overflow: auto;
  box-sizing: border-box;
  padding: 4px;
  border: 1px solid #455b6c;
  border-radius: 8px;
  background: #142b3a;
  color: #f6f9fc;
  box-shadow: 0 4px 20px #0005;
  font:
    13px/1.4 system-ui,
    sans-serif;
}
.inline-primary-actions,
.inline-text-actions,
.inline-link-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}
.inline-text-toolbar.expanded {
  width: 560px;
}
.inline-more-options {
  border-top: 1px solid #455b6c;
  margin-top: 4px;
  padding-top: 4px;
}
.inline-count {
  display: block;
  text-align: right;
  color: #b8cbd8;
  font-size: 11px;
  padding-top: 3px;
}
.inline-text-toolbar .inline-style-picker {
  width: 100px;
}
.inline-text-actions + .inline-text-actions {
  border-top: 1px solid #455b6c;
  margin-top: 4px;
  padding-top: 4px;
}
.inline-size,
.inline-color {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.inline-text-toolbar .inline-size input {
  width: 65px;
  padding: 3px;
}
.inline-text-toolbar input[type='color'] {
  width: 28px;
  min-height: 30px;
  padding: 2px;
  cursor: pointer;
}
.inline-separator {
  height: 24px;
  border-left: 1px solid #61788b;
  margin: 0 2px;
}
.format-bold {
  font-weight: bold !important;
}
.format-italic {
  font-style: italic !important;
}
.format-underline {
  text-decoration: underline;
}
.format-strike {
  text-decoration: line-through;
}
.inline-text-editor :deep(blockquote) {
  border-inline-start: 3px solid currentColor;
  padding-inline-start: 1em;
  margin: 1em 0;
  opacity: 0.9;
}
.inline-text-editor :deep(pre) {
  padding: 0.8em;
  background: #172c4010;
  white-space: pre-wrap;
}
.inline-text-editor :deep(code) {
  font-family: monospace;
  background: #172c4010;
}
.inline-text-toolbar button,
.inline-text-toolbar select,
.inline-text-toolbar input {
  margin: 0;
  min-height: 28px;
  width: auto;
  padding: 3px 5px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
}
.inline-text-toolbar button {
  min-width: 28px;
  cursor: pointer;
}
.inline-text-toolbar option {
  color: #f6f9fc;
  background: #203b4d;
}
.inline-text-toolbar button:hover,
.inline-text-toolbar button[aria-pressed='true'] {
  background: #275d86;
}
.inline-text-toolbar :focus-visible {
  outline: 2px solid #8cd5ff;
  outline-offset: 1px;
}
.inline-text-toolbar button:disabled {
  opacity: 0.4;
  cursor: default;
}
.inline-text-toolbar .inline-done {
  background: #1769a3;
}
.inline-link-form {
  margin-top: 5px;
}
.inline-link-form input {
  flex: 1;
  min-width: 100px;
  border-color: #61788b;
}
.inline-text-toolbar p {
  margin: 6px;
  max-width: 420px;
  color: #ffd4bc;
}
@media (max-width: 600px) {
  .inline-text-toolbar button,
  .inline-text-toolbar select {
    min-height: 36px;
  }
  .inline-text-toolbar button {
    min-width: 32px;
  }
  .inline-text-toolbar .inline-style-picker {
    width: 88px;
  }
}
</style>
