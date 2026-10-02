"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormEmailPreparationError = exports.buildFormEmailText = exports.buildFormEmailHtml = void 0;
exports.prepareFormEmail = prepareFormEmail;
exports.fitFormEmailPayload = fitFormEmailPayload;
const formSubmissionPdf_1 = require("./formSubmissionPdf");
const formEmailRender_1 = require("./formEmailRender");
var formEmailRender_2 = require("./formEmailRender");
Object.defineProperty(exports, "buildFormEmailHtml", { enumerable: true, get: function () { return formEmailRender_2.buildFormEmailHtml; } });
Object.defineProperty(exports, "buildFormEmailText", { enumerable: true, get: function () { return formEmailRender_2.buildFormEmailText; } });
const formSubmissionViewer_1 = require("./formSubmissionViewer");
const runtime_1 = require("./runtime");
const functionConfig_1 = require("./functionConfig");
const emailService_1 = require("./emailService");
const constants_1 = require("./constants");
const sharp_1 = __importDefault(require("sharp"));
const dailyLogEmailPhotos_1 = require("./dailyLogEmailPhotos");
class FormEmailPreparationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FormEmailPreparationError';
    }
}
exports.FormEmailPreparationError = FormEmailPreparationError;
const defaults = {
    loadAsset: async (id) => (await runtime_1.db.doc('formAssets/' + id).get()).data(),
    download: async (path, maxBytes) => {
        const file = runtime_1.storageBucket.file(path);
        const [metadata] = await file.getMetadata();
        if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) > maxBytes)
            throw new Error('Stored form photo exceeds the email processing limit.');
        const [contents] = await file.download();
        if (contents.length > maxBytes)
            throw new Error('Stored form photo exceeds the email processing limit.');
        return contents;
    },
    ownerEmail: async (uid) => (await runtime_1.db.doc('users/' + uid).get()).data()?.email,
    appBaseUrl: () => process.env.FIRESTORE_EMULATOR_HOST ? 'http://127.0.0.1:5173' : (0, functionConfig_1.getAppBaseUrl)(),
    viewerUrl: async (record) => (await (0, formSubmissionViewer_1.issueFormViewerLink)(record.id)).url,
};
// Match the existing Daily Log encoder without changing its source or behavior.
function photoIds(record, fieldId) {
    const value = record.answers[fieldId];
    return Array.isArray(value) ? value : [];
}
async function createBoundedJpeg(source, maxBytes) {
    const hardLimit = Math.min(dailyLogEmailPhotos_1.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES, maxBytes);
    if (hardLimit < 16 * 1024)
        return null;
    const targetBytes = Math.min(dailyLogEmailPhotos_1.DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES, hardLimit);
    let smallest = null;
    for (const [maxDimension, quality] of [
        [480, 68],
        [400, 60],
        [320, 52],
        [240, 44],
        [200, 38],
        [160, 32],
    ]) {
        const output = await (0, sharp_1.default)(source, {
            failOn: 'warning',
            limitInputPixels: 80000000,
            sequentialRead: true,
        })
            .rotate()
            .flatten({ background: '#ffffff' })
            .resize({
            width: maxDimension,
            height: maxDimension,
            fit: 'inside',
            withoutEnlargement: true,
        })
            .jpeg({ quality, mozjpeg: true })
            .toBuffer();
        if (!smallest || output.length < smallest.length)
            smallest = output;
        if (output.length <= targetBytes)
            return output;
    }
    return smallest && smallest.length <= hardLimit ? smallest : null;
}
function recordUrl(record, base) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new FormEmailPreparationError('Invalid application URL for form delivery.');
    return new URL('/form-submissions/' + encodeURIComponent(record.id), url).toString();
}
async function prepareFormEmail(record, recipients, deps = defaults) {
    const url = record.definition.output?.requireLogin === false && deps.viewerUrl
        ? await deps.viewerUrl(record)
        : recordUrl(record, deps.appBaseUrl()), previews = [], attachments = [];
    let totalBytes = 0;
    for (const [fieldIndex, field] of record.definition.fields.entries()) {
        if (field.kind !== 'photo' || totalBytes >= dailyLogEmailPhotos_1.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES)
            continue;
        const permitted = new Map();
        // Resolve only server-owned, submitted references. Never accept storage URLs/paths from answers.
        for (const id of photoIds(record, field.id).slice(0, constants_1.EMAIL.DAILY_LOG_PHOTO_PREVIEW_LIMIT)) {
            if (!/^[A-Za-z0-9_-]{1,128}$/.test(id))
                continue;
            const asset = await deps.loadAsset(id);
            const expected = 'form-photos/' + record.id + '/' + id + '.webp';
            if (asset?.recordId === record.id &&
                asset.fieldId === field.id &&
                asset.ownerUid === record.ownerUid &&
                asset.path === expected)
                permitted.set('daily-logs/' + record.id + '/' + id + '.webp', expected);
        }
        // Adapt the trusted path lookup, preserving Daily Logs' exact JPEG resizing/quality and fallback behavior.
        const prepared = await (0, dailyLogEmailPhotos_1.prepareDailyLogInlinePhotos)(record.id, {
            attachments: photoIds(record, field.id)
                .slice(0, constants_1.EMAIL.DAILY_LOG_PHOTO_PREVIEW_LIMIT)
                .map((id) => ({ type: 'photo', path: 'daily-logs/' + record.id + '/' + id + '.webp' })),
        }, {
            downloadObject: async (path, maxBytes) => {
                const trusted = permitted.get(path);
                if (!trusted)
                    throw Object.assign(new Error('Photo unavailable'), { code: 404 });
                return deps.download(trusted, Math.min(maxBytes, 2 * 1024 * 1024));
            },
            createBoundedJpeg,
        });
        for (const [index, attachment] of prepared.attachments.entries()) {
            const bytes = Buffer.from(attachment.contentBytes, 'base64').length;
            if (totalBytes + bytes > dailyLogEmailPhotos_1.DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES)
                break;
            totalBytes += bytes;
            const contentId = 'form-photo-' + fieldIndex + '-' + prepared.previews[index].position + '@phase2.local';
            previews.push({ fieldId: field.id, position: prepared.previews[index].position, contentId });
            attachments.push({
                ...attachment,
                name: 'form-photo-' + fieldIndex + '-' + prepared.previews[index].position + '.jpg',
                contentId,
            });
        }
    }
    const routing = (0, emailService_1.buildSubmissionEmailRouting)(recipients, await deps.ownerEmail(record.ownerUid));
    const pdf = record.definition.output?.pdf
        ? await (0, formSubmissionPdf_1.buildFormSubmissionPdf)(record, attachments)
        : undefined;
    const html = (0, formEmailRender_1.buildFormEmailHtml)(record, previews, url);
    const outputAttachments = [
        ...attachments.filter((attachment) => html.includes('cid:' + attachment.contentId)),
        ...(pdf
            ? [
                {
                    name: 'completed-form.pdf',
                    contentType: 'application/pdf',
                    contentBytes: pdf.toString('base64'),
                    isInline: false,
                },
            ]
            : []),
    ];
    const options = {
        ...routing,
        subject: record.definition.title,
        html,
        text: (0, formEmailRender_1.buildFormEmailText)(record, url),
        dailyLogPhotoFallbackHtml: (0, formEmailRender_1.buildFormEmailHtml)(record, [], url),
        ...(outputAttachments.length ? { attachments: outputAttachments } : {}),
    };
    return fitFormEmailPayload(options);
}
function fitFormEmailPayload(options) {
    const bytes = () => Buffer.byteLength(JSON.stringify({
        message: {
            subject: options.subject,
            body: { contentType: 'HTML', content: options.html },
            toRecipients: (Array.isArray(options.to) ? options.to : [options.to]).map((address) => ({
                emailAddress: { address },
            })),
            ...(options.replyTo ? { replyTo: [{ emailAddress: { address: options.replyTo } }] } : {}),
            attachments: options.attachments?.map((attachment) => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                ...attachment,
            })),
        },
        saveToSentItems: true,
    }), 'utf8') + 4096;
    if (bytes() > constants_1.EMAIL.DAILY_LOG_MAX_PAYLOAD_BYTES) {
        options.html = options.dailyLogPhotoFallbackHtml;
        options.attachments = options.attachments?.filter((attachment) => !attachment.isInline);
        if (!options.attachments?.length)
            delete options.attachments;
    }
    if (bytes() > constants_1.EMAIL.DAILY_LOG_MAX_PAYLOAD_BYTES)
        throw new FormEmailPreparationError('This completed form email exceeds the 900 KB message limit. The submission is retained; contact Admin.');
    return options;
}
//# sourceMappingURL=formEmailContent.js.map