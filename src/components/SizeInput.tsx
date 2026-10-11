import type { LengthUnit, ProductSize } from '../lib/types'
import { sizeText } from '../lib/sizeScale'
import { NumberInput } from './page'
import { Select } from './ui'

/* ---------------------------------------------------------------------------
 * Length × breadth × height with a unit. With `choices`, a list of sizes used
 * before (and the product's usual size) is offered first; picking one fills
 * the boxes, and any box can still be typed.
 * ------------------------------------------------------------------------- */

export const blankSize = (unit: LengthUnit = 'mm'): ProductSize => ({ length: null, breadth: null, height: null, unit })

export function SizeInput({
  value,
  onChange,
  choices = [],
  label = 'Size',
}: {
  value: ProductSize | null | undefined
  onChange: (v: ProductSize) => void
  choices?: Array<{ size: ProductSize; label: string }>
  label?: string
}) {
  const v = value ?? blankSize()
  const set = (patch: Partial<ProductSize>) => onChange({ ...v, ...patch })
  const current = sizeText(v)
  return (
    <div className="space-y-2">
      {choices.length ? (
        <Select
          aria-label={`${label}: sizes used before`}
          value={choices.some((c) => sizeText(c.size) === current) ? current : ''}
          onChange={(e) => {
            const c = choices.find((x) => sizeText(x.size) === e.target.value)
            if (c) onChange({ ...c.size })
          }}
        >
          <option value="">{current ? 'A new size (typed below)' : 'Choose a size used before, or type below…'}</option>
          {choices.map((c) => (
            <option key={c.label + sizeText(c.size)} value={sizeText(c.size)}>
              {c.label}
            </option>
          ))}
        </Select>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <NumberInput aria-label={`${label} length`} value={v.length} onChange={(n) => set({ length: n })} placeholder="Length" className="w-24" />
        <span className="text-muted" aria-hidden="true">
          ×
        </span>
        <NumberInput aria-label={`${label} breadth`} value={v.breadth} onChange={(n) => set({ breadth: n })} placeholder="Breadth" className="w-24" />
        <span className="text-muted" aria-hidden="true">
          ×
        </span>
        <NumberInput aria-label={`${label} height`} value={v.height} onChange={(n) => set({ height: n })} placeholder="Height" className="w-24" />
        <Select aria-label={`${label} unit`} value={v.unit} onChange={(e) => set({ unit: e.target.value as LengthUnit })} className="w-20">
          <option value="mm">mm</option>
          <option value="cm">cm</option>
          <option value="in">inch</option>
        </Select>
      </div>
    </div>
  )
}
