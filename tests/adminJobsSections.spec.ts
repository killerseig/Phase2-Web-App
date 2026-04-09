import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminJobsBrowserCard from '@/components/admin/AdminJobsBrowserCard.vue'
import AdminJobsCreateCard from '@/components/admin/AdminJobsCreateCard.vue'
import AdminJobsExportToolbar from '@/components/admin/AdminJobsExportToolbar.vue'
import AdminJobsTableCard from '@/components/admin/AdminJobsTableCard.vue'
import type { Job } from '@/services'
import { createJobForm } from '@/types/adminJobs'

const foremanOptions = [
  { value: 'Pat Foreman', label: 'Pat Foreman' },
] as const

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
  type: 'general',
  active: true,
  timecardStatus: 'pending',
  timecardPeriodEndDate: '2026-04-04',
}

describe('admin jobs section components', () => {
  it('emits browser toolbar actions', async () => {
    const wrapper = mount(AdminJobsBrowserCard, {
      props: {
        jobs: [baseJob],
        loading: false,
        error: '',
        selectedJobId: 'job-1',
        sortKey: 'name',
        sortDir: 'asc',
        currentWeekEnd: '2026-04-04',
        currentWeekLabel: 'Mar 29 - Apr 4',
        showCreate: false,
      },
    })

    await wrapper.get('button.btn-primary').trigger('click')

    expect(wrapper.emitted('toggle-create')).toEqual([[]])
  })

  it('emits merged form updates from the create card', async () => {
    const wrapper = mount(AdminJobsCreateCard, {
      props: {
        open: true,
        form: createJobForm(),
        loading: false,
        foremanOptions,
      },
    })

    await wrapper.get('input[placeholder="Project Name"]').setValue('Project One')

    expect(wrapper.emitted('update:form')?.[0]?.[0]).toMatchObject({
      name: 'Project One',
      code: '',
    })
  })

  it('emits export actions from the toolbar', async () => {
    const wrapper = mount(AdminJobsExportToolbar, {
      props: {
        exportDateInWeek: '2026-04-03',
        exportDateConfig: {},
        exportWeekLabel: 'Mar 29 - Apr 4',
        exportWeekEnding: '2026-04-04',
      },
      global: {
        stubs: {
          DatePickerField: {
            props: ['modelValue', 'size'],
            template: '<input class="date-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
        },
      },
    })

    await wrapper.get('.date-stub').setValue('2026-04-02')
    await wrapper.get('button.btn-outline-success').trigger('click')

    expect(wrapper.emitted('update:exportDateInWeek')).toEqual([['2026-04-02']])
    expect(wrapper.emitted('export')).toEqual([[]])
  })

  it('emits table edit and row actions', async () => {
    const wrapper = mount(AdminJobsTableCard, {
      props: {
        jobs: [baseJob],
        loading: false,
        error: '',
        editingJobId: 'job-1',
        editForm: {
          ...createJobForm(),
          ...{
            name: baseJob.name,
            code: baseJob.code ?? '',
            projectManager: baseJob.projectManager ?? '',
            foreman: baseJob.foreman ?? '',
            gc: baseJob.gc ?? '',
            jobAddress: baseJob.jobAddress ?? '',
            startDate: baseJob.startDate ?? '',
            finishDate: baseJob.finishDate ?? '',
            taxExempt: baseJob.taxExempt ?? '',
            certified: baseJob.certified ?? '',
            cip: baseJob.cip ?? '',
            kjic: baseJob.kjic ?? '',
          },
        },
        editingJobSaving: false,
        activeJobActionsId: 'job-1',
        togglingJobId: '',
        foremanOptions,
        sortKey: 'name',
        sortDir: 'asc',
        currentWeekEnd: '2026-04-04',
        currentWeekLabel: 'Mar 29 - Apr 4',
      },
    })

    await wrapper.get('input[placeholder="Project Manager"]').setValue('Casey')
    await wrapper.get('button[title="Delete job permanently"]').trigger('click')
    await wrapper.get('button[title="Archive job"]').trigger('click')

    expect(wrapper.emitted('update:editForm')?.[0]?.[0]).toMatchObject({
      projectManager: 'Casey',
    })
    expect(wrapper.emitted('delete-job')?.[0]?.[0]).toMatchObject({ id: 'job-1' })
    expect(wrapper.emitted('toggle-archive')?.[0]?.[0]).toMatchObject({
      job: expect.objectContaining({ id: 'job-1' }),
      active: false,
    })
  })
})
