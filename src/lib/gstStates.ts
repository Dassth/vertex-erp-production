/* ---------------------------------------------------------------------------
 * Indian states and union territories with their GST state codes (the first
 * two digits of a GSTIN), and turning what people typed ("Tamil Nadu",
 * "tamilnadu", "TN", "33", "33-Tamil Nadu") into the 2-digit code.
 * ------------------------------------------------------------------------- */

export interface GstState {
  code: string
  name: string
  /** Other spellings and short forms people type. */
  aliases: string[]
}

export const GST_STATES: GstState[] = [
  { code: '01', name: 'Jammu and Kashmir', aliases: ['jk', 'j&k', 'jammu & kashmir', 'jammu kashmir'] },
  { code: '02', name: 'Himachal Pradesh', aliases: ['hp'] },
  { code: '03', name: 'Punjab', aliases: ['pb'] },
  { code: '04', name: 'Chandigarh', aliases: ['ch'] },
  { code: '05', name: 'Uttarakhand', aliases: ['uk', 'uttaranchal'] },
  { code: '06', name: 'Haryana', aliases: ['hr'] },
  { code: '07', name: 'Delhi', aliases: ['dl', 'new delhi', 'nct of delhi'] },
  { code: '08', name: 'Rajasthan', aliases: ['rj'] },
  { code: '09', name: 'Uttar Pradesh', aliases: ['up'] },
  { code: '10', name: 'Bihar', aliases: ['br'] },
  { code: '11', name: 'Sikkim', aliases: ['sk'] },
  { code: '12', name: 'Arunachal Pradesh', aliases: ['ar'] },
  { code: '13', name: 'Nagaland', aliases: ['nl'] },
  { code: '14', name: 'Manipur', aliases: ['mn'] },
  { code: '15', name: 'Mizoram', aliases: ['mz'] },
  { code: '16', name: 'Tripura', aliases: ['tr'] },
  { code: '17', name: 'Meghalaya', aliases: ['ml'] },
  { code: '18', name: 'Assam', aliases: ['as'] },
  { code: '19', name: 'West Bengal', aliases: ['wb'] },
  { code: '20', name: 'Jharkhand', aliases: ['jh'] },
  { code: '21', name: 'Odisha', aliases: ['od', 'or', 'orissa'] },
  { code: '22', name: 'Chhattisgarh', aliases: ['cg', 'ct', 'chattisgarh'] },
  { code: '23', name: 'Madhya Pradesh', aliases: ['mp'] },
  { code: '24', name: 'Gujarat', aliases: ['gj'] },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', aliases: ['dnhdd', 'dadra and nagar haveli', 'daman and diu', 'daman & diu', 'dn', 'dd'] },
  { code: '27', name: 'Maharashtra', aliases: ['mh'] },
  { code: '28', name: 'Andhra Pradesh (old)', aliases: [] },
  { code: '29', name: 'Karnataka', aliases: ['ka'] },
  { code: '30', name: 'Goa', aliases: ['ga'] },
  { code: '31', name: 'Lakshadweep', aliases: ['ld'] },
  { code: '32', name: 'Kerala', aliases: ['kl'] },
  { code: '33', name: 'Tamil Nadu', aliases: ['tn', 'tamilnadu', 'tamil nadu state'] },
  { code: '34', name: 'Puducherry', aliases: ['py', 'pondicherry', 'pondy'] },
  { code: '35', name: 'Andaman and Nicobar Islands', aliases: ['an', 'andaman & nicobar', 'andaman and nicobar'] },
  { code: '36', name: 'Telangana', aliases: ['ts', 'tg'] },
  { code: '37', name: 'Andhra Pradesh', aliases: ['ap', 'andhra'] },
  { code: '38', name: 'Ladakh', aliases: ['la'] },
  { code: '97', name: 'Other Territory', aliases: ['ot', 'other territory'] },
]

const squash = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

const LOOKUP: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const s of GST_STATES) {
    m.set(s.code, s.code)
    m.set(String(Number(s.code)), s.code)
    m.set(squash(s.name), s.code)
    for (const a of s.aliases) m.set(squash(a), s.code)
  }
  return m
})()

/** The GST state code for what was typed, or null when it cannot be matched. */
export function stateCodeFrom(text: string | null | undefined): string | null {
  const t = (text ?? '').trim()
  if (!t) return null
  const direct = LOOKUP.get(squash(t))
  if (direct) return direct
  // "33 - Tamil Nadu", "Tamil Nadu (33)", "33, Tamil Nadu": a code inside the text, if it agrees with any name given.
  const code = /\b(\d{1,2})\b/.exec(t)?.[1]
  const byCode = code ? LOOKUP.get(String(Number(code))) : undefined
  const words = squash(t.replace(/\d+/g, ''))
  const byName = words ? LOOKUP.get(words) : undefined
  if (byCode && (!byName || byName === byCode)) return byCode
  return byName ?? null
}

export function stateName(code: string | null | undefined): string {
  return GST_STATES.find((s) => s.code === code)?.name ?? ''
}

/** "33 — Tamil Nadu", or what was stored when it is not a known code. */
export function stateLabel(value: string | null | undefined): string {
  const code = stateCodeFrom(value)
  return code ? `${code} — ${stateName(code)}` : (value ?? '').trim()
}
