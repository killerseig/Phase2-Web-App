"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidStoredRole = isValidStoredRole;
exports.normalizeStoredRole = normalizeStoredRole;
exports.getCurrentFunctionRole = getCurrentFunctionRole;
exports.getFunctionAssignedJobIds = getFunctionAssignedJobIds;
exports.getFunctionDisplayName = getFunctionDisplayName;
exports.buildCurrentFunctionUser = buildCurrentFunctionUser;
exports.currentFunctionUserHasAnyRole = currentFunctionUserHasAnyRole;
exports.currentFunctionUserCanAccessAssignedJob = currentFunctionUserCanAccessAssignedJob;
exports.canSendInviteForStoredRole = canSendInviteForStoredRole;
const constants_1 = require("./constants");
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function textOrNull(value) {
    const normalized = text(value);
    return normalized || null;
}
function isValidStoredRole(value) {
    return typeof value === 'string' && constants_1.VALID_ROLES.includes(value);
}
function normalizeStoredRole(value) {
    const role = normalizeRoleAlias(text(value));
    return isValidStoredRole(role) ? role : 'none';
}
function normalizeRoleAlias(value) {
    const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (normalized === 'shopforeman')
        return 'shop-foreman';
    if (normalized === 'projectmanager')
        return 'project-manager';
    return normalized;
}
function getCurrentFunctionRole(value) {
    return normalizeStoredRole(value);
}
function getFunctionAssignedJobIds(user) {
    if (!Array.isArray(user.assignedJobIds))
        return [];
    return user.assignedJobIds
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);
}
function getFunctionDisplayName(user) {
    return [text(user.firstName), text(user.lastName)].filter(Boolean).join(' ') || textOrNull(user.email);
}
function buildCurrentFunctionUser(uid, user) {
    return {
        uid,
        role: getCurrentFunctionRole(user.role),
        active: user.active !== false,
        assignedJobIds: getFunctionAssignedJobIds(user),
        displayName: getFunctionDisplayName(user),
    };
}
function currentFunctionUserHasAnyRole(user, roles) {
    return roles.includes(user.role);
}
function currentFunctionUserCanAccessAssignedJob(user, jobId) {
    if (user.role === 'admin')
        return true;
    if (!(user.role === 'foreman' || user.role === 'shop-foreman' || user.role === 'project-manager'))
        return false;
    const normalizedJobId = text(jobId);
    return normalizedJobId.length > 0 && user.assignedJobIds.includes(normalizedJobId);
}
function canSendInviteForStoredRole(value) {
    return normalizeStoredRole(value) !== 'none';
}
//# sourceMappingURL=roleAccess.js.map