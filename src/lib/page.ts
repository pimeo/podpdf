import {
    Size,
    TextOpts,
    RectOpts,
    LineOpts,
    CircleOpts,
    ImageOpts,
    LinkOpts,
    TableOpts,
    BoundingElement,
} from './types'
import { FONTS } from './constants'
import {
    fill,
    stroke,
    esc,
    n,
    measure,
} from './helpers'

export class Page {
    w: number;
    h: number;
    c: string[] = [];
    f = new Set<string>();
    imgs: { d: Uint8Array; w: number; h: number; x: number; y: number; id: string }[] = [];
    links: { x: number; y: number; w: number; h: number; url: string }[] = [];
    ic = 0;
    boundingElements: BoundingElement[] = [];

    constructor(s: Size) {
        this.w = s.width;
        this.h = s.height
    }

    text(t: string, x: number, y: number, o: TextOpts = {}) {
        const s = o.size ?? 12;
        const wt = o.weight ?? 'normal';
        const col = o.color ?? '#000';
        const al = o.align ?? 'left';
        const font = FONTS[wt]

        this.f.add(font);
        let py = this.h - y;
        let tx = x;
        const lines = o.maxWidth ? this.wrap(t, o.maxWidth, s) : [t]
        let mw = 0
        let mh = 0
        for (const ln of lines) {
            const w = measure(ln, s)
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
        const py = this.h - y - h;
        this.c.push('q')

        if (o.radius && o.radius > 0) {
            const r = Math.min(o.radius, w / 2, h / 2)
            this.c.push(
                `${n(x + r)} ${n(py)} m`,
                `${n(x + w - r)} ${n(py)} l`,
                `${n(x + w)} ${n(py)} ${n(x + w)} ${n(py + r)} y`,
                `${n(x + w)} ${n(py + h - r)} l`,
                `${n(x + w)} ${n(py + h)} ${n(x + w - r)} ${n(py + h)} y`,
                `${n(x + r)} ${n(py + h)} l`,
                `${n(x)} ${n(py + h)} ${n(x)} ${n(py + h - r)} y`,
                `${n(x)} ${n(py + r)} l`,
                `${n(x)} ${n(py)} ${n(x + r)} ${n(py)} y`,
                'h')

        } else {
            this.c.push(`${n(x)} ${n(py)} ${n(w)} ${n(h)} re`)
        }

        if (o.fill) {
            this.c.push(fill(o.fill));
            this.c.push(o.stroke ? 'B' : 'f')
        }

        if (o.stroke) {
            this.c.push(stroke(o.stroke));
            if (o.lineWidth) {
                this.c.push(`${o.lineWidth} w`);
            }
            if (!o.fill) {
                this.c.push('S')
            }
        }

        this.c.push('Q');

        if (o.notInBounding !== true) {
            this.addBoundingElement({ type: 'rect', id: o.id, width: w, height: h, offsetX: x, offsetY: py })
        }

        return this
    }

    line(x1: number, y1: number, x2: number, y2: number, o: LineOpts = {}) {
        this.c.push('q')
        if (o.color) {
            this.c.push(stroke(o.color));
        }

        if (o.width) {
            this.c.push(`${o.width} w`);
        }

        if (o.dash) {
            this.c.push(`[${o.dash.join(' ')}] 0 d`)
        }

        this.c.push(`${n(x1)} ${n(this.h - y1)} m`, `${n(x2)} ${n(this.h - y2)} l`, 'S', 'Q')

        if (o.notInBounding !== true) {
            this.addBoundingElement({ type: 'line', id: o.id, width: x2 - x1, height: y2 - y1, offsetX: x1, offsetY: y1 })
        }

        return this
    }

    circle(cx: number, cy: number, r: number, o: CircleOpts = {}) {
        const py = this.h - cy;
        const k = 0.5523;
        this.c.push('q');

        this.c.push(`${n(cx + r)} ${n(py)} m`, `${n(cx + r)} ${n(py + r * k)} ${n(cx + r * k)} ${n(py + r)} ${n(cx)} ${n(py + r)} c`, `${n(cx - r * k)} ${n(py + r)} ${n(cx - r)} ${n(py + r * k)} ${n(cx - r)} ${n(py)} c`, `${n(cx - r * k)} ${n(py - r)} ${n(cx - r)} ${n(py - r * k)} ${n(cx)} ${n(py - r)} c`, `${n(cx + r * k)} ${n(py - r)} ${n(cx + r)} ${n(py - r * k)} ${n(cx + r)} ${n(py)} c`)

        if (o.fill) {
            this.c.push(fill(o.fill));
            this.c.push(o.stroke ? 'B' : 'f')
        }

        if (o.stroke) {
            this.c.push(stroke(o.stroke));
            if (o.lineWidth) {
                this.c.push(`${o.lineWidth} w`);
            }

            if (!o.fill) {
                this.c.push('S')
            }
        }

        this.c.push('Q');

        if (o.notInBounding !== true) {
            this.addBoundingElement({ type: 'circle', id: o.id, width: cx + r * k, height: py + r * k, offsetX: cx, offsetY: py })
        }

        return this
    }

    image(d: Uint8Array, x: number, y: number, o: ImageOpts = {}) {
        const info = this.imgInfo(d); if (!info) return this
        const w = o.width ?? info.w, h = o.height ?? info.h, id = `I${++this.ic}`
        this.imgs.push({ d, w: info.w, h: info.h, x, y: this.h - y - h, id })
        this.c.push('q', `${n(w)} 0 0 ${n(h)} ${n(x)} ${n(this.h - y - h)} cm`, `/${id} Do`, 'Q')

        if (o.notInBounding !== true) {
            this.addBoundingElement({ type: 'image', id: o.id, width: w, height: h, offsetX: x, offsetY: this.h - y - h })
        }

        return this
    }

    link(t: string, url: string, x: number, y: number, o: LinkOpts = {}) {
        const col = o.color ?? '#00E'
        const s = o.size ?? 12;
        this.text(t, x, y, { color: col, size: s })
        const w = measure(t, s);

        if (o.underline !== false) {
            this.line(x, y + 2, x + w, y + 2, { color: col, width: 0.5 })
        }

        this.links.push({ x, y: this.h - y - s, w, h: s, url });

        if (o.notInBounding !== true) {
            this.addBoundingElement({ type: 'link', id: o.id, width: w, height: o.underline ? s + 3 : s, offsetX: x, offsetY: this.h - y - s })
        }

        return this
    }

    table(data: string[][], x: number, y: number, o: TableOpts) {
        const p = o.padding ?? 8;
        const fs = o.fontSize ?? 10

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
            this.rect(x, cy, tw, rh, { fill: (o.striped && r % 2) ? (o.stripedColor ?? '#F9F9F9') : '#FFF', notInBounding: true })

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
        if (d[0] === 0x89 && d[1] === 0x50) return { w: (d[16] << 24) | (d[17] << 16) | (d[18] << 8) | d[19], h: (d[20] << 24) | (d[21] << 16) | (d[22] << 8) | d[23] }
        return null
    }
}