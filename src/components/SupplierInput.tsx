import { useId } from 'react'
import { useStore } from '../store/store'
import type { Supplier } from '../lib/types'
import { Input } from './ui'

/**
 * A supplier name with the known suppliers offered as you type. A new name is
 * fine — it is added to Master → Suppliers when the record is saved.
 */
export function SupplierInput({ value, onChange, onPick, ...rest }: { value: string; onChange: (v: string) => void; onPick?: (s: Supplier) => void; name?: string; placeholder?: string; 'aria-invalid'?: boolean }) {
  const { db } = useStore()
  const listId = useId()
  const suppliers = (db.suppliers ?? []).filter((s) => s.active)
  return (
    <>
      <Input
        {...rest}
        list={listId}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          const hit = suppliers.find((s) => s.name.trim().toLowerCase() === e.target.value.trim().toLowerCase())
          if (hit) onPick?.(hit)
        }}
      />
      <datalist id={listId}>
        {suppliers.map((s) => (
          <option key={s.id} value={s.name}>
            {[s.contactPerson, s.phone].filter(Boolean).join(' · ')}
          </option>
        ))}
      </datalist>
    </>
  )
}
