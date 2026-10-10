import { describe, expect, it } from 'vitest'
import {
  integrationPayloadHash,
  parseIntegrationEnvelope,
  reserveIntegrationQuota,
  INTEGRATION_BYTES_PER_HOUR,
} from './integrationApiRequest'
const envelope = {
  requestId: '12345678-1234-1234-1234-123456789012',
  operation: 'forms.draft.create',
  payload: { definition: { title: 'Test', description: '' } },
}
describe('scoped API request and quota foundation', () => {
  it('accepts bounded IDs and rejects traversal and absent payloads', () => {
    expect(parseIntegrationEnvelope(envelope)).toMatchObject(envelope)
    expect(() => parseIntegrationEnvelope({ ...envelope, folderId: '../users' })).toThrow()
    expect(() => parseIntegrationEnvelope({ ...envelope, payload: [] })).toThrow()
  })
  it('hashes equivalent JSON independent of object key order but distinguishes changes', () => {
    const request = parseIntegrationEnvelope(envelope)
    expect(integrationPayloadHash(request)).toBe(
      integrationPayloadHash({
        ...request,
        payload: { definition: { description: '', title: 'Test' } },
      }),
    )
    expect(integrationPayloadHash(request)).not.toBe(
      integrationPayloadHash({ ...request, operation: 'forms.draft.update' }),
    )
  })
  it('caps both request count and byte consumption without silent truncation', () => {
    expect(reserveIntegrationQuota({ requests: 59, bytes: 0 }, 100)).toEqual({
      requests: 60,
      bytes: 100,
    })
    expect(() => reserveIntegrationQuota({ requests: 60 }, 0)).toThrow('quota')
    expect(() => reserveIntegrationQuota({ bytes: INTEGRATION_BYTES_PER_HOUR }, 1)).toThrow('quota')
    expect(() => reserveIntegrationQuota({}, -1)).toThrow()
  })
})
