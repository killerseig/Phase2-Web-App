"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWebsiteHtml = parseWebsiteHtml;
exports.websiteHtmlTemplate = websiteHtmlTemplate;
exports.validateJavascript = validateJavascript;
exports.reconcileWebsiteHtml = reconcileWebsiteHtml;
const websiteCustom_1 = require("./websiteCustom");
// Parse a deliberately limited HTML fragment. Widgets remain Vue components; no v-html,
// event attributes, script tags or Vue expressions ever enter the application DOM.
function parseWebsiteHtml(source, rootIds, layout = false) {
    if (typeof source !== 'string' || source.length > 20000)
        throw new Error('Limit HTML to 20,000 characters.');
    const roots = [], stack = [];
    const used = new Set();
    let contentCount = 0;
    const add = (node) => (stack.at(-1)?.children || roots).push(node);
    const input = source.replace(/<!--[\s\S]*?-->/g, '');
    let offset = 0;
    while (offset < input.length) {
        if (input[offset] !== '<') {
            const end = input.indexOf('<', offset);
            add({ text: input.slice(offset, end < 0 ? input.length : end) });
            offset = end < 0 ? input.length : end;
            continue;
        }
        const token = /^<(website-widget)\s+id="([a-zA-Z0-9_-]+)"\s*><\/website-widget\s*>/.exec(input.slice(offset));
        if (token) {
            const id = token[2];
            if (!rootIds.includes(id) || used.has(id))
                throw new Error('Reference each root widget once using its existing ID.');
            used.add(id);
            add({ widget: id });
            offset += token[0].length;
            continue;
        }
        const slot = /^<page-content\s*><\/page-content\s*>/.exec(input.slice(offset));
        if (slot) {
            if (!layout || ++contentCount !== 1)
                throw new Error('Only the site layout can contain one page-content slot.');
            add({ content: true });
            offset += slot[0].length;
            continue;
        }
        const tag = /^<(\/)?([a-z][a-z0-9]*)(\s[^<>]*?)?\s*(\/?)>/i.exec(input.slice(offset));
        if (!tag)
            throw new Error('Check the HTML tags and quoted attributes.');
        (0, websiteCustom_1.validateCustomCode)(tag[0], '', true);
        const name = tag[2].toLowerCase();
        if (tag[1]) {
            if (stack.pop()?.tag !== name)
                throw new Error('Close HTML elements in the order they were opened.');
        }
        else {
            const attrs = {};
            for (const attr of (tag[3] || '').matchAll(/([a-z][a-z0-9-]*)\s*=\s*("[^"]*"|'[^']*')/gi))
                attrs[attr[1].toLowerCase()] = attr[2].slice(1, -1);
            const node = { tag: name, attrs, children: [] };
            add(node);
            if (!tag[4] && !['img', 'br', 'hr', 'input'].includes(name))
                stack.push(node);
            if (stack.length > 20)
                throw new Error('Use no more than 20 nested HTML elements.');
        }
        offset += tag[0].length;
    }
    if (stack.length)
        throw new Error('Close all HTML elements.');
    if (used.size !== rootIds.length)
        throw new Error('Keep a reference to every root widget. Remove widgets in Design mode.');
    if (layout && contentCount !== 1)
        throw new Error('The site layout needs exactly one <page-content></page-content> slot.');
    return roots;
}
function websiteHtmlTemplate(ids, slotId) {
    return ids
        .map((id) => id === slotId
        ? '<page-content></page-content>'
        : `<website-widget id="${id}"></website-widget>`)
        .join('\n');
}
function validateJavascript(value) {
    if (typeof value !== 'string' || value.length > 20000)
        throw new Error('Limit JavaScript to 20,000 characters.');
    // Source is never evaluated on the server or in the employee application.
    return value;
}
// Reconcile visual structure edits inside existing wrappers in the same undo step.
function reconcileWebsiteHtml(source, previous, next, slotId) {
    parseWebsiteHtml(source, previous.filter((id) => id !== slotId), !!slotId);
    const markers = next.map((id) => websiteHtmlTemplate([id], slotId));
    let index = 0;
    const result = source.replace(/<website-widget\s+id="[a-zA-Z0-9_-]+"\s*><\/website-widget\s*>|<page-content\s*><\/page-content\s*>/g, () => markers[index++] || '');
    return result + (index < markers.length ? '\n' + markers.slice(index).join('\n') : '');
}
//# sourceMappingURL=websiteLayout.js.map