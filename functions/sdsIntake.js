"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SDS_MASTER_CAPACITY = void 0;
exports.importPath = importPath;
exports.validateImportIndex = validateImportIndex;
exports.checkImportBytes = checkImportBytes;
const https_1 = require("firebase-functions/v2/https");
exports.SDS_MASTER_CAPACITY = 10000;
function importPath(value) {
    if (typeof value !== 'string' || value.length > 1000 || !value.trim())
        throw new https_1.HttpsError('invalid-argument', 'Provide a relative source path.');
    const path = value.replace(/\\/g, '/');
    if (path.startsWith('/') ||
        /[\x00-\x1f:]/.test(path) ||
        path.split('/').some((p) => !p || p === '.' || p === '..'))
        throw new https_1.HttpsError('invalid-argument', 'Source paths must be relative without traversal.');
    return path;
}
function validateImportIndex(value) {
    const index = value;
    if (!index ||
        index.version !== 1 ||
        !Array.isArray(index.files) ||
        !index.files.length ||
        index.files.length > exports.SDS_MASTER_CAPACITY)
        throw new https_1.HttpsError('invalid-argument', 'Use index version 1 with 1–10,000 files.');
    const seen = new Set();
    return index.files.map((raw) => {
        const row = raw;
        const path = importPath(row?.path);
        if (seen.has(path.toLowerCase()))
            throw new https_1.HttpsError('invalid-argument', 'Source paths must be unique.');
        seen.add(path.toLowerCase());
        if (!path.toLowerCase().endsWith('.pdf') ||
            !Number.isSafeInteger(row.size) ||
            Number(row.size) < 1 ||
            Number(row.size) > 20 * 1024 * 1024 ||
            typeof row.sha256 !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(row.sha256))
            throw new https_1.HttpsError('invalid-argument', 'Each PDF needs its exact size and SHA-256 hash.');
        const text = (key, maximum, required = false) => {
            const value = row[key] ?? '';
            if (typeof value !== 'string' || value.trim().length > maximum || (required && !value.trim()))
                throw new https_1.HttpsError('invalid-argument', `Invalid ${key} in ${path}.`);
            return value.trim();
        };
        const revisionDate = text('revisionDate', 10);
        if (revisionDate &&
            (!/^\d{4}-\d{2}-\d{2}$/.test(revisionDate) ||
                !Number.isFinite(Date.parse(revisionDate)) ||
                new Date(revisionDate).toISOString().slice(0, 10) !== revisionDate))
            throw new https_1.HttpsError('invalid-argument', 'Invalid revision date.');
        return {
            path,
            size: Number(row.size),
            sha256: row.sha256.toLowerCase(),
            name: text('name', 160, true),
            manufacturer: text('manufacturer', 160),
            productCode: text('productCode', 100),
            language: text('language', 40, true),
            revisionDate,
            provenance: text('provenance', 1000),
        };
    });
}
function checkImportBytes(bytes, checksum, expectedSize, expectedHash) {
    if (expectedSize !== undefined &&
        (!Number.isSafeInteger(expectedSize) || Number(expectedSize) !== bytes.length))
        throw new https_1.HttpsError('invalid-argument', 'Uploaded bytes do not match the index size.');
    if (expectedHash !== undefined &&
        (typeof expectedHash !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(expectedHash) ||
            expectedHash.toLowerCase() !== checksum))
        throw new https_1.HttpsError('invalid-argument', 'Uploaded bytes do not match the index SHA-256 hash.');
}
//# sourceMappingURL=sdsIntake.js.map