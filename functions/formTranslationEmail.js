"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formTranslationEmailContent = formTranslationEmailContent;
const formTranslation_1 = require("./formTranslation");
const formEmailRender_1 = require("./formEmailRender");
/** Adds an English rendering alongside original submitted results. Original photos/PDF stay intact. */
function formTranslationEmailContent(record, translation) {
    if (translation.status === 'disabled')
        return { html: '', text: '' };
    const notice = translation.status === 'failed'
        ? 'English translation failed. Original submitted answers follow; no English rendering is available.'
        : 'English rendering — machine translation; review safety meaning. ' +
            (translation.correction ? 'Human correction recorded. ' : '') +
            'Original submitted answers follow unchanged.';
    if (translation.status !== 'ready')
        return { html: '<p>' + notice + '</p>', text: notice + '\n\n' };
    const projected = (0, formTranslation_1.translatedFormProjection)(record, translation);
    if (projected === record)
        return {
            html: '<p>English rendering is out of date. Original submitted answers follow.</p>',
            text: 'English rendering is out of date. Original submitted answers follow.\n\n',
        };
    const body = (0, formEmailRender_1.buildFormEmailHtml)(projected).match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || '';
    return {
        html: '<section><h2>English rendering</h2><p>' +
            notice +
            '</p>' +
            body +
            '</section><h2>Original submission</h2>',
        text: notice +
            '\n\nEnglish rendering\n' +
            (0, formEmailRender_1.buildFormEmailText)(projected) +
            '\n\nOriginal submission\n',
    };
}
//# sourceMappingURL=formTranslationEmail.js.map