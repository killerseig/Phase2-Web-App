"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationScopes = void 0;
exports.hashIntegrationSecret = hashIntegrationSecret;
exports.evaluateIntegrationRequest = evaluateIntegrationRequest;
exports.integrationAuditEvent = integrationAuditEvent;
const node_crypto_1 = require("node:crypto");
exports.integrationScopes = [
    'forms:draft:write',
    'sds:metadata:write',
    'sds:upload:stage',
    'sds:upload:commit',
];
const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const operationScopes = {
    'forms.draft.create': 'forms:draft:write',
    'forms.draft.update': 'forms:draft:write',
    'sds.metadata.update': 'sds:metadata:write',
    'sds.upload.stage': 'sds:upload:stage',
    'sds.upload.finalize': 'sds:upload:commit',
};
/** Hash an opaque high-entropy secret; never persist or log the bearer value. */
function hashIntegrationSecret(secret) {
    return (0, node_crypto_1.createHash)('sha256').update(secret, 'utf8').digest('hex');
}
/** Authentication transport/lookup is deliberately outside this pure policy module. */
function evaluateIntegrationRequest(credential, secret, request, now) {
    if (!credential ||
        !hashPattern.test(credential.secretHash) ||
        !/^[A-Za-z0-9_-]{43,128}$/.test(secret))
        return { allowed: false, reason: 'invalid-key' };
    const actual = Buffer.from(hashIntegrationSecret(secret), 'hex');
    const expected = Buffer.from(credential.secretHash, 'hex');
    if (!(0, node_crypto_1.timingSafeEqual)(actual, expected))
        return { allowed: false, reason: 'invalid-key' };
    if (credential.revokedAt !== undefined)
        return { allowed: false, reason: 'revoked' };
    if (!Number.isFinite(now) ||
        !Number.isFinite(credential.createdAt) ||
        !Number.isFinite(credential.expiresAt) ||
        credential.createdAt > now ||
        credential.expiresAt <= credential.createdAt ||
        !idPattern.test(credential.id) ||
        !Array.isArray(credential.scopes) ||
        credential.scopes.some((scope) => !exports.integrationScopes.includes(scope)) ||
        !validIds(credential.formIds) ||
        !validIds(credential.sdsFolderIds))
        return { allowed: false, reason: 'invalid-policy' };
    if (credential.expiresAt <= now)
        return { allowed: false, reason: 'expired' };
    if (!Object.prototype.hasOwnProperty.call(operationScopes, request.operation))
        return { allowed: false, reason: 'unsupported-operation' };
    const operation = request.operation;
    if (!credential.scopes.includes(operationScopes[operation]))
        return { allowed: false, reason: 'missing-scope' };
    if (operation === 'forms.draft.update' &&
        (!request.resourceId || !credential.formIds.includes(request.resourceId)))
        return { allowed: false, reason: 'resource-denied' };
    if (operation.startsWith('sds.') &&
        (!request.folderId || !credential.sdsFolderIds.includes(request.folderId)))
        return { allowed: false, reason: 'resource-denied' };
    if (request.resourceId !== undefined && !idPattern.test(request.resourceId))
        return { allowed: false, reason: 'resource-denied' };
    return { allowed: true, operation };
}
function validIds(value) {
    return (Array.isArray(value) &&
        value.length <= 200 &&
        value.every((id) => typeof id === 'string' && idPattern.test(id)));
}
/** Safe metadata for an eventual append-only server audit; no request payload or secret. */
function integrationAuditEvent(keyId, request, decision, now) {
    return {
        keyId: idPattern.test(keyId) ? keyId : 'unknown',
        operation: Object.prototype.hasOwnProperty.call(operationScopes, request.operation)
            ? request.operation
            : 'unsupported',
        resourceId: request.resourceId && idPattern.test(request.resourceId) ? request.resourceId : null,
        folderId: request.folderId && idPattern.test(request.folderId) ? request.folderId : null,
        allowed: decision.allowed,
        reason: decision.allowed ? null : decision.reason,
        at: now,
    };
}
//# sourceMappingURL=apiScopePolicy.js.map