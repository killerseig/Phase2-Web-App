export declare const FORM_VIEWER_LINK_DAYS = 30;
/** Internal email preparation only; authorization for callable issuance is checked separately. */
export declare function issueFormViewerLink(id: string, baseUrl?: string): Promise<{
    url: string;
    expiresAt: number;
}>;
export declare const formSubmissionViewer: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    url: string;
    expiresAt: number;
} | {
    base64: string;
    contentType: string;
    revoked?: undefined;
    canManage?: undefined;
    id?: undefined;
    templateVersion?: undefined;
    definition?: undefined;
    answers?: undefined;
    submittedAt?: undefined;
    requireLogin?: undefined;
    linkLifetimeDays?: undefined;
} | {
    revoked: boolean;
    base64?: undefined;
    contentType?: undefined;
    canManage?: undefined;
    id?: undefined;
    templateVersion?: undefined;
    definition?: undefined;
    answers?: undefined;
    submittedAt?: undefined;
    requireLogin?: undefined;
    linkLifetimeDays?: undefined;
} | {
    canManage: boolean;
    id: string;
    templateVersion: number;
    definition: import("./formModel").FormVersion;
    answers: import("./formModel").FormAnswers;
    submittedAt: number | undefined;
    requireLogin: boolean;
    linkLifetimeDays: number;
    base64?: undefined;
    contentType?: undefined;
    revoked?: undefined;
}>, unknown>;
//# sourceMappingURL=formSubmissionViewer.d.ts.map