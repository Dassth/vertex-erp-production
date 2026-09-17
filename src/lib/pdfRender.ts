/* ---------------------------------------------------------------------------
 * Browser PDF rendering. Loaded on demand (dynamic import) together with
 * pdfmake and the embedded Noto Sans Tamil fonts, so none of it is part of the
 * initial bundle. External resources are blocked: documents may only use the
 * embedded fonts.
 * ------------------------------------------------------------------------- */

import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import regularUrl from '../assets/fonts/NotoSansTamil-Regular.ttf?url'
import boldUrl from '../assets/fonts/NotoSansTamil-Bold.ttf?url'
import { FONT_FAMILY, FONT_FILES } from './pdfDocs'

interface PdfMakeBrowser {
  addVirtualFileSystem(vfs: Record<string, string>): void
  addFonts(fonts: Record<string, typeof FONT_FILES>): void
  setUrlAccessPolicy(callback: (url: string) => boolean): void
  createPdf(definition: TDocumentDefinitions): { getBlob(): Promise<Blob> }
}

async function fontBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load PDF font (${response.status}).`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

let engine: Promise<PdfMakeBrowser> | null = null

function loadEngine(): Promise<PdfMakeBrowser> {
  if (!engine) {
    engine = (async () => {
      const mod = (await import('pdfmake/build/pdfmake')) as unknown as { default?: PdfMakeBrowser } & PdfMakeBrowser
      const pdfMake = mod.default ?? mod
      const [regular, bold] = await Promise.all([fontBase64(regularUrl), fontBase64(boldUrl)])
      pdfMake.addVirtualFileSystem({ [FONT_FILES.normal]: regular, [FONT_FILES.bold]: bold })
      pdfMake.addFonts({ [FONT_FAMILY]: FONT_FILES })
      pdfMake.setUrlAccessPolicy(() => false)
      return pdfMake
    })().catch((error: unknown) => {
      engine = null // allow a retry after a network hiccup
      throw error
    })
  }
  return engine
}

export async function renderPdf(definition: TDocumentDefinitions): Promise<Blob> {
  const pdfMake = await loadEngine()
  return pdfMake.createPdf(definition).getBlob()
}

/** Save a generated file through the browser's standard download mechanism. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
