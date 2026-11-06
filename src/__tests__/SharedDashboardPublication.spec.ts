import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SharedDashboardView from '@/views/SharedDashboardView.vue'
import { useAuthStore } from '@/stores/auth'
const fake = vi.hoisted(() => ({
  command: vi.fn(), ask: vi.fn(),
  auth: {currentUser:{uid:'a'},rawRole:'admin',hasWorkspaceAccess:true,assignedJobIds:[] as string[],displayName:'Admin'},
}))
vi.mock('@/stores/auth', async()=>{const {reactive}=await import('vue');const auth=reactive(fake.auth);return {useAuthStore:()=>auth}})
vi.mock('@/stores/jobs',()=>({useJobsStore:()=>({jobs:[],error:null,loading:false,subscribeVisibleJobs:vi.fn()})}))
vi.mock('@/services/sharedDashboards',()=>({sharedDashboardCommand:fake.command}))
vi.mock('@/services/forms',()=>({formApi:vi.fn().mockResolvedValue({templates:[]})}))
const auth=useAuthStore() as unknown as typeof fake.auth
const canvas=defineComponent({
  props:['announcementDrafts','publishedDraftIds'],
  emits:['publish-announcement'],
  setup(_, {expose}) {expose({prepareForms:()=>true,notesDirty:false})},
  template:'<div><button v-if="announcementDrafts?.length" @click="$emit(\'publish-announcement\',announcementDrafts[0].id)">Publish test</button><p data-publications>{{ publishedDraftIds?.join(\',\') }}</p></div>',
})
const cleanup: (() => void)[] = []
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); vi.unstubAllGlobals() })
async function open() {
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
  await flushPromises()
  cleanup.push(() => wrapper.unmount())
  return wrapper
}
function layout() { const uid=auth.currentUser.uid; return {
  widgets:[{id:'drafts',type:'announcement-drafts',title:'Drafts',span:12,text:''}],version:0,canEdit:true,role:'admin',allowRoleEditing:false,job:null,
  notes:{},events:[],notesVersion:0,publishedDraftIds:[],
  announcementDrafts:[{id:'draft-'+uid,title:'Draft '+uid,body:'Message',audience:'everyone'}],
}}
describe('announcement publication context isolation',()=>{
  beforeEach(()=>{
    fake.command.mockReset();fake.ask.mockReset().mockResolvedValue(true)
    auth.currentUser.uid='a';auth.rawRole='admin';auth.hasWorkspaceAccess=true
    vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}})
    fake.command.mockImplementation(async action=>action==='load'?layout():{})
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
    fake.command.mockImplementation((action,data)=>action==='load'?Promise.resolve(layout()):new Promise(resolve=>{pending.set(data.draftId,resolve)}))
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
})
