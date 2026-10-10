export declare const integrationScopes: readonly ["forms:draft:write", "sds:metadata:write", "sds:upload:stage", "sds:upload:commit"];
export type IntegrationScope = (typeof integrationScopes)[number];
export type IntegrationOperation = 'forms.draft.create' | 'forms.draft.update' | 'sds.metadata.update' | 'sds.upload.stage' | 'sds.upload.finalize';
export interface IntegrationCredential {
    id: string;
    secretHash: string;
    scopes: IntegrationScope[];
    createdAt: number;
    expiresAt: number;
    revokedAt?: number;
    /** Existing form edits need explicit grants; creating a draft does not publish it. */
    formIds: string[];
    /** SDS modifications/uploads require an explicit approved staging folder. */
    sdsFolderIds: string[];
}
export interface IntegrationRequest {
    operation: string;
    resourceId?: string;
    folderId?: string;
}
export type IntegrationDecision = {
    allowed: true;
    operation: IntegrationOperation;
} | {
    allowed: false;
    reason: 'invalid-key' | 'expired' | 'revoked' | 'invalid-policy' | 'unsupported-operation' | 'missing-scope' | 'resource-denied';
};
/** Hash an opaque high-entropy secret; never persist or log the bearer value. */
export declare function hashIntegrationSecret(secret: string): string;
/** Authentication transport/lookup is deliberately outside this pure policy module. */
export declare function evaluateIntegrationRequest(credential: IntegrationCredential | null, secret: string, request: IntegrationRequest, now: number): IntegrationDecision;
/** Safe metadata for an eventual append-only server audit; no request payload or secret. */
export declare function integrationAuditEvent(keyId: string, request: IntegrationRequest, decision: IntegrationDecision, now: number): {
    keyId: string;
    operation: string;
    resourceId: string | null;
    folderId: string | null;
    allowed: boolean;
    reason: "invalid-key" | "expired" | "revoked" | "invalid-policy" | "unsupported-operation" | "missing-scope" | "resource-denied" | null;
    at: number;
};
//# sourceMappingURL=apiScopePolicy.d.ts.map