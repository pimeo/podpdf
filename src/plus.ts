// podpdf/plus - Extended PDF with PNG & Custom Fonts support
// Standalone implementation with same API as core + extra features
// Uses built-in zlib from Bun/Node (zero npm dependencies)
import {
  Weight,
  Size,
  TextOpts,
  RectOpts,
  LineOpts,
  CircleOpts,
  ImageOpts,
  LinkOpts,
  TableOpts,
  PDFMetadata,
  PNGData,
  TTFInfo,
  BoundingElement,
} from './lib/types'
import {
  fill,
  stroke,
  esc,
  n,
  measure,
  parsePNGHeader,
  unfilterPNG,
  parseTTF,
  getImageType,
} from './lib/helpers'
import { SIZES } from './lib/constants'
import { Stream } from './lib/stream'
import { inflateSync } from 'node:zlib'

const FONTS: Record<string, Record<Weight, string>> = {
  helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', bolditalic: 'Helvetica-BoldOblique' },
  times: { normal: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic', bolditalic: 'Times-BoldItalic' },
  courier: { normal: 'Courier', bold: 'Courier-Bold', italic: 'Courier-Oblique', bolditalic: 'Courier-BoldOblique' },
}

// ============== Page ==============

class Page {
  w: number; h: number; c: string[] = []; f = new Set<string>()
  imgs: { d: Uint8Array; w: number; h: number; x: number; y: number; id: string; fmt: 'jpeg' | 'png'; png?: PNGData }[] = []
  links: { x: number; y: number; w: number; h: number; url: string }[] = []
  ic = 0
  boundingElements: BoundingElement[] = [];
  private fonts: Map<string, TTFInfo>

  constructor(s: Size, fonts: Map<string, TTFInfo>) { this.w = s.width; this.h = s.height; this.fonts = fonts }

  text(t: string, x: number, y: number, o: TextOpts = {}) {
    const s = o.size ?? 12
    const wt = o.weight ?? 'normal'
    const col = o.color ?? '#000'
    const al = o.align ?? 'left'

    let font = 'Helvetica'
    if (o.font) {
      if (FONTS[o.font]) font = FONTS[o.font][wt]
      else font = o.font
    } else {
      font = FONTS['helvetica'][wt]
    }

    this.f.add(font)
    let py = this.h - y;
    let tx = x;
    const lines = o.maxWidth ? this.wrap(t, o.maxWidth, s) : [t]
    let mw = 0
    let mh = 0
    for (const ln of lines) {
      const w = measure(ln, s, font, this.fonts)
      mw = Math.max(w, mw)
      tx = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x
      this.c.push('q', 'BT', fill(col), `/${font.replace('-', '')} ${s} Tf`, `${n(tx)} ${n(py)} Td`, `(${esc(ln)}) Tj`, 'ET', 'Q')
      py -= s * 1.2
      mh += s * 1.2
    }

    if (o.notInBounding !== true) {
      this.addBoundingElement({ type: 'text', id: o.id, width: mw, height: mh, offsetX: x, offsetY: y })
    }

    return this
  }

  rect(x: number, y: number, w: number, h: number, o: RectOpts = {}) {
    const py = this.h - y - h; this.c.push('q')
    if (o.radius && o.radius > 0) {
      const r = Math.min(o.radius, w / 2, h / 2)
      this.c.push(`${n(x + r)} ${n(py)} m`, `${n(x + w - r)} ${n(py)} l`, `${n(x + w)} ${n(py)} ${n(x + w)} ${n(py + r)} y`, `${n(x + w)} ${n(py + h - r)} l`, `${n(x + w)} ${n(py + h)} ${n(x + w - r)} ${n(py + h)} y`, `${n(x + r)} ${n(py + h)} l`, `${n(x)} ${n(py + h)} ${n(x)} ${n(py + h - r)} y`, `${n(x)} ${n(py + r)} l`, `${n(x)} ${n(py)} ${n(x + r)} ${n(py)} y`, 'h')
    } else this.c.push(`${n(x)} ${n(py)} ${n(w)} ${n(h)} re`)
    if (o.fill) { this.c.push(fill(o.fill)); this.c.push(o.stroke ? 'B' : 'f') }
    if (o.stroke) { this.c.push(stroke(o.stroke)); if (o.lineWidth) this.c.push(`${o.lineWidth} w`); if (!o.fill) this.c.push('S') }
    this.c.push('Q');

    if (o.notInBounding !== true) {
      this.addBoundingElement({ type: 'rect', id: o.id, width: w, height: h, offsetX: x, offsetY: py })
    }

    return this
  }

  line(x1: number, y1: number, x2: number, y2: number, o: LineOpts = {}) {
    this.c.push('q')
    if (o.color) this.c.push(stroke(o.color))
    if (o.width) this.c.push(`${o.width} w`)
    if (o.dash) this.c.push(`[${o.dash.join(' ')}] 0 d`)
    this.c.push(`${n(x1)} ${n(this.h - y1)} m`, `${n(x2)} ${n(this.h - y2)} l`, 'S', 'Q')

    if (o.notInBounding !== true) {
      this.addBoundingElement({ type: 'line', id: o.id, width: x2 - x1, height: y2 - y1, offsetX: x1, offsetY: y1 })
    }

    return this
  }

  circle(cx: number, cy: number, r: number, o: CircleOpts = {}) {
    const py = this.h - cy, k = 0.5523; this.c.push('q')
    this.c.push(`${n(cx + r)} ${n(py)} m`, `${n(cx + r)} ${n(py + r * k)} ${n(cx + r * k)} ${n(py + r)} ${n(cx)} ${n(py + r)} c`, `${n(cx - r * k)} ${n(py + r)} ${n(cx - r)} ${n(py + r * k)} ${n(cx - r)} ${n(py)} c`, `${n(cx - r * k)} ${n(py - r)} ${n(cx - r)} ${n(py - r * k)} ${n(cx)} ${n(py - r)} c`, `${n(cx + r * k)} ${n(py - r)} ${n(cx + r)} ${n(py - r * k)} ${n(cx + r)} ${n(py)} c`)
    if (o.fill) { this.c.push(fill(o.fill)); this.c.push(o.stroke ? 'B' : 'f') }
    if (o.stroke) { this.c.push(stroke(o.stroke)); if (o.lineWidth) this.c.push(`${o.lineWidth} w`); if (!o.fill) this.c.push('S') }
    this.c.push('Q');

    if (o.notInBounding !== true) {
      this.addBoundingElement({ type: 'circle', id: o.id, width: cx + r * k, height: py + r * k, offsetX: cx, offsetY: py })
    }

    return this
  }

  image(d: Uint8Array, x: number, y: number, o: ImageOpts = {}, png?: PNGData) {
    const info = png || this.imgInfo(d); if (!info) return this
    const w = o.width ?? info.w, h = o.height ?? info.h, id = `I${++this.ic}`
    const fmt = png ? 'png' : 'jpeg'
    this.imgs.push({ d, w: info.w, h: info.h, x, y: this.h - y - h, id, fmt, png })
    this.c.push('q', `${n(w)} 0 0 ${n(h)} ${n(x)} ${n(this.h - y - h)} cm`, `/${id} Do`, 'Q')

    if (o.notInBounding !== true) {
      this.addBoundingElement({ type: 'image', id: o.id, width: w, height: h, offsetX: x, offsetY: this.h - y - h })
    }

    return this
  }

  link(t: string, url: string, x: number, y: number, o: LinkOpts = {}) {
    const col = o.color ?? '#00E', s = 12; this.text(t, x, y, { color: col, size: s })
    const w = measure(t, s); if (o.underline !== false) this.line(x, y + 2, x + w, y + 2, { color: col, width: 0.5 })
    this.links.push({ x, y: this.h - y - s, w, h: s, url });
    if (o.notInBounding !== true) {
      this.addBoundingElement({ type: 'link', id: o.id, width: w, height: o.underline ? s + 3 : s, offsetX: x, offsetY: this.h - y - s })
    }

    return this
  }

  table(data: string[][], x: number, y: number, o: TableOpts) {
    const p = o.padding ?? 8;
    const fs = o.fontSize ?? 10
    const striped = o.striped !== false
    const stripedColor = o.stripedColor ?? '#F9F9F9'

    // Calculate Widths
    const cw = o.columns.map((c, i) => c.width ?? Math.max(measure(c.header, fs), ...data.map(r => measure(r[i] ?? '', fs))) + p * 2)
    const tw = cw.reduce((a, b) => a + b, 0);
    let cy = y;

    // -- Render Header

    // Calculate header height based on wrapped lines
    const headLines = o.columns.map((c, i) => this.wrap(c.header, cw[i] - p * 2, fs).length)
    const hh = (Math.max(1, ...headLines) * fs * 1.2) + p * 2

    this.rect(x, cy, tw, hh, { fill: o.headerBg ?? '#F0F0F0', radius: o.headerRadius ?? 0, notInBounding: true })

    let cx = x
    for (let i = 0; i < o.columns.length; i++) {
      const c = o.columns[i]
      this.text(
        c.header,
        cx + (c.align === 'center' ? cw[i] / 2 : c.align === 'right' ? cw[i] - p : p),
        cy + p + fs * 0.8,
        {
          size: fs,
          weight: 'bold',
          color: o.headerColor ?? '#000',
          align: c.align,
          maxWidth: cw[i] - p * 2,
          notInBounding: true
        })
      cx += cw[i]
    }
    cy += hh

    // -- Render Body Rows

    for (let r = 0; r < data.length; r++) {
      // Calculate the height needed for this specific row
      const rowLines = data[r].map((t, i) => this.wrap(t ?? '', cw[i] - p * 2, fs).length)
      const rh = (Math.max(1, ...rowLines) * fs * 1.2) + p * 2

      // Draw Background
      this.rect(x, cy, tw, rh, { fill: (striped && r % 2) ? stripedColor : '#FFF', notInBounding: true })

      // Draw Text
      cx = x
      for (let i = 0; i < o.columns.length; i++) {
        const c = o.columns[i]
        this.text(
          data[r][i] ?? '',
          cx + (c.align === 'center' ? cw[i] / 2 : c.align === 'right' ? cw[i] - p : p),
          cy + p + fs * 0.8,
          {
            size: fs,
            align: c.align,
            maxWidth: cw[i] - p * 2,
            notInBounding: true
          })
        cx += cw[i]
      }
      cy += rh
    }

    // Draw Outer Border (using final calculated height)
    this.rect(x, y, tw, cy - y, { stroke: o.borderColor ?? '#CCC', notInBounding: true })

    if (o.notInBounding !== true) {
      this.addBoundingElement({ type: 'table', id: o.id, width: tw, height: cy - y, offsetX: x, offsetY: y })
    }

    return this
  }

  getBoundingElements(): BoundingElement[] {
    return this.boundingElements
  }

  measureTableHeaderRow(data: string[][], o: TableOpts): Size {
    const p = o.padding ?? 8;
    const fs = o.fontSize ?? 10

    const cw = o.columns.map((c, i) => c.width ?? Math.max(measure(c.header, fs), ...data.map(r => measure(r[i] ?? '', fs))) + p * 2)
    const tw = cw.reduce((a, b) => a + b, 0);

    const headLines = o.columns.map((c, i) => this.wrap(c.header, cw[i] - p * 2, fs).length)
    const hh = (Math.max(1, ...headLines) * fs * 1.2) + p * 2

    return { width: tw, height: hh }
  }

  measureTableBodyRow(data: string[], o: TableOpts): Size {
    const p = o.padding ?? 8;
    const fs = o.fontSize ?? 10

    const cw = o.columns.map((c, i) => c.width ?? Math.max(measure(c.header, fs), ...data.map(r => measure(r[i] ?? '', fs))) + p * 2)
    const tw = cw.reduce((a, b) => a + b, 0);

    // Calculate the height needed for this specific row
    const rowLines = data.map((t, i) => this.wrap(t ?? '', cw[i] - p * 2, fs).length)
    const rh = (Math.max(1, ...rowLines) * fs * 1.2) + p * 2

    return { width: tw, height: rh }
  }

  private addBoundingElement(b: BoundingElement) {
    this.boundingElements.push(b)
  }

  private wrap(t: string, mw: number, s: number): string[] {
    const words = t.split(' '), lines: string[] = []; let cur = ''
    for (const w of words) { const test = cur ? `${cur} ${w}` : w; if (measure(test, s) <= mw) cur = test; else { if (cur) lines.push(cur); cur = w } }
    if (cur) lines.push(cur); return lines
  }

  private imgInfo(d: Uint8Array): { w: number; h: number } | null {
    if (d[0] === 0xFF && d[1] === 0xD8) { let o = 2; while (o < d.length) { if (d[o] !== 0xFF) break; const m = d[o + 1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: (d[o + 5] << 8) | d[o + 6], w: (d[o + 7] << 8) | d[o + 8] }; o += 2 + ((d[o + 2] << 8) | d[o + 3]) } }
    return null
  }
}

// ============== PDFPlus Class ==============

export class PDFPlus {
  private pages: Page[] = []; private cur: Page | null = null; private sz: Size; private meta?: PDFMetadata
  private customFonts: Map<string, TTFInfo> = new Map()

  constructor(s: Size | keyof typeof SIZES = 'A4') { this.sz = typeof s === 'string' ? SIZES[s] : s }

  metadata(m: PDFMetadata) { this.meta = m; return this }

  registerFont(name: string, data: Uint8Array): this {
    const info = parseTTF(data)
    if (info) this.customFonts.set(name, info)
    return this
  }

  page(s?: Size | keyof typeof SIZES) { this.cur = new Page(s ? (typeof s === 'string' ? SIZES[s] : s) : this.sz, this.customFonts); this.pages.push(this.cur); return this }
  text(t: string, x: number, y: number, o?: TextOpts) { this.ensure().text(t, x, y, o); return this }
  rect(x: number, y: number, w: number, h: number, o?: RectOpts) { this.ensure().rect(x, y, w, h, o); return this }
  line(x1: number, y1: number, x2: number, y2: number, o?: LineOpts) { this.ensure().line(x1, y1, x2, y2, o); return this }
  circle(cx: number, cy: number, r: number, o?: CircleOpts) { this.ensure().circle(cx, cy, r, o); return this }
  imageJpeg(d: Uint8Array, x: number, y: number, o?: ImageOpts) { this.ensure().image(d, x, y, o); return this }
  link(t: string, url: string, x: number, y: number, o?: LinkOpts) { this.ensure().link(t, url, x, y, o); return this }
  table(data: string[][], x: number, y: number, o: TableOpts) { this.ensure().table(data, x, y, o); return this }
  getBoundingElements() { return this.ensure().getBoundingElements(); }
  measureTableHeaderRow(tableData: string[][], o: TableOpts): Size { return this.ensure().measureTableHeaderRow(tableData, o); }
  measureTableBodyRow(data: string[], o: TableOpts): Size { return this.ensure().measureTableBodyRow(data, o); }

  image(d: Uint8Array, x: number, y: number, o: ImageOpts = {}): this {
    const imageType = getImageType(d)

    if ("jpeg" === imageType) {
      return this.imageJpeg(d, x, y, o)
    }

    if ("png" === imageType) {
      return this.imagePng(d, x, y, o)
    }

    return this
  }

  // PNG image support (async because of zlib decompression)
  imagePng(d: Uint8Array, x: number, y: number, o?: ImageOpts): this {
    const header = parsePNGHeader(d)
    if (!header) return this

    // Decompress using built-in zlib
    let raw: Uint8Array = new Uint8Array(inflateSync(header.idat))

    const png = unfilterPNG(raw, header.w, header.h, header.type, header.plte, header.trns)
    this.ensure().image(d, x, y, o, png)
    return this
  }

  private ensure() { if (!this.cur) this.page(); return this.cur! }

  build(): Uint8Array {
    const s = new Stream(), offsets: number[] = [0]
    let oid = 0

    s.l('%PDF-1.4').l('%\xB5\xB5\xB5\xB5')

    // Fonts
    const allFonts = new Set<string>(); this.pages.forEach(p => p.f.forEach(f => allFonts.add(f)))
    const fontArr = Array.from(allFonts)
    const fontIds: Record<string, number> = {}
    for (const f of fontArr) {
      if (this.customFonts.has(f)) continue;
      const id = ++oid; fontIds[f] = id; offsets[id] = s.size(); s.l(`${id} 0 obj`).l(`<</Type/Font/Subtype/Type1/BaseFont/${f}/Encoding/WinAnsiEncoding>>`).l('endobj')
    }

    // Custom fonts (TTF)
    const customFontIds: Record<string, { fontId: number; descId: number; fileId: number }> = {}
    for (const [name, info] of this.customFonts) {
      const fileId = ++oid; offsets[fileId] = s.size()
      s.l(`${fileId} 0 obj`).l(`<</Length ${info.data.length}/Length1 ${info.data.length}>>`).l('stream')
      s.w(info.data).l('').l('endstream').l('endobj')

      const descId = ++oid; offsets[descId] = s.size()
      const scale = 1000 / info.unitsPerEm
      s.l(`${descId} 0 obj`).l(`<</Type/FontDescriptor/FontName/${info.name}/Flags 32/FontBBox[${info.bbox.map(v => Math.round(v * scale)).join(' ')}]/ItalicAngle 0/Ascent ${Math.round(info.ascent * scale)}/Descent ${Math.round(info.descent * scale)}/CapHeight ${Math.round(info.ascent * scale * 0.7)}/StemV 80/FontFile2 ${fileId} 0 R>>`).l('endobj')

      const fontId = ++oid; offsets[fontId] = s.size()
      const widthsStr = info.widths.map(w => Math.round(w * scale)).join(' ')
      s.l(`${fontId} 0 obj`).l(`<</Type/Font/Subtype/TrueType/BaseFont/${info.name}/FirstChar 0/LastChar 255/Widths[${widthsStr}]/FontDescriptor ${descId} 0 R/Encoding/WinAnsiEncoding>>`).l('endobj')

      customFontIds[name] = { fontId, descId, fileId }
    }

    // Images
    const contentIds: number[] = [], annotIds: number[][] = [], imgIds: number[][] = [], smaskIds: number[][] = []
    for (const p of this.pages) {
      const pImgIds: number[] = [], pSmaskIds: number[] = []
      for (const img of p.imgs) {
        if (img.fmt === 'png' && img.png) {
          // PNG: embed raw RGB data
          const png = img.png

          // SMask for alpha if present
          let smaskId = 0
          if (png.alpha) {
            smaskId = ++oid; pSmaskIds.push(smaskId); offsets[smaskId] = s.size()
            s.l(`${smaskId} 0 obj`).l(`<</Type/XObject/Subtype/Image/Width ${png.w}/Height ${png.h}/ColorSpace/DeviceGray/BitsPerComponent 8/Length ${png.alpha.length}>>`).l('stream')
            s.w(png.alpha).l('').l('endstream').l('endobj')
          }

          const id = ++oid; pImgIds.push(id); offsets[id] = s.size()
          s.l(`${id} 0 obj`).l(`<</Type/XObject/Subtype/Image/Width ${png.w}/Height ${png.h}/ColorSpace/DeviceRGB/BitsPerComponent 8${smaskId ? `/SMask ${smaskId} 0 R` : ''}/Length ${png.rgb.length}>>`).l('stream')
          s.w(png.rgb).l('').l('endstream').l('endobj')
        } else {
          // JPEG
          const id = ++oid; pImgIds.push(id); offsets[id] = s.size()
          s.l(`${id} 0 obj`).l(`<</Type/XObject/Subtype/Image/Width ${img.w}/Height ${img.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${img.d.length}>>`).l('stream')
          s.w(img.d).l('').l('endstream').l('endobj')
        }
      }
      imgIds.push(pImgIds); smaskIds.push(pSmaskIds)

      const content = p.c.join('\n'), len = new TextEncoder().encode(content).length
      const cid = ++oid; contentIds.push(cid); offsets[cid] = s.size(); s.l(`${cid} 0 obj`).l(`<</Length ${len}>>`).l('stream').w(content).l('').l('endstream').l('endobj')

      const pAnnotIds: number[] = []; for (const l of p.links) { const aid = ++oid; pAnnotIds.push(aid); offsets[aid] = s.size(); s.l(`${aid} 0 obj`).l(`<</Type/Annot/Subtype/Link/Rect[${l.x} ${l.y} ${l.x + l.w} ${l.y + l.h}]/Border[0 0 0]/A<</Type/Action/S/URI/URI(${l.url})>>>>`).l('endobj') }
      annotIds.push(pAnnotIds)
    }

    const pagesId = ++oid
    const pageStartId = oid + 1
    const pageIds = this.pages.map((_, i) => pageStartId + i)
    offsets[pagesId] = s.size()
    s.l(`${pagesId} 0 obj`).l(`<</Type/Pages/Kids[${pageIds.map(id => `${id} 0 R`).join(' ')}]/Count ${pageIds.length}>>`).l('endobj')
    for (let i = 0; i < this.pages.length; i++) {
      const p = this.pages[i], pid = ++oid
      const fRef = Array.from(p.f).filter(f => !this.customFonts.has(f)).map(f => `/${f.replace('-', '')} ${fontIds[f]} 0 R`).join('')
      const cfRef = Array.from(this.customFonts.keys()).map(name => `/${name} ${customFontIds[name].fontId} 0 R`).join('')
      const iRef = p.imgs.map((img, j) => `/${img.id} ${imgIds[i][j]} 0 R`).join('')
      const aRef = annotIds[i].length ? `/Annots[${annotIds[i].map(id => `${id} 0 R`).join(' ')}]` : ''
      offsets[pid] = s.size()
      // Added /Group dictionary to enable correct transparency blending
      s.l(`${pid} 0 obj`).l(`<</Type/Page/Parent ${pagesId} 0 R/MediaBox[0 0 ${p.w} ${p.h}]/Group<</Type/Group/S/Transparency/CS/DeviceRGB>>/Contents ${contentIds[i]} 0 R/Resources<<${(fRef || cfRef) ? `/Font<<${fRef}${cfRef}>>` : ''}${iRef ? `/XObject<<${iRef}>>` : ''}>>${aRef}>>`).l('endobj')
    }

    // Info dictionary
    let infoId = 0
    if (this.meta) {
      infoId = ++oid; offsets[infoId] = s.size()
      const d = new Date(), date = `D:${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
      const m = this.meta
      s.l(`${infoId} 0 obj`).l(`<<${m.title ? `/Title(${esc(m.title)})` : ''}${m.author ? `/Author(${esc(m.author)})` : ''}${m.subject ? `/Subject(${esc(m.subject)})` : ''}${m.keywords ? `/Keywords(${esc(m.keywords)})` : ''}${m.creator ? `/Creator(${esc(m.creator)})` : ''}/Producer(podpdf)/CreationDate(${date})>>`).l('endobj')
    }

    const catId = ++oid; offsets[catId] = s.size()
    s.l(`${catId} 0 obj`).l(`<</Type/Catalog/Pages ${pagesId} 0 R>>`).l('endobj')

    const xref = s.size()
    s.l('xref').l(`0 ${oid + 1}`).l('0000000000 65535 f ')
    for (let i = 1; i <= oid; i++) s.l(`${offsets[i].toString().padStart(10, '0')} 00000 n `)
    s.l('trailer').l(`<</Size ${oid + 1}/Root ${catId} 0 R${infoId ? `/Info ${infoId} 0 R` : ''}>>`).l('startxref').l(xref.toString()).l('%%EOF')
    return s.out()
  }

  async save(path: string) { const d = this.build(); if (typeof Bun !== 'undefined') await Bun.write(path, d); else { const { writeFile } = await import('fs/promises'); await writeFile(path, d) } }
}

export const pdfPlus = (s?: Size | keyof typeof SIZES) => new PDFPlus(s)
