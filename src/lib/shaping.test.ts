import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/* The PDF renderer (pdfmake → pdfkit) lays text out with fontkit. This checks
   that fontkit's OpenType shaping of the bundled Noto Sans Tamil produces the
   same glyph sequence as HarfBuzz — the reference shaping engine used by
   browsers — for conjuncts, split vowel signs, Grantha letters and mixed
   Tamil/English text. */

const fontPath = path.resolve(__dirname, '../assets/fonts/NotoSansTamil-Regular.ttf')

const samples = [
  'தமிழ்',
  'கோயம்புத்தூர்',
  'ஸ்ரீ லட்சுமி பேக்கேஜிங்',
  'க்ஷேத்திரம் ஷ்ரீ',
  'கை கெ கே கொ கோ கௌ',
  'பொன்னுசாமி டிரேடர்ஸ், 12, காந்தி சாலை',
  'Tamil மற்றும் English ₹ 1,305.08',
]

describe('Tamil shaping used by PDF output', () => {
  it('matches HarfBuzz glyph-for-glyph', async () => {
    const bytes = fs.readFileSync(fontPath)
    const fontkitMod = (await import('fontkit')) as unknown as { create?: (b: Buffer) => unknown; default?: { create: (b: Buffer) => unknown } }
    const create = fontkitMod.create ?? fontkitMod.default!.create
    const fk = create(bytes) as { layout(s: string): { glyphs: Array<{ id: number }> }; hasGlyphForCodePoint(c: number): boolean }
    const hb = (await import('harfbuzzjs')) as unknown as {
      Blob: new (b: Uint8Array) => unknown
      Face: new (b: unknown, i: number) => unknown
      Font: new (f: unknown) => unknown
      Buffer: new () => {
        addText(s: string): void
        guessSegmentProperties(): void
        json?: () => Array<{ g: number }>
        getGlyphInfos?: () => Array<{ codepoint: number }>
      }
      shape(font: unknown, buf: unknown): void
    }
    const hbFont = new hb.Font(new hb.Face(new hb.Blob(new Uint8Array(bytes)), 0))

    for (const text of samples) {
      const buf = new hb.Buffer()
      buf.addText(text)
      buf.guessSegmentProperties()
      hb.shape(hbFont, buf)
      // After shaping, HarfBuzz stores glyph ids in `codepoint` (json() is absent in harfbuzzjs 1.6).
      const hbIds = buf.json ? buf.json().map((g) => g.g) : buf.getGlyphInfos!().map((g) => g.codepoint)
      expect(hbIds.length, text).toBeGreaterThan(0)
      expect(fk.layout(text).glyphs.map((g) => g.id), text).toEqual(hbIds)
    }
    for (const cp of [0x41, 0x20b9, 0x2014, 0x201c, 0x0bcc]) expect(fk.hasGlyphForCodePoint(cp)).toBe(true)
  })
})
