import type { CostingInputs, CostingIssue, Material, Product, ProductMaterial, VertexDB } from '../../lib/types'
import { computeOrderCosting, materialConfigIssues, usageConfigIssues } from '../../lib/costing'
import type { CostingSource } from '../../lib/costing'

export const NO_PRICING_INPUTS: CostingInputs = {
  profitMethod: 'markup',
  profitPct: 0,
  taxPct: 0,
  charges: [],
  discountType: 'amount',
  discountValue: 0,
}

/** Configuration errors that would block costing this product (checked at 1,000 pcs). */
export function productIssues(db: VertexDB, product: CostingSource): CostingIssue[] {
  return computeOrderCosting({
    quantity: 1000,
    product,
    materials: db.materials,
    settings: db.settings,
    inputs: NO_PRICING_INPUTS,
  }).issues.filter((i) => i.level === 'error')
}

export interface MaterialUsage {
  product: Product
  line: ProductMaterial
  issues: string[]
}

export interface MaterialRow {
  material: Material
  usages: MaterialUsage[]
  issues: string[]
  usageIssueCount: number
  missingPrice: boolean
  needsConfig: boolean
  unused: boolean
}

export function materialRows(db: VertexDB): MaterialRow[] {
  return db.materials.map((material) => {
    const usages: MaterialUsage[] = []
    for (const product of db.products) {
      for (const line of product.materials) {
        if (line.materialId === material.id) usages.push({ product, line, issues: usageConfigIssues(line, material) })
      }
    }
    const issues = materialConfigIssues(material)
    const usageIssueCount = usages.reduce((n, u) => n + u.issues.length, 0)
    return {
      material,
      usages,
      issues,
      usageIssueCount,
      missingPrice: material.price === null,
      needsConfig: issues.some((i) => i !== 'Price missing') || usageIssueCount > 0,
      unused: usages.length === 0,
    }
  })
}

export function stageLabel(product: Pick<Product, 'stages'>, stageId: string | null): string {
  if (!stageId) return 'Whole product'
  const idx = product.stages.findIndex((s) => s.id === stageId)
  if (idx < 0) return 'Removed stage'
  return `${idx + 1}. ${product.stages[idx].name || 'Unnamed stage'}`
}

export function processLabel(product: Pick<Product, 'stages'>, processId: string | null): string {
  if (!processId) return ''
  for (const s of product.stages) {
    const p = s.processes.find((x) => x.id === processId)
    if (p) return p.name || 'Unnamed process'
  }
  return 'Removed process'
}
