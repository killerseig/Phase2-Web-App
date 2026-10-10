import type { IntegrationEnvelope } from './integrationApiRequest';
/** Commits only server-validated, key/actor/folder-bound staging. No public storage URLs. */
export declare function finalizeIntegrationSds(request: IntegrationEnvelope, actorUid: string, keyId: string, secret: string): Promise<{
    id: string;
    revisionId: `${string}-${string}-${string}-${string}-${string}`;
    version: number;
    state: string;
}>;
//# sourceMappingURL=integrationSdsFinalize.d.ts.map