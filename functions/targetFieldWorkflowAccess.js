"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetFunctionRoleCanOpenFieldWorkflow = targetFunctionRoleCanOpenFieldWorkflow;
exports.targetFunctionRoleCanViewSubmittedFieldWorkflow = targetFunctionRoleCanViewSubmittedFieldWorkflow;
exports.targetFunctionRoleCanCreateFieldWorkflow = targetFunctionRoleCanCreateFieldWorkflow;
exports.targetFunctionRoleCanEditFieldWorkflowDraft = targetFunctionRoleCanEditFieldWorkflowDraft;
exports.targetFunctionRoleCanSubmitFieldWorkflow = targetFunctionRoleCanSubmitFieldWorkflow;
const targetJobAssignments_1 = require("./targetJobAssignments");
const targetRoleCapabilities_1 = require("./targetRoleCapabilities");
function targetFunctionRoleCanOpenFieldWorkflow(input) {
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
function targetFunctionRoleCanViewSubmittedFieldWorkflow(input) {
    return targetFunctionRoleCanOpenFieldWorkflow(input);
}
function targetFunctionRoleCanCreateFieldWorkflow(input) {
    if (!input.jobId)
        return false;
    const capabilities = (0, targetRoleCapabilities_1.getTargetFunctionRoleCapabilities)(input.role);
    if (capabilities.editAllJobs)
        return true;
    if (capabilities.editShopJobFieldWorkflows && input.isShopJob)
        return true;
    return capabilities.editAssignedFieldWorkflows
        && (0, targetJobAssignments_1.targetFunctionUserIsAssignedToJob)(input.jobId, input.assignedJobIds);
}
function targetFunctionRoleCanEditFieldWorkflowDraft(input) {
    return targetFunctionRoleCanCreateFieldWorkflow(input);
}
function targetFunctionRoleCanSubmitFieldWorkflow(input) {
    return targetFunctionRoleCanCreateFieldWorkflow(input);
}
//# sourceMappingURL=targetFieldWorkflowAccess.js.map