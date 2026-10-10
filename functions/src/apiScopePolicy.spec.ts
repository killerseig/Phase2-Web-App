import { describe, expect, it } from 'vitest'
import {
  evaluateIntegrationRequest,
  hashIntegrationSecret,
  integrationAuditEvent,
  type IntegrationCredential,
} from './apiScopePolicy'
const secret = 'a'.repeat(43)
const policy = (): IntegrationCredential => ({
  id: 'test-only',
  secretHash: hashIntegrationSecret(secret),
  scopes: ['forms:draft:write', 'sds:metadata:write', 'sds:upload:stage'],
  createdAt: 100,
  expiresAt: 1000,
  formIds: ['form-a'],
  sdsFolderIds: ['staging-a'],
})
describe('integration API policy foundation', () => {
  it('allows draft creation and explicitly scoped updates without implying publication', () => {
    expect(
      evaluateIntegrationRequest(policy(), secret, { operation: 'forms.draft.create' }, 500)
        .allowed,
    ).toBe(true)
    expect(
      evaluateIntegrationRequest(
        policy(),
        secret,
        { operation: 'forms.draft.update', resourceId: 'form-a' },
        500,
      ).allowed,
    ).toBe(true)
    expect(
      evaluateIntegrationRequest(
        policy(),
        secret,
        { operation: 'forms.draft.update', resourceId: 'form-b' },
        500,
      ),
    ).toEqual({ allowed: false, reason: 'resource-denied' })
  })
  it('denies publish, delete, responses, permissions and unknown/prototype operations', () => {
    for (const operation of [
      'forms.publish',
      'sds.delete',
      'forms.entries.read',
      'users.roles.update',
      'toString',
      '__proto__',
    ])
      expect(evaluateIntegrationRequest(policy(), secret, { operation }, 500)).toEqual({
        allowed: false,
        reason: 'unsupported-operation',
      })
  })
  it('requires separate SDS scopes and approved folders', () => {
    expect(
      evaluateIntegrationRequest(
        policy(),
        secret,
        { operation: 'sds.upload.finalize', folderId: 'staging-a' },
        500,
      ),
    ).toEqual({ allowed: false, reason: 'missing-scope' })
    expect(
      evaluateIntegrationRequest(
        { ...policy(), scopes: [...policy().scopes, 'sds:upload:commit'] },
        secret,
        { operation: 'sds.upload.finalize', folderId: 'staging-a' },
        500,
      ).allowed,
    ).toBe(true)
    expect(
      evaluateIntegrationRequest(
        policy(),
        secret,
        { operation: 'sds.upload.stage', folderId: 'staging-a' },
        500,
      ).allowed,
    ).toBe(true)
    expect(
      evaluateIntegrationRequest(
        policy(),
        secret,
        { operation: 'sds.metadata.update', folderId: 'other' },
        500,
      ),
    ).toEqual({ allowed: false, reason: 'resource-denied' })
    const formsOnly = {
      ...policy(),
      scopes: ['forms:draft:write'] as IntegrationCredential['scopes'],
    }
    expect(
      evaluateIntegrationRequest(
        formsOnly,
        secret,
        { operation: 'sds.upload.stage', folderId: 'staging-a' },
        500,
      ),
    ).toEqual({ allowed: false, reason: 'missing-scope' })
  })
  it('denies wrong secrets, expiry at the boundary and revoked keys', () => {
    expect(
      evaluateIntegrationRequest(
        policy(),
        'b'.repeat(43),
        { operation: 'forms.draft.create' },
        500,
      ),
    ).toEqual({ allowed: false, reason: 'invalid-key' })
    expect(
      evaluateIntegrationRequest(policy(), secret, { operation: 'forms.draft.create' }, 1000),
    ).toEqual({ allowed: false, reason: 'expired' })
    expect(
      evaluateIntegrationRequest(
        { ...policy(), revokedAt: 0 },
        secret,
        { operation: 'forms.draft.create' },
        500,
      ),
    ).toEqual({ allowed: false, reason: 'revoked' })
  })
  it('fails closed on malformed policy or invalid resource IDs', () => {
    expect(
      evaluateIntegrationRequest(
        { ...policy(), expiresAt: NaN },
        secret,
        { operation: 'forms.draft.create' },
        500,
      ),
    ).toEqual({ allowed: false, reason: 'invalid-policy' })
    expect(
      evaluateIntegrationRequest(
        policy(),
        secret,
        { operation: 'forms.draft.create', resourceId: '../../users' },
        500,
      ),
    ).toEqual({ allowed: false, reason: 'resource-denied' })
  })
  it('audits only safe identifiers and decisions, without payload or bearer secrets', () => {
    const request = {
      operation: `publish-${secret}`,
      resourceId: 'valid',
      folderId: secret + '/private',
    }
    const event = integrationAuditEvent(
      'test-only',
      request,
      { allowed: false, reason: 'unsupported-operation' },
      500,
    )
    expect(JSON.stringify(event)).not.toContain(secret)
    expect(event).toMatchObject({ operation: 'unsupported', folderId: null, allowed: false })
  })
})
