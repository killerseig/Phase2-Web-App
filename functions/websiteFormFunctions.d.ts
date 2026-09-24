export declare const submitWebsiteForm: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    received: boolean;
}>, unknown>;
export declare function submissionEmailHtml(record: {
    formName: string;
    answers: {
        label: string;
        value: unknown;
    }[];
}): string;
export declare function deliverWebsiteSubmission(id: string, retry?: boolean): Promise<void>;
export declare const deliverWebsiteFormEmail: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").QueryDocumentSnapshot | undefined, {
    submissionId: string;
}>>;
export declare const websiteFormAdmin: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    emailStatus: any;
    submissions?: undefined;
    nextCursor?: undefined;
} | {
    submissions: {
        id: string;
        formName: any;
        createdAt: any;
        answers: any;
        emailStatus: any;
        attempts: any;
        attemptStartedAt: any;
    }[];
    nextCursor: string | null;
    emailStatus?: undefined;
}>, unknown>;
//# sourceMappingURL=websiteFormFunctions.d.ts.map