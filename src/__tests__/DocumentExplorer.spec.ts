import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DocumentExplorer from '@/components/dashboard/DocumentExplorer.vue'
import { visibleFolders } from '@/features/sds/types'

const folders = [
  { id: 'a', name: 'Adhesives', parentId: '', order: 0 },
  { id: 'b', name: 'Interior', parentId: 'a', order: 0 },
  { id: 'c', name: 'Paint', parentId: '', order: 1 },
]
const documents = [
  { id: 'one', name: 'Glue', folderId: 'b', order: 1 },
  { id: 'two', name: 'Paste', folderId: 'b', order: 2 },
]
describe('document explorer', () => {
  it('keeps only ancestor folders for a selected job subset', () => {
    expect(visibleFolders(documents.slice(0, 1), folders).map((f) => f.id)).toEqual(['a', 'b'])
  })
  it('searches across folders while preserving a mixed folder selection', async () => {
    const wrapper = mount(DocumentExplorer, {
      props: {
        title: 'SDS',
        folders,
        documents,
        folderId: '',
        search: 'Glue',
        selectedId: '',
        editing: true,
        checkedIds: ['one'],
      },
    })
    expect(wrapper.text()).toContain('Glue')
    expect(wrapper.text()).not.toContain('Paste')
    const checkbox = wrapper.get<HTMLInputElement>(
      'input[aria-label="Select all 2 files in Adhesives"]',
    )
    expect(checkbox.element.indeterminate).toBe(true)
    await checkbox.setValue(true)
    expect(wrapper.emitted('toggleFolder')?.[0]).toEqual([folders[0]])
  })
  it('opens a nested folder without generating any document mutation', async () => {
    const wrapper = mount(DocumentExplorer, {
      props: { title: 'SDS', folders, documents, folderId: '', search: '', selectedId: '' },
    })
    const folder = wrapper.findAll('button').find((button) => button.text() === 'Interior')!
    await folder.trigger('click')
    expect(wrapper.emitted('update:folderId')?.[0]).toEqual(['b'])
    expect(wrapper.emitted('toggle')).toBeUndefined()
    expect(wrapper.find('input[type=checkbox]').exists()).toBe(false)
  })
})

it('places its search above Root in the opt-in sidebar and leaves the legacy toolbar available elsewhere', async () => {
  const view = mount(DocumentExplorer, {
    props: {
      title: 'Documents',
      folders,
      documents,
      folderId: '',
      search: '',
      selectedId: '',
      sidebarTools: true,
    },
    slots: { toolbar: '<button>Legacy toolbar action</button>' },
  })
  const sidebar = view.get('.document-explorer__sidebar')
  expect(sidebar.find('input[type=search]').exists()).toBe(true)
  const input = sidebar.get('input[type=search]'),
    root = sidebar.get('.tree-root')
  expect(
    input.element.compareDocumentPosition(root.element) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  expect(view.find('.document-explorer__header').exists()).toBe(false)
  expect(view.text()).not.toContain('Legacy toolbar action')
  await input.setValue('Interior')
  expect(view.emitted('update:search')).toEqual([['Interior']])
  await view.setProps({ sidebarTools: false })
  expect(view.find('.document-explorer__header input[type=search]').exists()).toBe(true)
  expect(view.text()).toContain('Legacy toolbar action')
  view.unmount()
})

const mediaRemovals = vi.fn<MediaQueryList['removeEventListener']>()
afterEach(() => {
  vi.unstubAllGlobals()
  mediaRemovals.mockClear()
})
it('opens an opt-in phone drawer, focuses search, selects a file and restores its trigger', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn<() => void>(),
      removeEventListener: mediaRemovals,
    })),
  )
  const view = mount(DocumentExplorer, {
    attachTo: document.body,
    props: {
      title: 'Documents',
      folders,
      documents,
      folderId: '',
      search: '',
      selectedId: '',
      sidebarTools: true,
    },
  })
  await flushPromises()
  const trigger = view.get('[aria-label="Open files"]')
  expect(trigger.attributes('aria-expanded')).toBe('false')
  expect(view.get('.document-explorer__sidebar').attributes('inert')).toBeDefined()
  await trigger.trigger('click')
  await flushPromises()
  expect(trigger.attributes('aria-expanded')).toBe('true')
  expect(document.activeElement).toBe(view.get('input[type=search]').element)
  await view
    .findAll('.tree-file')
    .find((button) => button.text() === 'Glue')!
    .trigger('click')
  await flushPromises()
  expect(view.emitted('select')).toEqual([[documents[0]]])
  expect(trigger.attributes('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(trigger.element)
  view.unmount()
  expect(mediaRemovals).toHaveBeenCalledOnce()
})

