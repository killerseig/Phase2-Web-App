"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicHttpsUrl = publicHttpsUrl;
exports.websiteVideo = websiteVideo;
exports.interactiveWidgetErrors = interactiveWidgetErrors;
// Shared by the editor, renderer and publication validator.
function publicHttpsUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password ? url : null;
    }
    catch {
        return null;
    }
}
function websiteVideo(value) {
    const url = publicHttpsUrl(value);
    if (!url)
        return null;
    let youtube = '';
    if (url.hostname === 'youtu.be')
        youtube = url.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
        youtube =
            url.pathname === '/watch'
                ? url.searchParams.get('v') || ''
                : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1] || '';
    }
    if (/^[\w-]{11}$/.test(youtube))
        return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${youtube}` };
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
        const id = url.pathname.match(/^\/(?:video\/)?(\d+)$/)?.[1];
        if (id)
            return { kind: 'embed', url: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm)$/i.test(url.pathname))
        return { kind: 'file', url: url.href };
    return null;
}
function interactiveWidgetErrors(section) {
    const errors = [];
    if (section.type === 'video' && !websiteVideo(section.linkUrl))
        errors.push('Choose a YouTube, Vimeo, or HTTPS MP4/WebM video link.');
    if (['accordion', 'tabs', 'downloads'].includes(section.type)) {
        if (!section.items.length)
            errors.push('Add at least one item.');
        for (const item of section.items) {
            if (!item.title.trim())
                errors.push('Give each item a heading.');
            if (section.type === 'downloads') {
                if (!publicHttpsUrl(item.linkUrl) || !item.linkLabel.trim())
                    errors.push('Give each document an HTTPS link and download label.');
            }
            else if (!item.text.trim() && !item.imageId && !item.linkUrl)
                errors.push('Add text, an image, or a link to each item.');
        }
    }
    return [...new Set(errors)];
}
//# sourceMappingURL=websiteInteractive.js.map