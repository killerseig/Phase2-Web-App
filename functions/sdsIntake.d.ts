export declare const SDS_MASTER_CAPACITY = 10000;
export interface SdsImportRow {
    path: string;
    size: number;
    sha256: string;
    name: string;
    manufacturer: string;
    productCode: string;
    revisionDate: string;
    language: string;
    provenance: string;
}
export declare function importPath(value: unknown): string;
export declare function validateImportIndex(value: unknown): SdsImportRow[];
export declare function checkImportBytes(bytes: Buffer, checksum: string, expectedSize: unknown, expectedHash: unknown): void;
//# sourceMappingURL=sdsIntake.d.ts.map