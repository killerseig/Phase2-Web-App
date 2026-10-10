import type { FormRecord } from './formModel';
import type { FormEntryPage } from './formEntryAccess';
/** Fail atomically instead of returning a partial all-entry export. Every page reauthorizes. */
export declare function collectAllEntryPages(fetchPage: (cursor: string | null, snapshotBefore?: number) => Promise<FormEntryPage>, snapshotBefore?: number): Promise<FormRecord[]>;
//# sourceMappingURL=formEntryPagination.d.ts.map