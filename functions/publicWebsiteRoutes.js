"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyPublicSite = exports.canonicalPublicSite = exports.publicPageUrl = exports.isReservedPublicSlug = exports.reservedPublicSlugs = void 0;
exports.publicLinkPath = publicLinkPath;
exports.canonicalPublicUrl = canonicalPublicUrl;
exports.isPublicPagePath = isPublicPagePath;
exports.legacyPublicUrl = legacyPublicUrl;
// Shared route boundary: public pages are single root segments; app routes win.
exports.reservedPublicSlugs = [
    'admin', 'forms', 'form-submissions', 'reports', 'company-library', 'dashboards',
    'login', 'forgot-password', 'set-password', 'daily-log-gallery', 'jobs', 'dashboard',
    'exports', 'users', 'employees', 'settings', 'assets', 'public-assets', 'website', 'website-image',
    'website-runtime', 'public-boot', 'public-style', 'sds-file', 'employee-app', 'index', 'favicon',
];
const isReservedPublicSlug = (slug) => exports.reservedPublicSlugs.includes(slug);
exports.isReservedPublicSlug = isReservedPublicSlug;
const publicPageUrl = (slug) => slug === 'home' ? '/' : '/' + slug;
exports.publicPageUrl = publicPageUrl;
function publicLinkPath(value) { return (value.split(/[?#]/, 1)[0] || '/').replace(/\/$/, '') || '/'; }
function canonicalPublicUrl(value) {
    const match = value.match(/^\/website(?:\/([a-z0-9-]+))?\/?([?#].*)?$/);
    if (!match || (0, exports.isReservedPublicSlug)(match[1] || 'home'))
        return value;
    return (0, exports.publicPageUrl)(match[1] || 'home') + (match[2] || '');
}
function isPublicPagePath(value) {
    const path = publicLinkPath(canonicalPublicUrl(value));
    return path === '/' || (/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && !(0, exports.isReservedPublicSlug)(path.slice(1)));
}
function legacyPublicUrl(value) {
    if (!value.startsWith('/') || value.startsWith('/website') || !isPublicPagePath(value))
        return value;
    const path = publicLinkPath(value);
    return (path === '/' ? '/website' : '/website' + path) + value.slice(path.length);
}
function mapPublicSiteLinks(site, mapUrl) {
    function visit(value) {
        if (Array.isArray(value))
            return value.map(visit);
        if (!value || typeof value !== 'object')
            return value;
        const source = value, result = {};
        for (const [key, entry] of Object.entries(source)) {
            if (typeof entry === 'string' && ['url', 'href', 'linkUrl'].includes(key))
                result[key] = mapUrl(entry);
            else if (typeof entry === 'string' && key === 'html')
                result[key] = entry.replace(/(href=["'])([^"']+)(["'])/g, (_, start, url, end) => start + mapUrl(url) + end);
            else if (typeof entry === 'string' && key === 'text' && source.textFormat === 'markdown')
                result[key] = entry.replace(/\]\(([^)]+)\)/g, (_, url) => '](' + mapUrl(url) + ')');
            else
                result[key] = visit(entry);
        }
        return result;
    }
    return visit(site);
}
const canonicalPublicSite = (site) => mapPublicSiteLinks(site, canonicalPublicUrl);
exports.canonicalPublicSite = canonicalPublicSite;
const legacyPublicSite = (site) => mapPublicSiteLinks(site, legacyPublicUrl);
exports.legacyPublicSite = legacyPublicSite;
//# sourceMappingURL=publicWebsiteRoutes.js.map