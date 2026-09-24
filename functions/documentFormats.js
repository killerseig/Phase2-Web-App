"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCUMENT_MIME = void 0;
exports.documentExtension = documentExtension;
exports.printable = printable;
exports.validateDocument = validateDocument;
exports.imageToPdf = imageToPdf;
const https_1 = require("firebase-functions/v2/https");
const pdf_lib_1 = require("pdf-lib");
const sharp_1 = __importDefault(require("sharp"));
const fflate_1 = require("fflate");
exports.DOCUMENT_MIME = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    txt: 'text/plain',
    csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
function documentExtension(value) {
    if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(exports.DOCUMENT_MIME, value))
        throw new https_1.HttpsError('invalid-argument', 'Supported files: PDF, JPG, PNG, WebP, TXT, CSV, DOCX and XLSX.');
    return value;
}
function printable(extension = 'pdf') {
    return ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(extension);
}
async function validateDocument(bytes, extension) {
    if (!bytes.length || bytes.length > 20 * 1024 * 1024)
        throw new https_1.HttpsError('invalid-argument', 'Choose a non-empty file no larger than 20 MB.');
    try {
        if (extension === 'pdf') {
            const pdf = await pdf_lib_1.PDFDocument.load(bytes);
            if (!pdf.getPageCount() || pdf.getPageCount() > 500)
                throw new Error('Use a readable, unencrypted PDF with 1–500 pages.');
            return { pageCount: pdf.getPageCount() };
        }
        if (exports.DOCUMENT_MIME[extension].startsWith('image/')) {
            const source = (0, sharp_1.default)(bytes, { limitInputPixels: 40000000, failOn: 'error' });
            const info = await source.metadata();
            const expected = extension === 'jpg' ? 'jpeg' : extension;
            if (info.format !== expected || (info.pages ?? 1) > 1)
                throw new Error('Use a valid, still JPG, PNG or WebP image.');
            await source.clone().resize({ width: 1, height: 1 }).toBuffer();
            return { pageCount: 1 };
        }
        if (extension === 'txt' || extension === 'csv') {
            if (bytes.length > 2 * 1024 * 1024)
                throw new Error('Text and CSV files must be no larger than 2 MB.');
            const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text))
                throw new Error('Use a UTF-8 text or CSV file.');
            return { pageCount: 0 };
        }
        let size = 0, count = 0;
        const files = (0, fflate_1.unzipSync)(bytes, {
            filter: (entry) => {
                size += entry.originalSize;
                if (++count > 2000 || size > 30 * 1024 * 1024 || entry.originalSize > 10 * 1024 * 1024)
                    throw new Error('This Office document is too large to preview. Use a smaller document or export it as a PDF.');
                if (/vbaProject\.bin$/i.test(entry.name))
                    throw new Error('Macro-enabled Office documents are not supported.');
                return /\.xml$|\.rels$/.test(entry.name);
            },
        });
        const main = extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';
        if (!files['[Content_Types].xml'] || !files[main])
            throw new Error('Choose a valid DOCX or XLSX file, not a renamed or encrypted file.');
        const root = new TextDecoder().decode(files[main]);
        if (!(extension === 'docx' ? /<(?:[\w.-]+:)?document\b/ : /<(?:[\w.-]+:)?workbook\b/).test(root))
            throw new Error('This Office document has no readable document or workbook content.');
        for (const [name, value] of Object.entries(files)) {
            if (value.length > 10 * 1024 * 1024)
                throw new Error('Office content exceeds the preview limit.');
            const text = new TextDecoder('utf-8', { fatal: true }).decode(value);
            if (/<!DOCTYPE|<!ENTITY/i.test(text))
                throw new Error('This document contains unsupported XML declarations.');
            if (/xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
                const cells = [...text.matchAll(/<c\b[^>]*\br="([A-Z]+)(\d+)"/g)];
                if (cells.length > 100000 ||
                    cells.some((m) => Number(m[2]) > 10000 ||
                        m[1].length > 2 ||
                        [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) > 200))
                    throw new Error('Worksheets support up to 10,000 rows, 200 columns and 100,000 populated cells.');
            }
        }
        if (Object.keys(files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length > 30)
            throw new Error('Workbooks support up to 30 worksheets.');
        return { pageCount: 0 };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('invalid-argument', error instanceof Error ? error.message.slice(0, 300) : 'The file could not be validated.');
    }
}
async function imageToPdf(bytes) {
    const image = await (0, sharp_1.default)(bytes, { limitInputPixels: 40000000 }).rotate().png().toBuffer();
    const pdf = await pdf_lib_1.PDFDocument.create();
    const embedded = await pdf.embedPng(image);
    const page = pdf.addPage(embedded.width > embedded.height ? [792, 612] : [612, 792]);
    const scale = Math.min((page.getWidth() - 48) / embedded.width, (page.getHeight() - 48) / embedded.height);
    const width = embedded.width * scale, height = embedded.height * scale;
    page.drawImage(embedded, {
        x: (page.getWidth() - width) / 2,
        y: (page.getHeight() - height) / 2,
        width,
        height,
    });
    return pdf.save();
}
//# sourceMappingURL=documentFormats.js.map