export interface WebsiteChange {
    path: string;
    kind: 'added' | 'removed' | 'changed';
    before: string;
    after: string;
}
export interface WebsiteComparison {
    changes: WebsiteChange[];
    total: number;
}
export declare function compareWebsites(before: unknown, after: unknown): WebsiteComparison;
//# sourceMappingURL=websiteChanges.d.ts.map