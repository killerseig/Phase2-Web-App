"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formRecipientGroups = exports.FORM_TOTAL_RECIPIENT_LIMIT = exports.FORM_RESPONDENT_RECIPIENT_LIMIT = void 0;
exports.normalizeFormRecipientEmails = normalizeFormRecipientEmails;
exports.respondentRecipients = respondentRecipients;
exports.resolveRecipientEmails = resolveRecipientEmails;
exports.resolveFormSubmissionRecipients = resolveFormSubmissionRecipients;
exports.publicRecipientConsentSnapshot = publicRecipientConsentSnapshot;
const roleAccess_1 = require("./roleAccess");
exports.FORM_RESPONDENT_RECIPIENT_LIMIT = 10;
exports.FORM_TOTAL_RECIPIENT_LIMIT = 100;
exports.formRecipientGroups = ['job-foremen', 'job-project-managers', 'job-everyone'];
const ids = (value) => Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeFormRecipientEmails(value, limit) {
    if (!Array.isArray(value))
        throw new Error('Recipient addresses must be a list.');
    if (value.length > limit)
        throw new Error(`At most ${limit} recipient addresses are allowed.`);
    const emails = value.map((address) => {
        if (typeof address !== 'string')
            throw new Error('Invalid recipient address.');
        const normalized = address.trim().toLowerCase();
        if (normalized.length > 254 || !emailPattern.test(normalized))
            throw new Error('Invalid recipient address.');
        return normalized;
    });
    return [...new Set(emails)];
}
function respondentRecipients(fields, answers) {
    const result = [];
    for (const field of fields) {
        const value = answers[field.id];
        if (field.kind === 'recipients' && value !== undefined) {
            result.push(...normalizeFormRecipientEmails(value, exports.FORM_RESPONDENT_RECIPIENT_LIMIT));
        }
        if (field.kind === 'repeat' && Array.isArray(value)) {
            for (const instance of value) {
                if (typeof instance === 'object' && instance && 'answers' in instance)
                    result.push(...respondentRecipients(field.fields ?? [], instance.answers));
            }
        }
    }
    return normalizeFormRecipientEmails(result, exports.FORM_RESPONDENT_RECIPIENT_LIMIT);
}
/** Notification routing only: this function never grants access to entries or photos. */
function resolveRecipientEmails(definition, answers, job, users, options = {}) {
    const groups = definition.recipientGroups ?? [];
    if (groups.some((group) => !exports.formRecipientGroups.includes(group)))
        throw new Error('Invalid recipient group.');
    if (groups.length && !job)
        throw new Error('Job recipient groups require a valid job context.');
    const fixed = normalizeFormRecipientEmails(definition.recipients, 20);
    const additional = respondentRecipients(definition.fields, answers);
    const groupEmails = [];
    if (job && groups.length) {
        for (const user of users) {
            if (user.active === false)
                continue;
            const role = (0, roleAccess_1.normalizeStoredRole)(user.role);
            const assigned = ids(user.assignedJobIds).includes(job.id);
            const foremanAssigned = role === 'foreman' && (assigned || ids(job.assignedForemanIds).includes(user.uid));
            const selected = (groups.includes('job-everyone') && (assigned || foremanAssigned)) ||
                (groups.includes('job-foremen') && foremanAssigned) ||
                (groups.includes('job-project-managers') && role === 'project-manager' && assigned);
            if (!selected ||
                typeof user.email !== 'string' ||
                !emailPattern.test(user.email.trim()) ||
                user.email.trim().length > 254)
                continue;
            groupEmails.push(user.email.trim().toLowerCase());
        }
    }
    // Public input cannot turn the notification service into an arbitrary mail relay.
    // Unverified addresses remain part of the immutable answers, but do not receive mail.
    const approved = [...new Set([...fixed, ...groupEmails])];
    const publicApprovedExtras = additional.filter((email) => options.verifiedEmails?.includes(email));
    const combined = [
        ...new Set([...approved, ...(options.publicRespondent ? publicApprovedExtras : additional)]),
    ];
    if (combined.length > exports.FORM_TOTAL_RECIPIENT_LIMIT)
        throw new Error('Too many submission recipients. Narrow the job recipient groups.');
    return combined;
}
/** Queries only explicit assignment membership; never scans the company directory. */
async function resolveFormSubmissionRecipients(db, definition, answers, jobId, options = {}) {
    if (options.publicRespondent && options.publicRecordId && options.verifiedEmails === undefined) {
        options = {
            ...options,
            verifiedEmails: (await publicRecipientConsentSnapshot(db, options.publicRecordId)).map((proof) => proof.email),
        };
    }
    if (!definition.recipientGroups?.length)
        return resolveRecipientEmails(definition, answers, null, [], options);
    if (!jobId)
        throw new Error('Job recipient groups require a valid job context.');
    const jobSnapshot = await db.collection('jobs').doc(jobId).get();
    if (!jobSnapshot.exists)
        throw new Error('Job recipient groups require a valid job context.');
    const job = {
        id: jobSnapshot.id,
        assignedForemanIds: jobSnapshot.data()?.assignedForemanIds,
    };
    const assignedSnapshot = await db
        .collection('users')
        .where('assignedJobIds', 'array-contains', jobId)
        .limit(101)
        .get();
    if (assignedSnapshot.size > exports.FORM_TOTAL_RECIPIENT_LIMIT)
        throw new Error('Job recipient group is too large. Narrow its membership.');
    const users = new Map();
    for (const doc of assignedSnapshot.docs)
        users.set(doc.id, { ...doc.data(), uid: doc.id });
    const foremanIds = [...new Set(ids(job.assignedForemanIds))];
    if (foremanIds.length > exports.FORM_TOTAL_RECIPIENT_LIMIT)
        throw new Error('Job recipient group is too large.');
    if (foremanIds.length) {
        const snapshots = await db.getAll(...foremanIds.map((uid) => db.collection('users').doc(uid)));
        for (const doc of snapshots)
            if (doc.exists)
                users.set(doc.id, { ...doc.data(), uid: doc.id });
    }
    return resolveRecipientEmails(definition, answers, job, [...users.values()], options);
}
/** Copy only these provenance fields into the immutable submission/delivery, never code hashes. */
async function publicRecipientConsentSnapshot(db, recordId) {
    const record = await db.doc(`formRecords/${recordId}`).get();
    const saved = record.data();
    const proofs = await db
        .collection('formRecipientVerifications')
        .where('recordId', '==', recordId)
        .limit(10)
        .get();
    return proofs.docs
        .filter((doc) => {
        const proof = doc.data();
        return (proof.verified === true &&
            proof.approvalExpiresAt > Date.now() &&
            saved &&
            proof.templateId === saved.templateId &&
            proof.templateVersion === saved.templateVersion &&
            proof.capabilityHash === saved.publicCapabilityHash);
    })
        .map((doc) => {
        const proof = doc.data();
        return {
            proofId: doc.id,
            email: proof.email,
            recordId,
            templateId: proof.templateId,
            templateVersion: proof.templateVersion,
            verifiedAt: proof.verifiedAt,
            approvalExpiresAt: proof.approvalExpiresAt,
        };
    });
}
//# sourceMappingURL=formRecipients.js.map