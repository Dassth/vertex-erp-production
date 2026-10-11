import { describe, expect, it } from 'vitest'
import { buildEmptyDB } from '../lib/defaults'
import { blankMaterialDraft, saveMaterial } from './master'
import { saveSupplier } from './suppliers'
import { ADMIN, NOW, ctxFor, must } from '../test/fixtures'

describe('suppliers', () => {
  it('a supplier named on a material is added by itself; renaming it keeps the material linked', () => {
    let db = buildEmptyDB(NOW)
    db = must(saveMaterial({ ...blankMaterialDraft('sheet'), name: 'Duplex board', supplier: 'Ganesh Paper Mart' })(db, ctxFor(ADMIN[0]))).db
    db = must(saveMaterial({ ...blankMaterialDraft('quantity'), name: 'PVA glue', uom: 'kg', supplier: 'ganesh paper mart' })(db, ctxFor(ADMIN[0]))).db
    expect(db.suppliers.map((s) => [s.code, s.name])).toEqual([['SUP-0001', 'Ganesh Paper Mart']])
    const s = db.suppliers[0]
    const renamed = must(saveSupplier({ id: s.id, name: 'Ganesh Paper Mart Pvt Ltd', contactPerson: 'Ravi', phone: '98400 00000', email: 'ravi@example.com', address: 'Sivakasi', gstin: '', notes: '', expectedUpdatedAt: s.updatedAt })(db, ctxFor(ADMIN[0])))
    expect(renamed.db.materials.find((m) => m.name === 'Duplex board')!.supplier).toBe('Ganesh Paper Mart Pvt Ltd')
    expect(saveSupplier({ id: '', name: 'ganesh paper mart pvt ltd', contactPerson: '', phone: '', email: '', address: '', gstin: '', notes: '' })(renamed.db, ctxFor(ADMIN[0])).ok).toBe(false)
    expect(saveSupplier({ id: '', name: 'X', contactPerson: '', phone: '', email: 'not-an-email', address: '', gstin: '', notes: '' })(renamed.db, ctxFor(ADMIN[0])).ok).toBe(false)
  })
})
