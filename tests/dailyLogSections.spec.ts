import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DailyLogActionPanel from '@/components/dailyLogs/DailyLogActionPanel.vue'
import DailyLogMainColumn from '@/components/dailyLogs/DailyLogMainColumn.vue'
import DailyLogSidebarColumn from '@/components/dailyLogs/DailyLogSidebarColumn.vue'
import DailyLogSiteInfoCard from '@/components/dailyLogs/DailyLogSiteInfoCard.vue'
import DailyLogStatusToolbar from '@/components/dailyLogs/DailyLogStatusToolbar.vue'
import DailyLogTextSectionCard from '@/components/dailyLogs/DailyLogTextSectionCard.vue'
import { createEmptyDailyLogDraft } from '@/composables/dailyLog/defaults'
import DailyLogList from '@/components/dailyLogs/DailyLogList.vue'
import DailyLogQualityControlCard from '@/components/dailyLogs/DailyLogQualityControlCard.vue'
import DailyLogRecipients from '@/components/dailyLogs/DailyLogRecipients.vue'

describe('daily log section components', () => {
  it('emits text section field updates', async () => {
    const wrapper = mount(DailyLogTextSectionCard, {
      props: {
        title: 'Schedule & Assessment',
        icon: 'bi bi-calendar-event',
        canEdit: true,
        fields: [
          { key: 'weeklySchedule', label: 'Weekly Schedule', value: '', rows: 4 },
        ],
      },
    })

    await wrapper.find('textarea').setValue('Updated schedule')

    expect(wrapper.emitted('update-field')).toEqual([
      [{ key: 'weeklySchedule', value: 'Updated schedule' }],
    ])
  })

  it('renders the status toolbar warning and emits new draft clicks', async () => {
    const wrapper = mount(DailyLogStatusToolbar, {
      props: {
        logDate: '2026-04-03',
        today: '2026-04-03',
        currentStatus: 'submitted',
        currentSubmittedAt: '2026-04-03T12:00:00Z',
        logsCount: 2,
        saving: false,
        creatingDraft: false,
        isDatedDraft: true,
        isSubmittedViewOnly: false,
        datedDraftLabel: 'Past draft',
        datedDraftMessageTense: 'previous',
        datePickerConfig: {},
        formatSubmittedAt: (value) => String(value),
      },
      global: {
        stubs: {
          DatePickerField: {
            template: '<div class="date-picker-stub" />',
          },
        },
      },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Past draft')
    expect(wrapper.emitted('start-new-draft')).toEqual([[]])
  })

  it('shows the correct action controls for draft and submitted logs', async () => {
    const draftWrapper = mount(DailyLogActionPanel, {
      props: {
        currentStatus: 'draft',
        saving: false,
        hasEmailRecipients: false,
        hasSubmittedToday: false,
        error: '',
      },
    })

    await draftWrapper.find('button.btn-success').trigger('click')

    expect(draftWrapper.emitted('submit')).toEqual([[]])

    const submittedWrapper = mount(DailyLogActionPanel, {
      props: {
        currentStatus: 'submitted',
        saving: false,
        hasEmailRecipients: true,
        hasSubmittedToday: true,
        error: 'Network error',
      },
    })

    await submittedWrapper.find('button.btn-info').trigger('click')

    expect(submittedWrapper.text()).toContain('Daily log already submitted for today')
    expect(submittedWrapper.text()).toContain('Network error')
    expect(submittedWrapper.emitted('send-email')).toEqual([[]])
  })

  it('forwards main column field and action events', async () => {
    const wrapper = mount(DailyLogMainColumn, {
      props: {
        jobName: 'Project One',
        siteInfo: {
          projectName: 'Project One',
          jobNumber: '111A1',
          projectManager: 'Riley',
          foreman: 'Pat',
          generalContractor: 'ACME GC',
          address: '123 Main St',
        },
        form: createEmptyDailyLogDraft('Project One'),
        canEdit: true,
        uploading: false,
        photoFileName: '',
        ptpFileName: '',
        qcFileName: '',
        photoDescription: '',
        ptpPhotoNote: '',
        qcPhotoDescription: '',
        currentStatus: 'draft',
        saving: false,
        hasEmailRecipients: true,
        hasSubmittedToday: false,
        error: '',
        canDeleteManpowerLine: () => true,
        isAdminAddedLine: () => false,
      },
    })

    wrapper.findComponent(DailyLogQualityControlCard).vm.$emit('update:qcAssignedTo', 'Jordan')
    wrapper.findComponent(DailyLogActionPanel).vm.$emit('submit')

    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update-field')).toEqual([
      [{ key: 'qcAssignedTo', value: 'Jordan' }],
    ])
    expect(wrapper.emitted('submit')).toEqual([[]])
  })

  it('renders job information as read-only fields', () => {
    const wrapper = mount(DailyLogSiteInfoCard, {
      props: {
        projectName: 'Project One',
        jobNumber: '111A1',
        projectManager: 'Riley',
        foreman: 'Pat',
        generalContractor: 'ACME GC',
        address: '123 Main St',
      },
    })

    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(6)
    expect(inputs.every((input) => input.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.text()).toContain('Project Manager')
    expect(wrapper.text()).toContain('General Contractor')
  })

  it('forwards sidebar events from list and recipients', async () => {
    const wrapper = mount(DailyLogSidebarColumn, {
      props: {
        logDate: '2026-04-03',
        logs: [],
        currentUserId: 'user-1',
        formatTimestamp: () => 'now',
        selectedId: null,
        saving: false,
        recipients: ['crew@example.com'],
        globalRecipients: ['global@example.com'],
        savingRecipients: false,
      },
    })

    wrapper.findComponent(DailyLogList).vm.$emit('select', 'log-1')
    wrapper.findComponent(DailyLogRecipients).vm.$emit('add', 'new@example.com')

    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('select')).toEqual([['log-1']])
    expect(wrapper.emitted('add-recipient')).toEqual([['new@example.com']])
  })

  it('shows a global-recipient warning when no job-specific recipients exist', () => {
    const wrapper = mount(DailyLogRecipients, {
      props: {
        recipients: [],
        globalRecipients: ['global@example.com'],
        saving: false,
      },
    })

    expect(wrapper.text()).toContain('Only the global recipient list will receive this daily log right now')
  })
})
