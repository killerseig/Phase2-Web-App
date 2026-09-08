import { mount } from '@vue/test-utils'
import { computed, defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import JobAdminDetailPane from '@/components/jobs/JobAdminDetailPane.vue'
import type {
  GlobalNotificationModuleKey,
  GlobalNotificationRecipients,
  JobRecord,
  NotificationModuleKey,
  NotificationRecipients,
  UserProfile,
} from '@/types/domain'
import type { JobFormState } from '@/features/jobs/jobViewHelpers'

const notificationModules: Array<{ key: GlobalNotificationModuleKey; label: string }> = [
  { key: 'dailyLogs', label: 'Daily Logs' },
  { key: 'timecards', label: 'Timecards' },
  { key: 'shopOrders', label: 'Shop Orders' },
  { key: 'newJobs', label: 'New Jobs' },
  { key: 'fieldUserAssignments', label: 'Field User Assignments' },
]
const jobNotificationModules: Array<{ key: NotificationModuleKey; label: string }> = [
  { key: 'dailyLogs', label: 'Daily Logs' },
  { key: 'shopOrders', label: 'Shop Orders' },
]

const appPaneStub = defineComponent({
  template: '<section class="app-pane-stub"><slot /></section>',
})

const appPaneHeaderStub = defineComponent({
  props: {
    eyebrow: String,
    title: String,
  },
  template: `
    <header>
      <span>{{ eyebrow }}</span>
      <h2>{{ title }}</h2>
      <slot name="actions" />
    </header>
  `,
})

const jobDetailsFormFieldsStub = defineComponent({
  emits: ['updateField'],
  template: `
    <section data-testid="job-details-fields">
      <button type="button" data-testid="emit-field" @click="$emit('updateField', 'name', 'Updated Job')">
        Update field
      </button>
    </section>
  `,
})

const jobFieldUserAssignmentPanelStub = defineComponent({
  emits: ['updateSearchTerm', 'toggleUser'],
  template: `
    <section data-testid="job-foreman-panel">
      <button type="button" data-testid="emit-foreman-search" @click="$emit('updateSearchTerm', 'dan')">
        Search
      </button>
      <button type="button" data-testid="emit-foreman-toggle" @click="$emit('toggleUser', 'user-1')">
        Toggle
      </button>
    </section>
  `,
})

const jobNotificationRecipientsPanelStub = defineComponent({
  props: {
    description: String,
    disabled: Boolean,
    modules: Array,
  },
  setup(props) {
    const moduleKeys = computed(() =>
      ((props.modules ?? []) as Array<{ key: string }>).map((module) => module.key).join(','),
    )
    return { moduleKeys }
  },
  emits: ['updateInput', 'addRecipient', 'removeRecipient'],
  template: `
    <section
      data-testid="job-recipients-panel"
      :data-disabled="disabled ? 'true' : 'false'"
      :data-modules="moduleKeys"
    >
      <p>{{ description }}</p>
      <button type="button" data-testid="emit-recipient-input" @click="$emit('updateInput', 'dailyLogs', 'dan@example.com')">
        Update recipient input
      </button>
      <button type="button" data-testid="emit-recipient-add" @click="$emit('addRecipient', 'dailyLogs')">
        Add recipient
      </button>
      <button type="button" data-testid="emit-recipient-remove" @click="$emit('removeRecipient', 'dailyLogs', 'dan@example.com')">
        Remove recipient
      </button>
    </section>
  `,
})

function makeForm(overrides: Partial<JobFormState> = {}): JobFormState {
  return {
    name: 'Shop',
    code: '736',
    type: 'general',
    gc: 'Phase 2',
    jobAddress: '123 Main St',
    startDate: '2026-06-01',
    finishDate: '2026-06-30',
    productionBurden: '0.33',
    assignedForemanIds: [],
    ...overrides,
  }
}

function makeRecipients(overrides: Partial<NotificationRecipients> = {}): NotificationRecipients {
  return {
    dailyLogs: ['daily@example.com'],
    timecards: [],
    shopOrders: [],
    ...overrides,
  }
}

function makeInputs(): Record<NotificationModuleKey, string> {
  return {
    dailyLogs: '',
    timecards: '',
    shopOrders: '',
  }
}

function makeGlobalRecipients(): GlobalNotificationRecipients {
  return {
    ...makeRecipients(),
    newJobs: [],
    fieldUserAssignments: [],
  }
}

function makeGlobalInputs(): Record<GlobalNotificationModuleKey, string> {
  return {
    ...makeInputs(),
    newJobs: '',
    fieldUserAssignments: '',
  }
}

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    email: 'dan@example.com',
    firstName: 'Dan',
    lastName: 'Larsen',
    role: 'foreman',
    active: true,
    assignedJobIds: [],
    ...overrides,
  }
}

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

