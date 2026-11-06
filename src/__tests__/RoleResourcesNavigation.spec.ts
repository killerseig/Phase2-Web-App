import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoleResourcesModule from '@/components/dashboard/RoleResourcesModule.vue'
import { sdsCommand } from '@/services/sds'
import { onBeforeRouteLeave } from 'vue-router'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ rawRole: 'admin' }) }))
vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn<typeof onBeforeRouteLeave>(), RouterLink: { template: '<a><slot /></a>' } }))
vi.mock('@/services/sds', () => ({ sdsCommand: vi.fn<typeof sdsCommand>(), sdsErrorMessage: (error: Error) => error.message }))

describe('resource navigation preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sdsCommand).mockResolvedValue({ resources: [] } as never)
  })
  it('preserves a cancelled draft and prompts only once after approving discard', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(RoleResourcesModule, { props: { fixedRole: 'foreman' } })
    await flushPromises()
    expect(sdsCommand).toHaveBeenCalledWith('listResources', { role: 'foreman' })
    await wrapper.get('button').trigger('click')
    await wrapper.get('input').setValue('Keep this resource')
    expect(wrapper.vm.prepareNavigation()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('Keep this resource')
    confirm.mockReturnValue(true)
    expect(wrapper.vm.prepareNavigation()).toBe(true)
    const guard = vi.mocked(onBeforeRouteLeave).mock.calls[0]![0] as () => boolean
    expect(guard()).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(2)
    await flushPromises()
    expect(wrapper.find('form').exists()).toBe(false)
    wrapper.unmount()
    confirm.mockRestore()
  })
  it('blocks navigation while saving without offering to discard the in-flight mutation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(RoleResourcesModule)
    await flushPromises()
    let finish!: (value: unknown) => void
    vi.mocked(sdsCommand).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }) as never)
    await wrapper.get('button').trigger('click')
    await wrapper.get('input').setValue('Saving resource')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.vm.prepareNavigation()).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    finish({})
    await flushPromises()
    expect(wrapper.vm.prepareNavigation()).toBe(true)
    wrapper.unmount()
    confirm.mockRestore()
  })
})
