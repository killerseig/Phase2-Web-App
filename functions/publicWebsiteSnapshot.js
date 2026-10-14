"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRendererId = publicRendererId;
exports.assertPublic = assertPublic;
exports.publicVersion = publicVersion;
exports.publicSnapshotJson = publicSnapshotJson;
exports.generatePublicPages = generatePublicPages;
exports.regeneratePublicPages = regeneratePublicPages;
exports.servePublicHtml = servePublicHtml;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const publicWebsiteRoutes_1 = require("./publicWebsiteRoutes");
let rendererId;
function publicRendererId() {
    return rendererId || (rendererId = (0, node_crypto_1.createHash)('sha256').update((0, node_fs_1.readFileSync)(node_path_1.default.join(__dirname, 'generated/publicWebsiteRenderer.cjs'))).digest('hex').slice(0, 16));
}
function assertPublic(site) {
    const allowed = new Set(['name', 'accent', 'pages', 'sharedLayout', 'css', 'js', 'theme', 'forms', 'branding']);
    if (Object.entries(site).some(([key, value]) => value !== undefined && !allowed.has(key)) || site.savedSections || site.customWidgets || site.theme?.presets || site.forms?.some(form => form.delivery))
        throw new Error('Only sanitized published content can be generated.');
    if (!Array.isArray(site.pages) || [...site.pages, ...(site.sharedLayout ? [site.sharedLayout] : [])].some(page => page.sections.some(section => section.hidden)))
        throw new Error('Hidden/draft sections cannot be generated.');
}
function publicVersion(site, revision) {
    assertPublic(site);
    return `public-${revision}-${(0, node_crypto_1.createHash)('sha256').update(JSON.stringify(site)).digest('hex').slice(0, 16)}`;
}
function publicSnapshotJson(site, version) {
    assertPublic(site);
    return JSON.stringify({ site, version }).replace(/[<>&\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}
async function generatePublicPages(site, revision, renderer, existingVersion) {
    assertPublic(site);
    const version = existingVersion || publicVersion(site, revision);
    const render = renderer || require('./generated/publicWebsiteRenderer.cjs').renderPublicPage;
    const pages = {};
    for (const page of site.pages) {
        const html = await render(site, page.slug, version);
        if (!html || Buffer.byteLength(html) > 900000)
            throw new Error('Generated page exceeds its supported size.');
        pages[page.slug] = html;
    }
    return { version, site, pages };
}
const regenerated = new Map();
function regeneratePublicPages(site, version) {
    const key = version + ':' + publicRendererId();
    let result = regenerated.get(key);
    if (!result) {
        result = generatePublicPages(site, 0, undefined, version).catch(error => { regenerated.delete(key); throw error; });
        regenerated.set(key, result);
        while (regenerated.size > 2)
            regenerated.delete(regenerated.keys().next().value);
    }
    return result;
}
function escapeHtml(value) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function servePublicHtml(site, version, slug, body, template) {
    assertPublic(site);
    const page = site.pages.find(page => page.slug === slug);
    if (!page)
        throw new Error('Unknown public page');
    const shell = template || (0, node_fs_1.readFileSync)(node_path_1.default.join(__dirname, 'generated/publicTemplate.html'), 'utf8');
    if (!shell.includes('<div id="app"></div>'))
        throw new Error('Invalid public HTML template');
    return shell.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title + ' | ' + site.name)}</title><link rel="canonical" href="${(0, publicWebsiteRoutes_1.publicPageUrl)(slug)}">`).replace('<div id="app"></div>', `<div id="app" data-public-prerender>${body}</div><script type="application/json" id="published-website-snapshot">${publicSnapshotJson(site, version)}</script>`);
}
//# sourceMappingURL=publicWebsiteSnapshot.js.map