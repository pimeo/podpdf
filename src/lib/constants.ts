import { Size, Weight } from './types'

export const SIZES: Record<string, Size> = {
    A4: { width: 595, height: 842 },
    A3: { width: 842, height: 1191 },
    A5: { width: 420, height: 595 },
    LETTER: { width: 612, height: 792 },
    A4_LANDSCAPE: { width: 842, height: 595 },
    A3_LANDSCAPE: { width: 1191, height: 842 },
    A5_LANDSCAPE: { width: 595, height: 420 },
}

export const FONTS: Record<Weight, string> = {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    bolditalic: 'Helvetica-BoldOblique'
}

export const CP1252: Record<string, number> = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 }
