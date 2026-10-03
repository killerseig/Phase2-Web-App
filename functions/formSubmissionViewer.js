"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formSubmissionViewer = void 0;
const formModel_1 = require("./formModel");
const formSubmissionPdf_1 = require("./formSubmissionPdf");
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
const formModel_2 = require("./formModel");
const roleAccess_1 = require("./roleAccess");
const targetJobAccess_1 = require("./targetJobAccess");
const jobIdentity_1 = require("./jobIdentity");
const denied = () => new https_1.HttpsError('permission-denied', 'This submission is unavailable or you do not have access.');
async function authorizedRecord(id, uid) {
    // Never consult share tokens or historical requireLogin flags. All entries
    // and photo bytes belong to an active signed-in owner or Admin.
    if (!uid || !(0, formModel_2.formId)(id))
        throw denied();
    const [snapshot, profile] = await Promise.all([
        runtime_1.db.doc('formSubmissions/' + id).get(),
        runtime_1.db.doc('users/' + uid).get(),
    ]);
    const record = snapshot.data(), user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, profile.data() || {});
    if (!record ||
        record.status !== 'submitted' ||
        !profile.exists ||
        !user.active ||
        !['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(user.role) ||
        (record.ownerUid !== uid && user.role !== 'admin'))
        throw denied();
    if (record.jobId) {
        const job = await runtime_1.db.doc('jobs/' + record.jobId).get(), assigned = new Set(user.assignedJobIds);
        if (job.data()?.assignedForemanIds?.includes(user.uid))
            assigned.add(record.jobId);
        if (!job.exists ||
            !(0, targetJobAccess_1.targetFunctionRoleCanOpenJobDashboard)({
                role: user.role,
                jobId: record.jobId,
                assignedJobIds: [...assigned],
                isShopJob: (0, jobIdentity_1.isFunctionShopJob)(job.data()),
            }))
            throw denied();
    }
    return record;
}
exports.formSubmissionViewer = (0, https_1.onCall)({ timeoutSeconds: 120 }, async (request) => {
    if (!request.auth?.uid)
        throw denied();
    const { id, action, assetId } = request.data || {};
    if (action === 'preview-pdf') {
        if (!request.auth?.uid)
            throw denied();
        const profile = (await runtime_1.db.doc('users/' + request.auth.uid).get()).data(), user = (0, roleAccess_1.buildCurrentFunctionUser)(request.auth.uid, profile || {});
        if (!user.active || user.role !== 'admin')
            throw denied();
        let definition, answers;
        try {
            definition = (0, formModel_1.validateFormDefinition)(request.data.definition);
            answers = (0, formModel_1.validateFormAnswers)(definition, request.data.answers, false);
        }
        catch {
            throw new https_1.HttpsError('invalid-argument', 'Correct the form definition and preview answers before generating a PDF.');
        }
        const record = {
            id: 'preview',
            ownerUid: request.auth.uid,
            templateId: 'preview',
            templateVersion: 1,
            definition: { ...definition, version: 1, createdAt: '' },
            answers,
            revision: 1,
            status: 'submitted',
            createdAt: 0,
            updatedAt: 0,
        };
        const pdf = await (0, formSubmissionPdf_1.buildFormSubmissionPdf)(record);
        if (pdf.length > 512 * 1024)
            throw new https_1.HttpsError('resource-exhausted', 'This PDF preview exceeds the local size limit.');
        return { base64: pdf.toString('base64'), contentType: 'application/pdf' };
    }
    if (!['get', 'photo'].includes(action))
        throw denied();
    const record = await authorizedRecord(id, request.auth.uid);
    if (action === 'get') {
        const definition = (0, formModel_2.respondentDefinition)(record.definition);
        return {
            id: record.id,
            templateVersion: record.templateVersion,
            definition: {
                ...definition,
                ...(definition.output ? { output: { ...definition.output, requireLogin: true } } : {}),
            },
            answers: record.answers,
            submittedAt: record.submittedAt,
            requireLogin: true,
        };
    }
    if (!(0, formModel_2.formId)(assetId) ||
        !record.definition.fields.some((field) => field.kind === 'photo' &&
            Array.isArray(record.answers[field.id]) &&
            record.answers[field.id].includes(assetId)))
        throw denied();
    const asset = (await runtime_1.db.doc('formAssets/' + assetId).get()).data(), expected = 'form-photos/' + id + '/' + assetId + '.webp';
    if (!asset ||
        asset.recordId !== id ||
        asset.ownerUid !== record.ownerUid ||
        asset.path !== expected ||
        !record.definition.fields.some((field) => field.kind === 'photo' &&
            field.id === asset.fieldId &&
            record.answers[field.id].includes(assetId)))
        throw denied();
    const file = runtime_1.storageBucket.file(expected), [metadata] = await file.getMetadata();
    if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) > 2 * 1024 * 1024)
        throw denied();
    const [bytes] = await file.download();
    if (bytes.length > 2 * 1024 * 1024)
        throw denied();
    return { base64: bytes.toString('base64'), contentType: 'image/webp' };
});
//# sourceMappingURL=formSubmissionViewer.js.map