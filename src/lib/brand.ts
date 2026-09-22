/* The maker's mark. It appears at the foot of every screen and every document. */
export const BRAND = 'Back Moon Devs'
export const POWERED_BY = `Powered by ${BRAND}`

/**
 * Whether internal documents carry the mark. Customer and government documents
 * (tax invoice, cumulative summary, GST and invoice reports) never do: they are
 * read by the customer, their auditor and the department.
 */
export const watermarkOn = (company: { documentWatermark?: boolean }): boolean => company.documentWatermark !== false
