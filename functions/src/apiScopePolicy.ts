import { createHash, timingSafeEqual } from 'node:crypto'

export const integrationScopes = [
  'forms:draft:write',
  'sds:metadata:write',
  'sds:upload:stage',
  'sds:upload:commit',
] as const
export type IntegrationScope = (typeof integrationScopes)[number]
export type IntegrationOperation =
  | 'forms.draft.create'
  | 'forms.draft.update'
  | 'sds.metadata.update'
  | 'sds.upload.stage'
  | 'sds.upload.finalize'
export interface IntegrationCredential {
  id: string
  secretHash: string
  scopes: IntegrationScope[]
  createdAt: number
  expiresAt: number
  revokedAt?: number
  /** Existing form edits need explicit grants; creating a draft does not publish it. */
  formIds: string[]
  /** SDS modifications/uploads require an explicit approved staging folder. */
  sdsFolderIds: string[]
}
export interface IntegrationRequest {
  operation: string
  resourceId?: string
  folderId?: string
}
export type IntegrationDecision =
  | { allowed: true; operation: IntegrationOperation }
  | {
      allowed: false
      reason:
        | 'invalid-key'
        | 'expired'
        | 'revoked'
        | 'invalid-policy'
        | 'unsupported-operation'
        | 'missing-scope'
        | 'resource-denied'
    }
const idPattern = /^[A-Za-z0-9_-]{1,80}$/
const hashPattern = /^[a-f0-9]{64}$/
const operationScopes: Record<IntegrationOperation, IntegrationScope> = {
  'forms.draft.create': 'forms:draft:write',
  'forms.draft.update': 'forms:draft:write',
  'sds.metadata.update': 'sds:metadata:write',
  'sds.upload.stage': 'sds:upload:stage',
  'sds.upload.finalize': 'sds:upload:commit',
}

/** Hash an opaque high-entropy secret; never persist or log the bearer value. */
export function hashIntegrationSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex')
}

/** Authentication transport/lookup is deliberately outside this pure policy module. */
export function evaluateIntegrationRequest(
  credential: IntegrationCredential | null,
  secret: string,
  request: IntegrationRequest,
  now: number,
): IntegrationDecision {
  if (
    !credential ||
    !hashPattern.test(credential.secretHash) ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(secret)
  )
    return { allowed: false, reason: 'invalid-key' }
  const actual = Buffer.from(hashIntegrationSecret(secret), 'hex')
  const expected = Buffer.from(credential.secretHash, 'hex')
  if (!timingSafeEqual(actual, expected)) return { allowed: false, reason: 'invalid-key' }
  if (credential.revokedAt !== undefined) return { allowed: false, reason: 'revoked' }
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(credential.createdAt) ||
    !Number.isFinite(credential.expiresAt) ||
    credential.createdAt > now ||
    credential.expiresAt <= credential.createdAt ||
    !idPattern.test(credential.id) ||
    !Array.isArray(credential.scopes) ||
    credential.scopes.some((scope) => !integrationScopes.includes(scope)) ||
    !validIds(credential.formIds) ||
    !validIds(credential.sdsFolderIds)
  )
    return { allowed: false, reason: 'invalid-policy' }
  if (credential.expiresAt <= now) return { allowed: false, reason: 'expired' }
  if (!Object.prototype.hasOwnProperty.call(operationScopes, request.operation))
    return { allowed: false, reason: 'unsupported-operation' }
  const operation = request.operation as IntegrationOperation
  if (!credential.scopes.includes(operationScopes[operation]))
    return { allowed: false, reason: 'missing-scope' }
  if (
    operation === 'forms.draft.update' &&
    (!request.resourceId || !credential.formIds.includes(request.resourceId))
  )
    return { allowed: false, reason: 'resource-denied' }
  if (
    operation.startsWith('sds.') &&
    (!request.folderId || !credential.sdsFolderIds.includes(request.folderId))
  )
    return { allowed: false, reason: 'resource-denied' }
  if (request.resourceId !== undefined && !idPattern.test(request.resourceId))
    return { allowed: false, reason: 'resource-denied' }
  return { allowed: true, operation }
}
function validIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 200 &&
    value.every((id) => typeof id === 'string' && idPattern.test(id))
  )
}

/** Safe metadata for an eventual append-only server audit; no request payload or secret. */
export function integrationAuditEvent(
  keyId: string,
  request: IntegrationRequest,
  decision: IntegrationDecision,
  now: number,
) {
  return {
    keyId: idPattern.test(keyId) ? keyId : 'unknown',
    operation: Object.prototype.hasOwnProperty.call(operationScopes, request.operation)
      ? request.operation
      : 'unsupported',
    resourceId:
      request.resourceId && idPattern.test(request.resourceId) ? request.resourceId : null,
    folderId: request.folderId && idPattern.test(request.folderId) ? request.folderId : null,
    allowed: decision.allowed,
    reason: decision.allowed ? null : decision.reason,
    at: now,
  }
}
