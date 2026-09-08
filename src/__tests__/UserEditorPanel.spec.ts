import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UserEditorPanel from '@/components/users/UserEditorPanel.vue'
import type { JobRecord, UserProfile } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    name: 'Shop',
    code: '736',
    gc: 'Phase 2',
    type: 'general',
    active: true,
    assignedForemanIds: [],
    ...overrides,
  }
}

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'cj.blanchard@example.com',
    firstName: 'CJ',
    lastName: 'Blanchard',
    role: 'project-manager',
    active: true,
    assignedJobIds: ['job-1'],
    ...overrides,
  }
}

function mountEditor(overrides: Partial<InstanceType<typeof UserEditorPanel>['$props']> = {}) {
  const selectedUser = makeUser()

  return mount(UserEditorPanel, {
    props: {
      isCreateMode: false,
      createForm: {
        email: 'new.user@example.com',
        firstName: 'New',
        lastName: 'User',
        role: 'project-manager',
        assignedJobIds: ['job-1'],
      },
      detailForm: {
        firstName: selectedUser.firstName ?? '',
        lastName: selectedUser.lastName ?? '',
        role: 'project-manager',
        active: true,
        assignedJobIds: ['job-1'],
      },
      selectedUser,
      editingSelf: false,
      createAction: null,
      emailAction: null,
      saveLoading: false,
      deleteLoading: false,
      deleteConfirmOpen: false,
      detailInfo: 'All changes saved.',
      createJobs: [makeJob()],
      detailJobs: [makeJob()],
      jobsLoading: false,
      createJobSearchTerm: '',
      detailJobSearchTerm: '',
      ...overrides,
    },
  })
}

