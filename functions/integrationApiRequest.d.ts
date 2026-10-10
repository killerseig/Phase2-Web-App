export declare const INTEGRATION_REQUESTS_PER_HOUR = 60;
export declare const INTEGRATION_BYTES_PER_HOUR: number;
export interface IntegrationEnvelope {
    requestId: string;
    operation: string;
    resourceId?: string;
    folderId?: string;
    payload: Record<string, unknown>;
}
export declare function parseIntegrationEnvelope(value: unknown): IntegrationEnvelope;
export declare function integrationPayloadHash(request: IntegrationEnvelope): string;
export declare function reserveIntegrationQuota(previous: {
    requests?: number;
    bytes?: number;
}, incomingBytes: number): {
    requests: number;
    bytes: number;
};
//# sourceMappingURL=integrationApiRequest.d.ts.map