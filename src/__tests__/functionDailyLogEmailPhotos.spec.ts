import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  file: vi.fn(),
}))

vi.mock('../../functions/src/runtime', () => ({
  storageBucket: {
    name: 'phase2-test.appspot.com',
    file: mocks.file,
  },
}))

import {
  DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES,
  DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES,
  getExpectedDailyLogThumbnailPath,
  prepareDailyLogInlinePhotos,
  selectDailyLogEmailPhotoCandidates,
} from '../../functions/src/dailyLogEmailPhotos'

function attachment(index: number, type: 'photo' | 'ptp' | 'qc' = 'photo') {
  return {
    name: `${type}-${index}.jpg`,
    path: `daily-logs/daily-log-1/${type}-${index}.jpg`,
    type,
  }
}

describe('Daily Log inline email photos', () => {
  beforeEach(() => {
    mocks.file.mockReset()
  })

  it('binds paths to the current log and selects at most two entries per section', () => {
    const candidates = selectDailyLogEmailPhotoCandidates('daily-log-1', {
      payload: {
        attachments: [
          ...Array.from({ length: 8 }, (_, index) => attachment(index + 1)),
          ...Array.from({ length: 7 }, (_, index) => attachment(index + 1, 'ptp')),
          ...Array.from({ length: 6 }, (_, index) => attachment(index + 1, 'qc')),
          {
            name: 'foreign.jpg',
            path: 'daily-logs/another-log/foreign.jpg',
            type: 'qc',
          },
        ],
      },
    })

    expect(candidates).toHaveLength(6)
    expect(candidates.filter((entry) => entry.section === 'photo')).toHaveLength(2)
    expect(candidates.filter((entry) => entry.section === 'ptp')).toHaveLength(2)
    expect(candidates.filter((entry) => entry.section === 'qc')).toHaveLength(2)
    expect(candidates).not.toContainEqual(
      expect.objectContaining({ originalPath: expect.stringContaining('another-log') }),
    )
    expect(
      getExpectedDailyLogThumbnailPath('daily-logs/daily-log-1/photo-1.jpg', 'daily-log-1'),
    ).toBe('daily-logs/daily-log-1/thumbnails/photo-1.jpg')
  })

  it('generates a bounded CID JPEG from the original when a legacy thumbnail is missing', async () => {
    const source = Buffer.from(
      '<svg width="40" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="30" fill="blue"/></svg>',
    )
    mocks.file.mockImplementation((path: string) => ({
      getMetadata: vi.fn(async () => {
        if (path.includes('/thumbnails/')) {
          throw Object.assign(new Error('missing'), { code: 404 })
        }
        return [{ size: String(source.length) }]
      }),
      download: vi.fn(async () => [source]),
    }))

    const result = await prepareDailyLogInlinePhotos('daily-log-1', {
      payload: { attachments: [attachment(1)] },
    })

    expect(mocks.file).toHaveBeenNthCalledWith(1, 'daily-logs/daily-log-1/thumbnails/photo-1.jpg')
    expect(mocks.file).toHaveBeenNthCalledWith(2, 'daily-logs/daily-log-1/photo-1.jpg')
    expect(result.previews).toEqual([
      {
        section: 'photo',
        position: 1,
        contentId: 'daily-log-photo-1@phase2.local',
      },
    ])
    expect(result.attachments).toHaveLength(1)
    const jpeg = Buffer.from(result.attachments[0]!.contentBytes, 'base64')
    expect(jpeg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]))
    expect(jpeg.length).toBeLessThanOrEqual(DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES)
  })

  it('never exceeds the aggregate raw-image budget', async () => {
    const attachments = [
      ...Array.from({ length: 6 }, (_, index) => attachment(index + 1)),
      ...Array.from({ length: 6 }, (_, index) => attachment(index + 1, 'ptp')),
      ...Array.from({ length: 6 }, (_, index) => attachment(index + 1, 'qc')),
    ]
    const fixedSize = DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES

    const result = await prepareDailyLogInlinePhotos(
      'daily-log-1',
      { payload: { attachments } },
      {
        downloadObject: vi.fn(async () => Buffer.from('source')),
        createBoundedJpeg: vi.fn(async (_source, maxBytes) =>
          maxBytes >= fixedSize ? Buffer.alloc(fixedSize) : null,
        ),
      },
    )

    const totalBytes = result.attachments.reduce(
      (sum, entry) => sum + Buffer.from(entry.contentBytes, 'base64').length,
      0,
    )
    expect(result.attachments).toHaveLength(6)
    expect(totalBytes).toBeLessThanOrEqual(DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES)
  })
})
