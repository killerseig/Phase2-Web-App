import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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
  const view = mount(DocumentExplorer, { props: { title: 'Documents', folders, documents, folderId: '', search: '', selectedId: '', sidebarTools: true }, slots: { toolbar: '<button>Legacy toolbar action</button>' } })
  const sidebar = view.get('.document-explorer__sidebar')
  expect(sidebar.find('input[type=search]').exists()).toBe(true)
  const input = sidebar.get('input[type=search]'), root = sidebar.get('.tree-root')
  expect(input.element.compareDocumentPosition(root.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(view.find('.document-explorer__header').exists()).toBe(false)
  expect(view.text()).not.toContain('Legacy toolbar action')
  await input.setValue('Interior')
  expect(view.emitted('update:search')).toEqual([['Interior']])
  await view.setProps({ sidebarTools: false })
  expect(view.find('.document-explorer__header input[type=search]').exists()).toBe(true)
  expect(view.text()).toContain('Legacy toolbar action')
  view.unmount()
})
