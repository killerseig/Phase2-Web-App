"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetFunctionUserIsAssignedToJob = targetFunctionUserIsAssignedToJob;
function targetFunctionUserIsAssignedToJob(jobId, assignedJobIds) {
    return Boolean(jobId) && (assignedJobIds ?? []).includes(jobId);
}
//# sourceMappingURL=targetJobAssignments.js.map