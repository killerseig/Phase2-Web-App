import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  directGet: vi.fn(),
  nestedGet: vi.fn(),
  getJobDetails: vi.fn(),
}))

vi.mock('../../functions/src/runtime', () => ({
  storageBucket: { name: 'phase2-test.appspot.com' },
  db: {
    collection: vi.fn((collectionName: string) => {
      if (collectionName === 'dailyLogs') {
        return {
          doc: (dailyLogId: string) => ({
            path: `dailyLogs/${dailyLogId}`,
            get: mocks.directGet,
          }),
        }
      }

      return {
        doc: (jobId: string) => ({
          collection: () => ({
            doc: (dailyLogId: string) => ({
              path: `jobs/${jobId}/dailyLogs/${dailyLogId}`,
              get: mocks.nestedGet,
            }),
          }),
        }),
      }
    }),
  },
}))

vi.mock('../../functions/src/firestoreService', () => ({
  getJobDetails: mocks.getJobDetails,
}))

import {
  buildPublicDailyLogGalleryPayload,
  isTrustedStorageObjectUrl,
  loadLegacyPublicDailyLogGallery,
} from '../../functions/src/dailyLogGalleryFunctions'

function storageUrl(path: string) {
  return `https://firebasestorage.googleapis.com/v0/b/phase2-test.appspot.com/o/${encodeURIComponent(path)}?alt=media&token=test-token`
}

describe('public daily log gallery payload', () => {
  beforeEach(() => {
    mocks.directGet.mockReset()
    mocks.nestedGet.mockReset()
    mocks.getJobDetails.mockReset()
    mocks.directGet.mockResolvedValue({ exists: false, data: () => undefined })
    mocks.getJobDetails.mockResolvedValue({ name: 'Lucky 3 Ranch', number: '5229' })
  })

  it('returns only single-log gallery metadata and safe photo fields', () => {
    const result = buildPublicDailyLogGalleryPayload(
      { name: 'Lucky 3 Ranch', number: '5229', notificationRecipients: ['private@example.com'] },
      {
        status: 'submitted',
        logDate: '2026-08-20',
        sequenceNumber: 2,
        foremanName: 'Vince Hintz',
        additionalRecipients: ['private@example.com'],
        history: [{ id: 'another-log' }],
        submittedAt: '2026-08-20T15:30:00.000Z',
        payload: {
          foremanOnSite: 'Vince Hintz',
          notesCorrespondence: 'Internal report details',
          attachments: [
            {
              name: 'north-wall.jpg',
              url: storageUrl('daily-logs/daily-log-1/north-wall.jpg'),
              thumbnailUrl: storageUrl('daily-logs/daily-log-1/thumbnails/north-wall.jpg'),
              path: 'daily-logs/daily-log-1/north-wall.jpg',
              thumbnailPath: 'daily-logs/daily-log-1/thumbnails/north-wall.jpg',
              type: 'photo',
              description: 'North wall progress',
              createdAt: '2026-08-20T14:00:00.000Z',
            },
            {
              name: 'unsafe.jpg',
              url: 'javascript:alert(1)',
              path: 'daily-logs/log-1/unsafe.jpg',
              type: 'photo',
              description: 'Unsafe URL',
            },
          ],
        },
      },
      'daily-log-1',
      'phase2-test.appspot.com',
    )

    expect(Object.keys(result)).toEqual([
      'jobName',
      'jobCode',
      'logDate',
      'sequenceNumber',
      'foremanName',
      'submittedAt',
      'attachments',
    ])
    expect(result.attachments).toEqual([
      {
        name: 'north-wall.jpg',
        url: storageUrl('daily-logs/daily-log-1/north-wall.jpg'),
        thumbnailUrl: storageUrl('daily-logs/daily-log-1/thumbnails/north-wall.jpg'),
        type: 'photo',
        description: 'North wall progress',
      },
    ])
    expect(JSON.stringify(result)).not.toContain('private@example.com')
    expect(JSON.stringify(result)).not.toContain('another-log')
    expect(JSON.stringify(result)).not.toContain('Internal report details')
  })

  it('rejects thumbnail URLs outside the app bucket or expected object path', () => {
    expect(
      isTrustedStorageObjectUrl(
        storageUrl('daily-logs/daily-log-1/thumbnails/photo.jpg'),
        'daily-logs/daily-log-1/thumbnails/photo.jpg',
        'phase2-test.appspot.com',
      ),
    ).toBe(true)
    expect(
      isTrustedStorageObjectUrl(
        'https://tracking.example.com/photo.jpg',
        'daily-logs/daily-log-1/thumbnails/photo.jpg',
        'phase2-test.appspot.com',
      ),
    ).toBe(false)
  })

  it('serves legacy links only for the exact submitted daily log', async () => {
    mocks.nestedGet.mockResolvedValue({
      id: 'daily-log-1',
      exists: true,
      data: () => ({
        status: 'submitted',
        logDate: '2026-08-20',
        sequenceNumber: 2,
        payload: {
          foremanOnSite: 'Vince Hintz',
          attachments: [
            {
              name: 'legacy-photo.jpg',
              url: storageUrl('daily-logs/daily-log-1/legacy-photo.jpg'),
              path: 'daily-logs/daily-log-1/legacy-photo.jpg',
              type: 'photo',
              description: 'Legacy photo',
            },
          ],
        },
      }),
    })

    await expect(loadLegacyPublicDailyLogGallery('job-1', 'daily-log-1')).resolves.toEqual(
      expect.objectContaining({
        jobName: 'Lucky 3 Ranch',
        jobCode: '5229',
        foremanName: 'Vince Hintz',
        attachments: [expect.objectContaining({ name: 'legacy-photo.jpg' })],
      }),
    )
  })

  it('does not expose draft daily logs through legacy links', async () => {
    mocks.nestedGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'draft', logDate: '2026-08-20' }),
    })

    await expect(loadLegacyPublicDailyLogGallery('job-1', 'daily-log-1')).rejects.toThrow(
      'Photo gallery not found.',
    )
  })
})
