"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetFunctionRoleCanCreateJobs = targetFunctionRoleCanCreateJobs;
exports.targetFunctionRoleCanDeleteOrArchiveJobs = targetFunctionRoleCanDeleteOrArchiveJobs;
exports.targetFunctionRoleCanSeeJobListEntry = targetFunctionRoleCanSeeJobListEntry;
exports.targetFunctionRoleCanOpenJobDashboard = targetFunctionRoleCanOpenJobDashboard;
exports.targetFunctionRoleCanEditJobSetup = targetFunctionRoleCanEditJobSetup;
const targetJobAssignments_1 = require("./targetJobAssignments");
const targetRoleCapabilities_1 = require("./targetRoleCapabilities");
function targetFunctionRoleCanCreateJobs(role) {
    return (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(role).createJobs;
}
function targetFunctionRoleCanDeleteOrArchiveJobs(role) {
    return (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(role).deleteOrArchiveJobs;
}
function targetFunctionRoleCanSeeJobListEntry(input) {
    if (!input.jobId)
        return false;
    const capabilities = (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(input.role);
    if (capabilities.viewAllJobs)
        return true;
    if (capabilities.useShopJobDashboard && input.isShopJob)
        return true;
    return capabilities.useAssignedJobDashboards
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds);
}
function targetFunctionRoleCanOpenJobDashboard(input) {
    if (!input.jobId)
        return false;
    const capabilities = (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(input.role);
    if (capabilities.editAllJobs)
        return true;
    if (capabilities.useShopJobDashboard && input.isShopJob)
        return true;
    return capabilities.useAssignedJobDashboards
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds);
}
function targetFunctionRoleCanEditJobSetup(input) {
    if (!input.jobId)
        return false;
    const capabilities = (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(input.role);
    if (capabilities.editAllJobs)
        return true;
    return capabilities.editAssignedJobs
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds);
}
//# sourceMappingURL=targetJobAccess.js.map