"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFormSubmissionPdf = buildFormSubmissionPdf;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const pdfkit_1 = __importDefault(require("pdfkit"));
const formModel_1 = require("./formModel");
const formTranslation_1 = require("./formTranslation");
/** Printable complete form, independent of custom email omissions. No scripts or external fetches. */
function buildFormSubmissionPdf(record, previews = [], translation) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({
            size: 'LETTER',
            margin: 42,
            info: { Title: record.definition.title },
        }), chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        try {
            const fontRoot = (0, node_fs_1.existsSync)((0, node_path_1.join)(__dirname, 'assets/SourceSans3-Regular.ttf'))
                ? (0, node_path_1.join)(__dirname, 'assets')
                : (0, node_path_1.join)(__dirname, '../assets');
            doc.registerFont('FormRegular', (0, node_path_1.join)(fontRoot, 'SourceSans3-Regular.ttf'));
            doc.registerFont('FormBold', (0, node_path_1.join)(fontRoot, 'SourceSans3-Semibold.ttf'));
            doc.font('FormBold').fontSize(18).text(record.definition.title);
            doc
                .font('FormRegular')
                .fontSize(10)
                .text('Completed form | Version ' + record.templateVersion)
                .text('Entry: ' +
                record.id +
                (record.submittedAt
                    ? ' | Submitted: ' + new Date(record.submittedAt).toISOString()
                    : ''))
                .moveDown();
            if (record.definition.description)
                doc.text(record.definition.description).moveDown();
            let section = '';
            function render(fields, answers, includePhotos = true) {
                fields.forEach((field) => {
                    if (field.kind === 'repeat') {
                        for (const [position, instance] of (answers[field.id] || []).entries()) {
                            doc
                                .font('FormBold')
                                .fontSize(14)
                                .text(field.label + ' ' + (position + 1))
                                .moveDown(0.4);
                            render(field.fields || [], instance.answers, includePhotos);
                        }
                        return;
                    }
                    if (doc.y > 680)
                        doc.addPage();
                    if (field.section && field.section !== section)
                        doc.font('FormBold').fontSize(14).text(field.section).moveDown(0.4);
                    section = field.section || '';
                    doc.font('FormBold').fontSize(11).text(field.label);
                    doc.font('FormRegular').fontSize(10);
                    if (field.hint)
                        doc.text(field.hint).moveDown(0.3);
                    if (field.kind === 'matrix') {
                        const selections = (answers[field.id] || []);
                        for (const [index, row] of (field.rows || []).entries()) {
                            if (doc.y > 670)
                                doc.addPage();
                            doc.font('FormBold').fontSize(10).text(row.label);
                            doc
                                .font('FormRegular')
                                .fontSize(10)
                                .text(selections[index] || 'Not provided')
                                .moveDown(0.5);
                        }
                        doc.moveDown();
                    }
                    else if (field.kind !== 'photo')
                        doc.text((0, formModel_1.formAnswerSummary)(field, answers[field.id]).replace(/\t/g, '    ')).moveDown();
                    else {
                        const count = Array.isArray(answers[field.id])
                            ? answers[field.id].length
                            : 0;
                        doc.text(count + ' attached photos.').moveDown(0.3);
                        if (!includePhotos) {
                            if (count)
                                doc.text('Photos are included with the original submission.').moveDown();
                            return;
                        }
                        for (const preview of previews.filter((item) => (answers[field.id] || []).some((id) => item.contentId === 'entry-photo-' + id))) {
                            if (doc.y + 155 > 710)
                                doc.addPage();
                            const y = doc.y;
                            doc.image(Buffer.from(preview.contentBytes, 'base64'), doc.x, y, { fit: [220, 145] });
                            doc.y = y + 155;
                        }
                        doc.moveDown();
                    }
                });
            }
            const projected = translation ? (0, formTranslation_1.translatedFormProjection)(record, translation) : record;
            if (projected !== record)
                doc.font('FormBold').fontSize(14).text('Original submission').moveDown();
            if (translation?.status === 'failed')
                doc
                    .text('English translation failed. Original submitted answers follow unchanged.')
                    .moveDown();
            render(record.definition.fields, record.answers);
            if (projected !== record && translation) {
                doc.addPage();
                section = '';
                doc.font('FormBold').fontSize(18).text('English rendering').moveDown();
                doc
                    .font('FormRegular')
                    .fontSize(10)
                    .text('Machine translation; review safety meaning. Original submission is preserved above.')
                    .text('Translation revision: ' +
                    translation.revision +
                    ' | Provider: ' +
                    translation.provider)
                    .text('Original source SHA-256: ' + translation.sourceHash)
                    .moveDown();
                if (translation.correction)
                    doc
                        .text('Human correction: ' +
                        new Date(translation.correction.at).toISOString() +
                        ' | Reviewer: ' +
                        translation.correction.by)
                        .moveDown();
                render(projected.definition.fields, projected.answers, false);
            }
            doc.end();
        }
        catch (error) {
            doc.end();
            reject(error);
        }
    });
}
//# sourceMappingURL=formSubmissionPdf.js.map