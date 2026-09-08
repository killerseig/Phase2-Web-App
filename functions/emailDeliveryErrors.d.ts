export interface EmailDeliveryFailureClassification {
    httpStatus?: number;
    retryable: boolean;
}
export interface EmailDeliveryErrorOptions {
    cause?: unknown;
    httpStatus?: number | null;
    retryable?: boolean;
}
export declare function isRetryableEmailDeliveryStatus(httpStatus?: number): boolean;
export declare class EmailDeliveryError extends Error {
    readonly httpStatus?: number;
    readonly retryable: boolean;
    readonly cause?: unknown;
    constructor(message: string, options?: EmailDeliveryErrorOptions);
}
export declare function classifyEmailDeliveryError(error: unknown): EmailDeliveryFailureClassification;
//# sourceMappingURL=emailDeliveryErrors.d.ts.map