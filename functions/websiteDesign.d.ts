export type WebsiteDevice = 'desktop' | 'tablet' | 'mobile';
export interface ContainerLayout {
    direction: 'row' | 'column';
    gap: number;
    wrap?: boolean;
    align?: 'stretch' | 'start' | 'center' | 'end';
    justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
}
export interface ItemSizing {
    grow?: number;
    basis?: number;
    minHeight?: number;
    height?: number;
    align?: 'auto' | 'stretch' | 'start' | 'center' | 'end';
}
export interface PageLayout {
    desktop?: 'grid' | 'flow';
    tablet?: 'scale' | 'flow';
    mobile?: 'scale' | 'flow';
    gap?: number;
    padding?: number;
}
export declare const pageCssTemplate = "/* Page styles override matching appearance controls.\n   Add a CSS class such as custom-feature to a widget to target it.\n   Media queries follow the preview width as well as the public page. */\n.page {\n  background-color: #ffffff;\n  color: #172c40;\n  font-family: 'Segoe UI', sans-serif;\n}\n.widget-title {\n  letter-spacing: -0.02em;\n}\n.widget-button {\n  border-radius: 8px;\n}\n/* .custom-feature { background-color: #eaf0f5; padding: 24px; } */\n@media (max-width: 767px) {\n  .widget-title { font-size: 28px; }\n  .page-header { gap: 12px; }\n}\n";
export declare function compilePageCss(source: string, scopeId: string): string;
//# sourceMappingURL=websiteDesign.d.ts.map