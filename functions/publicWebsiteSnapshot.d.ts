import type { WebsiteSite } from './websiteModel';
export interface PublishedRepresentation {
    version: string;
    site: WebsiteSite;
    pages: Record<string, string>;
}
export declare function publicRendererId(): string;
export declare function assertPublic(site: WebsiteSite): void;
export declare function publicVersion(site: WebsiteSite, revision: number): string;
export declare function publicSnapshotJson(site: WebsiteSite, version: string): string;
export declare function generatePublicPages(site: WebsiteSite, revision: number, renderer?: (site: WebsiteSite, slug: string, version: string) => Promise<string>, existingVersion?: string): Promise<PublishedRepresentation>;
export declare function regeneratePublicPages(site: WebsiteSite, version: string): Promise<PublishedRepresentation>;
export declare function servePublicHtml(site: WebsiteSite, version: string, slug: string, body: string, template?: string): string;
//# sourceMappingURL=publicWebsiteSnapshot.d.ts.map