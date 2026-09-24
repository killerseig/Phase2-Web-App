"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdsCanAccessJob = sdsCanAccessJob;
exports.sdsId = sdsId;
exports.sdsText = sdsText;
exports.folderPath = folderPath;
exports.orderedSheets = orderedSheets;
exports.validateSelections = validateSelections;
const https_1 = require("firebase-functions/v2/https");
const jobIdentity_1 = require("./jobIdentity");
const targetJobAccess_1 = require("./targetJobAccess");
function sdsCanAccessJob(user, jobId, job) {
    const assignedJobIds = [...user.assignedJobIds];
    if (Array.isArray(job.assignedForemanIds) && job.assignedForemanIds.includes(user.uid))
        assignedJobIds.push(jobId);
    return (user.active &&
        (0, targetJobAccess_1.targetFunctionRoleCanSeeJobListEntry)({
            role: user.role,
            jobId,
            assignedJobIds,
            isShopJob: (0, jobIdentity_1.isFunctionShopJob)({ name: job.name, number: job.code ?? job.number }),
        }));
}
function sdsId(value, optional = false) {
    if (optional && (value === '' || value === undefined || value === null))
        return '';
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid record identifier.');
    }
    return value;
}
function sdsText(value, label, max = 200, required = false) {
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
        throw new https_1.HttpsError('invalid-argument', `${label} must be ${required ? 'provided and ' : ''}at most ${max} characters.`);
    }
    return value.trim();
}
function folderPath(id, folders) {
    const result = [];
    const seen = new Set();
    let next = id;
    while (next) {
        const folder = folders.find((entry) => entry.id === next);
        if (!folder || seen.has(next) || result.length >= 8) {
            throw new https_1.HttpsError('failed-precondition', 'Folder structure is invalid or deeper than eight levels.');
        }
        result.unshift(folder);
        seen.add(next);
        next = folder.parentId;
    }
    return result;
}
function orderedSheets(sheets, folders) {
    const compare = (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id);
    // Folders precede sheets at each level, matching the explorer.
    const result = [];
    const visit = (parentId) => {
        folders
            .filter((f) => f.parentId === parentId)
            .sort(compare)
            .forEach((f) => visit(f.id));
        result.push(...sheets.filter((s) => s.folderId === parentId).sort(compare));
    };
    folders.forEach((f) => folderPath(f.id, folders));
    sheets.forEach((s) => folderPath(s.folderId, folders));
    visit('');
    return result;
}
function validateSelections(value) {
    if (!Array.isArray(value) || value.length > 1000)
        throw new https_1.HttpsError('invalid-argument', 'Select at most 1,000 sheets.');
    const seen = new Set();
    return value.map((entry) => {
        const documentId = sdsId(entry?.documentId);
        const revisionId = sdsId(entry?.revisionId);
        if (seen.has(documentId))
            throw new https_1.HttpsError('invalid-argument', 'A sheet was selected more than once.');
        seen.add(documentId);
        return { documentId, revisionId };
    });
}
//# sourceMappingURL=sdsModel.js.map