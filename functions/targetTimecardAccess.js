"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetFunctionRoleCanUseTimecardExport = targetFunctionRoleCanUseTimecardExport;
exports.targetFunctionRoleCanLockTimecards = targetFunctionRoleCanLockTimecards;
exports.targetFunctionRoleCanDeleteDraftTimecardWeeks = targetFunctionRoleCanDeleteDraftTimecardWeeks;
exports.targetFunctionRoleCanUseJobTimecardWorkflow = targetFunctionRoleCanUseJobTimecardWorkflow;
exports.targetFunctionRoleCanSubmitJobTimecards = targetFunctionRoleCanSubmitJobTimecards;
exports.targetFunctionRoleCanViewSubmittedTimecards = targetFunctionRoleCanViewSubmittedTimecards;
exports.targetFunctionRoleCanViewSubmittedTimecardReport = targetFunctionRoleCanViewSubmittedTimecardReport;
const targetJobAssignments_1 = require("./targetJobAssignments");
const targetRoleCapabilities_1 = require("./targetRoleCapabilities");
function targetFunctionRoleCanUseTimecardExport(role) {
    return (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(role).useTimecardExport;
}
function targetFunctionRoleCanLockTimecards(role) {
    return (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(role).lockTimecards;
}
function targetFunctionRoleCanDeleteDraftTimecardWeeks(role) {
    return (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(role).deleteDraftTimecardWeeks;
}
function targetFunctionRoleCanUseJobTimecardWorkflow(input) {
    if (!input.jobId)
        return false;
    const capabilities = (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(input.role);
    if (capabilities.editAllJobs)
        return true;
    if (capabilities.editShopJobTimecards && input.isShopJob)
        return true;
    return capabilities.editAssignedTimecards
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds);
}
function targetFunctionRoleCanSubmitJobTimecards(input) {
    return targetFunctionRoleCanUseJobTimecardWorkflow(input);
}
function targetFunctionRoleCanViewSubmittedTimecards(input) {
    if (!input.jobId)
        return false;
    const capabilities = (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(input.role);
    if (capabilities.editAllJobs || capabilities.useTimecardExport)
        return true;
    if (capabilities.editShopJobTimecards && input.isShopJob)
        return true;
    if (capabilities.editAssignedTimecards
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds)) {
        return true;
    }
    return capabilities.viewSubmittedAssignedTimecards
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds);
}
function targetFunctionRoleCanViewSubmittedTimecardReport(input) {
    if (!input.jobId)
        return false;
    const capabilities = (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(input.role);
    if (capabilities.editAllJobs)
        return true;
    return capabilities.viewSubmittedAssignedTimecards
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds);
}
//# sourceMappingURL=targetTimecardAccess.js.map