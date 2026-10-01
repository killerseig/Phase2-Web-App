export declare const motionEffects: {
    readonly none: "None";
    readonly fade: "Fade in";
    readonly rise: "Fade up";
    readonly slide: "Slide in";
    readonly zoom: "Gentle zoom";
};
export interface WebsiteMotion {
    effect: keyof typeof motionEffects;
    duration?: number;
    delay?: number;
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}
export declare function validateMotion(raw: unknown): WebsiteMotion;
//# sourceMappingURL=websiteMotion.d.ts.map