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
/** Printable complete form, independent of custom email omissions. No scripts or external fetches. */
function buildFormSubmissionPdf(record, previews = []) {
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
                .moveDown();
            if (record.definition.description)
                doc.text(record.definition.description).moveDown();
            let section = '';
            record.definition.fields.forEach((field, index) => {
                if (doc.y > 680)
                    doc.addPage();
                if (field.section && field.section !== section)
                    doc.font('FormBold').fontSize(14).text(field.section).moveDown(0.4);
                section = field.section || '';
                doc.font('FormBold').fontSize(11).text(field.label);
                doc.font('FormRegular').fontSize(10);
                if (field.hint)
                    doc.text(field.hint).moveDown(0.3);
                if (field.kind !== 'photo')
                    doc
                        .text((0, formModel_1.formAnswerSummary)(field, record.answers[field.id]).replace(/\t/g, '    '))
                        .moveDown();
                else {
                    const count = Array.isArray(record.answers[field.id])
                        ? record.answers[field.id].length
                        : 0;
                    doc
                        .text(count +
                        ' photos. Full-resolution photos are available through the email viewer link.')
                        .moveDown(0.3);
                    for (const preview of previews.filter((item) => item.contentId.startsWith('form-photo-' + index + '-'))) {
                        if (doc.y + 155 > 710)
                            doc.addPage();
                        const y = doc.y;
                        doc.image(Buffer.from(preview.contentBytes, 'base64'), doc.x, y, { fit: [220, 145] });
                        doc.y = y + 155;
                    }
                    doc.moveDown();
                }
            });
            doc.end();
        }
        catch (error) {
            doc.end();
            reject(error);
        }
    });
}
//# sourceMappingURL=formSubmissionPdf.js.map