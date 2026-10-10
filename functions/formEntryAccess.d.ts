import { type FormRecord } from './formModel';
export declare function authorizeFormEntry(id: string, uid?: string): Promise<FormRecord>;
export interface FormEntryPage {
    records: FormRecord[];
    nextCursor: string | null;
    snapshotBefore: number;
    complete: boolean;
}
/** Scan a bounded ID range and filter every entry; empty pages may still have a next cursor. */
export declare function authorizeFormEntriesPage(templateId: string, uid?: string, cursor?: unknown, snapshotBefore?: unknown): Promise<FormEntryPage>;
//# sourceMappingURL=formEntryAccess.d.ts.map