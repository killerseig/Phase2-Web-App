"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeFormEntry = authorizeFormEntry;
exports.authorizeFormEntriesPage = authorizeFormEntriesPage;
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
const roleAccess_1 = require("./roleAccess");
const formModel_1 = require("./formModel");
const formAccess_1 = require("./formAccess");
const targetJobAccess_1 = require("./targetJobAccess");
const jobIdentity_1 = require("./jobIdentity");
const denied = () => new https_1.HttpsError('permission-denied', 'This entry is unavailable or you do not have access.');
async function reader(uid) {
    if (!uid)
        throw denied();
    const snapshot = await runtime_1.db.doc('users/' + uid).get();
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, snapshot.data() || {});
    if (!snapshot.exists || !user.active)
        throw denied();
    return user;
}
async function currentEntryPolicy(templateId, fallback) {
    const template = await runtime_1.db.doc('formTemplates/' + templateId).get();
    const version = template.data()?.latestVersion;
    if (!version)
        return fallback;
    const issued = await template.ref
        .collection('versions')
        .doc('v' + version)
        .get();
    return issued.data()?.access || fallback;
}
async function jobAllowed(record, user) {
    if (!record.jobId)
        return true;
    const job = await runtime_1.db.doc('jobs/' + record.jobId).get();
    const assigned = new Set(user.assignedJobIds);
    if (job.data()?.assignedForemanIds?.includes(user.uid))
        assigned.add(record.jobId);
    return (job.exists &&
        (0, targetJobAccess_1.targetFunctionRoleCanOpenJobDashboard)({
            role: user.role,
            jobId: record.jobId,
            assignedJobIds: [...assigned],
            isShopJob: (0, jobIdentity_1.isFunctionShopJob)(job.data()),
        }));
}
async function authorizeFormEntry(id, uid) {
    if (!(0, formModel_1.formId)(id))
        throw denied();
    const user = await reader(uid);
    const record = (await runtime_1.db.doc('formSubmissions/' + id).get()).data();
    if (!record || record.status !== 'submitted')
        throw denied();
    if (!(0, formAccess_1.canReadFormEntry)(await currentEntryPolicy(record.templateId, record.definition.access), record.ownerUid, user))
        throw denied();
    if (!(await jobAllowed(record, user)))
        throw denied();
    return record;
}
/** Scan a bounded ID range and filter every entry; empty pages may still have a next cursor. */
async function authorizeFormEntriesPage(templateId, uid, cursor, snapshotBefore) {
    if (!(0, formModel_1.formId)(templateId) || (cursor != null && cursor !== '' && !(0, formModel_1.formId)(cursor)))
        throw denied();
    const user = await reader(uid);
    const template = (await runtime_1.db.doc('formTemplates/' + templateId).get()).data();
    const policy = await currentEntryPolicy(templateId, template?.draft?.access);
    if (!template || !(0, formAccess_1.canReadFormEntry)(policy, '', user))
        throw denied();
    const boundary = snapshotBefore == null ? Date.now() : Number(snapshotBefore);
    if (!Number.isSafeInteger(boundary) || boundary < 0 || boundary > Date.now() + 1000)
        throw new https_1.HttpsError('invalid-argument', 'Invalid entry snapshot.');
    let query = runtime_1.db
        .collection('formSubmissions')
        .where('templateId', '==', templateId)
        .orderBy('__name__')
        .limit(101);
    if (cursor)
        query = query.startAfter(cursor);
    const snapshot = await query.get();
    const scanned = snapshot.docs.slice(0, 100);
    const allowed = scanned
        .map((doc) => doc.data())
        .filter((record) => record.status === 'submitted' &&
        (record.submittedAt || 0) <= boundary &&
        (0, formAccess_1.canReadFormEntry)(policy, record.ownerUid, user));
    const records = (await Promise.all(allowed.map(async (record) => ((await jobAllowed(record, user)) ? record : undefined)))).filter((record) => !!record);
    const nextCursor = snapshot.docs.length > 100 ? scanned[scanned.length - 1].id : null;
    return { records, nextCursor, snapshotBefore: boundary, complete: nextCursor === null };
}
//# sourceMappingURL=formEntryAccess.js.map