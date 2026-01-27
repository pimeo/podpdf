import { Color, PNGData, TTFInfo } from './types'
import { CP1252 } from './constants'

export const rgb = (c: Color): [number, number, number] => {
    if (Array.isArray(c)) return c
    const h = c.replace('#', '')
    if (h.length === 3) return [parseInt(h[0] + h[0], 16) / 255, parseInt(h[1] + h[1], 16) / 255, parseInt(h[2] + h[2], 16) / 255]
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}
export const fill = (c: Color) => { const [r, g, b] = rgb(c); return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg` }
export const stroke = (c: Color) => { const [r, g, b] = rgb(c); return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG` }
export const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x00-\x7F]/g, c => `\\${(CP1252[c] || c.charCodeAt(0)).toString(8).padStart(3, '0')}`)
export const n = (v: number) => Number.isInteger(v) ? v.toString() : v.toFixed(2)
export const measure = (t: string, s: number) => t.length * s * 0.52

export const parsePNGHeader = (d: Uint8Array): { w: number; h: number; colorType: number; idat: Uint8Array } | null => {
    if (d[0] !== 0x89 || d[1] !== 0x50 || d[2] !== 0x4E || d[3] !== 0x47) return null
    let pos = 8, w = 0, h = 0, colorType = 0
    const idat: Uint8Array[] = []
    while (pos < d.length) {
        const len = (d[pos] << 24) | (d[pos + 1] << 16) | (d[pos + 2] << 8) | d[pos + 3]
        const type = String.fromCharCode(d[pos + 4], d[pos + 5], d[pos + 6], d[pos + 7])
        if (type === 'IHDR') {
            w = (d[pos + 8] << 24) | (d[pos + 9] << 16) | (d[pos + 10] << 8) | d[pos + 11]
            h = (d[pos + 12] << 24) | (d[pos + 13] << 16) | (d[pos + 14] << 8) | d[pos + 15]
            colorType = d[pos + 17]
        } else if (type === 'IDAT') idat.push(d.slice(pos + 8, pos + 8 + len))
        else if (type === 'IEND') break
        pos += 12 + len
    }
    if (!w || !idat.length) return null
    const total = idat.reduce((a, b) => a + b.length, 0)
    const merged = new Uint8Array(total)
    let off = 0
    for (const c of idat) { merged.set(c, off); off += c.length }
    return { w, h, colorType, idat: merged }
}

export const unfilterPNG = (raw: Uint8Array, w: number, h: number, colorType: number): PNGData => {
    const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1
    const scanline = w * bpp + 1
    const rgb = new Uint8Array(w * h * 3)
    const alpha = (colorType === 6 || colorType === 4) ? new Uint8Array(w * h) : undefined

    const paeth = (a: number, b: number, c: number) => {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
    }

    for (let y = 0; y < h; y++) {
        const filter = raw[y * scanline]
        for (let x = 0; x < w * bpp; x++) {
            const i = y * scanline + 1 + x
            const a = x >= bpp ? raw[i - bpp] : 0
            const b = y > 0 ? raw[(y - 1) * scanline + 1 + x] : 0
            const c = (x >= bpp && y > 0) ? raw[(y - 1) * scanline + 1 + x - bpp] : 0

            if (filter === 1) raw[i] = (raw[i] + a) & 255
            else if (filter === 2) raw[i] = (raw[i] + b) & 255
            else if (filter === 3) raw[i] = (raw[i] + Math.floor((a + b) / 2)) & 255
            else if (filter === 4) raw[i] = (raw[i] + paeth(a, b, c)) & 255
        }

        for (let x = 0; x < w; x++) {
            const i = y * scanline + 1 + x * bpp
            const oi = (y * w + x) * 3
            if (colorType === 6) { rgb[oi] = raw[i]; rgb[oi + 1] = raw[i + 1]; rgb[oi + 2] = raw[i + 2]; if (alpha) alpha[y * w + x] = raw[i + 3] }
            else if (colorType === 4) { rgb[oi] = rgb[oi + 1] = rgb[oi + 2] = raw[i]; if (alpha) alpha[y * w + x] = raw[i + 1] }
            else if (colorType === 2) { rgb[oi] = raw[i]; rgb[oi + 1] = raw[i + 1]; rgb[oi + 2] = raw[i + 2] }
            else { rgb[oi] = rgb[oi + 1] = rgb[oi + 2] = raw[i] }
        }
    }
    return { w, h, rgb, alpha }
}

export const parseTTF = (d: Uint8Array): TTFInfo | null => {
    const u16 = (o: number) => (d[o] << 8) | d[o + 1]
    const i16 = (o: number) => { const v = u16(o); return v > 32767 ? v - 65536 : v }
    const u32 = (o: number) => (d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]
    const numTables = u16(4)
    const tables: Record<string, { offset: number; length: number }> = {}
    for (let i = 0; i < numTables; i++) {
        const o = 12 + i * 16
        tables[String.fromCharCode(d[o], d[o + 1], d[o + 2], d[o + 3])] = { offset: u32(o + 8), length: u32(o + 12) }
    }
    if (!tables.head || !tables.hhea || !tables.hmtx || !tables.maxp) return null
    const head = tables.head.offset
    const unitsPerEm = u16(head + 18)
    const bbox = [i16(head + 36), i16(head + 38), i16(head + 40), i16(head + 42)]
    const hhea = tables.hhea.offset
    const ascent = i16(hhea + 4), descent = i16(hhea + 6), numHmtx = u16(hhea + 34)
    const hmtx = tables.hmtx.offset
    const widths: number[] = []
    for (let i = 0; i < Math.min(numHmtx, 256); i++) widths.push(u16(hmtx + i * 4))
    let name = 'CustomFont'
    if (tables.name) {
        const nt = tables.name.offset, nc = u16(nt + 2), so = nt + u16(nt + 4)
        for (let i = 0; i < nc; i++) {
            const r = nt + 6 + i * 12
            if (u16(r + 6) === 6) { name = Array.from(d.slice(so + u16(r + 10), so + u16(r + 10) + u16(r + 8))).filter(b => b > 31 && b < 127).map(b => String.fromCharCode(b)).join(''); break }
        }
    }
    return { name: name.replace(/[^a-zA-Z0-9]/g, ''), unitsPerEm, ascent, descent, bbox, widths, data: d }
}