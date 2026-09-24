export interface TextBoxValues {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    padding?: number;
    lockAspect?: boolean;
}
export interface TextBox extends TextBoxValues {
    devices?: Partial<Record<'tablet' | 'mobile', TextBoxValues>>;
}
export type TextBoxes = Partial<Record<'title' | 'text' | 'image' | 'button', TextBox>>;
export declare function validateTextBoxes(value: unknown): TextBoxes;
//# sourceMappingURL=websiteTextBox.d.ts.map