describe('UserEditorPanel', () => {
  it('renders create mode fields, assigned jobs, and forwards create-form events', async () => {
    const wrapper = mountEditor({
      isCreateMode: true,
      selectedUser: null,
      createJobSearchTerm: 'shop',
    })

    expect(wrapper.text()).toContain('Create User')
    expect(wrapper.text()).toContain("Create User, Don't Send Invite")
    expect(wrapper.text()).toContain('Create User & Send Invite')
    expect(wrapper.text()).toContain('Assigned Jobs')
    expect(wrapper.text()).toContain('1 selected')
    expect(wrapper.get<HTMLInputElement>('input[type="email"]').element.value).toBe(
      'new.user@example.com',
    )
    expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe('project-manager')
    expect(wrapper.get<HTMLInputElement>('input[autocomplete="given-name"]').element.value).toBe(
      'New',
    )
    expect(wrapper.get<HTMLInputElement>('input[autocomplete="family-name"]').element.value).toBe(
      'User',
    )

    await wrapper.get('input[type="email"]').setValue('other@example.com')
    await wrapper.get('select').setValue('admin')
    await wrapper.get('input[autocomplete="given-name"]').setValue('Other')
    await wrapper.get('input[autocomplete="family-name"]').setValue('Person')
    await wrapper.get('input[type="search"]').setValue('office')
    await wrapper.get('input[type="checkbox"]').setValue(false)
    await wrapper.findAll('button')[0]!.trigger('click')
    await wrapper.findAll('button')[1]!.trigger('click')

    expect(wrapper.emitted('updateCreateTextField')).toEqual([
      ['email', 'other@example.com'],
      ['firstName', 'Other'],
      ['lastName', 'Person'],
    ])
    expect(wrapper.emitted('updateCreateRole')).toEqual([['admin']])
    expect(wrapper.emitted('updateCreateJobSearchTerm')).toEqual([['office']])
    expect(wrapper.emitted('toggleCreateAssignedJob')).toEqual([['job-1']])
    expect(wrapper.emitted('createUser')).toEqual([[false], [true]])
  })

  it('locks create actions while one create path is pending', () => {
    const wrapper = mountEditor({
      isCreateMode: true,
      selectedUser: null,
      createAction: 'send',
    })
    const buttons = wrapper.findAll('button')

    expect(buttons[0]!.attributes('disabled')).toBeDefined()
    expect(buttons[1]!.text()).toBe('Creating User...')
    expect(buttons[1]!.attributes('disabled')).toBeDefined()
    expect(buttons[1]!.attributes('aria-busy')).toBe('true')
  })

  it('renders selected-user edit mode and forwards editable field, role, active, assignment, delete, and submit events', async () => {
    const wrapper = mountEditor({
      detailJobSearchTerm: 'shop',
    })

    expect(wrapper.text()).toContain('Selected User')
    expect(wrapper.text()).toContain('CJ Blanchard')
    expect(wrapper.text()).toContain('Project Manager')
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Delete User')
    expect(wrapper.text()).toContain('Resend Invite')
    expect(wrapper.text()).toContain('Send Password Reset')
    expect(wrapper.text()).toContain('All changes saved.')
    expect(
      wrapper.get<HTMLInputElement>('input[type="email"]').attributes('readonly'),
    ).toBeDefined()
    expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe('project-manager')

    await wrapper.get('select').setValue('foreman')
    await wrapper.get('input[autocomplete="given-name"]').setValue('Christopher')
    await wrapper.get('input[autocomplete="family-name"]').setValue('B')
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(false)
    await wrapper.get('input[type="search"]').setValue('office')
    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(false)
    await wrapper.get('form').trigger('submit')
    const emailActionButtons = wrapper.findAll('.users-detail__email-actions button')
    await emailActionButtons[0]!.trigger('click')
    await emailActionButtons[1]!.trigger('click')
    await wrapper.get('button.app-button--danger').trigger('click')

    expect(wrapper.emitted('updateDetailRole')).toEqual([['foreman']])
    expect(wrapper.emitted('updateDetailTextField')).toEqual([
      ['firstName', 'Christopher'],
      ['lastName', 'B'],
    ])
    expect(wrapper.emitted('updateDetailActive')).toEqual([[false]])
    expect(wrapper.emitted('updateDetailJobSearchTerm')).toEqual([['office']])
    expect(wrapper.emitted('toggleDetailAssignedJob')).toEqual([['job-1']])
    expect(wrapper.emitted('detailSubmit')).toHaveLength(1)
    expect(wrapper.emitted('resendInvite')).toHaveLength(1)
    expect(wrapper.emitted('sendPasswordReset')).toHaveLength(1)
    expect(wrapper.emitted('deleteUser')).toHaveLength(1)
  })

  it('keeps account email actions visible and locks them while sending, saving, or without an email', () => {
    const sending = mountEditor({ emailAction: 'invite' })
    const sendingButtons = sending.findAll('.users-detail__email-actions button')

    expect(sendingButtons).toHaveLength(2)
    expect(sendingButtons[0]!.text()).toBe('Sending Invite...')
    expect(sendingButtons[0]!.attributes('aria-busy')).toBe('true')
    expect(sendingButtons[0]!.attributes('disabled')).toBeDefined()
    expect(sendingButtons[1]!.attributes('disabled')).toBeDefined()
    expect(sending.get('button.app-button--danger').attributes('disabled')).toBeDefined()

    const saving = mountEditor({ saveLoading: true })
    const savingButtons = saving.findAll('.users-detail__email-actions button')

    expect(savingButtons).toHaveLength(2)
    expect(savingButtons.every((button) => button.attributes('disabled') !== undefined)).toBe(true)

    const deleting = mountEditor({ deleteLoading: true })
    expect(
      deleting
        .findAll('.users-detail__email-actions button')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)

    const confirmingDelete = mountEditor({ deleteConfirmOpen: true })
    expect(
      confirmingDelete
        .findAll('.users-detail__email-actions button')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)

    const withoutEmail = mountEditor({
      selectedUser: makeUser({ email: null }),
    })
    const unavailableButtons = withoutEmail.findAll('.users-detail__email-actions button')

    expect(unavailableButtons).toHaveLength(2)
    expect(unavailableButtons.every((button) => button.attributes('disabled') !== undefined)).toBe(
      true,
    )
    expect(withoutEmail.text()).toContain('This user does not have an email address.')
  })

  it('locks self-edit role, active state, and delete controls to avoid account lockout', () => {
    const wrapper = mountEditor({
      editingSelf: true,
    })

    expect(wrapper.text()).toContain('You are editing the currently signed-in account.')
    expect(wrapper.find('button.app-button--danger').exists()).toBe(false)
    expect(wrapper.get('select').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('select').attributes('tabindex')).toBe('-1')
    expect(wrapper.get('select').classes()).toContain('users-form__control--locked')
    expect(wrapper.findAll('input[type="checkbox"]')[0]!.attributes('aria-disabled')).toBe('true')
    expect(wrapper.findAll('input[type="checkbox"]')[0]!.attributes('tabindex')).toBe('-1')
    expect(wrapper.findAll('.users-detail__email-actions button')).toHaveLength(2)
    expect(wrapper.text()).toContain('Resend Invite')
    expect(wrapper.text()).toContain('Send Password Reset')
  })

  it('renders save-loading state and hides assigned jobs for non-assignable roles', () => {
    const wrapper = mountEditor({
      detailForm: {
        firstName: 'Alison',
        lastName: 'Larsen',
        role: 'admin',
        active: true,
        assignedJobIds: ['job-1'],
      },
      saveLoading: true,
    })

    expect(wrapper.text()).not.toContain('Assigned Jobs')
    expect(wrapper.text()).toContain('Saving')
    expect(wrapper.get('select').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[autocomplete="given-name"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button.app-button--danger').attributes('disabled')).toBeDefined()
  })

  it('renders no-access stored roles as read-only and hides job assignments', () => {
    const wrapper = mountEditor({
      selectedUser: makeUser({
        assignedJobIds: ['job-1'],
        email: 'no-access@example.com',
        firstName: 'No',
        lastName: 'User',
        role: 'none',
      }),
      detailForm: {
        firstName: 'No',
        lastName: 'User',
        role: 'foreman',
        active: true,
        assignedJobIds: [],
      },
    })

    expect(wrapper.text()).toContain('No Access')
    expect(wrapper.find('select').exists()).toBe(false)
    expect(
      wrapper
        .findAll<HTMLInputElement>('input[readonly]')
        .some((input) => input.element.value === 'No Access'),
    ).toBe(true)
    expect(wrapper.text()).not.toContain('Assigned Jobs')
  })

  it('renders the no-selection empty state', () => {
    const wrapper = mountEditor({
      selectedUser: null,
    })

    expect(wrapper.text()).toContain('No User Selected')
    expect(wrapper.text()).toContain('Select a user to edit, or click New User to create one.')
  })
})
