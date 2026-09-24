<script setup lang="ts" generic="T extends ExplorerDocument">
import { computed, ref, watch } from 'vue'
import ExplorerContextMenu from './ExplorerContextMenu.vue'
import type { ExplorerMenuAction, ExplorerMenuTarget } from '@/features/sds/explorerMenu'
import {
  explorerCompare,
  folderAncestors,
  type ExplorerDocument,
  type ExplorerFolder,
} from '@/features/sds/types'

const props = defineProps<{
  title: string
  folders: ExplorerFolder[]
  documents: T[]
  folderId: string
  search: string
  selectedId: string
  loading?: boolean
  disabled?: boolean
  menuActions?: (target: ExplorerMenuTarget) => ExplorerMenuAction[]
  editing?: boolean
  checkedIds?: string[]
  searchText?: (document: T) => string
}>()
const emit = defineEmits<{
  'update:folderId': [id: string]
  'update:search': [search: string]
  select: [document: T]
  toggle: [document: T]
  toggleFolder: [folder: ExplorerFolder]
  open: [document: T]
  action: [id: string, target: ExplorerMenuTarget]
}>()
const menu = ref<{
  target: ExplorerMenuTarget
  x: number
  y: number
  source: HTMLElement
  key: number
}>()
let menuKey = 0
const actions = computed(() => (menu.value ? (props.menuActions?.(menu.value.target) ?? []) : []))
const menuLabel = computed(() => {
  const target = menu.value?.target
  return target?.kind === 'document'
    ? (props.documents.find((d) => d.id === target.id)?.name ?? 'Sheet')
    : (props.folders.find((f) => f.id === target?.id)?.name ?? 'Root folder')
})
function closeMenu(restore = false) {
  const source = menu.value?.source
  menu.value = undefined
  if (restore) source?.focus({ preventScroll: true })
}
function showMenu(event: MouseEvent | KeyboardEvent, target: ExplorerMenuTarget) {
  if (!props.menuActions) return
  event.preventDefault()
  event.stopPropagation()
  if (props.disabled || props.loading) return
  const element = event.currentTarget as HTMLElement
  const source = element.matches('button')
    ? element
    : (element.querySelector<HTMLElement>('button') ?? element)
  const rect = source.getBoundingClientRect()
  const pointer =
    event instanceof MouseEvent && event.type === 'contextmenu' && (event.clientX || event.clientY)
  menu.value = {
    target,
    x: pointer ? event.clientX : rect.left,
    y: pointer ? event.clientY : rect.bottom,
    source,
    key: ++menuKey,
  }
  if (target.kind === 'document') {
    const document = props.documents.find((d) => d.id === target.id)
    if (document) emit('select', document)
  }
}
function menuKeydown(event: KeyboardEvent, target: ExplorerMenuTarget) {
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
    showMenu(event, target)
}
function runAction(id: string) {
  const target = menu.value?.target
  if (!target || props.disabled || !actions.value.some((a) => a.id === id && !a.disabled)) return
  closeMenu(true)
  if (id === 'open-folder') collapsed.value.delete(target.id)
  emit('action', id, target)
}
watch(
  () => [
    props.folderId,
    props.search,
    props.disabled,
    props.loading,
    props.documents,
    props.folders,
  ],
  () => closeMenu(),
)
const collapsed = ref(new Set<string>())
const matching = computed(() =>
  props.documents.filter(
    (document) =>
      !props.search.trim() ||
      (props.searchText?.(document) ?? document.name)
        .toLocaleLowerCase()
        .includes(props.search.trim().toLocaleLowerCase()),
  ),
)
type TreeRow =
  | { kind: 'folder'; folder: ExplorerFolder; depth: number }
  | { kind: 'document'; document: T; depth: number }
