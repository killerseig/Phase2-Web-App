import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  constrainImageDimensions,
  DAILY_LOG_PHOTO_SOURCE_MAX_BYTES,
  DAILY_LOG_PHOTO_TARGET_BYTES,
  DAILY_LOG_PHOTO_UPLOAD_MAX_BYTES,
  isSupportedDailyLogPhotoFile,
  prepareDailyLogPhotoForUpload,
} from '@/features/dailyLogs/photoUpload'

function withSize(file: File, size: number) {
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: size,
  })
  return file
}

function installImageResizeMocks() {
  class MockImage {
    naturalHeight = 3024
    naturalWidth = 4032
    height = 3024
    width = 4032
    onerror: (() => void) | null = null
    onload: (() => void) | null = null

    set src(_value: string) {
      queueMicrotask(() => this.onload?.())
    }
  }

  vi.stubGlobal('Image', MockImage)
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:daily-log-photo'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })

  const drawImage = vi.fn()
  const fillRect = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    fillRect,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['optimized photo'], { type: 'image/jpeg' }))
  })

  return { drawImage, fillRect }
}

describe('daily log photo upload preparation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('recognizes iPad photo extensions even when the browser omits the MIME type', () => {
    expect(isSupportedDailyLogPhotoFile(new File(['photo'], 'IMG_1001.HEIC'))).toBe(true)
    expect(
      isSupportedDailyLogPhotoFile(new File(['text'], 'notes.txt', { type: 'text/plain' })),
    ).toBe(false)
  })

  it('calculates an aspect-ratio-safe long edge', () => {
    expect(constrainImageDimensions(4032, 3024, 2048)).toEqual({
      width: 2048,
      height: 1536,
    })
    expect(constrainImageDimensions(800, 600, 2048)).toEqual({
      width: 800,
      height: 600,
    })
  })

  it('keeps small web-ready photos unchanged', async () => {
    const photo = new File(['small photo'], 'small.jpg', { type: 'image/jpeg' })

    await expect(prepareDailyLogPhotoForUpload(photo)).resolves.toBe(photo)
  })

  it('converts a max-resolution iPad photo to a smaller JPEG before upload', async () => {
    const { drawImage, fillRect } = installImageResizeMocks()
    const photo = withSize(
      new File(['large photo'], 'IMG_1001.HEIC', { type: 'image/heic' }),
      18 * 1024 * 1024,
    )

    const prepared = await prepareDailyLogPhotoForUpload(photo)

    expect(prepared.name).toBe('IMG_1001.jpg')
    expect(prepared.type).toBe('image/jpeg')
    expect(prepared.size).toBeLessThan(DAILY_LOG_PHOTO_UPLOAD_MAX_BYTES)
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1920, 1440)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1920, 1440)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:daily-log-photo')
  })

  it('keeps reducing a photo when an iPad canvas attempt fails', async () => {
    const { drawImage } = installImageResizeMocks()
    vi.mocked(HTMLCanvasElement.prototype.toBlob)
      .mockImplementationOnce((callback) => callback(null))
      .mockImplementationOnce((callback) => {
        callback(new Blob(['smaller photo'], { type: 'image/jpeg' }))
      })
    const photo = withSize(
      new File(['large photo'], 'image.jpg', { type: 'image/jpeg' }),
      12 * 1024 * 1024,
    )

    const prepared = await prepareDailyLogPhotoForUpload(photo)

    expect(prepared.size).toBeLessThanOrEqual(DAILY_LOG_PHOTO_TARGET_BYTES)
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(2)
    expect(drawImage).toHaveBeenNthCalledWith(1, expect.anything(), 0, 0, 1920, 1440)
    expect(drawImage).toHaveBeenNthCalledWith(2, expect.anything(), 0, 0, 1600, 1200)
  })

  it('rejects source files too large to safely process on a tablet', async () => {
    const photo = withSize(
      new File(['huge photo'], 'huge.jpg', { type: 'image/jpeg' }),
      DAILY_LOG_PHOTO_SOURCE_MAX_BYTES + 1,
    )

    await expect(prepareDailyLogPhotoForUpload(photo)).rejects.toThrow(
      'larger than the 50 MB photo limit',
    )
  })
})
