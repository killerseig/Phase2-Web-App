import type { SdsBookEntry } from './sdsModel';
/** Output and manifest share final pagination, independent of explorer filters. */
export declare function buildSdsBook(title: string, generatedAt: string, entries: readonly SdsBookEntry[], readPdf: (entry: SdsBookEntry) => Promise<Uint8Array>): Promise<{
    bytes: Uint8Array<ArrayBufferLike>;
    manifest: {
        documentId: string;
        revisionId: string;
        title: string;
        startPage: number;
        pageCount: number;
    }[];
    pageCount: number;
}>;
//# sourceMappingURL=sdsBook.d.ts.map