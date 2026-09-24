export type HtmlNode = {
    tag?: string;
    attrs?: Record<string, string>;
    text?: string;
    children?: HtmlNode[];
    widget?: string;
    content?: boolean;
};
export declare function parseWebsiteHtml(source: string, rootIds: string[], layout?: boolean): HtmlNode[];
export declare function websiteHtmlTemplate(ids: string[], slotId?: string): string;
export declare function validateJavascript(value: unknown): string;
export declare function reconcileWebsiteHtml(source: string, previous: string[], next: string[], slotId?: string): string;
//# sourceMappingURL=websiteLayout.d.ts.map