function mountPane(overrides = {}) {
  return mount(JobAdminDetailPane, {
    props: {
      archiveLoading: false,
      canDeleteOrArchiveJobs: true,
      canEditSelectedJob: true,
      createForm: makeForm(),
      createLoading: false,
      createNotificationRecipients: makeRecipients(),
      createRecipientInputs: makeInputs(),
      deleteLoading: false,
      detailForm: makeForm(),
      detailInfo: '',
      detailNotificationRecipients: makeRecipients(),
      detailRecipientInputs: makeInputs(),
      filteredForemen: [makeUser()],
      foremanSearchTerm: '',
      globalNotificationRecipients: makeGlobalRecipients(),
      globalNotificationModules: notificationModules,
      globalRecipientInputs: makeGlobalInputs(),
      isAllJobsMode: false,
      isCreateMode: false,
      jobNotificationModules,
      jobTypeOptions: ['general', 'small-jobs'],
      recipientSaving: false,
      saveLoading: false,
      selectedJob: null,
      usersLoading: false,
      ...overrides,
    },
    global: {
      stubs: {
        AppPane: appPaneStub,
        AppPaneHeader: appPaneHeaderStub,
        JobDetailsFormFields: jobDetailsFormFieldsStub,
        JobFieldUserAssignmentPanel: jobFieldUserAssignmentPanelStub,
        JobNotificationRecipientsPanel: jobNotificationRecipientsPanelStub,
      },
    },
  })
}

