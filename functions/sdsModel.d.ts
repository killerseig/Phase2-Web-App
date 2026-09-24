import type { CurrentFunctionUser } from './roleAccess';
export interface SdsFolder {
    id: string;
    name: string;
    parentId: string;
    order: number;
}
export interface SdsSheet {
    id: string;
    name: string;
    manufacturer: string;
    productCode: string;
    language: string;
    folderId: string;
    order: number;
    revisionId: string;
    revisionDate: string;
    archived: boolean;
    extension?: string;
    mimeType?: string;
    originalName?: string;
    size?: number;
}
export interface SdsSelection {
    documentId: string;
    revisionId: string;
}
export interface SdsBookEntry {
    documentId: string;
    revisionId: string;
    title: string;
    manufacturer: string;
    revisionDate: string;
    folders: string[];
    filePath: string;
    extension?: string;
}
export declare function sdsCanAccessJob(user: CurrentFunctionUser, jobId: string, job: Record<string, unknown>): boolean;
export declare function sdsId(value: unknown, optional?: boolean): string;
export declare function sdsText(value: unknown, label: string, max?: number, required?: boolean): string;
export declare function folderPath(id: string, folders: readonly SdsFolder[]): SdsFolder[];
export declare function orderedSheets(sheets: readonly SdsSheet[], folders: readonly SdsFolder[]): SdsSheet[];
export declare function validateSelections(value: unknown): SdsSelection[];
//# sourceMappingURL=sdsModel.d.ts.map