const tree = computed(() => {
  const rows: TreeRow[] = []
  const walk = (parentId: string, depth: number) => {
    if (depth > 8) return
    props.folders
      .filter((f) => f.parentId === parentId)
      .sort(explorerCompare)
      .forEach((folder) => {
        if (
          props.search.trim() &&
          !matching.value.some((d) =>
            folderAncestors(d.folderId, props.folders).some((f) => f.id === folder.id),
          )
        )
          return
        rows.push({ kind: 'folder', folder, depth })
        if (props.search.trim() || !collapsed.value.has(folder.id)) walk(folder.id, depth + 1)
      })
    matching.value
      .filter((d) => d.folderId === parentId)
      .sort(explorerCompare)
      .forEach((document) => rows.push({ kind: 'document', document, depth }))
  }
  walk('', 0)
  return rows
})
function openFolder(folder: ExplorerFolder) {
  const next = new Set(collapsed.value)
  if (next.has(folder.id)) next.delete(folder.id)
  else next.add(folder.id)
  collapsed.value = next
  emit('update:folderId', folder.id)
}
watch(
  () => props.folderId,
  (id) => {
    const next = new Set(collapsed.value)
    folderAncestors(id, props.folders)
      .filter((folder) => folder.id !== id)
      .forEach((folder) => next.delete(folder.id))
    collapsed.value = next
  },
)
function folderState(folder: ExplorerFolder) {
  const children = props.documents.filter(
    (d) =>
      d.folderId === folder.id ||
      folderAncestors(d.folderId, props.folders).some((f) => f.id === folder.id),
  )
  const count = children.filter((d) => props.checkedIds?.includes(d.id)).length
  return {
    checked: children.length > 0 && count === children.length,
    mixed: count > 0 && count < children.length,
    count: children.length,
  }
}
</script>

<template>
  <section class="document-explorer" :aria-label="title">
    <header class="document-explorer__header">
      <h2>{{ title }}</h2>
      <slot name="context" />
      <label class="document-explorer__search">
        <span class="sr-only">Search files</span>
        <i class="pi pi-search" aria-hidden="true" />
        <input
          type="search"
          :value="search"
          placeholder="Search files…"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <slot name="toolbar" />
    </header>
    <div class="document-explorer__body">
      <nav
        aria-label="Folders"
        class="document-explorer__folders"
        @contextmenu="showMenu($event, { kind: 'background', id: folderId })"
      >
        <div class="tree-row tree-root">
          <button
            class="tree-name"
            type="button"
            :aria-current="!folderId ? 'location' : undefined"
            @click="emit('update:folderId', '')"
            @keydown="menuKeydown($event, { kind: 'background', id: '' })"
            @contextmenu="showMenu($event, { kind: 'background', id: '' })"
          >
            <i class="pi pi-folder-open" aria-hidden="true" /> Root folder
          </button>
          <button
            v-if="menuActions"
            class="more"
            type="button"
            aria-label="Current folder actions"
            aria-haspopup="menu"
            @click="showMenu($event, { kind: 'background', id: folderId })"
          >
            <i class="pi pi-ellipsis-h" aria-hidden="true" />
          </button>
        </div>
        <p v-if="loading" role="status">Loading documents…</p>
        <template v-else>
          <div
            v-for="row in tree"
            :key="row.kind === 'folder' ? 'f-' + row.folder.id : 'd-' + row.document.id"
            class="tree-row"
            :class="{ 'is-selected': row.kind === 'document' && row.document.id === selectedId }"
            :style="{ paddingLeft: row.depth * 12 + 'px' }"
            @contextmenu="
              showMenu($event, {
                kind: row.kind,
                id: row.kind === 'folder' ? row.folder.id : row.document.id,
              })
            "
            @keydown="
              menuKeydown($event, {
                kind: row.kind,
                id: row.kind === 'folder' ? row.folder.id : row.document.id,
              })
            "
          >
            <template v-if="row.kind === 'folder'">
              <input
                v-if="editing"
                type="checkbox"
                :aria-label="
                  'Select all ' + folderState(row.folder).count + ' files in ' + row.folder.name
                "
                :checked="folderState(row.folder).checked"
                :indeterminate="folderState(row.folder).mixed"
                :disabled="!folderState(row.folder).count"
                @change="emit('toggleFolder', row.folder)"
              />
              <button
                type="button"
                class="tree-name"
                :aria-expanded="!!search.trim() || !collapsed.has(row.folder.id)"
                :title="row.folder.name"
                @click="openFolder(row.folder)"
              >
                <i
                  :class="[
                    'pi',
                    collapsed.has(row.folder.id) && !search.trim()
                      ? 'pi-angle-right'
                      : 'pi-angle-down',
                  ]"
                  aria-hidden="true"
                />
                <i class="pi pi-folder" aria-hidden="true" /><span>{{ row.folder.name }}</span>
              </button>
              <button
                v-if="menuActions"
                class="more"
                type="button"
                :aria-label="'Actions for ' + row.folder.name"
                aria-haspopup="menu"
                @click="showMenu($event, { kind: 'folder', id: row.folder.id })"
              >
                <i class="pi pi-ellipsis-h" aria-hidden="true" />
              </button>
            </template>
            <template v-else>
              <input
                v-if="editing"
                type="checkbox"
                :checked="checkedIds?.includes(row.document.id)"
                :aria-label="'Include ' + row.document.name"
                @change="emit('toggle', row.document)"
              />
              <button
                type="button"
                class="tree-name tree-file"
                :title="row.document.name"
                :aria-pressed="row.document.id === selectedId"
                @click="emit('select', row.document)"
                @dblclick="emit('open', row.document)"
              >
                <i class="pi pi-file" aria-hidden="true" /><span>{{ row.document.name }}</span>
              </button>
              <button
                v-if="menuActions"
                class="more"
                type="button"
                :aria-label="'Actions for ' + row.document.name"
                aria-haspopup="menu"
                @click="showMenu($event, { kind: 'document', id: row.document.id })"
              >
                <i class="pi pi-ellipsis-h" aria-hidden="true" />
              </button>
            </template>
          </div>
          <p v-if="!matching.length" role="status">
            {{ search ? 'No matching files. Try another search.' : 'No files in this collection.' }}
          </p>
        </template>
      </nav>
      <section class="document-explorer__viewer" aria-label="File viewer">
        <slot name="viewer"><p class="viewer-empty">Select a file to preview it.</p></slot>
      </section>
    </div>
    <ExplorerContextMenu
      v-if="menu && actions.length"
      :key="menu.key"
      :x="menu.x"
      :y="menu.y"
      :label="menuLabel"
      :actions="actions"
      @close="closeMenu"
      @action="runAction"
    />
  </section>
