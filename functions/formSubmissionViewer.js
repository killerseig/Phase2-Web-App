"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formSubmissionViewer = exports.FORM_VIEWER_LINK_DAYS = void 0;
exports.issueFormViewerLink = issueFormViewerLink;
const formModel_1 = require("./formModel");
const formSubmissionPdf_1 = require("./formSubmissionPdf");
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
const formModel_2 = require("./formModel");
const roleAccess_1 = require("./roleAccess");
const functionConfig_1 = require("./functionConfig");
const denied = () => new https_1.HttpsError('permission-denied', 'This submission is unavailable or you do not have access.');
const hash = (token) => (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
exports.FORM_VIEWER_LINK_DAYS = 30;
/** Internal email preparation only; authorization for callable issuance is checked separately. */
async function issueFormViewerLink(id, baseUrl = (0, functionConfig_1.getAppBaseUrl)()) {
    const token = (0, node_crypto_1.randomBytes)(32).toString('base64url'), expiresAt = Date.now() + exports.FORM_VIEWER_LINK_DAYS * 86400000;
    await runtime_1.db.runTransaction(async (tx) => {
        const [submitted, access] = await tx.getAll(runtime_1.db.doc('formSubmissions/' + id), runtime_1.db.doc('formSubmissionAccess/' + id));
        const record = submitted.data();
        if (!record ||
            record.status !== 'submitted' ||
            record.definition.output?.requireLogin !== false)
            throw denied();
        tx.create(runtime_1.db.doc('formViewerShares/' + hash(token)), {
            submissionId: id,
            generation: Number(access.data()?.generation || 0),
            expiresAt,
        });
    });
    const url = new URL('/form-submissions/' + encodeURIComponent(id), baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw denied();
    url.hash = 'token=' + token;
    return { url: url.toString(), expiresAt };
}
async function authorizedRecord(id, uid, token) {
    if (!(0, formModel_2.formId)(id))
        throw denied();
    const snapshot = await runtime_1.db.doc('formSubmissions/' + id).get(), record = snapshot.data();
    if (!record || record.status !== 'submitted')
        throw denied();
    if (uid) {
        const profile = await runtime_1.db.doc('users/' + uid).get(), user = (0, roleAccess_1.buildCurrentFunctionUser)(uid, profile.data() || {});
        if (profile.exists &&
            user.active &&
            ['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(user.role) &&
            (record.ownerUid === uid || user.role === 'admin'))
            return record;
    }
    if (record.definition.output?.requireLogin === false &&
        typeof token === 'string' &&
        /^[A-Za-z0-9_-]{43}$/.test(token)) {
        const [share, access] = await Promise.all([
            runtime_1.db.doc('formViewerShares/' + hash(token)).get(),
            runtime_1.db.doc('formSubmissionAccess/' + id).get(),
        ]);
        const value = share.data();
        if (value?.submissionId === id &&
            Number(value.expiresAt) > Date.now() &&
            Number(value.generation) === Number(access.data()?.generation || 0))
            return record;
    }
    throw denied();
}
exports.formSubmissionViewer = (0, https_1.onCall)({ timeoutSeconds: 120 }, async (request) => {
    const { id, action, token, assetId } = request.data || {};
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
    if (action === 'issue-link' || action === 'revoke-links') {
        // A share token alone can never create, revoke, edit, or enumerate records.
        if (!request.auth?.uid)
            throw denied();
        await authorizedRecord(id, request.auth.uid);
        if (action === 'issue-link')
            return issueFormViewerLink(id);
        await runtime_1.db.runTransaction(async (tx) => {
            const ref = runtime_1.db.doc('formSubmissionAccess/' + id), access = await tx.get(ref);
            tx.set(ref, { generation: Number(access.data()?.generation || 0) + 1, revokedAt: Date.now() });
        });
        return { revoked: true };
    }
    if (!['get', 'photo'].includes(action))
        throw denied();
    const record = await authorizedRecord(id, request.auth?.uid, token);
    if (action === 'get') {
        const profile = request.auth?.uid
            ? (await runtime_1.db.doc('users/' + request.auth.uid).get()).data()
            : undefined;
        const manager = request.auth?.uid
            ? (0, roleAccess_1.buildCurrentFunctionUser)(request.auth.uid, profile || {})
            : undefined;
        return {
            canManage: !!(manager?.active &&
                (record.ownerUid === manager.uid || manager.role === 'admin')),
            id: record.id,
            templateVersion: record.templateVersion,
            definition: (0, formModel_2.respondentDefinition)(record.definition),
            answers: record.answers,
            submittedAt: record.submittedAt,
            requireLogin: record.definition.output?.requireLogin !== false,
            linkLifetimeDays: exports.FORM_VIEWER_LINK_DAYS,
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