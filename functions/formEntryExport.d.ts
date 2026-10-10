import type { FormRecord } from './formModel';
export interface EntryAnswerRow {
    submissionId: string;
    version: number;
    submittedAt: number;
    groupLabel: string;
    groupId: string;
    rowId: string;
    fieldId: string;
    label: string;
    kind: string;
    value: string;
}
/** Traverse the immutable submitted definition, never today's editor draft. */
export declare function entryAnswerRows(record: FormRecord): EntryAnswerRow[];
export declare const entryExportHeaders: string[];
export declare function entryExportCells(records: FormRecord[]): string[][];
/** Quoted CSV is insufficient to stop spreadsheet formulas; neutralize each cell. */
export declare function safeSpreadsheetCell(value: string): string;
export declare function entriesCsv(records: FormRecord[]): Buffer;
export declare function entriesXlsx(records: FormRecord[]): Buffer;
//# sourceMappingURL=formEntryExport.d.ts.map