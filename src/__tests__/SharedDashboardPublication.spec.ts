import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SharedDashboardView from '@/views/SharedDashboardView.vue'
import { useAuthStore } from '@/stores/auth'
const fake = vi.hoisted(() => ({
  command: vi.fn<(action: string, data?: Record<string, unknown>) => Promise<unknown>>(),
  ask: vi.fn<() => Promise<boolean>>(), discard: vi.fn<() => void>(),
  prepare: vi.fn<() => Promise<boolean>>(), notesDirty:false,
  auth: {currentUser:{uid:'a'},rawRole:'admin',hasWorkspaceAccess:true,assignedJobIds:[] as string[],displayName:'Admin'},
}))
vi.mock('@/stores/auth', async()=>{const {reactive}=await import('vue');const auth=reactive(fake.auth);return {useAuthStore:()=>auth}})
vi.mock('@/stores/jobs',()=>({useJobsStore:()=>({jobs:[],error:null,loading:false,subscribeVisibleJobs:vi.fn<() => void>()})}))
vi.mock('@/services/sharedDashboards',()=>({sharedDashboardCommand:fake.command}))
vi.mock('@/services/forms',()=>({formApi:vi.fn<() => Promise<{ templates: unknown[] }>>().mockResolvedValue({templates:[]})}))
const auth=useAuthStore() as unknown as typeof fake.auth
const canvas=defineComponent({
  props:['announcementDrafts','publishedDraftIds','widgets'],
  emits:['publish-announcement'],
  setup(_, {expose}) {expose({prepareForms:fake.prepare,get notesDirty(){return fake.notesDirty},discardNotes:fake.discard})},
  template: "<div><p data-widgets>{{ widgets?.map(widget => widget.id).join(',') }}</p><button v-if=\"announcementDrafts?.length\" @click=\"$emit('publish-announcement',announcementDrafts[0].id)\">Publish test</button><p data-publications>{{ publishedDraftIds?.join(',') }}</p></div>",
})
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); vi.unstubAllGlobals() })
async function open(disposeImmediately = false) {
  const router=createRouter({history:createMemoryHistory(),routes:[
    {path:'/personal',name:'personal-workspace',component:SharedDashboardView},
    {path:'/role',name:'role-workspace',component:{template:'<div />'}},
    {path:'/jobs',name:'jobs',component:{template:'<div />'}},
  ]})
  await router.push('/personal')
  await router.isReady()
  const wrapper=mount(RouterView,{global:{plugins:[router],stubs:{
    AppShell:{template:'<div><slot /></div>'},
    AppLoadingRegion:{setup(_, {expose}){expose({covered:false})},template:'<section><slot /></section>'},
    SharedDashboardCanvas:canvas,
    BuilderConfirmDialog:{setup(_, {expose}){expose({ask:fake.ask})},template:'<div />'},
  }}})
  if (disposeImmediately) {
    wrapper.unmount()
    await flushPromises()
    return wrapper
  }
  await flushPromises()
  cleanup.push(() => wrapper.unmount())
  return wrapper
}
function layout() { const uid=auth.currentUser.uid; return {
  widgets:[{id:'drafts',type:'announcement-drafts',title:'Drafts',span:12,text:''}],version:0,canEdit:true,role:'admin',allowRoleEditing:false,job:null,
  notes:{},events:[],notesVersion:0,publishedDraftIds:[],
  announcementDrafts:[{id:'draft-'+uid,title:'Draft '+uid,body:'Message',audience:'everyone'}],
}}
describe('dashboard confirmation and publication context isolation',()=>{
  beforeEach(()=>{
    fake.command.mockReset();fake.ask.mockReset().mockResolvedValue(true)
    fake.prepare.mockReset().mockResolvedValue(true)
    fake.notesDirty=false;fake.discard.mockReset().mockImplementation(()=>{fake.notesDirty=false})
    auth.currentUser.uid='a';auth.rawRole='admin';auth.hasWorkspaceAccess=true
    vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}})
    vi.stubGlobal('CSS', { escape: (value: string) => value }) // Fixture IDs are plain identifiers.
    fake.command.mockImplementation(async action=>action==='load'?layout():{})
  })
  it('does not resume initialization after the dashboard is unmounted', async () => {
    const created = vi.fn<() => void>()
    vi.stubGlobal('ResizeObserver', class { constructor() { created() } observe() {} disconnect() {} })
    const added = vi.spyOn(window, 'addEventListener')
    try {
      await open(true)
      expect(created).not.toHaveBeenCalled()
      expect(fake.command).not.toHaveBeenCalled()
      expect(added.mock.calls.filter(([name]) => name === 'beforeunload')).toHaveLength(0)
    } finally { added.mockRestore() }
  })
  it.each(['selection', 'device', 'account', 'role', 'access'] as const)(
    'rejects a late inspector lock event after %s changes', async change => {
      fake.command.mockImplementation(async action => action === 'load' ? {
        ...layout(), widgets: [
          { id: 'a', type: 'text', title: 'Alpha', text: '', span: 6 },
          { id: 'b', type: 'text', title: 'Beta', text: '', span: 6 },
        ],
      } : {})
      const wrapper = await open()
      const button = (name: string) => wrapper.findAll('button').find(entry => entry.text() === name)!
      await button('Edit').trigger('click')
      await flushPromises()
      const old = wrapper.get('[data-lock-selection] input').element as HTMLInputElement
      if (change === 'selection') await button('Beta').trigger('click')
      if (change === 'device') await button('Phone').trigger('click')
      if (change === 'account') auth.currentUser.uid = 'b'
      if (change === 'role') auth.rawRole = 'foreman'
      if (change === 'access') auth.hasWorkspaceAccess = false
      await flushPromises()
      old.checked = true
      old.dispatchEvent(new Event('change', { bubbles: true }))
      await flushPromises()
      const currentCanvas = wrapper.findComponent(canvas)
      const currentWidgets = currentCanvas.exists() ? currentCanvas.props('widgets') : []
      expect(currentWidgets.some((w: { positionLocked?: boolean }) => w.positionLocked)).toBe(false)
      expect(fake.command.mock.calls.filter(([action]) => action.startsWith('save'))).toHaveLength(0)
    },
  )
  it('does not change locks while saving a layout', async () => {
    let finish!: (value: unknown) => void
    const source = { ...layout(), widgets: [{ id: 'a', type: 'text', title: 'Alpha', text: '', span: 6 }] }
    fake.command.mockImplementation(action => action === 'load' ? Promise.resolve(source) : new Promise(resolve => { finish = resolve }))
    const wrapper = await open()
    const mountedElement = wrapper.element
    document.body.append(mountedElement)
    cleanup.push(() => mountedElement.remove())
    const button = (name: string) => wrapper.findAll('button').find(entry => entry.text() === name)!
    await button('Edit').trigger('click')
    await wrapper.get('input[maxlength="100"]').setValue('Changed')
    await button('Save template').trigger('click')
    await flushPromises()
    const input = wrapper.get('[data-lock-selection] input').element as HTMLInputElement
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(wrapper.findComponent(canvas).props('widgets')[0].positionLocked).toBeUndefined()
    expect(input.checked).toBe(false)
    finish({ ...source, version: 1 })
    await flushPromises()
  })
  it.each(['account', 'role', 'access'] as const)('rejects an obsolete arrangement after %s changes', async change => {
    const widgets = [
      { id: 'a', type: 'text', title: 'Alpha', text: '', span: 6, placement: { x: 1, y: 2, w: 6, h: 8 } },
      { id: 'b', type: 'text', title: 'Beta', text: '', span: 6, placement: { x: 12, y: 8, w: 6, h: 8 } },
    ]
    fake.command.mockImplementation(async action => action === 'load' ? { ...layout(), widgets } : {})
    const wrapper = await open()
    const button = (name: string) => wrapper.findAll('button').find(entry => entry.text() === name)!
    await button('Edit').trigger('click')
    await button('Alpha').trigger('click')
    await button('Beta').trigger('click', { ctrlKey: true })
    const old = button('Align left').element
    if (change === 'account') auth.currentUser.uid = 'b'
    if (change === 'role') auth.rawRole = 'foreman'
    if (change === 'access') auth.hasWorkspaceAccess = false
    await flushPromises()
    old.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    const current = wrapper.findComponent(canvas)
    const actual = current.exists() ? current.props('widgets') : widgets
    expect(actual).toEqual(widgets)
    expect(fake.command.mock.calls.filter(([action]) => action.startsWith('save'))).toHaveLength(0)
  })
  it('guards arrangement commands while a save is pending', async () => {
    let finish!: (value: unknown) => void
    const widgets = [
      { id: 'a', type: 'text', title: 'Alpha', text: '', span: 6, placement: { x: 1, y: 2, w: 6, h: 8 } },
      { id: 'b', type: 'text', title: 'Beta', text: '', span: 6, placement: { x: 12, y: 8, w: 6, h: 8 } },
    ]
    const source = { ...layout(), widgets }
    fake.command.mockImplementation(action => action === 'load' ? Promise.resolve(source) : new Promise(resolve => { finish = resolve }))
    const wrapper = await open()
    const button = (name: string) => wrapper.findAll('button').find(entry => entry.text() === name)!
    await button('Edit').trigger('click')
    await button('Alpha').trigger('click')
    await button('Beta').trigger('click', { ctrlKey: true })
    await wrapper.get('input[maxlength="100"]').setValue('Changed')
    await button('Save template').trigger('click')
    await flushPromises()
    button('Align left').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.findComponent(canvas).props('widgets').map((w: typeof widgets[number]) => w.placement)).toEqual(widgets.map(w => w.placement))
    finish({ ...source, version: 1 })
    await flushPromises()
  })
  it.each(['account', 'role', 'access'] as const)('does not publish a confirmation after %s changes',async change=>{
    let accept!: (value:boolean)=>void
    fake.ask.mockReturnValue(new Promise(resolve=>{accept=resolve}))
    const wrapper=await open()
    await wrapper.findAll('button').find(button=>button.text()==='Publish test')!.trigger('click')
    await flushPromises()
    if(change==='account')auth.currentUser.uid='b'
    else if(change==='role')auth.rawRole='foreman'
    else auth.hasWorkspaceAccess=false
    await flushPromises()
    accept(true)
    await flushPromises()
    expect(fake.command.mock.calls.filter(([action])=>action==='publish-announcement')).toHaveLength(0)
  })
  it('does not unlock a newer publication when the old request finishes',async()=>{
    const pending=new Map<string,(value:unknown)=>void>()
    fake.command.mockImplementation((action,data)=>action==='load'?Promise.resolve(layout()):new Promise(resolve=>{pending.set(String(data?.draftId),resolve)}))
    const wrapper=await open()
    const publish=()=>wrapper.findAll('button').find(button=>button.text()==='Publish test')!
    await publish().trigger('click')
    await flushPromises()
    auth.currentUser.uid='b'
    await flushPromises()
    await publish().trigger('click')
    await flushPromises()
    pending.get('draft-a')!({id:'old'})
    await flushPromises()
    expect(wrapper.findAll('button').find(button=>button.text()==='Edit')!.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-publications]').text()).toBe('')
    pending.get('draft-b')!({id:'new'})
    await flushPromises()
    expect(wrapper.find('[data-publications]').text()).toBe('draft-b')
    expect(wrapper.findAll('button').find(button=>button.text()==='Edit')!.attributes('disabled')).toBeUndefined()
  })
  it.each(['success','failure'] as const)('ignores a late publication %s from the previous account',async outcome=>{
    let resolve!: (value:unknown)=>void, reject!: (reason:unknown)=>void
    fake.command.mockImplementation(action=>action==='load'?Promise.resolve(layout()):new Promise((yes,no)=>{resolve=yes;reject=no}))
    const wrapper=await open()
    await wrapper.findAll('button').find(button=>button.text()==='Publish test')!.trigger('click')
    await flushPromises()
    auth.currentUser.uid='b'
    await flushPromises()
    if(outcome==='success')resolve({id:'old-publication'})
    else reject(Error('Old account publication failed'))
    await flushPromises()
    expect(wrapper.find('[data-publications]').text()).toBe('')
    expect(wrapper.text()).not.toContain('Announcement published.')
    expect(wrapper.text()).not.toContain('Old account publication failed')
  })
  it('does not remove a widget from a new account after accepting an old confirmation',async()=>{
    const wrapper=await open()
    await wrapper.findAll('button').find(button=>button.text()==='Edit')!.trigger('click')
    await flushPromises()
    let accept!: (value:boolean)=>void
    fake.ask.mockReturnValue(new Promise(resolve=>{accept=resolve}))
    await wrapper.findAll('button').find(button=>button.text()==='Remove widget')!.trigger('click')
    await flushPromises()
    auth.currentUser.uid='b'
    await flushPromises()
    accept(true)
    await flushPromises()
    expect(wrapper.find('[data-widgets]').text()).toBe('drafts')
  })
  it.each(['cancel', 'selection', 'content', 'device'] as const)(
    'does not cut or replace the clipboard after %s invalidates confirmation', async change => {
      fake.command.mockImplementation(async action => action === 'load' ? {
        ...layout(), widgets: [
          { id: 'a', type: 'text', title: 'Alpha', text: '', span: 6 },
          { id: 'b', type: 'text', title: 'Beta', text: '', span: 6 },
        ],
      } : {})
      const wrapper = await open()
      const button = (label: string) => wrapper.findAll('button').find(entry => entry.text() === label)!
      await button('Edit').trigger('click')
      await flushPromises()
      await button('Copy selection').trigger('click')
      await button('Beta').trigger('click')
      let accept!: (value: boolean) => void
      fake.ask.mockReturnValue(new Promise(resolve => { accept = resolve }))
      await button('Cut settings').trigger('click')
      await flushPromises()
      if (change === 'selection') await button('Alpha').trigger('click')
      if (change === 'content') await wrapper.get('input[maxlength="100"]').setValue('Changed')
      if (change === 'device') await button('Phone').trigger('click')
      await flushPromises()
      accept(change !== 'cancel')
      await flushPromises()
      expect(fake.command.mock.calls.filter(([action]) => action.startsWith('save'))).toHaveLength(0)
      expect(wrapper.get('[data-widgets]').text()).toBe('a,b')
      await button('Paste widgets').trigger('click')
      await flushPromises()
      expect(wrapper.get('input[maxlength="100"]').element).toHaveProperty('value', 'Alpha')
      expect(wrapper.get('[data-widgets]').text().split(',')).toHaveLength(3)
    },
  )
  it.each(['account', 'role', 'access'] as const)('rejects an old Cut after %s changes', async change => {
    const wrapper = await open()
    const button = (label: string) => wrapper.findAll('button').find(entry => entry.text() === label)!
    await button('Edit').trigger('click')
    await flushPromises()
    await button('Copy selection').trigger('click')
    let accept!: (value: boolean) => void
    fake.ask.mockReturnValue(new Promise(resolve => { accept = resolve }))
    await button('Cut settings').trigger('click')
    await flushPromises()
    if (change === 'account') auth.currentUser.uid = 'b'
    if (change === 'role') auth.rawRole = 'foreman'
    if (change === 'access') auth.hasWorkspaceAccess = false
    await flushPromises()
    accept(true)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Widget settings cut.')
    expect(fake.command.mock.calls.filter(([action]) => action.startsWith('save'))).toHaveLength(0)
  })
  it('retains the old clipboard when a confirmed Cut fails complete-layout validation', async () => {
    const invalidTitle = 'z'.repeat(101)
    fake.command.mockImplementation(async action => action === 'load' ? {
      ...layout(), widgets: [
        { id: 'a', type: 'text', title: 'Alpha', text: '', span: 6 },
        { id: 'b', type: 'text', title: 'Beta', text: '', span: 6 },
        { id: 'c', type: 'text', title: invalidTitle, text: '', span: 6 },
      ],
    } : {})
    const wrapper = await open()
    const button = (label: string) => wrapper.findAll('button').find(entry => entry.text() === label)!
    await button('Edit').trigger('click')
    await flushPromises()
    await button('Copy selection').trigger('click')
    await button('Beta').trigger('click')
    await button('Cut settings').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-widgets]').text()).toBe('a,b,c')
    await button(invalidTitle).trigger('click')
    await wrapper.get('input[maxlength="100"]').setValue('Valid')
    await button('Paste widgets').trigger('click')
    await flushPromises()
    expect(wrapper.get('input[maxlength="100"]').element).toHaveProperty('value', 'Alpha')
    expect(wrapper.get('[data-widgets]').text().split(',')).toHaveLength(4)
  })
  it('does not refresh or discard the new account after an old discard confirmation',async()=>{
    const wrapper=await open()
    await wrapper.findAll('button').find(button=>button.text()==='Edit')!.trigger('click')
    await flushPromises()
    await wrapper.get('input[maxlength="100"]').setValue('Unsaved title')
    let accept!: (value:boolean)=>void
    fake.ask.mockReturnValue(new Promise(resolve=>{accept=resolve}))
    await wrapper.findAll('button').find(button=>button.text()==='Refresh')!.trigger('click')
    await flushPromises()
    auth.currentUser.uid='b'
    await flushPromises()
    accept(true)
    await flushPromises()
    expect(fake.command.mock.calls.filter(([action])=>action==='load')).toHaveLength(2)
    expect(fake.discard).not.toHaveBeenCalled()
  })
  it('does not enter the new account editor after an old content-discard confirmation',async()=>{
    const wrapper=await open()
    fake.notesDirty=true
    let accept!: (value:boolean)=>void
    fake.ask.mockReturnValue(new Promise(resolve=>{accept=resolve}))
    await wrapper.findAll('button').find(button=>button.text()==='Edit')!.trigger('click')
    await flushPromises()
    auth.currentUser.uid='b'
    fake.notesDirty=false
    await flushPromises()
    accept(true)
    await flushPromises()
    expect(wrapper.findAll('button').some(button=>button.text()==='Cancel edits')).toBe(false)
    expect(fake.discard).not.toHaveBeenCalled()
  })

  it('blocks refresh if a save begins during nested navigation preparation',async()=>{
    const wrapper=await open()
    await wrapper.findAll('button').find(button=>button.text()==='Edit')!.trigger('click')
    await flushPromises()
    await wrapper.get('input[maxlength="100"]').setValue('Unsaved title')
    let prepared!: (value:boolean)=>void, saved!: (value:unknown)=>void
    fake.prepare.mockReturnValue(new Promise(resolve=>{prepared=resolve}))
    fake.command.mockImplementation(action=>action==='load'?Promise.resolve(layout()):new Promise(resolve=>{saved=resolve}))
    await wrapper.findAll('button').find(button=>button.text()==='Refresh')!.trigger('click')
    await flushPromises()
    await wrapper.findAll('button').find(button=>button.text()==='Save template')!.trigger('click')
    await flushPromises()
    prepared(true)
    await flushPromises()
    expect(fake.command.mock.calls.filter(([action])=>action==='load')).toHaveLength(1)
    expect(fake.discard).not.toHaveBeenCalled()
    expect(wrapper.findAll('button').find(button=>button.text()==='Refresh')!.attributes('disabled')).toBeDefined()
    saved({...layout(),version:1,widgets:[{...layout().widgets[0],title:'Unsaved title'}]})
    await flushPromises()
    expect(wrapper.text()).toContain('Your layout was saved.')
  })
  it('allows the router to leave after an access revocation has settled',async()=>{
    const wrapper=await open()
    auth.hasWorkspaceAccess=false
    await flushPromises()
    await wrapper.vm.$router.push('/jobs')
    await flushPromises()
    expect(wrapper.vm.$router.currentRoute.value.name).toBe('jobs')
  })

})
