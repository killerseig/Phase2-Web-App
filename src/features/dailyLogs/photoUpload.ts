const MB = 1024 * 1024

export const DAILY_LOG_PHOTO_SOURCE_MAX_BYTES = 50 * MB
export const DAILY_LOG_PHOTO_UPLOAD_MAX_BYTES = 8 * MB
export const DAILY_LOG_PHOTO_TARGET_BYTES = 2 * MB
export const DAILY_LOG_EMAIL_THUMBNAIL_TARGET_BYTES = 120 * 1024
export const DAILY_LOG_EMAIL_THUMBNAIL_MAX_BYTES = 300 * 1024

const DAILY_LOG_PHOTO_SKIP_OPTIMIZATION_BYTES = 750 * 1024
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  'avif',
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'png',
  'webp',
])
const WEB_READY_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

interface ResizeAttempt {
  maxDimension: number
  quality: number
}

const RESIZE_ATTEMPTS: ResizeAttempt[] = [
  { maxDimension: 1920, quality: 0.82 },
  { maxDimension: 1600, quality: 0.76 },
  { maxDimension: 1280, quality: 0.68 },
  { maxDimension: 1024, quality: 0.6 },
  { maxDimension: 800, quality: 0.52 },
]

const EMAIL_THUMBNAIL_RESIZE_ATTEMPTS: ResizeAttempt[] = [
  { maxDimension: 480, quality: 0.7 },
  { maxDimension: 400, quality: 0.62 },
  { maxDimension: 320, quality: 0.54 },
  { maxDimension: 240, quality: 0.46 },
]

function fileExtension(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

function jpegFileName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, '').trim() || 'daily-log-photo'
  return `${baseName}.jpg`
}

export function isSupportedDailyLogPhotoFile(file: File) {
  return (
    file.type.toLowerCase().startsWith('image/') ||
    SUPPORTED_IMAGE_EXTENSIONS.has(fileExtension(file.name))
  )
}

export function constrainImageDimensions(width: number, height: number, maxDimension: number) {
  if (width <= 0 || height <= 0) {
    throw new Error('The selected photo has invalid dimensions.')
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function loadImage(file: File) {
  return new Promise<{ image: HTMLImageElement; release: () => void }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    const release = () => URL.revokeObjectURL(objectUrl)
    image.onload = () => resolve({ image, release })
    image.onerror = () => {
      release()
      reject(new Error(`Could not read ${file.name} as a photo.`))
    }
    image.src = objectUrl
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error('The browser could not optimize this photo.'))
      },
      'image/jpeg',
      quality,
    )
  })
}

async function resizeToJpeg(image: HTMLImageElement, attempt: ResizeAttempt) {
  const dimensions = constrainImageDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    attempt.maxDimension,
  )
  const canvas = document.createElement('canvas')
  canvas.width = dimensions.width
  canvas.height = dimensions.height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('The browser could not prepare this photo for upload.')

  try {
    // Daily-log photos are rendered on white reports, so transparent images should match the report.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await canvasToJpeg(canvas, attempt.quality)
  } finally {
    canvas.width = 1
    canvas.height = 1
  }
}

export async function prepareDailyLogPhotoForUpload(file: File): Promise<File> {
  if (!isSupportedDailyLogPhotoFile(file)) {
    throw new Error(`${file.name} is not a supported image.`)
  }

  if (file.size > DAILY_LOG_PHOTO_SOURCE_MAX_BYTES) {
    throw new Error(`${file.name} is larger than the 50 MB photo limit.`)
  }

  const normalizedType = file.type.toLowerCase()
  if (
    file.size <= DAILY_LOG_PHOTO_SKIP_OPTIMIZATION_BYTES &&
    WEB_READY_IMAGE_TYPES.has(normalizedType)
  ) {
    return file
  }

  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    if (file.size < DAILY_LOG_PHOTO_UPLOAD_MAX_BYTES) return file
    throw new Error(`${file.name} is too large and could not be optimized by this browser.`)
  }

  let smallestBlob: Blob | null = null
  let resizeError: unknown = null

  try {
    const { image, release } = await loadImage(file)

    try {
      for (const attempt of RESIZE_ATTEMPTS) {
        try {
          const blob = await resizeToJpeg(image, attempt)
          if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob

          if (blob.size <= DAILY_LOG_PHOTO_TARGET_BYTES) {
            return new File([blob], jpegFileName(file.name), {
              type: 'image/jpeg',
              lastModified: file.lastModified,
            })
          }
        } catch (error) {
          // Mobile Safari can fail one canvas size under memory pressure. Keep stepping down.
          resizeError = error
        }
      }
    } finally {
      release()
    }
  } catch (error) {
    resizeError = error
  }

  if (smallestBlob && smallestBlob.size <= DAILY_LOG_PHOTO_UPLOAD_MAX_BYTES) {
    return new File([smallestBlob], jpegFileName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  }

  // If this browser cannot decode a valid image format, keep the upload usable when Storage can
  // safely accept the original. This is especially useful for native HEIC support differences.
  if (file.size <= DAILY_LOG_PHOTO_UPLOAD_MAX_BYTES) return file

  throw resizeError instanceof Error
    ? resizeError
    : new Error(`${file.name} could not be resized automatically.`)
}

/**
 * Create the small derivative used by submitted Daily Log emails and gallery grids.
 * This always rasterizes to a bounded JPEG instead of reusing the larger gallery file.
 */
export async function prepareDailyLogEmailThumbnail(file: File): Promise<File> {
  if (!isSupportedDailyLogPhotoFile(file)) {
    throw new Error(`${file.name} is not a supported image.`)
  }

  const { image, release } = await loadImage(file)
  let smallestBlob: Blob | null = null
  let resizeError: unknown = null

  try {
    for (const attempt of EMAIL_THUMBNAIL_RESIZE_ATTEMPTS) {
      try {
        const blob = await resizeToJpeg(image, attempt)
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob

        if (blob.size <= DAILY_LOG_EMAIL_THUMBNAIL_TARGET_BYTES) {
          return new File([blob], jpegFileName(file.name), {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          })
        }
      } catch (error) {
        resizeError = error
      }
    }
  } finally {
    release()
  }

  if (smallestBlob && smallestBlob.size <= DAILY_LOG_EMAIL_THUMBNAIL_MAX_BYTES) {
    return new File([smallestBlob], jpegFileName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  }

  throw resizeError instanceof Error
    ? resizeError
    : new Error(`${file.name} could not be prepared as an email thumbnail.`)
}
