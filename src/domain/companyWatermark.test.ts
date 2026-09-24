import { describe, expect, it } from 'vitest'
import { buildEmptyDB } from '../lib/defaults'
import { watermarkOn } from '../lib/brand'
import { ADMIN, BILLING_ONLY, RETIRED_UNIT, ctxFor, must } from '../test/fixtures'
import { saveCompanyProfile } from './system'

const draft = (documentWatermark?: boolean) => ({
  name: 'Vertex Print Pack',
  address: 'Sivakasi',
  phone: '',
  email: '',
  gstin: '33AMQPA8484N1ZE',
  invoicePrefix: 'INV',
  bankDetails: '',
  invoiceTerms: '',
  documentWatermark,
})

describe('the document watermark setting', () => {
  it('is on for a fresh database', () => {
    expect(watermarkOn(buildEmptyDB().company)).toBe(true)
  })

  it('is saved with the company profile and applies to everyone', () => {
    const off = must(saveCompanyProfile(draft(false))(buildEmptyDB(), ctxFor(ADMIN[0])))
    expect(off.value.documentWatermark).toBe(false)
    expect(watermarkOn(off.db.company)).toBe(false)
    const on = must(saveCompanyProfile({ ...draft(true), expectedUpdatedAt: off.value.updatedAt })(off.db, ctxFor(ADMIN[0])))
    expect(watermarkOn(on.db.company)).toBe(true)
  })

  it('stays with Administrator 1 — no other account may change it', () => {
    const db = buildEmptyDB()
    for (const actor of [ADMIN[1], BILLING_ONLY, RETIRED_UNIT]) expect(saveCompanyProfile(draft(false))(db, ctxFor(actor)).ok).toBe(false)
  })
})
