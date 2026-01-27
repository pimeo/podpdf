export type Color = string | [number, number, number];
export type Align = "left" | "center" | "right";
export type Weight = "normal" | "bold" | "italic" | "bolditalic";
export type Type =
    | "text"
    | "rect"
    | "line"
    | "circle"
    | "image"
    | "link"
    | "table";

export interface Size {
    width: number;
    height: number;
}

export interface TextOpts {
    size?: number;
    color?: Color;
    align?: Align;
    weight?: Weight;
    maxWidth?: number;
    font?: string;
    id?: string;
    notInBounding?: boolean;
}

export interface RectOpts {
    fill?: Color;
    stroke?: Color;
    lineWidth?: number;
    radius?: number;
    id?: string;
    notInBounding?: boolean;
}

export interface LineOpts {
    color?: Color;
    width?: number;
    dash?: number[];
    id?: string;
    notInBounding?: boolean;
}

export interface CircleOpts {
    fill?: Color;
    stroke?: Color;
    lineWidth?: number;
    id?: string;
    notInBounding?: boolean;
}

export interface ImageOpts {
    width?: number;
    height?: number;
    id?: string;
    notInBounding?: boolean;
}
export interface LinkOpts {
    underline?: boolean;
    color?: Color;
    id?: string;
    size?: number;
    notInBounding?: boolean;
}
export interface TableCol {
    header: string;
    width?: number;
    align?: Align;
}

export interface TableOpts {
    columns: TableCol[];
    headerBg?: Color;
    headerColor?: Color;
    headerRadius?: number;
    borderColor?: Color;
    fontSize?: number;
    padding?: number;
    id?: string;
    notInBounding?: boolean;
    striped?: boolean;
    stripedColor?: Color;
}

export interface PDFMetadata {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
}

export interface PNGData {
    w: number;
    h: number;
    rgb: Uint8Array;
    alpha?: Uint8Array;
}

export interface TTFInfo {
    name: string;
    unitsPerEm: number;
    ascent: number;
    descent: number;
    bbox: number[];
    widths: number[];
    data: Uint8Array;
}

export interface BoundingElement {
    type: Type;
    width: number;
    height: number;
    offsetX?: number;
    offsetY?: number;
    id?: string;
}
