export class Stream {
    private c: Uint8Array[] = []
    private s = 0
    private e = new TextEncoder()
    w(d: string | Uint8Array) { const c = typeof d === 'string' ? this.e.encode(d) : d; this.c.push(c); this.s += c.length; return this }
    l(d: string) { return this.w(d + '\n') }
    size() { return this.s }
    out() { const r = new Uint8Array(this.s); let o = 0; for (const c of this.c) { r.set(c, o); o += c.length } return r }
}