describe('JobAdminDetailPane', () => {
  it('renders create mode and forwards create form events', async () => {
    const wrapper = mountPane({
      isCreateMode: true,
    })

    expect(wrapper.text()).toContain('Create')
    expect(wrapper.text()).toContain('New Job')
    expect(wrapper.text()).toContain('Applies only to this new job')
    expect(wrapper.get('[data-testid="job-recipients-panel"]').attributes('data-modules')).toBe(
      'dailyLogs,shopOrders',
    )

    await wrapper.get('form').trigger('submit')
    await wrapper.get('[data-testid="emit-field"]').trigger('click')
    await wrapper.get('[data-testid="emit-foreman-search"]').trigger('click')
    await wrapper.get('[data-testid="emit-foreman-toggle"]').trigger('click')
    await wrapper.get('[data-testid="emit-recipient-input"]').trigger('click')
    await wrapper.get('[data-testid="emit-recipient-add"]').trigger('click')
    await wrapper.get('[data-testid="emit-recipient-remove"]').trigger('click')

    expect(wrapper.emitted('createJob')).toHaveLength(1)
    expect(wrapper.emitted('updateCreateField')).toEqual([['name', 'Updated Job']])
    expect(wrapper.emitted('updateForemanSearchTerm')).toEqual([['dan']])
    expect(wrapper.emitted('toggleCreateForeman')).toEqual([['user-1']])
    expect(wrapper.emitted('updateCreateRecipientInput')).toEqual([
      ['dailyLogs', 'dan@example.com'],
    ])
    expect(wrapper.emitted('addCreateRecipient')).toEqual([['dailyLogs']])
    expect(wrapper.emitted('removeCreateRecipient')).toEqual([['dailyLogs', 'dan@example.com']])
  })

  it('renders global notification defaults and forwards global recipient events', async () => {
    const wrapper = mountPane({
      isAllJobsMode: true,
      recipientSaving: true,
    })

    expect(wrapper.text()).toContain('Global Scope')
    expect(wrapper.text()).toContain('All Jobs')
    expect(wrapper.text()).toContain('Defaults')
    expect(wrapper.get('[data-testid="job-recipients-panel"]').attributes('data-disabled')).toBe(
      'true',
    )
    expect(wrapper.get('[data-testid="job-recipients-panel"]').attributes('data-modules')).toBe(
      'dailyLogs,timecards,shopOrders,newJobs,fieldUserAssignments',
    )

    await wrapper.get('[data-testid="emit-recipient-input"]').trigger('click')
    await wrapper.get('[data-testid="emit-recipient-add"]').trigger('click')
    await wrapper.get('[data-testid="emit-recipient-remove"]').trigger('click')

    expect(wrapper.emitted('updateGlobalRecipientInput')).toEqual([
      ['dailyLogs', 'dan@example.com'],
    ])
    expect(wrapper.emitted('addGlobalRecipient')).toEqual([['dailyLogs']])
    expect(wrapper.emitted('removeGlobalRecipient')).toEqual([['dailyLogs', 'dan@example.com']])
  })

  it('renders selected job mode and forwards save/archive/delete/detail events', async () => {
    const wrapper = mountPane({
      detailInfo: 'All changes saved.',
      selectedJob: makeJob({ name: 'Lucky 3 Ranch', active: false }),
    })

    expect(wrapper.text()).toContain('Selected Job')
    expect(wrapper.text()).toContain('Lucky 3 Ranch')
    expect(wrapper.text()).toContain('Archived')
    expect(wrapper.text()).toContain('Restore Job')
    expect(wrapper.text()).toContain('Delete Job')
    expect(wrapper.text()).toContain('All changes saved.')
    expect(wrapper.get('[data-testid="job-recipients-panel"]').attributes('data-modules')).toBe(
      'dailyLogs,shopOrders',
    )

    await wrapper.get('form').trigger('submit')
    await wrapper.get('[data-testid="emit-field"]').trigger('click')
    await wrapper.get('[data-testid="emit-foreman-toggle"]').trigger('click')
    await wrapper.get('[data-testid="emit-recipient-input"]').trigger('click')
    await wrapper.get('[data-testid="emit-recipient-add"]').trigger('click')
    await wrapper.get('[data-testid="emit-recipient-remove"]').trigger('click')
    const archiveButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Restore Job')
    const deleteButton = wrapper.findAll('button').find((button) => button.text() === 'Delete Job')

    expect(archiveButton).toBeTruthy()
    expect(deleteButton).toBeTruthy()

    await archiveButton!.trigger('click')
    await deleteButton!.trigger('click')

    expect(wrapper.emitted('saveJob')).toHaveLength(1)
    expect(wrapper.emitted('updateDetailField')).toEqual([['name', 'Updated Job']])
    expect(wrapper.emitted('toggleDetailForeman')).toEqual([['user-1']])
    expect(wrapper.emitted('updateDetailRecipientInput')).toEqual([
      ['dailyLogs', 'dan@example.com'],
    ])
    expect(wrapper.emitted('addDetailRecipient')).toEqual([['dailyLogs']])
    expect(wrapper.emitted('removeDetailRecipient')).toEqual([['dailyLogs', 'dan@example.com']])
    expect(wrapper.emitted('requestToggleArchive')).toHaveLength(1)
    expect(wrapper.emitted('deleteJob')).toHaveLength(1)
  })

  it('allows selected-job editing without exposing archive or delete actions', async () => {
    const wrapper = mountPane({
      canDeleteOrArchiveJobs: false,
      canEditSelectedJob: true,
      selectedJob: makeJob({ name: 'Assigned PM Job' }),
    })

    expect(wrapper.text()).toContain('Selected Job')
    expect(wrapper.text()).toContain('Assigned PM Job')
    expect(wrapper.text()).not.toContain('Archive Job')
    expect(wrapper.text()).not.toContain('Delete Job')

    await wrapper.get('form').trigger('submit')
    await wrapper.get('[data-testid="emit-field"]').trigger('click')

    expect(wrapper.emitted('saveJob')).toHaveLength(1)
    expect(wrapper.emitted('updateDetailField')).toEqual([['name', 'Updated Job']])
  })

  it('renders a read-only selected-job message when setup editing is not allowed', () => {
    const wrapper = mountPane({
      canDeleteOrArchiveJobs: false,
      canEditSelectedJob: false,
      selectedJob: makeJob({ name: 'Read Only Job' }),
    })

    expect(wrapper.text()).toContain('Read Only Job')
    expect(wrapper.text()).toContain('This role can view this job, but cannot edit its setup.')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Archive Job')
    expect(wrapper.text()).not.toContain('Delete Job')
  })

  it('renders an empty editor prompt when no mode or selected job is available', () => {
    const wrapper = mountPane()

    expect(wrapper.text()).toContain('Select a job to edit, or create a new one.')
  })
})
