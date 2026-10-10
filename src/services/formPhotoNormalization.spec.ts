import { describe, expect, it, vi } from 'vitest'
import { normalizeFormPhoto, type PhotoNormalizer } from './formPhotoNormalization'
function adapter(width = 6000, height = 4000) {
  const close = vi.fn()
  const decode = vi.fn(async () => ({ width, height, source: {} as CanvasImageSource, close }))
  const encode = vi.fn(async () => new Blob(['normalized'], { type: 'image/webp' }))
  return { decode, encode, close }
}
describe('local phone photo normalization', () => {
  it('resizes a large source before upload, preserves aspect ratio and releases the decoder', async () => {
    const normalizer = adapter()
    const source = new File([new Uint8Array(3 * 1024 * 1024)], 'phone.jpg', { type: 'image/jpeg' })
    const result = await normalizeFormPhoto(source, normalizer)
    expect(result.type).toBe('image/webp')
    expect(result.size).toBeLessThan(2 * 1024 * 1024)
    expect(normalizer.encode).toHaveBeenCalledWith(expect.anything(), 2048, 1365, 0.86)
    expect(normalizer.close).toHaveBeenCalledOnce()
  })
  it('retries smaller dimensions when encoded bytes exceed the server ceiling', async () => {
    const normalizer = adapter()
    normalizer.encode.mockResolvedValueOnce(
      new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'image/webp' }),
    )
    await normalizeFormPhoto(new File(['source'], 'phone.png', { type: 'image/png' }), normalizer)
    expect(normalizer.encode.mock.calls[1]?.slice(1, 3)).toEqual([1536, 1024])
  })
  it('rejects unsupported formats and oversized sources before decoding', async () => {
    const normalizer = adapter()
    await expect(
      normalizeFormPhoto(new File(['heic'], 'photo.heic', { type: 'image/heic' }), normalizer),
    ).rejects.toThrow('HEIC')
    await expect(
      normalizeFormPhoto(
        new File([new Uint8Array(21 * 1024 * 1024)], 'photo.jpg', { type: 'image/jpeg' }),
        normalizer,
      ),
    ).rejects.toThrow('20 MB')
    expect(normalizer.decode).not.toHaveBeenCalled()
  })
  it('releases oversized decoded images and reports processing limits', async () => {
    const normalizer = adapter(10000, 10000)
    await expect(
      normalizeFormPhoto(new File(['source'], 'photo.jpg', { type: 'image/jpeg' }), normalizer),
    ).rejects.toThrow('80 megapixel')
    expect(normalizer.encode).not.toHaveBeenCalled()
    expect(normalizer.close).toHaveBeenCalledOnce()
  })
  it('does not transmit an undecodable file', async () => {
    const normalizer: PhotoNormalizer = {
      decode: vi.fn().mockRejectedValue(new Error('corrupt')),
      encode: vi.fn(),
    }
    await expect(
      normalizeFormPhoto(new File(['bad'], 'photo.jpg', { type: 'image/jpeg' }), normalizer),
    ).rejects.toThrow('decoded')
    expect(normalizer.encode).not.toHaveBeenCalled()
  })
})
