import { type SdsSheet } from './sdsModel';
export declare const downloadSdsFile: import("firebase-functions/v2/https").HttpsFunction;
/** New SDS namespace only: no existing job records or workflow permissions are mutated. */
export declare const sdsWorkspace: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    url: string;
    extension: "pdf" | "jpg" | "jpeg" | "png" | "webp" | "txt" | "csv" | "docx" | "xlsx";
    mimeType: "image/jpeg" | "application/pdf" | "image/png" | "image/webp" | "text/plain" | "text/csv" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
} | {
    version: any;
    folders: {
        id: string;
    }[];
    sheets: {
        id: string;
    }[];
    binder: {
        version: any;
        selections: any;
    };
    exportId: string;
} | {
    sheets: SdsSheet[];
    after: string;
    scanned: number;
    searchMode: string;
    version?: undefined;
    files?: undefined;
    totalBytes?: undefined;
    duplicateByteGroups?: undefined;
    currency?: undefined;
    id?: undefined;
    ok?: undefined;
    reused?: undefined;
    status?: undefined;
    error?: undefined;
    resources?: undefined;
} | {
    version: number;
    files: import("./sdsIntake").SdsImportRow[];
    totalBytes: number;
    duplicateByteGroups: string[][];
    currency: string;
    sheets?: undefined;
    after?: undefined;
    scanned?: undefined;
    searchMode?: undefined;
    id?: undefined;
    ok?: undefined;
    reused?: undefined;
    status?: undefined;
    error?: undefined;
    resources?: undefined;
} | {
    id: string;
    sheets?: undefined;
    after?: undefined;
    scanned?: undefined;
    searchMode?: undefined;
    version?: undefined;
    files?: undefined;
    totalBytes?: undefined;
    duplicateByteGroups?: undefined;
    currency?: undefined;
    ok?: undefined;
    reused?: undefined;
    status?: undefined;
    error?: undefined;
    resources?: undefined;
} | {
    ok: boolean;
    sheets?: undefined;
    after?: undefined;
    scanned?: undefined;
    searchMode?: undefined;
    version?: undefined;
    files?: undefined;
    totalBytes?: undefined;
    duplicateByteGroups?: undefined;
    currency?: undefined;
    id?: undefined;
    reused?: undefined;
    status?: undefined;
    error?: undefined;
    resources?: undefined;
} | {
    id: string;
    reused: boolean;
    sheets?: undefined;
    after?: undefined;
    scanned?: undefined;
    searchMode?: undefined;
    version?: undefined;
    files?: undefined;
    totalBytes?: undefined;
    duplicateByteGroups?: undefined;
    currency?: undefined;
    ok?: undefined;
    status?: undefined;
    error?: undefined;
    resources?: undefined;
} | {
    url?: string | undefined;
    extension?: "pdf" | "jpg" | "jpeg" | "png" | "webp" | "txt" | "csv" | "docx" | "xlsx" | undefined;
    mimeType?: "image/jpeg" | "application/pdf" | "image/png" | "image/webp" | "text/plain" | "text/csv" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | undefined;
    status: string;
    pageCount: any;
    sheets?: undefined;
    after?: undefined;
    scanned?: undefined;
    searchMode?: undefined;
    version?: undefined;
    files?: undefined;
    totalBytes?: undefined;
    duplicateByteGroups?: undefined;
    currency?: undefined;
    id?: undefined;
    ok?: undefined;
    reused?: undefined;
    error?: undefined;
    resources?: undefined;
} | {
    status: any;
    error: any;
    sheets?: undefined;
    after?: undefined;
    scanned?: undefined;
    searchMode?: undefined;
    version?: undefined;
    files?: undefined;
    totalBytes?: undefined;
    duplicateByteGroups?: undefined;
    currency?: undefined;
    id?: undefined;
    ok?: undefined;
    reused?: undefined;
    resources?: undefined;
} | {
    resources: {
        id: string;
    }[];
    sheets?: undefined;
    after?: undefined;
    scanned?: undefined;
    searchMode?: undefined;
    version?: undefined;
    files?: undefined;
    totalBytes?: undefined;
    duplicateByteGroups?: undefined;
    currency?: undefined;
    id?: undefined;
    ok?: undefined;
    reused?: undefined;
    status?: undefined;
    error?: undefined;
}>, unknown>;
export declare const generateSdsBook: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    exportId: string;
}>>;
//# sourceMappingURL=sdsFunctions.d.ts.map