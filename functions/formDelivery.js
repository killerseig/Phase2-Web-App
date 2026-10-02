"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverFormEmail = exports.formEmail = exports.prepareFormEmail = exports.buildFormEmailText = exports.buildFormEmailHtml = void 0;
exports.deliverFormSubmission = deliverFormSubmission;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const runtime_1 = require("./runtime");
const formModel_1 = require("./formModel");
const roleAccess_1 = require("./roleAccess");
const functionConfig_1 = require("./functionConfig");
const emailDeliveryErrors_1 = require("./emailDeliveryErrors");
const emailService_1 = require("./emailService");
var formEmailContent_1 = require("./formEmailContent");
Object.defineProperty(exports, "buildFormEmailHtml", { enumerable: true, get: function () { return formEmailContent_1.buildFormEmailHtml; } });
Object.defineProperty(exports, "buildFormEmailText", { enumerable: true, get: function () { return formEmailContent_1.buildFormEmailText; } });
Object.defineProperty(exports, "prepareFormEmail", { enumerable: true, get: function () { return formEmailContent_1.prepareFormEmail; } });
const formEmailContent_2 = require("./formEmailContent");
const provider = {
    enabled: () => !process.env.FIRESTORE_EMULATOR_HOST && !process.env.FUNCTIONS_EMULATOR && (0, emailService_1.isEmailEnabled)(),
    send: async (record, recipients) => {
        let email;
        try {
            email = await (0, formEmailContent_2.prepareFormEmail)(record, recipients);
        }
        catch (error) {
            if (error instanceof formEmailContent_2.FormEmailPreparationError)
                throw error;
            // Preparation has not contacted the provider, so an explicit retry is safe.
            throw new formEmailContent_2.FormEmailPreparationError('The completed form email could not be prepared. The submission is retained.');
        }
        await (0, emailService_1.sendEmail)(email);
    },
};
// The submission is immutable. Delivery state and claims live in a separate record.
async function deliverFormSubmission(id, retry = false, adapter = provider) {
    const ref = runtime_1.db.doc('formDeliveries/' + id), attemptId = (0, node_crypto_1.randomUUID)();
    const claim = await runtime_1.db.runTransaction(async (tx) => {
        const [delivery, submission] = await tx.getAll(ref, runtime_1.db.doc('formSubmissions/' + id));
        if (!delivery.exists || !submission.exists)
            throw new https_1.HttpsError('not-found', 'Submission not found.');
        const state = delivery.data();
        if (state.status === 'sent' ||
            state.status === 'sending' ||
            state.status === 'not-configured' ||
            (!retry && state.status !== 'queued'))
            return undefined;
        if (!['queued', 'failed', 'disabled'].includes(state.status))
            return undefined;
        tx.update(ref, {
            status: 'sending',
            attemptId,
            attempts: Number(state.attempts) + 1,
            attemptStartedAt: Date.now(),
        });
        return { record: submission.data(), recipients: state.recipients };
    });
    if (!claim)
        return;
    let status = 'failed';
    try {
        if (!adapter.enabled())
            status = 'disabled';
        else {
            await adapter.send(claim.record, claim.recipients);
            status = 'sent';
        }
    }
    catch (error) {
        const failure = (0, emailDeliveryErrors_1.classifyEmailDeliveryError)(error);
        status =
            error instanceof formEmailContent_2.FormEmailPreparationError ||
                !failure.retryable ||
                (failure.httpStatus !== undefined && failure.httpStatus < 500)
                ? 'failed'
                : 'uncertain';
    }
    await runtime_1.db.runTransaction(async (tx) => {
        const state = await tx.get(ref);
        if (state.data()?.attemptId === attemptId)
            tx.update(ref, { status, attemptFinishedAt: Date.now() });
    });
}
exports.formEmail = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)(), timeoutSeconds: 120 }, async (request) => {
    const id = request.data?.id;
    if (!(0, formModel_1.formId)(id) || !request.auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Sign in and choose a submission.');
    const [profile, snapshot] = await Promise.all([
        runtime_1.db.doc('users/' + request.auth.uid).get(),
        runtime_1.db.doc('formSubmissions/' + id).get(),
    ]);
    const user = (0, roleAccess_1.buildCurrentFunctionUser)(request.auth.uid, profile.data() || {});
    if (!profile.exists ||
        !user.active ||
        !['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(user.role) ||
        !snapshot.exists ||
        (snapshot.data()?.ownerUid !== user.uid && user.role !== 'admin'))
        throw new https_1.HttpsError('permission-denied', 'This submission belongs to another user.');
    if (request.data?.action !== 'retry')
        throw new https_1.HttpsError('invalid-argument', 'Unknown delivery action.');
    await deliverFormSubmission(id, true);
    return { emailStatus: (await runtime_1.db.doc('formDeliveries/' + id).get()).data()?.status };
});
exports.deliverFormEmail = (0, firestore_1.onDocumentCreated)({
    document: 'formDeliveries/{id}',
    secrets: (0, functionConfig_1.getGraphEmailSecrets)(),
    timeoutSeconds: 120,
    retry: false,
}, async (event) => {
    await deliverFormSubmission(event.params.id);
});
//# sourceMappingURL=formDelivery.js.map