import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminUsersCreateCard from '@/components/admin/AdminUsersCreateCard.vue'
import AdminUsersTableCard from '@/components/admin/AdminUsersTableCard.vue'
import { ROLES } from '@/constants/app'
import type { UserProfile } from '@/services'

const roleOptions = [
  { value: ROLES.NONE, label: 'None (No Access)' },
  { value: ROLES.ADMIN, label: 'Admin' },
] as const

const baseUser: UserProfile = {
  id: 'user-1',
  email: 'casey@example.com',
  firstName: 'Casey',
  lastName: 'Stone',
  role: ROLES.ADMIN,
  active: true,
}

describe('admin user section components', () => {
  it('emits merged form updates from the create card', async () => {
    const wrapper = mount(AdminUsersCreateCard, {
      props: {
        open: true,
        form: {
          email: '',
          firstName: '',
          lastName: '',
          role: ROLES.NONE,
        },
        loading: false,
        roleOptions,
      },
    })

    await wrapper.get('input[type="email"]').setValue('casey@example.com')

    expect(wrapper.emitted('update:form')?.[0]?.[0]).toMatchObject({
      email: 'casey@example.com',
      role: ROLES.NONE,
    })
  })

  it('emits table row edit and delete actions', async () => {
    const wrapper = mount(AdminUsersTableCard, {
      props: {
        users: [baseUser],
        loading: false,
        error: '',
        editingUserId: 'user-1',
        editForm: {
          email: baseUser.email ?? '',
          firstName: baseUser.firstName ?? '',
          lastName: baseUser.lastName ?? '',
          role: baseUser.role,
        },
        savingUserEdit: false,
        activeUserActionsId: 'user-1',
        roleOptions,
        sortKey: 'email',
        sortDir: 'asc',
      },
    })

    await wrapper.get('input[placeholder="First name"]').setValue('Jordan')
    await wrapper.get('button[title="Delete user"]').trigger('click')

    expect(wrapper.emitted('update:editForm')?.[0]?.[0]).toMatchObject({ firstName: 'Jordan' })
    expect(wrapper.emitted('delete-user')?.[0]?.[0]).toMatchObject({ id: 'user-1' })
  })
})
