export interface RecipientChallengeMailer {
    enabled: () => boolean;
    send: (email: string, code: string) => Promise<void>;
}
export declare function verifyPublicFormRecipient(input: Record<string, unknown>, origin: string, mailer?: RecipientChallengeMailer): Promise<{
    status: string;
    message: string;
} | {
    status: any;
    message?: undefined;
}>;
export declare const publicFormRecipientVerification: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    status: string;
    message: string;
} | {
    status: any;
    message?: undefined;
}>, unknown>;
//# sourceMappingURL=formRecipientVerification.d.ts.map