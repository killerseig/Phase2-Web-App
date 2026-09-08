export interface EmailDeliveryFailureClassification {
  httpStatus?: number
  retryable: boolean
}

export interface EmailDeliveryErrorOptions {
  cause?: unknown
  httpStatus?: number | null
  retryable?: boolean
}

function normalizeHttpStatus(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 100 || value > 599) {
    return undefined
  }
  return value
}

export function isRetryableEmailDeliveryStatus(httpStatus?: number): boolean {
  if (httpStatus === undefined) return true
  if (httpStatus === 408 || httpStatus === 409 || httpStatus === 425 || httpStatus === 429) {
    return true
  }
  return httpStatus >= 500 && httpStatus <= 599
}

export class EmailDeliveryError extends Error {
  readonly httpStatus?: number
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(message: string, options: EmailDeliveryErrorOptions = {}) {
    super(message)
    this.name = 'EmailDeliveryError'
    this.httpStatus = normalizeHttpStatus(options.httpStatus)
    this.retryable = options.retryable ?? isRetryableEmailDeliveryStatus(this.httpStatus)
    this.cause = options.cause
  }
}

export function classifyEmailDeliveryError(error: unknown): EmailDeliveryFailureClassification {
  if (error instanceof EmailDeliveryError) {
    return {
      ...(error.httpStatus === undefined ? {} : { httpStatus: error.httpStatus }),
      retryable: error.retryable,
    }
  }

  if (!error || typeof error !== 'object') {
    return { retryable: true }
  }

  const candidate = error as {
    httpStatus?: unknown
    response?: { status?: unknown }
    retryable?: unknown
    status?: unknown
  }
  const httpStatus = normalizeHttpStatus(
    candidate.httpStatus ?? candidate.response?.status ?? candidate.status,
  )
  const retryable =
    typeof candidate.retryable === 'boolean'
      ? candidate.retryable
      : isRetryableEmailDeliveryStatus(httpStatus)

  return {
    ...(httpStatus === undefined ? {} : { httpStatus }),
    retryable,
  }
}
