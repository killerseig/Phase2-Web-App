import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import AnnouncementRecipientPicker from '@/components/dashboard/AnnouncementRecipientPicker.vue'
const fake = vi.hoisted(() => ({ command: vi.fn() }))
vi.mock('@/services/sharedDashboards', () => ({sharedDashboardCommand: fake.command}))
const person = {uid:'person-a',name:'Pat Foreman',email:'pat@example.invalid',role:'foreman'}
describe('announcement recipient selection', () => {
  beforeEach(()=>fake.command.mockReset())
  it('continues through an empty filtered page and emits a new selected list', async () => {
    fake.command.mockResolvedValueOnce({items:[],nextCursor:'page-one'}).mockResolvedValueOnce({items:[person],nextCursor:null})
    const selected: string[] = []
    const wrapper=mount(AnnouncementRecipientPicker,{props:{modelValue:selected,disabled:false}})
    await flushPromises()
    await wrapper.findAll('button').find(button=>button.text()==='Load more people')!.trigger('click')
    await flushPromises()
    expect(fake.command).toHaveBeenLastCalledWith('list-announcement-recipients',{scope:'personal',search:'',cursor:'page-one'})
    await wrapper.find('input[type=checkbox]').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['person-a']])
    expect(selected).toEqual([])
    wrapper.unmount()
  })
  it('retries a failed directory request without dropping existing selections', async () => {
    fake.command.mockRejectedValueOnce(Error('Directory unavailable')).mockResolvedValue({items:[person],nextCursor:null})
    const wrapper=mount(AnnouncementRecipientPicker,{props:{modelValue:['person-a'],disabled:false}})
    await flushPromises()
    expect(wrapper.find('[role=alert]').text()).toContain('Directory unavailable')
    await wrapper.findAll('button').find(button=>button.text()==='Retry people')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('input[type=checkbox]').element).toHaveProperty('checked',true)
    expect(wrapper.text()).toContain('1 of 25 people selected')
    wrapper.unmount()
  })
})
