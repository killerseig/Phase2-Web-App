export declare const formSubmissionViewer: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    base64: string;
    contentType: string;
    id?: undefined;
    templateVersion?: undefined;
    definition?: undefined;
    answers?: undefined;
    submittedAt?: undefined;
    requireLogin?: undefined;
} | {
    id: string;
    templateVersion: number;
    definition: {
        output?: import("./formModel").FormOutputSettings;
        version: number;
        createdAt: string;
        title: string;
        description: string;
        fields: import("./formModel").FormField[];
        recipients: string[];
    };
    answers: import("./formModel").FormAnswers;
    submittedAt: number | undefined;
    requireLogin: boolean;
    base64?: undefined;
    contentType?: undefined;
}>, unknown>;
//# sourceMappingURL=formSubmissionViewer.d.ts.map