</template>

<style scoped>
.document-explorer {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-background);
  overflow: hidden;
  min-width: 0;
}
.document-explorer__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.65rem;
  border-bottom: 1px solid var(--border);
  min-width: 0;
}
h2 {
  margin: 0;
  font-size: 1rem;
  white-space: nowrap;
}
.document-explorer__search {
  position: relative;
  flex: 0 1 230px;
  min-width: 90px;
  margin-left: auto;
}
.document-explorer__search > i {
  position: absolute;
  left: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8rem;
  pointer-events: none;
}
input[type='search'] {
  box-sizing: border-box;
  width: 100%;
  padding: 0.35rem 0.4rem 0.35rem 1.8rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font: inherit;
  font-size: 0.85rem;
  background: transparent;
  color: inherit;
}
.document-explorer__body {
  display: grid;
  grid-template-columns: minmax(180px, 27%) minmax(0, 1fr);
  height: var(--explorer-height, 440px);
}
.document-explorer__folders {
  padding: 0.35rem;
  border-right: 1px solid var(--border);
  overflow: auto;
  min-width: 0;
  font-size: 0.85rem;
}
.tree-row {
  display: flex;
  align-items: center;
  min-height: 30px;
  border-radius: 3px;
}
.tree-root {
  margin-bottom: 0.25rem;
  border-bottom: 1px solid var(--border);
}
button {
  font: inherit;
  cursor: pointer;
  color: inherit;
  background: transparent;
  border: 0;
}
.tree-name {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.2rem;
  text-align: left;
}
.tree-name span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tree-name i {
  flex-shrink: 0;
  font-size: 0.8rem;
}
.tree-file {
  padding-left: 1rem;
}
.more {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  min-height: 30px;
  padding: 0;
}
.is-selected,
.tree-row:hover {
  background: var(--field-hover, #3289bf22);
}
.is-selected {
  box-shadow: inset 2px 0 var(--accent);
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
input[type='checkbox'] {
  width: 16px;
  height: 16px;
  margin: 0 0.2rem;
  flex-shrink: 0;
}
.document-explorer__viewer {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #00000012;
}
.viewer-empty {
  margin: auto;
  padding: 1rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
p {
  padding: 0.35rem;
  color: var(--text-muted);
}
@media (max-width: 700px) {
  .document-explorer__header {
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .document-explorer__search {
    flex: 1;
  }
  .document-explorer__body {
    grid-template-columns: minmax(120px, 36%) minmax(0, 1fr);
  }
  .document-explorer__folders {
    font-size: 0.8rem;
  }
  .tree-row {
    min-height: 36px;
  }
  .tree-name {
    gap: 0.2rem;
  }
  .more {
    width: 24px;
    min-height: 36px;
  }
}
</style>
