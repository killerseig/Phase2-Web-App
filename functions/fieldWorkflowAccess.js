"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canWriteFieldWorkflowForJob = canWriteFieldWorkflowForJob;
const jobIdentity_1 = require("./jobIdentity");
const targetFieldWorkflowAccess_1 = require("./targetFieldWorkflowAccess");
function canWriteFieldWorkflowForJob(user, jobId, job, action) {
    const assignedJobIds = new Set(user.assignedJobIds);
    if ((job?.assignedForemanIds ?? []).includes(user.uid)) {
        assignedJobIds.add(jobId);
    }
    const input = {
        assignedJobIds: Array.from(assignedJobIds),
        isShopJob: (0, jobIdentity_1.isFunctionShopJob)(job),
        jobId,
        role: user.role,
    };
    if (action === 'create')
        return (0, targetFieldWorkflowAccess_1.targetFunctionRoleCanCreateFieldWorkflow)(input);
    if (action === 'submit')
        return (0, targetFieldWorkflowAccess_1.targetFunctionRoleCanSubmitFieldWorkflow)(input);
    return (0, targetFieldWorkflowAccess_1.targetFunctionRoleCanEditFieldWorkflowDraft)(input);
}
//# sourceMappingURL=fieldWorkflowAccess.js.map