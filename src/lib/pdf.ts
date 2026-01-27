import { Page } from './page'
import {
    Size,
    TextOpts,
    RectOpts,
    LineOpts,
    CircleOpts,
    ImageOpts,
    LinkOpts,
    TableOpts,
    PDFMetadata,
} from './types'
import { Stream } from './stream'
import { SIZES } from './constants'
import {
    esc,
} from './helpers'


export class PDF {
    producer: string = 'podpdf'
    private pages: Page[] = [];
    private cur: Page | null = null;
    private sz: Size;
    private meta?: PDFMetadata

    constructor(s: Size | keyof typeof SIZES = 'A4') {
        this.sz = typeof s === 'string' ? SIZES[s] : s
    }

    metadata(m: PDFMetadata) {
        this.meta = m;
        return this
    }

    page(s?: Size | keyof typeof SIZES) {
        this.cur = new Page(s ? (typeof s === 'string' ? SIZES[s] : s) : this.sz);
        this.pages.push(this.cur); return this
    }

    text(t: string, x: number, y: number, o?: TextOpts) { this.ensure().text(t, x, y, o); return this }
    rect(x: number, y: number, w: number, h: number, o?: RectOpts) { this.ensure().rect(x, y, w, h, o); return this }
    line(x1: number, y1: number, x2: number, y2: number, o?: LineOpts) { this.ensure().line(x1, y1, x2, y2, o); return this }
    circle(cx: number, cy: number, r: number, o?: CircleOpts) { this.ensure().circle(cx, cy, r, o); return this }
    image(d: Uint8Array, x: number, y: number, o?: ImageOpts) { this.ensure().image(d, x, y, o); return this }
    link(t: string, url: string, x: number, y: number, o?: LinkOpts) { this.ensure().link(t, url, x, y, o); return this }
    table(data: string[][], x: number, y: number, o: TableOpts) { this.ensure().table(data, x, y, o); return this }
    getBoundingElements() { return this.ensure().getBoundingElements(); }

    private ensure() {
        if (!this.cur) {
            this.page();
        }
        return this.cur!
    }

    build(): Uint8Array {
        const s = new Stream(), offsets: number[] = [0]
        let oid = 0

        s.l('%PDF-1.4').l('%\xB5\xB5\xB5\xB5')

        const allFonts = new Set<string>(); this.pages.forEach(p => p.f.forEach(f => allFonts.add(f)))
        const fontArr = Array.from(allFonts)
        const fontIds: Record<string, number> = {}
        for (const f of fontArr) { const id = ++oid; fontIds[f] = id; offsets[id] = s.size(); s.l(`${id} 0 obj`).l(`<</Type/Font/Subtype/Type1/BaseFont/${f}/Encoding/WinAnsiEncoding>>`).l('endobj') }

        const contentIds: number[] = [], annotIds: number[][] = [], imgIds: number[][] = []
        for (const p of this.pages) {
            const pImgIds: number[] = []
            for (const img of p.imgs) { const id = ++oid; pImgIds.push(id); offsets[id] = s.size(); const data = String.fromCharCode(...img.d); s.l(`${id} 0 obj`).l(`<</Type/XObject/Subtype/Image/Width ${img.w}/Height ${img.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${img.d.length}>>`).l('stream').w(data).l('').l('endstream').l('endobj') }
            imgIds.push(pImgIds)
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
            const fRef = Array.from(p.f).map(f => `/${f.replace('-', '')} ${fontIds[f]} 0 R`).join('')
            const iRef = p.imgs.map((img, j) => `/${img.id} ${imgIds[i][j]} 0 R`).join('')
            const aRef = annotIds[i].length ? `/Annots[${annotIds[i].map(id => `${id} 0 R`).join(' ')}]` : ''
            offsets[pid] = s.size()
            s.l(`${pid} 0 obj`).l(`<</Type/Page/Parent ${pagesId} 0 R/MediaBox[0 0 ${p.w} ${p.h}]/Contents ${contentIds[i]} 0 R/Resources<<${fRef ? `/Font<<${fRef}>>` : ''}${iRef ? `/XObject<<${iRef}>>` : ''}>>${aRef}>>`).l('endobj')
        }

        let infoId = 0
        if (this.meta) {
            infoId = ++oid; offsets[infoId] = s.size()
            const d = new Date(), date = `D:${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
            const m = this.meta
            s.l(`${infoId} 0 obj`).l(`<<${m.title ? `/Title(${esc(m.title)})` : ''}${m.author ? `/Author(${esc(m.author)})` : ''}${m.subject ? `/Subject(${esc(m.subject)})` : ''}${m.keywords ? `/Keywords(${esc(m.keywords)})` : ''}${m.creator ? `/Creator(${esc(m.creator)})` : ''}/Producer(${this.producer})/CreationDate(${date})>>`).l('endobj')
        }

        const catId = ++oid; offsets[catId] = s.size()
        s.l(`${catId} 0 obj`).l(`<</Type/Catalog/Pages ${pagesId} 0 R>>`).l('endobj')

        const xref = s.size()
        s.l('xref').l(`0 ${oid + 1}`).l('0000000000 65535 f ')
        for (let i = 1; i <= oid; i++) s.l(`${offsets[i].toString().padStart(10, '0')} 00000 n `)
        s.l('trailer').l(`<</Size ${oid + 1}/Root ${catId} 0 R${infoId ? `/Info ${infoId} 0 R` : ''}>>`).l('startxref').l(xref.toString()).l('%%EOF')
        return s.out()
    }
}