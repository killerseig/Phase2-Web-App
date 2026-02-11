/**
 * Cloud Functions Shared Utilities
 * Common helpers for all Cloud Functions
 */
/**
 * Standard API Response for Cloud Functions
 */
export interface CloudFunctionResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
/**
 * Create a success response
 */
export declare function successResponse<T>(data?: T): CloudFunctionResponse<T>;
/**
 * Create an error response
 */
export declare function errorResponse(code: string, message: string): CloudFunctionResponse;
/**
 * Cloud Function error codes
 */
export declare const CloudFunctionErrors: {
    readonly NOT_SIGNED_IN: "NOT_SIGNED_IN";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly PERMISSION_DENIED: "PERMISSION_DENIED";
    readonly EMAIL_DISABLED: "EMAIL_DISABLED";
    readonly EMAIL_SEND_FAILED: "EMAIL_SEND_FAILED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
//# sourceMappingURL=utils.d.ts.map