"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFunctionShopJob = isFunctionShopJob;
function text(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    return '';
}
function isFunctionShopJob(job) {
    const jobCode = text(job?.code).toLowerCase();
    const jobNumber = text(job?.number).toLowerCase();
    const jobName = text(job?.name).toLowerCase();
    return jobCode === '736' || jobNumber === '736' || jobName === 'shop';
}
//# sourceMappingURL=jobIdentity.js.map