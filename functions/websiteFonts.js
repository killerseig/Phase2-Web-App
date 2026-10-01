"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fontOptions = exports.textFonts = exports.websiteFonts = void 0;
exports.fontCategory = fontCategory;
// Shared allowlist for site, widget and inline typography. Named web fonts are self-hosted.
exports.websiteFonts = {
    sans: "'Source Sans 3', 'Segoe UI', sans-serif",
    serif: 'Georgia, serif',
    mono: 'Consolas, monospace',
    display: "'Saira Semi Condensed', 'Source Sans 3', sans-serif",
    Inter: 'Inter, Arial, sans-serif',
    Montserrat: 'Montserrat, Arial, sans-serif',
    Lora: 'Lora, Georgia, serif',
    Roboto: 'Roboto, Arial, sans-serif',
    'Open Sans': "'Open Sans', Arial, sans-serif",
    Raleway: 'Raleway, Arial, sans-serif',
    Nunito: 'Nunito, Arial, sans-serif',
    Oswald: 'Oswald, Arial, sans-serif',
    'Playfair Display': "'Playfair Display', Georgia, serif",
    Merriweather: 'Merriweather, Georgia, serif',
    'Libre Baskerville': "'Libre Baskerville', Georgia, serif",
    'DM Sans': "'DM Sans', Arial, sans-serif",
    'Work Sans': "'Work Sans', Arial, sans-serif",
    'Fira Code': "'Fira Code', Consolas, monospace",
    'Dancing Script': "'Dancing Script', cursive",
    'Source Sans 3': "'Source Sans 3', Arial, sans-serif",
    'Saira Semi Condensed': "'Saira Semi Condensed', Arial, sans-serif",
    Arial: 'Arial, sans-serif',
    Georgia: 'Georgia, serif',
    'Times New Roman': "'Times New Roman', serif",
    Verdana: 'Verdana, sans-serif',
    'Trebuchet MS': "'Trebuchet MS', sans-serif",
    Tahoma: 'Tahoma, sans-serif',
    'Palatino Linotype': "'Palatino Linotype', Palatino, serif",
    'Courier New': "'Courier New', monospace",
    Consolas: 'Consolas, monospace',
    'sans-serif': 'sans-serif',
    monospace: 'monospace',
};
function fontCategory(value) {
    if (['mono', 'monospace', 'Consolas', 'Courier New', 'Fira Code'].includes(value))
        return 'Monospace';
    if (value === 'Dancing Script')
        return 'Script';
    if ([
        'serif',
        'Georgia',
        'Times New Roman',
        'Palatino Linotype',
        'Lora',
        'Merriweather',
        'Libre Baskerville',
        'Playfair Display',
    ].includes(value))
        return 'Serif';
    if (['display', 'Saira Semi Condensed', 'Oswald'].includes(value))
        return 'Condensed';
    return 'Sans serif';
}
const legacy = ['sans', 'serif', 'mono', 'display'];
exports.textFonts = Object.keys(exports.websiteFonts)
    .filter((key) => !legacy.includes(key))
    .concat('serif');
exports.fontOptions = [
    { value: 'sans', label: 'Sans serif' },
    { value: 'serif', label: 'Serif' },
    { value: 'mono', label: 'Monospace' },
    { value: 'display', label: 'Condensed' },
    ...exports.textFonts.filter((value) => value !== 'serif').map((value) => ({ value, label: value })),
];
//# sourceMappingURL=websiteFonts.js.map