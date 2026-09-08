"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailDeliveryError = void 0;
exports.isRetryableEmailDeliveryStatus = isRetryableEmailDeliveryStatus;
exports.classifyEmailDeliveryError = classifyEmailDeliveryError;
function normalizeHttpStatus(value) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 100 || value > 599) {
        return undefined;
    }
    return value;
}
function isRetryableEmailDeliveryStatus(httpStatus) {
    if (httpStatus === undefined)
        return true;
    if (httpStatus === 408 || httpStatus === 409 || httpStatus === 425 || httpStatus === 429) {
        return true;
    }
    return httpStatus >= 500 && httpStatus <= 599;
}
class EmailDeliveryError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'EmailDeliveryError';
        this.httpStatus = normalizeHttpStatus(options.httpStatus);
        this.retryable = options.retryable ?? isRetryableEmailDeliveryStatus(this.httpStatus);
        this.cause = options.cause;
    }
}
exports.EmailDeliveryError = EmailDeliveryError;
function classifyEmailDeliveryError(error) {
    if (error instanceof EmailDeliveryError) {
        return {
            ...(error.httpStatus === undefined ? {} : { httpStatus: error.httpStatus }),
            retryable: error.retryable,
        };
    }
    if (!error || typeof error !== 'object') {
        return { retryable: true };
    }
    const candidate = error;
    const httpStatus = normalizeHttpStatus(candidate.httpStatus ?? candidate.response?.status ?? candidate.status);
    const retryable = typeof candidate.retryable === 'boolean'
        ? candidate.retryable
        : isRetryableEmailDeliveryStatus(httpStatus);
    return {
        ...(httpStatus === undefined ? {} : { httpStatus }),
        retryable,
    };
}
//# sourceMappingURL=emailDeliveryErrors.js.map