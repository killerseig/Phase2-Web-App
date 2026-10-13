import { type FormRecord } from './formModel';
/** Server-created release fixtures never broaden existing private viewer access. */
export declare function entryReaderAllowed(record: FormRecord, user: {
    uid: string;
    role: string;
    active: boolean;
}, policy: unknown): boolean;
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