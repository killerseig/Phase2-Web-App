import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminEmailJobRecipientsCard from '@/components/admin/AdminEmailJobRecipientsCard.vue'
import AdminEmailPurgeCard from '@/components/admin/AdminEmailPurgeCard.vue'
import AdminEmailRecipientCard from '@/components/admin/AdminEmailRecipientCard.vue'
import type { Job } from '@/services'

const baseJob: Job = {
  id: 'job-1',
  name: 'Project One',
  code: '4197',
  projectManager: 'Jordan',
  foreman: 'Pat Foreman',
  gc: 'Turner',
  jobAddress: '123 Main St',
  startDate: '2026-04-01',
  finishDate: '2026-04-30',
  taxExempt: 'No',
  certified: 'No',
  cip: '2445',
  kjic: 'Yes',
  accountNumber: null,
  type: 'drywall',
  active: true,
  timecardStatus: 'pending',
  timecardPeriodEndDate: '2026-04-04',
}

describe('admin email settings section components', () => {
  it('emits purge email updates and remove action', async () => {
    const wrapper = mount(AdminEmailPurgeCard, {
      props: {
        purgeEmail: '',
        purging: false,
      },
    })

    await wrapper.get('input[type="email"]').setValue('remove@example.com')
    await wrapper.get('button.btn-outline-danger').trigger('click')

    expect(wrapper.emitted('update:purgeEmail')).toEqual([['remove@example.com']])
    expect(wrapper.emitted('remove-everywhere')).toEqual([[]])
  })

  it('passes recipient add and remove events through the shared recipient card', async () => {
    const wrapper = mount(AdminEmailRecipientCard, {
      props: {
        title: 'Timecard Submission Recipients',
        icon: 'clock',
        subtitle: 'These recipients will receive all submitted timecards.',
        emails: ['team@example.com'],
        label: 'Timecard recipients',
        inputName: 'timecard-recipient',
        autocompleteSection: 'timecard',
        disabled: false,
      },
    })

    await wrapper.get('input[type="email"]').setValue('next@example.com')
    await wrapper.get('button.btn-primary').trigger('click')
    await wrapper.get('button[aria-label="Remove"]').trigger('click')

    expect(wrapper.emitted('add')).toEqual([['next@example.com']])
    expect(wrapper.emitted('remove')).toEqual([['team@example.com']])
  })

  it('emits job recipient and open-state actions from the job recipients card', async () => {
    const wrapper = mount(AdminEmailJobRecipientsCard, {
      props: {
        jobs: [baseJob],
        loading: false,
        error: '',
        saving: false,
        jobRecipients: new Map([[baseJob.id, ['lead@example.com']]]),
        openJobId: baseJob.id,
      },
    })

    await wrapper.get('input[type="email"]').setValue('new@example.com')
    await wrapper.get('button.btn-primary').trigger('click')
    await wrapper.get('button[aria-label="Remove"]').trigger('click')
    await wrapper.get('.accordion-card__header').trigger('click')

    expect(wrapper.emitted('add-job-recipient')).toEqual([[{ jobId: 'job-1', email: 'new@example.com' }]])
    expect(wrapper.emitted('remove-job-recipient')).toEqual([[{ jobId: 'job-1', email: 'lead@example.com' }]])
    const openEvents = wrapper.emitted('update:openJobId') ?? []
    expect(openEvents[openEvents.length - 1]).toEqual([null])
  })
})
