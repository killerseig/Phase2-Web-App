"use strict";
/**
 * Cloud Functions Shared Utilities
 * Common helpers for all Cloud Functions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudFunctionErrors = void 0;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
/**
 * Create a success response
 */
function successResponse(data) {
    return {
        success: true,
        data,
    };
}
/**
 * Create an error response
 */
function errorResponse(code, message) {
    return {
        success: false,
        error: { code, message },
    };
}
/**
 * Cloud Function error codes
 */
exports.CloudFunctionErrors = {
    NOT_SIGNED_IN: 'NOT_SIGNED_IN',
    INVALID_INPUT: 'INVALID_INPUT',
    NOT_FOUND: 'NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    EMAIL_DISABLED: 'EMAIL_DISABLED',
    EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};
//# sourceMappingURL=utils.js.map