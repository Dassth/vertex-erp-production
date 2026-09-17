/* JSON that keeps non-finite numbers (a half-typed NaN stays NaN instead of becoming null). */

const NON_FINITE = '$nonFinite'

export function toWire(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? { [NON_FINITE]: String(v) } : v))
}

export function fromWire<T>(text: string): T {
  return JSON.parse(text, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && NON_FINITE in v) return Number(v[NON_FINITE])
    return v
  }) as T
}
