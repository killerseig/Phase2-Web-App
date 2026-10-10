"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formTranslation = exports.formTranslationApiKey = exports.formTranslationProcessingApproved = exports.formTranslationEnabled = void 0;
exports.configuredFormTranslationAdapter = configuredFormTranslationAdapter;
exports.prepareFormTranslation = prepareFormTranslation;
exports.formTranslationHandler = formTranslationHandler;
const axios_1 = __importDefault(require("axios"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
const formEntryAccess_1 = require("./formEntryAccess");
const roleAccess_1 = require("./roleAccess");
const formTranslation_1 = require("./formTranslation");
exports.formTranslationEnabled = (0, params_1.defineBoolean)('FORM_TRANSLATION_ENABLED', { default: false });
exports.formTranslationProcessingApproved = (0, params_1.defineBoolean)('FORM_TRANSLATION_PROCESSING_APPROVED', { default: false });
exports.formTranslationApiKey = (0, params_1.defineSecret)('FORM_TRANSLATION_API_KEY');
/** Cloud Translation Basic, explicit provisioning; no Firebase built-in translation. */
function configuredFormTranslationAdapter() {
    if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR)
        return undefined;
    if (!exports.formTranslationEnabled.value() || !exports.formTranslationProcessingApproved.value())
        return undefined;
    const key = exports.formTranslationApiKey.value();
    if (!key)
        return undefined;
    return {
        translate: async (texts) => {
            const response = await axios_1.default.post('https://translation.googleapis.com/language/translate/v2', { q: texts, target: 'en', format: 'text' }, {
                params: { key },
                timeout: 20000,
                maxContentLength: 512 * 1024,
                maxBodyLength: 128 * 1024,
            });
            const translations = response.data?.data?.translations;
            if (!Array.isArray(translations))
                throw new Error('Translation unavailable.');
            return translations.map((item) => item.translatedText);
        },
    };
}
async function prepareFormTranslation(record, injectedAdapter, reauthorize) {
    const { sourceHash } = (0, formTranslation_1.translationSource)(record);
    const ref = runtime_1.db.doc('formTranslations/' + record.id + '/versions/' + sourceHash);
    const cached = (0, formTranslation_1.currentFormTranslation)(record, (await ref.get()).data());
    if (cached?.status === 'ready' && cached.sourceHash === sourceHash)
        return cached;
    const adapter = injectedAdapter || configuredFormTranslationAdapter();
    if (!adapter)
        return (0, formTranslation_1.translateFormRecord)(record);
    const acquired = await runtime_1.db.runTransaction(async (transaction) => {
        const latest = (await transaction.get(ref)).data();
        if (latest?.status === 'ready' || (latest?.leaseUntil || 0) > Date.now())
            return false;
        transaction.set(ref, { sourceHash, leaseUntil: Date.now() + 120000 }, { merge: true });
        return true;
    });
    if (!acquired)
        throw new https_1.HttpsError('resource-exhausted', 'Translation is being prepared. Try again shortly.');
    const result = await (0, formTranslation_1.translateFormRecord)(record, adapter);
    await reauthorize?.();
    await ref.set({ ...result, leaseUntil: result.status === 'failed' ? Date.now() + 60000 : 0 });
    return result;
}
async function formTranslationHandler(request, prepare = (record, verify) => prepareFormTranslation(record, undefined, verify)) {
    const record = await (0, formEntryAccess_1.authorizeFormEntry)(request.data?.id, request.auth?.uid);
    const { sourceHash } = (0, formTranslation_1.translationSource)(record);
    const ref = runtime_1.db.doc('formTranslations/' + record.id + '/versions/' + sourceHash);
    const action = request.data?.action;
    if (action === 'get') {
        const cached = (0, formTranslation_1.currentFormTranslation)(record, (await ref.get()).data());
        await (0, formEntryAccess_1.authorizeFormEntry)(record.id, request.auth?.uid);
        const initial = await (0, formTranslation_1.translateFormRecord)(record);
        return {
            translation: cached?.status
                ? cached
                : configuredFormTranslationAdapter()
                    ? { ...initial, status: 'pending' }
                    : initial,
        };
    }
    if (action === 'translate') {
        const translation = await prepare(record, () => (0, formEntryAccess_1.authorizeFormEntry)(record.id, request.auth?.uid));
        await (0, formEntryAccess_1.authorizeFormEntry)(record.id, request.auth?.uid);
        return { translation };
    }
    if (action === 'correct') {
        const profile = (await runtime_1.db.doc('users/' + request.auth.uid).get()).data();
        const user = (0, roleAccess_1.buildCurrentFunctionUser)(request.auth.uid, profile || {});
        if (!user.active || user.role !== 'admin')
            throw new https_1.HttpsError('permission-denied', 'Only Admin can correct a translation.');
        const corrections = request.data?.corrections;
        if (!corrections ||
            typeof corrections !== 'object' ||
            Array.isArray(corrections) ||
            JSON.stringify(corrections).length > 100000)
            throw new https_1.HttpsError('invalid-argument', 'Invalid corrections.');
        const translation = await runtime_1.db.runTransaction(async (transaction) => {
            const current = (0, formTranslation_1.currentFormTranslation)(record, (await transaction.get(ref)).data());
            if (current?.status !== 'ready' ||
                current.sourceHash !== sourceHash ||
                current.revision !== request.data.revision)
                throw new https_1.HttpsError('failed-precondition', 'Reload this translation before correcting it.');
            if (Object.keys(corrections).some((key) => !current.segments.some((segment) => segment.key === key)) ||
                Object.values(corrections).some((value) => typeof value !== 'string' || !value.trim() || value.length > 20000))
                throw new https_1.HttpsError('invalid-argument', 'Invalid translation segments.');
            const next = {
                ...current,
                revision: current.revision + 1,
                correction: { by: request.auth.uid, at: Date.now() },
                segments: current.segments.map((segment) => ({
                    ...segment,
                    translated: corrections[segment.key] ?? segment.translated,
                })),
            };
            await (0, formEntryAccess_1.authorizeFormEntry)(record.id, request.auth?.uid);
            const latestUser = (0, roleAccess_1.buildCurrentFunctionUser)(request.auth.uid, (await runtime_1.db.doc('users/' + request.auth.uid).get()).data() || {});
            if (!latestUser.active || latestUser.role !== 'admin')
                throw new https_1.HttpsError('permission-denied', 'Only Admin can correct a translation.');
            transaction.set(ref, next);
            transaction.set(ref.collection('corrections').doc('r' + next.revision), {
                before: current.segments,
                after: next.segments,
                ...next.correction,
                sourceHash,
            });
            return next;
        });
        await (0, formEntryAccess_1.authorizeFormEntry)(record.id, request.auth?.uid);
        return { translation };
    }
    throw new https_1.HttpsError('invalid-argument', 'Invalid translation action.');
}
exports.formTranslation = (0, https_1.onCall)({ timeoutSeconds: 120, secrets: [exports.formTranslationApiKey] }, (request) => formTranslationHandler(request));
//# sourceMappingURL=formTranslationService.js.map