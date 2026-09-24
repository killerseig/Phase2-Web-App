import type { WebsiteSection } from './websiteModel';
export interface CustomWidgetField {
    key: string;
    label: string;
    type: 'text' | 'color' | 'image';
    defaultValue: string;
    sectionId?: string;
    property?: 'title' | 'text' | 'alt' | 'linkLabel' | 'linkUrl' | 'imageId' | 'background' | 'color';
}
export interface CustomWidgetDefinition {
    id: string;
    name: string;
    kind: 'visual' | 'code';
    sections: WebsiteSection[];
    html: string;
    css: string;
    fields: CustomWidgetField[];
}
export interface CustomWidgetPlacement {
    definitionId?: string;
    inline?: CustomWidgetDefinition;
    values: Record<string, string>;
}
export declare function customDefinition(placement: CustomWidgetPlacement | undefined, definitions?: CustomWidgetDefinition[]): CustomWidgetDefinition | undefined;
export declare function resolvedCustom(definition: CustomWidgetDefinition, values?: Record<string, string>): CustomWidgetDefinition;
export declare function customBounds(sections: WebsiteSection[]): {
    width: number;
    height: number;
};
export declare function visibleCustomSections(sections: WebsiteSection[]): WebsiteSection[];
export declare function validateCustomCode(html: string, css: string, pageControls?: boolean): void;
export declare function customBindingError(definition: CustomWidgetDefinition): string;
export declare function customCodeLinks(html: string): string[];
export declare function customMarkup(definition: CustomWidgetDefinition, values?: Record<string, string>): {
    html: string;
    css: string;
};
export declare function customDocument(definition: CustomWidgetDefinition, values?: Record<string, string>): string;
//# sourceMappingURL=websiteCustom.d.ts.map