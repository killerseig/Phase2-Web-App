"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readEntryPhoto = readEntryPhoto;
exports.entryPdfPhotos = entryPdfPhotos;
const sharp_1 = __importDefault(require("sharp"));
const https_1 = require("firebase-functions/v2/https");
const runtime_1 = require("./runtime");
const formModel_1 = require("./formModel");
/** Caller must authorize the entry before reading bytes; validate membership and storage ownership again. */
async function readEntryPhoto(record, assetId) {
    if (!(0, formModel_1.photoAnswerIds)(record.definition, record.answers).includes(assetId))
        throw new https_1.HttpsError('permission-denied', 'Photo unavailable.');
    const asset = (await runtime_1.db.doc('formAssets/' + assetId).get()).data();
    const path = 'form-photos/' + record.id + '/' + assetId + '.webp';
    if (!asset ||
        asset.recordId !== record.id ||
        asset.ownerUid !== record.ownerUid ||
        asset.path !== path)
        throw new https_1.HttpsError('permission-denied', 'Photo unavailable.');
    const file = runtime_1.storageBucket.file(path), [metadata] = await file.getMetadata();
    if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) > 2 * 1024 * 1024)
        throw new https_1.HttpsError('resource-exhausted', 'Photo exceeds size limit.');
    const [bytes] = await file.download();
    if (bytes.length > 2 * 1024 * 1024)
        throw new https_1.HttpsError('resource-exhausted', 'Photo exceeds size limit.');
    return bytes;
}
async function entryPdfPhotos(record) {
    const photos = [];
    for (const assetId of (0, formModel_1.photoAnswerIds)(record.definition, record.answers)) {
        const bytes = await (0, sharp_1.default)(await readEntryPhoto(record, assetId))
            .rotate()
            .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
        photos.push({
            name: assetId + '.jpg',
            contentType: 'image/jpeg',
            contentBytes: bytes.toString('base64'),
            contentId: 'entry-photo-' + assetId,
            isInline: true,
        });
    }
    return photos;
}
//# sourceMappingURL=formEntryPhotos.js.map