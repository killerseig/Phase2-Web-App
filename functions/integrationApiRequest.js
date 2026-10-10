"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTEGRATION_BYTES_PER_HOUR = exports.INTEGRATION_REQUESTS_PER_HOUR = void 0;
exports.parseIntegrationEnvelope = parseIntegrationEnvelope;
exports.integrationPayloadHash = integrationPayloadHash;
exports.reserveIntegrationQuota = reserveIntegrationQuota;
const node_crypto_1 = require("node:crypto");
exports.INTEGRATION_REQUESTS_PER_HOUR = 60;
exports.INTEGRATION_BYTES_PER_HOUR = 100 * 1024 * 1024;
function parseIntegrationEnvelope(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid request.');
    const data = value;
    if (typeof data.requestId !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(data.requestId) ||
        typeof data.operation !== 'string' ||
        !data.payload ||
        typeof data.payload !== 'object' ||
        Array.isArray(data.payload))
        throw new Error('Invalid request.');
    for (const key of ['resourceId', 'folderId'])
        if (data[key] !== undefined &&
            (typeof data[key] !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(data[key])))
            throw new Error('Invalid resource.');
    return {
        requestId: data.requestId,
        operation: data.operation,
        resourceId: data.resourceId,
        folderId: data.folderId,
        payload: data.payload,
    };
}
function integrationPayloadHash(request) {
    const canonical = (value) => Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => [key, canonical(item)]))
            : value;
    return (0, node_crypto_1.createHash)('sha256')
        .update(JSON.stringify(canonical(request)))
        .digest('hex');
}
function reserveIntegrationQuota(previous, incomingBytes) {
    if (!Number.isSafeInteger(incomingBytes) || incomingBytes < 0)
        throw new Error('Invalid request size.');
    const next = {
        requests: (previous.requests ?? 0) + 1,
        bytes: (previous.bytes ?? 0) + incomingBytes,
    };
    if (!Number.isSafeInteger(next.requests) ||
        !Number.isSafeInteger(next.bytes) ||
        next.requests > exports.INTEGRATION_REQUESTS_PER_HOUR ||
        next.bytes > exports.INTEGRATION_BYTES_PER_HOUR)
        throw new Error('Integration hourly quota exceeded.');
    return next;
}
//# sourceMappingURL=integrationApiRequest.js.map