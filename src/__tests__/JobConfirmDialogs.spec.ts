import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobConfirmDialogs from '@/components/jobs/JobConfirmDialogs.vue'

function mountDialogs(overrides = {}) {
  return mount(JobConfirmDialogs, {
    props: {
      archiveBusy: false,
      archiveConfirmLabel: 'Archive Job',
      archiveMessage: 'Archive Phase 2 Company Office?',
      archiveOpen: true,
      archiveTitle: 'Archive job?',
      deleteBusy: false,
      deleteMessage: 'Delete Phase 2 Company Office? This cannot be undone.',
      deleteOpen: true,
      ...overrides,
    },
    global: {
      stubs: {
        ConfirmDialog: {
          props: [
            'busy',
            'confirmLabel',
            'destructive',
            'message',
            'open',
            'title',
          ],
          emits: ['confirm', 'update:open'],
          template: `
            <section
              v-if="open"
              role="dialog"
              :aria-label="title"
              :data-busy="String(Boolean(busy))"
              :data-destructive="String(destructive !== false && destructive !== undefined && destructive !== null)"
            >
              <p>{{ message }}</p>
              <button type="button" @click="$emit('update:open', false)">Close</button>
              <button type="button" @click="$emit('confirm')">{{ confirmLabel }}</button>
            </section>
          `,
        },
      },
    },
  })
}

describe('JobConfirmDialogs', () => {
  it('renders archive/restore and delete dialogs with parent-provided copy', () => {
    const wrapper = mountDialogs()

    expect(wrapper.get('[aria-label="Archive job?"]').text()).toContain('Archive Phase 2 Company Office?')
    expect(wrapper.get('[aria-label="Archive job?"]').text()).toContain('Archive Job')
    expect(wrapper.get('[aria-label="Delete job?"]').text()).toContain(
      'Delete Phase 2 Company Office? This cannot be undone.',
    )
    expect(wrapper.get('[aria-label="Delete job?"]').text()).toContain('Delete Job')
  })

  it('forwards close updates and confirm events to the parent-owned workflow state', async () => {
    const wrapper = mountDialogs()
    const archiveDialog = wrapper.get('[aria-label="Archive job?"]')
    const deleteDialog = wrapper.get('[aria-label="Delete job?"]')
    const archiveButtons = archiveDialog.findAll('button')
    const deleteButtons = deleteDialog.findAll('button')

    if (!archiveButtons[0] || !archiveButtons[1]) throw new Error('Expected archive dialog buttons to render')
    if (!deleteButtons[0] || !deleteButtons[1]) throw new Error('Expected delete dialog buttons to render')

    await archiveButtons[0].trigger('click')
    await deleteButtons[0].trigger('click')
    await archiveButtons[1].trigger('click')
    await deleteButtons[1].trigger('click')

    expect(wrapper.emitted('updateArchiveOpen')).toEqual([[false]])
    expect(wrapper.emitted('updateDeleteOpen')).toEqual([[false]])
    expect(wrapper.emitted('confirmArchive')).toEqual([[]])
    expect(wrapper.emitted('confirmDelete')).toEqual([[]])
  })

  it('passes independent busy state and destructive intent to each underlying dialog', () => {
    const wrapper = mountDialogs({
      archiveBusy: true,
      deleteBusy: true,
    })

    expect(wrapper.get('[aria-label="Archive job?"]').attributes('data-busy')).toBe('true')
    expect(wrapper.get('[aria-label="Delete job?"]').attributes('data-busy')).toBe('true')
    expect(wrapper.get('[aria-label="Archive job?"]').attributes('data-destructive')).toBe('false')
    expect(wrapper.get('[aria-label="Delete job?"]').attributes('data-destructive')).toBe('true')
  })
})
