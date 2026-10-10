"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicFormRecipientVerification = void 0;
exports.verifyPublicFormRecipient = verifyPublicFormRecipient;
const node_crypto_1 = require("node:crypto");
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
const functionConfig_1 = require("./functionConfig");
const emailService_1 = require("./emailService");
const formModel_1 = require("./formModel");
const formAccess_1 = require("./formAccess");
const formRecipients_1 = require("./formRecipients");
const hash = (value) => (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
const provider = {
    enabled: () => process.env.FORM_PUBLIC_RECIPIENT_VERIFICATION_ENABLED === 'true' &&
        !process.env.FIRESTORE_EMULATOR_HOST &&
        !process.env.FUNCTIONS_EMULATOR &&
        (0, emailService_1.isEmailEnabled)(),
    send: async (email, code) => (0, emailService_1.sendEmail)({
        to: email,
        subject: 'Approve one form results email',
        html: `<p>Someone requested that this address receive the results of one Phase 2 form response.</p><p>If you agree, give this code to the person completing the form: <strong>${code}</strong></p><p>The code expires in 15 minutes and approves only that response. Do not share it if you did not request or approve this email. This does not grant access to private records or photos.</p>`,
    }),
};
async function verifyPublicFormRecipient(input, origin, mailer = provider) {
    if (!(0, formModel_1.formId)(input.id) ||
        typeof input.publicCapability !== 'string' ||
        !/^[a-f0-9]{64}$/.test(input.publicCapability))
        throw new https_1.HttpsError('permission-denied', 'Invalid form session.');
    const email = (0, formRecipients_1.normalizeFormRecipientEmails)([input.email], 1)[0];
    const recordRef = runtime_1.db.doc(`formRecords/${input.id}`);
    const proofRef = runtime_1.db.doc(`formRecipientVerifications/${hash(`${input.id}:${email}`)}`);
    const now = Date.now(), capabilityHash = hash(input.publicCapability);
    const checkRecord = async (record, tx) => {
        if (!record ||
            record.status !== 'draft' ||
            record.publicCapabilityHash !== capabilityHash ||
            !record.publicExpiresAt ||
            record.publicExpiresAt <= now)
            throw new https_1.HttpsError('permission-denied', 'This form session expired or was submitted.');
        if (!(0, formRecipients_1.respondentRecipients)(record.definition.fields, record.answers).includes(email))
            throw new https_1.HttpsError('failed-precondition', 'Save this address in the recipient field first.');
        const templateRef = runtime_1.db.doc(`formTemplates/${record.templateId}`);
        const template = tx ? await tx.get(templateRef) : await templateRef.get();
        if (!template.exists || template.data()?.archived || !template.data()?.latestVersion)
            throw new https_1.HttpsError('permission-denied', 'This form is unavailable.');
        const versionRef = templateRef.collection('versions').doc('v' + template.data().latestVersion);
        const latest = tx ? await tx.get(versionRef) : await versionRef.get();
        if (!latest.exists || (0, formAccess_1.validateFormAccess)(latest.data()?.access).respondents !== 'public')
            throw new https_1.HttpsError('permission-denied', 'This form now requires sign in.');
    };
    if (input.action === 'request') {
        if (!mailer.enabled())
            return {
                status: 'not-configured',
                message: 'Recipient verification email is not enabled. Your answers can still be submitted.',
            };
        if (typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId))
            throw new https_1.HttpsError('invalid-argument', 'Invalid verification request.');
        const code = String((0, node_crypto_1.randomInt)(0, 100000000)).padStart(8, '0');
        const codeHash = hash(`${input.id}:${email}:${code}`);
        const requestRef = runtime_1.db.doc(`formRecipientVerificationRequests/${hash(`${input.id}:${input.requestId}`)}`);
        const requested = await runtime_1.db.runTransaction(async (tx) => {
            const [recordSnap, proof, prior] = await Promise.all([
                tx.get(recordRef),
                tx.get(proofRef),
                tx.get(requestRef),
            ]);
            const record = recordSnap.data();
            await checkRecord(record, tx);
            if (prior.exists) {
                if (prior.data()?.email !== email)
                    throw new https_1.HttpsError('invalid-argument', 'Request ID belongs to a different address.');
                return false;
            }
            if (proof.data()?.verified === true && proof.data()?.approvalExpiresAt > now)
                return false;
            if (proof.data()?.codeExpiresAt > now && ['sending', 'sent'].includes(proof.data()?.status))
                return false;
            const rateRefs = [
                runtime_1.db.doc(`formRecipientVerificationRates/origin-${hash(origin)}-${Math.floor(now / 3600000)}`),
                runtime_1.db.doc(`formRecipientVerificationRates/draft-${input.id}`),
                runtime_1.db.doc(`formRecipientVerificationRates/address-${hash(email)}-${Math.floor(now / 86400000)}`),
            ];
            const rates = await tx.getAll(...rateRefs), limits = [10, 10, 3];
            if (rates.some((snap, i) => Number(snap.data()?.count ?? 0) >= limits[i]))
                throw new https_1.HttpsError('resource-exhausted', 'Verification limit reached. Submit now or try later.');
            rates.forEach((snap, i) => tx.set(rateRefs[i], {
                count: Number(snap.data()?.count ?? 0) + 1,
                expiresAt: now + 86400000,
            }));
            tx.set(proofRef, {
                recordId: input.id,
                email,
                capabilityHash,
                templateId: record.templateId,
                templateVersion: record.templateVersion,
                codeHash,
                codeExpiresAt: now + 15 * 60000,
                attempts: 0,
                verified: false,
                status: 'sending',
                requestId: input.requestId,
            });
            tx.create(requestRef, { email, createdAt: now });
            return true;
        });
        if (requested) {
            try {
                await mailer.send(email, code);
                await proofRef.update({ status: 'sent' });
            }
            catch {
                await proofRef.update({ status: 'failed' });
                throw new https_1.HttpsError('unavailable', 'Verification email failed. Your answers are retained.');
            }
        }
        const saved = await proofRef.get();
        return { status: saved.data()?.verified ? 'verified' : (saved.data()?.status ?? 'pending') };
    }
    if (input.action === 'verify') {
        if (typeof input.code !== 'string' || !/^\d{8}$/.test(input.code))
            throw new https_1.HttpsError('invalid-argument', 'Enter the eight-digit code.');
        const matched = await runtime_1.db.runTransaction(async (tx) => {
            const [recordSnap, proof] = await Promise.all([tx.get(recordRef), tx.get(proofRef)]);
            const record = recordSnap.data();
            await checkRecord(record, tx);
            const data = proof.data();
            if (!data ||
                data.capabilityHash !== capabilityHash ||
                data.templateId !== record.templateId ||
                data.templateVersion !== record.templateVersion ||
                data.status !== 'sent' ||
                data.codeExpiresAt <= now ||
                data.attempts >= 5)
                throw new https_1.HttpsError('permission-denied', 'Verification expired or unavailable.');
            if (data.verified && data.approvalExpiresAt > now)
                return true;
            const actual = Buffer.from(hash(`${input.id}:${email}:${input.code}`), 'hex'), expected = Buffer.from(data.codeHash, 'hex');
            const valid = expected.length === actual.length && (0, node_crypto_1.timingSafeEqual)(actual, expected);
            tx.update(proofRef, {
                attempts: Number(data.attempts) + 1,
                ...(valid
                    ? { verified: true, verifiedAt: now, approvalExpiresAt: record.publicExpiresAt }
                    : {}),
            });
            return valid;
        });
        if (!matched)
            throw new https_1.HttpsError('permission-denied', 'Incorrect verification code.');
        return { status: 'verified' };
    }
    throw new https_1.HttpsError('invalid-argument', 'Unknown verification action.');
}
exports.publicFormRecipientVerification = (0, https_1.onCall)({ secrets: (0, functionConfig_1.getGraphEmailSecrets)(), timeoutSeconds: 60 }, (request) => verifyPublicFormRecipient(request.data ?? {}, request.rawRequest?.ip ?? 'unknown'));
//# sourceMappingURL=formRecipientVerification.js.map