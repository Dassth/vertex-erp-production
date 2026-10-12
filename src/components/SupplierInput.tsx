import { useState } from 'react'
import { useStore } from '../store/store'
import type { Supplier } from '../lib/types'
import { blankSupplier } from '../domain/suppliers'
import { SupplierEditor } from '../features/master/suppliers/SuppliersPage'
import { Picker } from './Picker'

/**
 * A supplier: click to see all suppliers, type to search, or press
 * "New supplier" to add one with its phone and GSTIN. A typed name that is not
 * in the list is still kept — it is added to Master → Suppliers when the
 * record is saved.
 */
export function SupplierInput({
  value,
  onChange,
  onPick,
  name,
  placeholder = 'Choose or type a supplier…',
  'aria-invalid': invalid,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  onPick?: (s: Supplier) => void
  name?: string
  placeholder?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}) {
  const { db, can } = useStore()
  const [creating, setCreating] = useState<string | null>(null)
  const options = (db.suppliers ?? [])
    .filter((s) => s.active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ id: s.id, label: s.name, detail: [s.contactPerson, s.phone].filter(Boolean).join(' · '), keywords: `${s.code} ${s.gstin}`, item: s }))
  return (
    <>
      <Picker
        noun="supplier"
        name={name}
        value={value}
        options={options}
        onText={onChange}
        onPick={(o) => onPick?.(o.item)}
        onNew={can('master') ? (typed) => setCreating(typed) : undefined}
        placeholder={placeholder}
        invalid={invalid}
        aria-label={ariaLabel}
      />
      {creating !== null ? (
        <SupplierEditor
          draft={blankSupplier(creating)}
          onClose={() => setCreating(null)}
          onSaved={(s) => {
            onChange(s.name)
            onPick?.(s)
          }}
        />
      ) : null}
    </>
  )
}
