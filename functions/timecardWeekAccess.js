"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFunctionShopJob = void 0;
exports.canCreateTimecardWeekForJob = canCreateTimecardWeekForJob;
const jobIdentity_1 = require("./jobIdentity");
const targetTimecardAccess_1 = require("./targetTimecardAccess");
var jobIdentity_2 = require("./jobIdentity");
Object.defineProperty(exports, "isFunctionShopJob", { enumerable: true, get: function () { return jobIdentity_2.isFunctionShopJob; } });
function canCreateTimecardWeekForJob(user, jobId, job) {
    if ((0, targetTimecardAccess_1.targetFunctionRoleCanUseTimecardExport)(user.role))
        return true;
    const assignedJobIds = new Set(user.assignedJobIds);
    if ((job?.assignedForemanIds ?? []).includes(user.uid)) {
        assignedJobIds.add(jobId);
    }
    return (0, targetTimecardAccess_1.targetFunctionRoleCanUseJobTimecardWorkflow)({
        assignedJobIds: Array.from(assignedJobIds),
        isShopJob: (0, jobIdentity_1.isFunctionShopJob)(job),
        jobId,
        role: user.role,
    });
}
//# sourceMappingURL=timecardWeekAccess.js.map