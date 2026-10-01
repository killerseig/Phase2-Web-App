export { textFonts } from './websiteFonts';
export interface RichTextNode {
    type: string;
    text?: string;
    attrs?: Record<string, string | number>;
    marks?: {
        type: string;
        attrs?: Record<string, string | number>;
    }[];
    content?: RichTextNode[];
}
export declare const textSizes: number[];
export declare const lineHeights: number[];
export declare function textColor(value: unknown): string;
export declare function richTextPlain(node: RichTextNode): string;
export declare function richTextLinks(node?: RichTextNode): string[];
export declare function mapRichTextLinks(node: RichTextNode | undefined, map: (href: string) => string): void;
export declare function validateRichText(value: unknown, heading?: boolean | 'title'): RichTextNode;
//# sourceMappingURL=websiteRichText.d.ts.map