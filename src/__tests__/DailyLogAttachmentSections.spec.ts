import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import DailyLogAttachmentSections from '@/components/dailyLogs/DailyLogAttachmentSections.vue'
import type { DailyLogAttachmentRecord } from '@/types/domain'

const photoAttachments: DailyLogAttachmentRecord[] = [
  {
    name: 'photo.jpg',
    url: 'https://example.com/photo.jpg',
    path: 'daily-logs/log-1/photo.jpg',
    type: 'photo',
    description: 'Photo description',
  },
]

const ptpAttachments: DailyLogAttachmentRecord[] = [
  {
    name: 'ptp.jpg',
    url: 'https://example.com/ptp.jpg',
    path: 'daily-logs/log-1/ptp.jpg',
    type: 'ptp',
    description: 'PTP description',
  },
]

function mountAttachmentSections(
  overrides: Partial<InstanceType<typeof DailyLogAttachmentSections>['$props']> = {},
) {
  return shallowMount(DailyLogAttachmentSections, {
    props: {
      disabled: false,
      photoAttachments,
      photoBusy: false,
      ptpAttachments,
      ptpBusy: false,
      uploadPhoto: vi.fn<(entries: Array<{ file: File; description: string }>) => Promise<void>>(
        async () => undefined,
      ),
      uploadPtp: vi.fn<(entries: Array<{ file: File; description: string }>) => Promise<void>>(
        async () => undefined,
      ),
      ...overrides,
    },
    global: {
      stubs: {
        DailyLogAttachmentCard: {
          props: [
            'attachments',
            'anchorId',
            'busy',
            'chooseLabel',
            'descriptionLabel',
            'disabled',
            'emptyLabel',
            'helperText',
            'title',
            'uploadHandler',
          ],
          emits: ['remove', 'update-description'],
          template: `
            <section data-testid="attachment-card" :data-anchor-id="anchorId">
              <strong data-testid="attachment-title">{{ title }}</strong>
              <span data-testid="attachment-choose-label">{{ chooseLabel }}</span>
              <span data-testid="attachment-description-label">{{ descriptionLabel }}</span>
              <span data-testid="attachment-empty-label">{{ emptyLabel }}</span>
              <span data-testid="attachment-helper-text">{{ helperText }}</span>
              <span data-testid="attachment-disabled">{{ String(disabled) }}</span>
              <span data-testid="attachment-busy">{{ String(busy) }}</span>
              <span data-testid="attachment-count">{{ attachments.length }}</span>
              <span data-testid="attachment-upload-handler">{{ typeof uploadHandler }}</span>
              <button
                data-testid="attachment-update"
                type="button"
                @click="$emit('update-description', { path: title, description: 'Updated' })"
              >Update</button>
              <button data-testid="attachment-remove" type="button" @click="$emit('remove', title)">Remove</button>
            </section>
          `,
        },
      },
    },
  })
}

describe('DailyLogAttachmentSections', () => {
  it('renders configured Photos and PTP attachment cards with parent-owned state', () => {
    const wrapper = mountAttachmentSections({
      disabled: true,
      photoBusy: true,
      ptpBusy: false,
    })
    const cards = wrapper.findAll('[data-testid="attachment-card"]')
    const photoCard = cards[0]!
    const ptpCard = cards[1]!

    expect(cards).toHaveLength(2)
    expect(photoCard.find('[data-testid="attachment-title"]').text()).toBe('Photos')
    expect(photoCard.find('[data-testid="attachment-choose-label"]').text()).toBe('Choose Photos')
    expect(photoCard.find('[data-testid="attachment-description-label"]').text()).toBe(
      'Description',
    )
    expect(photoCard.find('[data-testid="attachment-empty-label"]').text()).toBe(
      'Drag and drop photos here to upload.',
    )
    expect(photoCard.attributes('data-anchor-id')).toBe('daily-log-photos')
    expect(photoCard.find('[data-testid="attachment-helper-text"]').text()).toBe(
      'Select a photo to view it full screen.',
    )
    expect(photoCard.find('[data-testid="attachment-disabled"]').text()).toBe('true')
    expect(photoCard.find('[data-testid="attachment-busy"]').text()).toBe('true')
    expect(photoCard.find('[data-testid="attachment-count"]').text()).toBe('1')
    expect(photoCard.find('[data-testid="attachment-upload-handler"]').text()).toBe('function')

    expect(ptpCard.find('[data-testid="attachment-title"]').text()).toBe('PTP Photos')
    expect(ptpCard.find('[data-testid="attachment-choose-label"]').text()).toBe('Choose PTP Photos')
    expect(ptpCard.find('[data-testid="attachment-description-label"]').text()).toBe('Note')
    expect(ptpCard.find('[data-testid="attachment-empty-label"]').text()).toBe(
      'Drag and drop PTP photos here to upload.',
    )
    expect(ptpCard.find('[data-testid="attachment-helper-text"]').text()).toBe(
      'Select a PTP photo to view it full screen.',
    )
    expect(ptpCard.find('[data-testid="attachment-disabled"]').text()).toBe('true')
    expect(ptpCard.find('[data-testid="attachment-busy"]').text()).toBe('false')
    expect(ptpCard.find('[data-testid="attachment-count"]').text()).toBe('1')
    expect(ptpCard.find('[data-testid="attachment-upload-handler"]').text()).toBe('function')
  })

  it('forwards description and remove events from both attachment cards', async () => {
    const wrapper = mountAttachmentSections()
    const updateButtons = wrapper.findAll('[data-testid="attachment-update"]')
    const removeButtons = wrapper.findAll('[data-testid="attachment-remove"]')

    await updateButtons[0]!.trigger('click')
    await updateButtons[1]!.trigger('click')
    await removeButtons[0]!.trigger('click')
    await removeButtons[1]!.trigger('click')

    expect(wrapper.emitted('updateDescription')).toEqual([
      [{ path: 'Photos', description: 'Updated' }],
      [{ path: 'PTP Photos', description: 'Updated' }],
    ])
    expect(wrapper.emitted('remove')).toEqual([['Photos'], ['PTP Photos']])
  })
})
