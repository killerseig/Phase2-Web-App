"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSdsBook = buildSdsBook;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const fontkit_1 = __importDefault(require("@pdf-lib/fontkit"));
const pdf_lib_1 = require("pdf-lib");
function wrap(text, font, size, width) {
    const lines = [];
    let line = '';
    for (const char of text.replace(/[\r\n\t]/g, ' ')) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) {
            lines.push(line);
            line = '';
        }
        line += char;
    }
    lines.push(line || ' ');
    return lines;
}
/** Output and manifest share final pagination, independent of explorer filters. */
async function buildSdsBook(title, generatedAt, entries, readPdf) {
    if (!entries.length)
        throw new Error('Select at least one SDS sheet before exporting.');
    const book = await pdf_lib_1.PDFDocument.create();
    book.registerFontkit(fontkit_1.default);
    const font = await book.embedFont((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'assets/SourceSans3-Regular.ttf')), { subset: true });
    book.setTitle(title);
    book.setAuthor('Phase 2');
    book.setCreationDate(new Date(generatedAt));
    const blue = (0, pdf_lib_1.rgb)(0.08, 0.23, 0.38);
    const cover = book.addPage([612, 792]);
    cover.drawText('PHASE 2', { x: 48, y: 706, size: 22, font, color: blue });
    const titleLines = wrap(title, font, 27, 510);
    titleLines.forEach((line, i) => cover.drawText(line, { x: 48, y: 615 - i * 34, size: 27, font, color: blue }));
    cover.drawText('Safety Data Sheets', { x: 48, y: 400, size: 20, font });
    cover.drawText(`Generated ${generatedAt.slice(0, 10)} (UTC) · ${entries.length} sheets`, {
        x: 48,
        y: 368,
        size: 12,
        font,
    });
    cover.drawText('Contents follow the saved library organization and job selection.', {
        x: 48,
        y: 330,
        size: 11,
        font,
    });
    const rows = [];
    let previous = [];
    entries.forEach((entry, entryIndex) => {
        let common = 0;
        while (common < previous.length && previous[common] === entry.folders[common])
            common++;
        entry.folders.slice(common).forEach((label, index) => {
            const depth = common + index;
            rows.push({
                label,
                depth,
                entryIndex,
                folder: true,
                lines: wrap(label, font, 12, 460 - depth * 14),
                page: 0,
                y: 0,
            });
        });
        const label = `${entry.title} — ${entry.manufacturer}${entry.revisionDate ? ` · ${entry.revisionDate}` : ''}`;
        rows.push({
            label,
            depth: entry.folders.length,
            entryIndex,
            folder: false,
            lines: wrap(label, font, 11, 460 - entry.folders.length * 14),
            page: 0,
            y: 0,
        });
        previous = entry.folders;
    });
    let tocPage = 0;
    let y = 696;
    for (const row of rows) {
        const height = row.lines.length * 15 + 10;
        if (y - height < 55) {
            tocPage++;
            y = 696;
        }
        row.page = tocPage;
        row.y = y;
        y -= height;
    }
    const contents = Array.from({ length: tocPage + 1 }, (_, index) => {
        const page = book.addPage([612, 792]);
        page.drawText(index ? 'Table of contents (continued)' : 'Table of contents', {
            x: 48,
            y: 741,
            size: 20,
            font,
            color: blue,
        });
        return page;
    });
    const manifest = [];
    let bytesRead = 0;
    for (const entry of entries) {
        try {
            const bytes = await readPdf(entry);
            bytesRead += bytes.length;
            if (bytesRead > 100 * 1024 * 1024)
                throw new Error('This book exceeds the 100 MB source-file limit.');
            const source = await pdf_lib_1.PDFDocument.load(bytes);
            if (!source.getPageCount())
                throw new Error('The PDF has no pages.');
            if (source.getForm().getFields().length)
                source.getForm().flatten();
            if (book.getPageCount() + source.getPageCount() > 3000)
                throw new Error('This book exceeds the 3,000-page limit.');
            const startPage = book.getPageCount() + 1;
            const pages = await book.copyPages(source, source.getPageIndices());
            pages.forEach((page) => book.addPage(page));
            manifest.push({
                documentId: entry.documentId,
                revisionId: entry.revisionId,
                title: entry.title,
                startPage,
                pageCount: pages.length,
            });
        }
        catch (error) {
            throw new Error(`Could not include “${entry.title}”: ${error instanceof Error ? error.message : 'PDF unavailable'}`);
        }
    }
    for (const row of rows) {
        const page = contents[row.page];
        const target = manifest[row.entryIndex].startPage;
        const x = 48 + row.depth * 14;
        row.lines.forEach((line, i) => page.drawText(line, {
            x,
            y: row.y - i * 15,
            size: row.folder ? 12 : 11,
            font,
            color: row.folder ? blue : (0, pdf_lib_1.rgb)(0.1, 0.1, 0.1),
        }));
        page.drawText(String(target), {
            x: 552 - font.widthOfTextAtSize(String(target), 11),
            y: row.y,
            size: 11,
            font,
        });
        const link = book.context.register(book.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [x, row.y - (row.lines.length - 1) * 15 - 3, 563, row.y + 13],
            Border: [0, 0, 0],
            Dest: [book.getPage(target - 1).ref, 'Fit'],
        }));
        page.node.addAnnot(link);
    }
    // Hierarchical bookmarks mirror the contents, including folder destinations.
    const outline = book.context.obj({ Type: 'Outlines' });
    const outlineRef = book.context.register(outline);
    const stack = [
        { depth: -1, ref: outlineRef, children: [] },
    ];
    const groups = [stack[0]];
    for (const row of rows) {
        while (stack.length > 1 && stack[stack.length - 1].depth >= row.depth)
            stack.pop();
        const parent = stack[stack.length - 1];
        const item = book.context.obj({
            Title: pdf_lib_1.PDFHexString.fromText(row.label),
            Parent: parent.ref,
            Dest: [book.getPage(manifest[row.entryIndex].startPage - 1).ref, 'Fit'],
        });
        const ref = book.context.register(item);
        parent.children.push(ref);
        if (row.folder) {
            const group = { depth: row.depth, ref, children: [] };
            stack.push(group);
            groups.push(group);
        }
    }
    for (const group of groups) {
        if (!group.children.length)
            continue;
        const dict = book.context.lookup(group.ref);
        dict.set(pdf_lib_1.PDFName.of('First'), group.children[0]);
        dict.set(pdf_lib_1.PDFName.of('Last'), group.children[group.children.length - 1]);
        dict.set(pdf_lib_1.PDFName.of('Count'), book.context.obj(group.children.length));
        group.children.forEach((ref, i) => {
            const item = book.context.lookup(ref);
            if (i)
                item.set(pdf_lib_1.PDFName.of('Prev'), group.children[i - 1]);
            if (i < group.children.length - 1)
                item.set(pdf_lib_1.PDFName.of('Next'), group.children[i + 1]);
        });
    }
    book.catalog.set(pdf_lib_1.PDFName.of('Outlines'), outlineRef);
    // Source pages are copied at original dimensions/orientation without an overlay.
    contents.forEach((page, i) => page.drawText(String(i + 2), { x: 550, y: 30, size: 10, font }));
    return { bytes: await book.save(), manifest, pageCount: book.getPageCount() };
}
//# sourceMappingURL=sdsBook.js.map