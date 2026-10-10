/** Engineering upload bounds; source photos are resized locally before transmission. */
export const FORM_PHOTO_SOURCE_BYTES = 20 * 1024 * 1024
export const FORM_PHOTO_SOURCE_PIXELS = 80_000_000
export const FORM_PHOTO_UPLOAD_BYTES = 2 * 1024 * 1024
interface DecodedPhoto {
  width: number
  height: number
  source: CanvasImageSource
  close: () => void
}
export interface PhotoNormalizer {
  decode: (file: File) => Promise<DecodedPhoto>
  encode: (photo: DecodedPhoto, width: number, height: number, quality: number) => Promise<Blob>
}
const browserNormalizer: PhotoNormalizer = {
  async decode(file) {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        width: bitmap.width,
        height: bitmap.height,
        source: bitmap,
        close: () => bitmap.close(),
      }
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    try {
      image.src = url
      await image.decode()
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        source: image,
        close: () => URL.revokeObjectURL(url),
      }
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    }
  },
  async encode(photo, width, height, quality) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser cannot resize this photo.')
    context.drawImage(photo.source, 0, 0, width, height)
    try {
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('This photo could not be resized.'))),
          'image/webp',
          quality,
        ),
      )
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
  },
}
export async function normalizeFormPhoto(
  file: File,
  normalizer: PhotoNormalizer = browserNormalizer,
): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error(
      'Choose a JPEG, PNG or WebP photo. HEIC/HEIF is not supported; export it as JPEG first.',
    )
  if (!file.size || file.size > FORM_PHOTO_SOURCE_BYTES)
    throw new Error('Choose a nonempty photo of at most 20 MB before resizing.')
  let photo: DecodedPhoto
  try {
    photo = await normalizer.decode(file)
  } catch {
    throw new Error('This photo could not be decoded. Export it as JPEG and try again.')
  }
  try {
    if (
      !Number.isFinite(photo.width) ||
      !Number.isFinite(photo.height) ||
      photo.width < 1 ||
      photo.height < 1 ||
      photo.width * photo.height > FORM_PHOTO_SOURCE_PIXELS
    )
      throw new Error('This photo exceeds the 80 megapixel processing limit.')
    let scale = Math.min(1, 2048 / Math.max(photo.width, photo.height))
    for (let attempt = 0; attempt < 6; attempt++) {
      const width = Math.max(1, Math.round(photo.width * scale)),
        height = Math.max(1, Math.round(photo.height * scale))
      const blob = await normalizer.encode(photo, width, height, attempt === 0 ? 0.86 : 0.72)
      if (
        blob.size > 0 &&
        blob.size <= FORM_PHOTO_UPLOAD_BYTES &&
        ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)
      )
        return blob
      scale *= 0.75
    }
    throw new Error(
      'This photo is still too large after resizing. Choose a smaller photo and retry.',
    )
  } finally {
    photo.close()
  }
}
