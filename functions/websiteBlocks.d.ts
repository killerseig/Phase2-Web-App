export declare const compactTypes: readonly ["card", "profile-card", "metric", "progress-ring", "sparkline", "data-table"];
export declare const blockTypes: readonly ["button", "icon", "divider", "spacer", "list", "badge", "alert", "team", "testimonials", "statistics", "logos", "chart", "timeline", "progress", "card", "profile-card", "metric", "progress-ring", "sparkline", "data-table"];
export declare const blockCollections: string[];
export declare const widgetIcons: readonly ["star", "check", "heart", "briefcase", "building", "users", "shield", "wrench", "phone", "envelope", "map-marker", "info-circle", "exclamation-triangle", "clock", "trophy", "bolt"];
export interface BlockOptions {
    columns?: number;
    variant?: 'solid' | 'outline';
    chartType?: 'bar' | 'line' | 'area' | 'donut';
    showData?: boolean;
    listStyle?: 'bullet' | 'numbered' | 'check';
}
export interface BlockItemData {
    subtitle?: string;
    value?: number;
    icon?: string;
}
export declare function validateBlockItem(data: Record<string, unknown>): BlockItemData;
export declare function validateBlockOptions(value: unknown): BlockOptions;
interface BlockSection extends BlockItemData {
    type: string;
    title: string;
    text: string;
    linkLabel: string;
    linkUrl: string;
    blockOptions?: BlockOptions;
    items: (BlockItemData & {
        title: string;
        text: string;
        imageId: string;
    })[];
}
export declare function blockErrors(section: BlockSection): string[];
export {};
//# sourceMappingURL=websiteBlocks.d.ts.map