"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formSubmissionViewer = void 0;
const formModel_1 = require("./formModel");
const formSubmissionPdf_1 = require("./formSubmissionPdf");
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
const formModel_2 = require("./formModel");
const roleAccess_1 = require("./roleAccess");
const formEntryAccess_1 = require("./formEntryAccess");
const formEntryPhotos_1 = require("./formEntryPhotos");
const formTranslation_1 = require("./formTranslation");
const denied = () => new https_1.HttpsError('permission-denied', 'This submission is unavailable or you do not have access.');
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
    if (!['get', 'photo', 'pdf'].includes(action))
        throw denied();
    const record = await (0, formEntryAccess_1.authorizeFormEntry)(id, request.auth.uid);
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
    if (action === 'pdf') {
        let translation;
        if (request.data?.language === 'en') {
            const { sourceHash } = (0, formTranslation_1.translationSource)(record);
            translation = (0, formTranslation_1.currentFormTranslation)(record, (await runtime_1.db.doc('formTranslations/' + record.id + '/versions/' + sourceHash).get()).data());
            if (translation?.status !== 'ready')
                throw new https_1.HttpsError('failed-precondition', 'Prepare an English rendering before downloading the English and original PDF.');
            await (0, formEntryAccess_1.authorizeFormEntry)(record.id, request.auth.uid);
        }
        const bytes = await (0, formSubmissionPdf_1.buildFormSubmissionPdf)(record, await (0, formEntryPhotos_1.entryPdfPhotos)(record), translation);
        await (0, formEntryAccess_1.authorizeFormEntry)(record.id, request.auth.uid);
        if (bytes.length > 7 * 1024 * 1024)
            throw new https_1.HttpsError('resource-exhausted', 'This PDF exceeds the download size limit.');
        return {
            base64: bytes.toString('base64'),
            contentType: 'application/pdf',
            filename: 'form-entry-' + record.id + (translation ? '-english-original' : '') + '.pdf',
        };
    }
    if (!(0, formModel_2.formId)(assetId))
        throw denied();
    const bytes = await (0, formEntryPhotos_1.readEntryPhoto)(record, assetId);
    return { base64: bytes.toString('base64'), contentType: 'image/webp' };
});
//# sourceMappingURL=formSubmissionViewer.js.map