import { createHash } from 'node:crypto'
export const INTEGRATION_REQUESTS_PER_HOUR = 60
export const INTEGRATION_BYTES_PER_HOUR = 100 * 1024 * 1024
export interface IntegrationEnvelope {
  requestId: string
  operation: string
  resourceId?: string
  folderId?: string
  payload: Record<string, unknown>
}
export function parseIntegrationEnvelope(value: unknown): IntegrationEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid request.')
  const data = value as Record<string, unknown>
  if (
    typeof data.requestId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(data.requestId) ||
    typeof data.operation !== 'string' ||
    !data.payload ||
    typeof data.payload !== 'object' ||
    Array.isArray(data.payload)
  )
    throw new Error('Invalid request.')
  for (const key of ['resourceId', 'folderId'])
    if (
      data[key] !== undefined &&
      (typeof data[key] !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(data[key] as string))
    )
      throw new Error('Invalid resource.')
  return {
    requestId: data.requestId,
    operation: data.operation,
    resourceId: data.resourceId as string | undefined,
    folderId: data.folderId as string | undefined,
    payload: data.payload as Record<string, unknown>,
  }
}
export function integrationPayloadHash(request: IntegrationEnvelope): string {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, item]) => [key, canonical(item)]),
          )
        : value
  return createHash('sha256')
    .update(JSON.stringify(canonical(request)))
    .digest('hex')
}
export function reserveIntegrationQuota(
  previous: { requests?: number; bytes?: number },
  incomingBytes: number,
) {
  if (!Number.isSafeInteger(incomingBytes) || incomingBytes < 0)
    throw new Error('Invalid request size.')
  const next = {
    requests: (previous.requests ?? 0) + 1,
    bytes: (previous.bytes ?? 0) + incomingBytes,
  }
  if (
    !Number.isSafeInteger(next.requests) ||
    !Number.isSafeInteger(next.bytes) ||
    next.requests > INTEGRATION_REQUESTS_PER_HOUR ||
    next.bytes > INTEGRATION_BYTES_PER_HOUR
  )
    throw new Error('Integration hourly quota exceeded.')
  return next
}
