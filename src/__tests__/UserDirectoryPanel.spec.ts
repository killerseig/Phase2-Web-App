import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UserDirectoryPanel from '@/components/users/UserDirectoryPanel.vue'
import type { UserProfile } from '@/types/domain'

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'foreman',
    active: true,
    assignedJobIds: [],
    ...overrides,
  }
}

function mountDirectory(overrides: Partial<InstanceType<typeof UserDirectoryPanel>['$props']> = {}) {
  return mount(UserDirectoryPanel, {
    props: {
      users: [
        makeUser({
          id: 'admin-user',
          email: 'dan@example.com',
          firstName: 'Dan',
          lastName: 'Larsen',
          role: 'admin',
          inviteStatus: 'pending',
        }),
        makeUser({
          id: 'pm-user',
          email: 'pm@example.com',
          firstName: 'Project',
          lastName: 'Manager',
          role: 'project-manager',
          inviteStatus: 'accepted',
        }),
        makeUser({
          id: 'unnamed-user',
          email: null,
          firstName: null,
          lastName: null,
          role: 'none',
          active: false,
          inviteStatus: 'sent',
        }),
      ],
      usersLoading: false,
      selectedUserId: 'pm-user',
      searchTerm: 'dan',
      statusFilter: 'active',
      pendingInviteCount: 2,
      inviteLoading: false,
      ...overrides,
    },
  })
}

describe('UserDirectoryPanel', () => {
  it('renders user rows, role/status/invite badges, active selection, and invite controls', () => {
    const wrapper = mountDirectory()

    expect(wrapper.text()).toContain('Users')
    expect(wrapper.text()).toContain('2 pending invites')
    expect(wrapper.text()).toContain('Dan Larsen')
    expect(wrapper.text()).toContain('dan@example.com')
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.text()).toContain('Invite Pending')
    expect(wrapper.text()).toContain('Project Manager')
    expect(wrapper.text()).toContain('Setup Complete')
    expect(wrapper.text()).toContain('Unnamed User')
    expect(wrapper.text()).toContain('No email')
    expect(wrapper.text()).toContain('No Access')
    expect(wrapper.text()).toContain('Invited')
    expect(wrapper.text()).toContain('Inactive')
    expect(wrapper.get('[data-testid="users-row-pm-user"]').classes()).toContain('app-list-button--active')
    expect(wrapper.get<HTMLInputElement>('[data-testid="users-search"]').element.value).toBe('dan')
    expect(wrapper.get<HTMLSelectElement>('[data-testid="users-status-filter"]').element.value).toBe('active')
  })

  it('emits create, invite, search, status, and row-selection events', async () => {
    const wrapper = mountDirectory()

    await wrapper.get('button.app-button--primary').trigger('click')
    await wrapper.get('button:not(.app-button--primary)').trigger('click')
    await wrapper.get('[data-testid="users-search"]').setValue('cj')
    await wrapper.get('[data-testid="users-status-filter"]').setValue('both')
    await wrapper.get('[data-testid="users-row-admin-user"]').trigger('click')

    expect(wrapper.emitted('createUser')).toHaveLength(1)
    expect(wrapper.emitted('sendInvites')).toHaveLength(1)
    expect(wrapper.emitted('update:searchTerm')).toEqual([['cj']])
    expect(wrapper.emitted('update:statusFilter')).toEqual([['both']])
    expect(wrapper.emitted('selectUser')).toEqual([['admin-user']])
  })

  it('disables invite sending when no invites are pending and shows loading/empty states', () => {
    const noInvitesWrapper = mountDirectory({
      pendingInviteCount: 0,
    })
    const loadingWrapper = mountDirectory({
      users: [],
      usersLoading: true,
    })
    const emptyWrapper = mountDirectory({
      users: [],
      usersLoading: false,
    })

    expect(noInvitesWrapper.get('button:not(.app-button--primary)').attributes('disabled')).toBeDefined()
    expect(noInvitesWrapper.text()).toContain('0')
    expect(loadingWrapper.text()).toContain('Loading users...')
    expect(loadingWrapper.find('[data-testid="users-row-admin-user"]').exists()).toBe(false)
    expect(emptyWrapper.text()).toContain('No users match your search.')
  })

  it('shows send-invite loading copy and locks the action while invites are sending', () => {
    const wrapper = mountDirectory({
      inviteLoading: true,
    })
    const sendButton = wrapper.get('button:not(.app-button--primary)')

    expect(sendButton.text()).toBe('Sending...')
    expect(sendButton.attributes('disabled')).toBeDefined()
    expect(sendButton.attributes('aria-busy')).toBe('true')
  })
})