function responsiveExplorer() {
  let notify: ResizeObserverCallback = () => {}
  const disconnect = vi.fn<() => void>(),
    observe = vi.fn<(target: Element) => void>()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        notify = callback
      }
      observe = observe
      disconnect = disconnect
    },
  )
  let mediaChange = () => {}
  const media = {
    matches: false,
    addEventListener: vi.fn<(event: string, listener: () => void) => void>((_event, listener) => {
      mediaChange = listener
    }),
    removeEventListener: mediaRemovals,
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  const view = mount(DocumentExplorer, {
    attachTo: document.body,
    props: {
      title: 'Documents',
      folders,
      documents,
      folderId: '',
      search: '',
      selectedId: '',
      sidebarTools: true,
      menuActions: () => [{ id: 'refresh', label: 'Refresh files' }],
    },
  })
  const root = view.element
  // Camera transforms must not choose the responsive mode.
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ width: 200 } as DOMRect)
  const width = async (value: number) => {
    notify(
      [{ target: root, contentRect: { width: value } } as ResizeObserverEntry],
      {} as ResizeObserver,
    )
    await flushPromises()
  }
  const phone = async (value: boolean) => {
    media.matches = value
    mediaChange()
    await flushPromises()
  }
  return { view, width, phone, observe, disconnect }
}

it('uses authored width or phone media for its opt-in drawer', async () => {
  const { view, width, phone, observe } = responsiveExplorer()
  expect(observe).toHaveBeenCalledWith(view.element)
  await width(601)
  expect(view.find('[aria-label="Open files"]').exists()).toBe(false)
  await width(600)
  expect(view.find('[aria-label="Open files"]').exists()).toBe(true)
  await phone(true)
  await width(900)
  expect(view.find('[aria-label="Open files"]').exists()).toBe(true)
  await phone(false)
  expect(view.find('[aria-label="Open files"]').exists()).toBe(false)
  await width(240)
  await view.setProps({ sidebarTools: false })
  expect(view.find('[aria-label="Open files"]').exists()).toBe(false)
  expect(view.get('.document-explorer__sidebar').attributes('inert')).toBeUndefined()
  view.unmount()
})

it('retains an open drawer across same-mode and hidden-width notifications and disconnects', async () => {
  const { view, width, phone, disconnect } = responsiveExplorer()
  await width(500)
  await view.get('[aria-label="Open files"]').trigger('click')
  await flushPromises()
  for (const value of [499, 500, 0]) await width(value)
  await phone(true)
  await phone(false)
  expect(view.get('[aria-label="Open files"]').attributes('aria-expanded')).toBe('true')
  expect(document.activeElement).toBe(view.get('input[type=search]').element)
  view.unmount()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(mediaRemovals).toHaveBeenCalledOnce()
})

it('restores disappearing controls in both directions without stealing unrelated focus', async () => {
  const { view, width } = responsiveExplorer()
  await width(900)
  view.get<HTMLInputElement>('input[type=search]').element.focus()
  await width(500)
  expect(document.activeElement).toBe(view.get('[aria-label="Open files"]').element)
  await width(900)
  expect(document.activeElement).toBe(view.get('input[type=search]').element)
  const outside = document.createElement('button')
  document.body.append(outside)
  outside.focus()
  await width(500)
  expect(document.activeElement).toBe(outside)
  outside.remove()
  view.unmount()
})

it('closes its teleported menu and restores focus when the drawer mode changes', async () => {
  const { view, width } = responsiveExplorer()
  await width(900)
  await view.get('[aria-label="Root folder actions"]').trigger('click')
  await flushPromises()
  expect(document.activeElement?.getAttribute('role')).toBe('menuitem')
  await width(500)
  expect(document.querySelector('.explorer-menu')).toBeNull()
  expect(document.activeElement).toBe(view.get('[aria-label="Open files"]').element)
  view.unmount()
})
