import { type TextBoxes } from './websiteTextBox';
import { type RichTextNode } from './websiteRichText';
import { type WebsiteTheme } from './websiteTheme';
import { type BlockOptions, type BlockItemData } from './websiteBlocks';
import type { WebsiteFormDefinition } from './websiteForms';
import type { CustomWidgetDefinition, CustomWidgetPlacement } from './websiteCustom';
import type { ImageSettings, NavigationSettings } from './websiteContent';
import { type ContainerLayout, type ItemSizing, type PageLayout } from './websiteDesign';
export declare const sectionTypes: readonly ["page-content", "hero", "text", "image-text", "gallery", "cards", "contact", "container", "image", "navigation", "footer", "custom", "form", "accordion", "tabs", "video", "downloads", "button", "icon", "divider", "spacer", "list", "badge", "alert", "team", "testimonials", "statistics", "logos", "chart", "timeline", "progress", "card", "profile-card", "metric", "progress-ring", "sparkline", "data-table"];
export type SectionType = (typeof sectionTypes)[number];
export interface WebsiteItem extends BlockItemData {
    textBoxes?: TextBoxes;
    linkRichText?: RichTextNode;
    titleRichText?: RichTextNode;
    textRichText?: RichTextNode;
    textFormat?: 'markdown';
    imageSettings?: ImageSettings;
    id: string;
    title: string;
    text: string;
    imageId: string;
    alt: string;
    linkLabel: string;
    linkUrl: string;
}
export interface WebsiteSection extends WebsiteItem {
    blockOptions?: BlockOptions;
    formId?: string;
    custom?: CustomWidgetPlacement;
    locked?: boolean;
    navigation?: NavigationSettings;
    styleClass?: string;
    sizing?: ItemSizing;
    devices?: Partial<Record<'tablet' | 'mobile', {
        hidden?: boolean;
        appearance?: WebsiteSection['appearance'];
        container?: ContainerLayout;
        sizing?: ItemSizing;
    }>>;
    parentId?: string;
    container?: ContainerLayout;
    appearance?: {
        background?: string;
        color?: string;
        borderColor?: string;
        borderWidth?: number;
        radius?: number;
        padding?: number;
        paddingTop?: number;
        paddingRight?: number;
        paddingBottom?: number;
        paddingLeft?: number;
        margin?: number;
        marginTop?: number;
        marginRight?: number;
        marginBottom?: number;
        marginLeft?: number;
        fontSize?: number;
        headingSize?: number;
        opacity?: number;
        rotation?: number;
        fontFamily?: import('./websiteFonts').WebsiteFont;
        motion?: import('./websiteMotion').WebsiteMotion;
        textAlign?: 'left' | 'center' | 'right';
        imageFit?: 'cover' | 'contain';
    };
    layout?: {
        x: number;
        y: number;
        w: number;
        h: number;
        z: number;
    };
    span?: 4 | 6 | 8 | 12;
    type: SectionType;
    hidden: boolean;
    items: WebsiteItem[];
}
export interface WebsitePage {
    html?: string;
    js?: string;
    useSiteLayout?: boolean;
    chrome?: 'widgets';
    css?: string;
    layout?: PageLayout;
    grid?: {
        visible: boolean;
        snap: boolean;
        spacingX: number;
        spacingY: number;
    };
    id: string;
    title: string;
    slug: string;
    description: string;
    inNavigation: boolean;
    sections: WebsiteSection[];
}
export interface WebsiteSite {
    css?: string;
    js?: string;
    sharedLayout?: WebsitePage;
    theme?: WebsiteTheme;
    forms?: WebsiteFormDefinition[];
    customWidgets?: CustomWidgetDefinition[];
    savedSections?: {
        id: string;
        name: string;
        sections: WebsiteSection[];
    }[];
    name: string;
    accent: string;
    pages: WebsitePage[];
    branding?: WebsiteBranding;
}
export interface WebsiteBranding {
    logoId: string;
    logoAlt: string;
    footerText: string;
    footerLinks: {
        id: string;
        label: string;
        url: string;
    }[];
}
export declare function validateWebsite(value: unknown): WebsiteSite;
export declare function websiteAssetIds(site: WebsiteSite): string[];
export declare function publishedWebsite(site: WebsiteSite): WebsiteSite;
export declare function initialWebsite(): WebsiteSite;
//# sourceMappingURL=websiteModel.d.ts.map