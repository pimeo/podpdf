export type Color = string | [number, number, number]
export type Align = 'left' | 'center' | 'right'
export type Weight = 'normal' | 'bold' | 'italic' | 'bolditalic'
export interface Size { width: number; height: number }
export interface TextOpts { size?: number; color?: Color; align?: Align; weight?: Weight; maxWidth?: number; font?: string }
export interface RectOpts { fill?: Color; stroke?: Color; lineWidth?: number; radius?: number }
export interface LineOpts { color?: Color; width?: number; dash?: number[] }
export interface CircleOpts { fill?: Color; stroke?: Color; lineWidth?: number }
export interface ImageOpts { width?: number; height?: number }
export interface LinkOpts { underline?: boolean; color?: Color }
export interface TableCol { header: string; width?: number; align?: Align }
export interface TableOpts { columns: TableCol[]; headerBg?: Color; headerColor?: Color; borderColor?: Color; fontSize?: number; padding?: number }
export interface PDFMetadata { title?: string; author?: string; subject?: string; keywords?: string; creator?: string }
export interface PNGData { w: number; h: number; rgb: Uint8Array; alpha?: Uint8Array }
export interface TTFInfo { name: string; unitsPerEm: number; ascent: number; descent: number; bbox: number[]; widths: number[]; data: Uint8Array }