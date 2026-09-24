"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customDefinition = customDefinition;
exports.resolvedCustom = resolvedCustom;
exports.customBounds = customBounds;
exports.visibleCustomSections = visibleCustomSections;
exports.validateCustomCode = validateCustomCode;
exports.customBindingError = customBindingError;
exports.customCodeLinks = customCodeLinks;
exports.customMarkup = customMarkup;
exports.customDocument = customDocument;
const websiteContent_1 = require("./websiteContent");
function customDefinition(placement, definitions = []) {
    return placement?.inline || definitions.find((entry) => entry.id === placement?.definitionId);
}
function resolvedCustom(definition, values = {}) {
    const result = JSON.parse(JSON.stringify(definition));
    for (const field of result.fields) {
        const value = values[field.key] ?? field.defaultValue;
        field.defaultValue = value;
        const section = result.sections.find((entry) => entry.id === field.sectionId);
        if (!section || !field.property)
            continue;
        if (field.property === 'background' || field.property === 'color')
            section.appearance = { ...section.appearance, [field.property]: value };
        else {
            if (section[field.property] !== value) {
                if (field.property === 'title')
                    delete section.titleRichText;
                if (field.property === 'linkLabel')
                    delete section.linkRichText;
                if (field.property === 'text')
                    delete section.textRichText;
            }
            section[field.property] = value;
        }
    }
    return result;
}
function customBounds(sections) {
    const roots = sections.filter((section) => !section.parentId);
    return {
        width: Math.max(1, ...roots.map((section) => (section.layout.x + section.layout.w) * 45)),
        height: Math.max(1, ...roots.map((section) => (section.layout.y + section.layout.h) * 32)),
    };
}
function visibleCustomSections(sections) {
    return sections.filter((section) => {
        let current = section;
        const visited = new Set();
        while (current) {
            if (current.hidden || visited.has(current.id))
                return false;
            visited.add(current.id);
            current = sections.find((entry) => entry.id === current?.parentId);
        }
        return true;
    });
}
const tags = new Set('div span section article header footer nav main aside p h1 h2 h3 h4 h5 h6 ul ol li strong em b i small a img figure figcaption br hr blockquote details summary table thead tbody tr th td'.split(' '));
const attributes = new Set('class id title role aria-label aria-hidden href alt src width height colspan rowspan open target'.split(' '));
// Deliberately small HTML grammar, shared by editor and backend. The sandbox/CSP is an
// additional boundary; arbitrary HTML is never inserted into the application DOM.
function validateCustomCode(html, css, pageControls = false) {
    if (html.length > 20000 || css.length > 12000)
        throw new Error('Limit HTML to 20,000 and CSS to 12,000 characters.');
    let rest = html;
    while (rest.includes('<')) {
        rest = rest.slice(rest.indexOf('<'));
        const match = /^<\/?([a-z][a-z0-9]*)(\s[^<>]*?)?\s*\/?>/i.exec(rest);
        if (!match ||
            (!tags.has(match[1].toLowerCase()) &&
                !(pageControls &&
                    [
                        'button',
                        'input',
                        'label',
                        'textarea',
                        'select',
                        'option',
                        'output',
                        'canvas',
                        'progress',
                        'meter',
                    ].includes(match[1].toLowerCase()))))
            throw new Error('Use static HTML elements; scripts, forms, embedded pages, and document tags are not supported.');
        let attrs = (match[2] || '').trim();
        while (attrs) {
            const attr = /^([a-z][a-z0-9-]*)\s*=\s*("[^"]*"|'[^']*')\s*/i.exec(attrs);
            if (!attr ||
                (!attributes.has(attr[1].toLowerCase()) &&
                    !(pageControls &&
                        ([
                            'type',
                            'name',
                            'value',
                            'for',
                            'placeholder',
                            'checked',
                            'disabled',
                            'selected',
                            'min',
                            'max',
                            'step',
                            'aria-expanded',
                            'aria-controls',
                            'aria-live',
                            'tabindex',
                        ].includes(attr[1].toLowerCase()) ||
                            /^data-[a-z][a-z0-9-]*$/.test(attr[1])))))
                throw new Error('Use quoted HTML attributes. Event handlers and inline styles are not supported; place styles in CSS.');
            const name = attr[1].toLowerCase(), value = attr[2].slice(1, -1);
            if (name === 'target' && value !== '_top')
                throw new Error('Links open the website page.');
            if (name === 'href' && !(0, websiteContent_1.safeWebsiteLink)(value))
                throw new Error('Use an HTTPS, email, phone or website link in href.');
            if (name === 'src' && !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value))
                throw new Error('Code images use embedded PNG, JPEG or WebP data. Use visual widgets for library images.');
            if (value.includes('{{'))
                throw new Error('Text settings belong between HTML tags, not in attributes.');
            attrs = attrs.slice(attr[0].length);
        }
        rest = rest.slice(match[0].length);
    }
    if (/[<>\\]/.test(css) || /@import|url\s*\(|expression\s*\(|behavior\s*:/i.test(css))
        throw new Error('Widget CSS cannot load external resources or contain HTML.');
}
function escapeHtml(text) {
    return text.replace(/[&<>"'{}]/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '{': '&#123;',
        '}': '&#125;',
    })[character]);
}
function customBindingError(definition) {
    for (const [source, css] of [
        [definition.html, false],
        [definition.css, true],
    ])
        for (const match of source.matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g)) {
            const field = definition.fields.find((field) => field.key === match[1]);
            if (!field)
                return `Add an editable setting named ${match[1]}, or remove its placeholder.`;
            if (css && field.type !== 'color')
                return 'CSS placeholders require color settings.';
        }
    return '';
}
function customCodeLinks(html) {
    return [...html.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((match) => match[1] ?? match[2]);
}
function customMarkup(definition, values = {}) {
    validateCustomCode(definition.html, definition.css);
    const fields = new Map(definition.fields.map((field) => [field.key, field]));
    const html = definition.html
        .replace(/\{\{([a-z][a-z0-9_]*)\}\}/g, (_, key) => escapeHtml(values[key] ?? fields.get(key)?.defaultValue ?? ''))
        .replace(/<a(?![^>]*\btarget=)(?=\s|>)/gi, '<a target="_top"');
    const css = definition.css.replace(/\{\{([a-z][a-z0-9_]*)\}\}/g, (_, key) => {
        const field = fields.get(key), value = values[key] ?? field?.defaultValue ?? '';
        return field?.type === 'color' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
    });
    return { html, css };
}
function customDocument(definition, values = {}) {
    const { html, css } = customMarkup(definition, values);
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0}body{font-family:system-ui,sans-serif;overflow-wrap:anywhere}*{box-sizing:border-box}${css}</style></head><body>${html}</body></html>`;
}
//# sourceMappingURL=websiteCustom.js.map