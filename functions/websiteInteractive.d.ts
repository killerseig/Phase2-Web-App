export declare function publicHttpsUrl(value: string): URL | null;
export declare function websiteVideo(value: string): {
    kind: 'embed' | 'file';
    url: string;
} | null;
interface InteractiveSection {
    type: string;
    title: string;
    linkUrl: string;
    items: {
        title: string;
        text: string;
        imageId: string;
        linkLabel: string;
        linkUrl: string;
    }[];
}
export declare function interactiveWidgetErrors(section: InteractiveSection): string[];
export {};
//# sourceMappingURL=websiteInteractive.d.ts.map