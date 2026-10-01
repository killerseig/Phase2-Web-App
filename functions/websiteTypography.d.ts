import { type WebsiteFont } from './websiteFonts';
export declare const textStyleNames: {
    readonly pageTitle: "Page title";
    readonly sectionHeading: "Section heading";
    readonly body: "Body text";
};
export interface TextStyleValues {
    font?: WebsiteFont;
    size?: number;
    weight?: number;
    lineHeight?: number;
}
export interface WebsiteTextStyle extends TextStyleValues {
    devices?: {
        tablet?: TextStyleValues;
        mobile?: TextStyleValues;
    };
}
export type WebsiteTextStyles = Partial<Record<keyof typeof textStyleNames, WebsiteTextStyle>>;
export declare const textStyleLimits: {
    readonly size: {
        readonly min: 8;
        readonly max: 160;
    };
    readonly weight: {
        readonly min: 100;
        readonly max: 900;
    };
    readonly lineHeight: {
        readonly min: 1;
        readonly max: 3;
    };
};
export declare function validateTextStyles(raw: unknown): WebsiteTextStyles;
//# sourceMappingURL=websiteTypography.d.ts.map