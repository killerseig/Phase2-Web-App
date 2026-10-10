export declare const formEntries: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    nextCursor: string | null;
    snapshotBefore: number;
    complete: boolean;
    entries: {
        id: string;
        title: string;
        templateVersion: number;
        submittedAt: number | undefined;
        jobId: string;
    }[];
    base64?: undefined;
    contentType?: undefined;
    filename?: undefined;
    entryCount?: undefined;
} | {
    base64: string;
    contentType: string;
    filename: string;
    nextCursor: string | null;
    snapshotBefore: number;
    complete: boolean;
    entryCount: number;
    entries?: undefined;
}>, unknown>;
//# sourceMappingURL=formEntries.d.ts.map