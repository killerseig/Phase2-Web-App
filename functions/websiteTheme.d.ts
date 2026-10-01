import { type WebsiteFont } from './websiteFonts';
import { type WebsiteTextStyles } from './websiteTypography';
export interface BrandPreset {
    name: string;
    accent: string;
    theme: Omit<WebsiteTheme, 'presets'>;
}
export interface WebsiteTheme {
    enabled?: boolean;
    background?: string;
    surface?: string;
    text?: string;
    muted?: string;
    border?: string;
    buttonText?: string;
    bodyFont?: WebsiteFont;
    headingFont?: WebsiteFont;
    fontSize?: number;
    lineHeight?: number;
    radius?: number;
    spacing?: number;
    contentWidth?: number;
    textStyles?: WebsiteTextStyles;
    presets?: BrandPreset[];
}
export declare const themeColors: readonly ["background", "surface", "text", "muted", "border", "buttonText"];
export declare const themeNumbers: {
    readonly fontSize: {
        readonly label: "Body text size";
        readonly min: 14;
        readonly max: 24;
        readonly step: 1;
    };
    readonly lineHeight: {
        readonly label: "Line height";
        readonly min: 1.3;
        readonly max: 2;
        readonly step: 0.05;
    };
    readonly radius: {
        readonly label: "Button corner radius";
        readonly min: 0;
        readonly max: 32;
        readonly step: 1;
    };
    readonly spacing: {
        readonly label: "Default flow spacing";
        readonly min: 0;
        readonly max: 80;
        readonly step: 1;
    };
    readonly contentWidth: {
        readonly label: "Flow content width";
        readonly min: 720;
        readonly max: 1600;
        readonly step: 10;
    };
};
export declare const defaultTheme: Required<Omit<WebsiteTheme, 'textStyles' | 'presets' | 'enabled'>>;
export declare function validateTheme(value: unknown, allowPresets?: boolean): WebsiteTheme;
export declare function contrastRatio(first: string, second: string): number;
export declare function themeWarnings(theme: WebsiteTheme, accent: string): string[];
//# sourceMappingURL=websiteTheme.d.ts.map