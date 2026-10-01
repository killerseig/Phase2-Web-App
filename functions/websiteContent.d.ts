import type { RichTextNode } from './websiteRichText';
export interface ImageSettings {
    focusX?: number;
    focusY?: number;
    zoom?: number;
    caption?: string;
    overlay?: string;
    overlayOpacity?: number;
    overlayMode?: 'solid' | 'linear';
    overlayAngle?: number;
    darken?: number;
}
export interface MenuLabel {
    label: string;
    labelRichText?: RichTextNode;
}
export interface MenuLink extends MenuLabel {
    id: string;
    url: string;
    children?: MenuLink[];
}
export interface NavigationSettings {
    pageLabels?: (MenuLabel & {
        id: string;
    })[];
    loginLabel?: MenuLabel;
    brandText?: string;
    brandRichText?: RichTextNode;
    showBrand: boolean;
    showPages: boolean;
    showLogin: boolean;
    links: MenuLink[];
}
export declare function safeWebsiteLink(value: string): boolean;
export type TextNode = {
    type: 'text';
    text: string;
} | {
    type: 'strong' | 'em' | 'link';
    children: TextNode[];
    href?: string;
};
export interface TextBlock {
    type: 'p' | 'h2' | 'h3' | 'ul' | 'ol';
    lines: TextNode[][];
}
export declare function inlineText(text: string, depth?: number): TextNode[];
export declare function formattedText(text: string): TextBlock[];
export declare function textLinks(text: string): string[];
export declare function menuLinks(links: MenuLink[]): MenuLink[];
//# sourceMappingURL=websiteContent.d.ts.map