/* ---------------------------------------------------------------------------
 * Vertex ERP — domain model (schema v2)
 *
 * Operational sequence:
 *   Master setup → Planning → Order Costing → Production → Dispatch → Billing
 *
 * Master records (products, materials, customers, costing configuration) are
 * live and editable. Every operational document that must stay historically
 * stable (finalized costing, production order, invoice) carries its own
 * snapshot, so later Master edits never rewrite confirmed records.
 * ------------------------------------------------------------------------- */

export type Role = 'admin' | 'unit'
/** Administrators are not equal: each tier sees a different slice of the workflow. */
export type AdminTier = 'full' | 'operations' | 'billing'
export type UnitId = string
export type Priority = 'Low' | 'Normal' | 'High' | 'Urgent'
export type LengthUnit = 'mm' | 'cm' | 'in'

export interface Stamp {
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

/* ------------------------------ Accounts --------------------------------- */

export interface User {
  id: string
  name: string
  email: string
  role: Role
  /** Only set for unit users — the production unit whose process work they update. */
  unitId: UnitId | null
  /** Only set for administrators. Decides which modules the account can reach. */
  adminTier: AdminTier | null
  designation: string
  initials: string
  /** PBKDF2 hash. `null` means the account has not chosen a password yet. */
  passwordHash: string | null
  passwordSalt: string | null
  passwordSetAt: string | null
  active: boolean
}

export interface ProductionUnit {
  id: UnitId
  name: string
  shortName: string
  speciality: string
  dailyCapacityJobs: number
}

/** Someone who performs or takes responsibility for process work in one unit.
 *  A responsible person does not need a login account. */
export interface UnitPerson extends Stamp {
  id: string
  unitId: UnitId
  name: string
  designation: string
  active: boolean
}

/** A machine belonging to one unit, selectable for processes that need one. */
export interface UnitMachine extends Stamp {
  id: string
  unitId: UnitId
  code: string
  name: string
  active: boolean
}

export interface CompanyProfile {
  name: string
  address: string
  phone: string
  email: string
  gstin: string
  /** Invoice number prefix, e.g. INV → INV/2026-27/0001 */
  invoicePrefix: string
  bankDetails: string
  invoiceTerms: string
  updatedAt: string | null
  updatedBy: string | null
}

/* ------------------------------ Materials -------------------------------- */

/** `sheet` materials are consumed as cut pieces from a source sheet (yield/ups
 *  applies). `quantity` materials are consumed per finished piece. */
export type MaterialKind = 'sheet' | 'quantity'

/**
 * per_unit — price per consumption unit (per sheet, per kg of adhesive, per nos)
 * per_pack — price per pack of `packSize` consumption units (e.g. ream of 500 sheets)
 * per_kg   — sheet materials bought by weight; needs GSM and sheet size
 */
export type PricingBasis = 'per_unit' | 'per_pack' | 'per_kg'

export interface Material extends Stamp {
  id: string
  code: string
  name: string
  kind: MaterialKind
  /** Consumption unit. Always `sheet` for sheet materials. */
  uom: string
  /** `null` = price not entered yet. `0` = explicitly free. */
  price: number | null
  pricingBasis: PricingBasis
  packSize: number | null
  gsm: number | null
  /** Display/entry unit for sizes. Stored values are always millimetres. */
  sizeUnit: LengthUnit
  sheetLengthMm: number | null
  sheetWidthMm: number | null
  /** Trim allowance kept clear on all four edges of the sheet. */
  edgeMarginMm: number
  /** Cutting gap between adjacent pieces. */
  cutGapMm: number
  /** Applied once, to net consumption (net sheets for sheet materials). */
  wastagePct: number
  /** Purchase quantity is rounded up to a multiple of this, in priced units. */
  purchaseMultiple: number
  supplier: string
  notes: string
  active: boolean
  priceUpdatedAt: string | null
  priceUpdatedBy: string | null
  /** `candidate` = researched option awaiting grade, size and price confirmation. */
  approval?: 'approved' | 'candidate'
  /** Supplier-stated thickness. Kept separately from GSM — there is no universal conversion. */
  thicknessMm?: number | null
  /** Stable identifier when the material came from an import. */
  importKey?: string | null
}

/* ------------------------------- Products -------------------------------- */

export type CostBasis = 'per_1000' | 'per_piece' | 'per_hour' | 'fixed'

export interface ProductProcess {
  id: string
  name: string
  description: string
  /** Changeover / make-ready hours, independent of quantity. `null` = not measured yet (blocks costing). */
  setupHours: number | null
  /** Run hours for every 1,000 finished pieces. */
  runHoursPer1000: number | null
  /** Reusable process charge from Master → Costing. When null the custom rate below applies. */
  chargeId: string | null
  costBasis: CostBasis
  /** `null` = not configured (blocks costing). `0` = explicitly no charge. */
  rate: number | null
  setupCharge: number | null
  /** Machine-bound work. Manual processes are run with "No machine required". */
  requiresMachine: boolean
  /** Selected production method (e.g. in-house digital print, outsourced). Empty = not selected yet. */
  method?: string
}

export interface ProductStage {
  id: string
  name: string
  description: string
  processes: ProductProcess[]
}

export interface ProductMaterial {
  id: string
  materialId: string
  stageId: string | null
  processId: string | null
  /** Quantity materials: consumption per finished piece, in the material's uom. `null` = not measured yet. */
  qtyPerPiece: number | null
  /** Sheet materials: cut pieces required for one finished piece. `null` = cut list not approved yet. */
  piecesPerProduct: number | null
  cutLengthMm: number | null
  cutWidthMm: number | null
  rotationAllowed: boolean
  /** Validated manual ups for layouts the grid calculation does not support. */
  upsOverride: number | null
  upsOverrideReason: string
  note: string
}

export interface Product extends Stamp {
  id: string
  code: string
  name: string
  category: string
  description: string
  hsn: string
  uom: string
  stages: ProductStage[]
  materials: ProductMaterial[]
  /** Product-specific tax rate; `null` uses the Master → Costing default. */
  taxPct: number | null
  active: boolean
  /** Incremented on every edit so plans can detect a changed definition. */
  version: number
  /** Customer specification and provenance; `null` for products entered directly. */
  spec?: ProductSpec | null
}

export type SpecStatus = 'proposed' | 'confirmed'

/**
 * What the customer actually supplied, kept apart from what was proposed.
 * Unknown values stay null — a raw size string is never converted into
 * millimetres or cutting dimensions.
 */
export interface ProductSpec {
  /** Stable identifier of the import row, so a repeated import never duplicates the product. */
  importKey: string | null
  status: SpecStatus
  sourceRow: number | null
  /** Product name exactly as supplied (source spelling). */
  sourceName: string
  /** Size exactly as supplied, e.g. "2*8.5". Unit and dimension basis unknown. */
  rawSize: string
  sizeUnit: string | null
  dimensionBasis: 'internal' | 'external' | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  /** Customer's requested batch quantity — not a consumption figure. */
  requestedQty: number | null
  construction: string
  insertApproach: string
  aliases: string[]
  /** Confirmations still required before production costing. */
  openItems: string[]
  notes: string
}

/* --------------------------- Costing configuration ------------------------ */

export interface ProcessCharge extends Stamp {
  id: string
  name: string
  basis: CostBasis
  rate: number | null
  setupCharge: number | null
  active: boolean
}

export type ChargeBasis = 'fixed' | 'per_1000' | 'percent'

export interface OrderChargeTemplate {
  id: string
  name: string
  basis: ChargeBasis
  amount: number | null
  applyByDefault: boolean
  active: boolean
}

/** markup = profit as % of cost. margin = profit as % of selling price. */
export type ProfitMethod = 'markup' | 'margin'

export interface CostingSettings {
  taxLabel: string
  taxPct: number
  profitMethod: ProfitMethod
  profitPct: number
  /** Working hours kept free before the delivery date when scheduling. */
  bufferHours: number
  processCharges: ProcessCharge[]
  orderCharges: OrderChargeTemplate[]
  updatedAt: string | null
  updatedBy: string | null
}

/* ------------------------------- Customers ------------------------------- */

export interface Customer extends Stamp {
  id: string
  code: string
  company: string
  contactPerson: string
  phone: string
  email: string
  billingAddress: string
  deliveryAddress: string
  gstin: string
  placeOfSupply: string
  paymentTerms: string
  notes: string
  active: boolean
}

export type CustomerSnapshot = Pick<
  Customer,
  | 'id'
  | 'code'
  | 'company'
  | 'contactPerson'
  | 'phone'
  | 'email'
  | 'billingAddress'
  | 'deliveryAddress'
  | 'gstin'
  | 'placeOfSupply'
  | 'paymentTerms'
>

/* ------------------------------- Planning -------------------------------- */

export type PlanStatus = 'Draft' | 'Ready for Costing' | 'In Production' | 'Cancelled'

export interface Plan extends Stamp {
  id: string
  code: string
  customerId: string
  productId: string
  productVersion: number
  quantity: number
  orderDate: string
  deliveryDate: string
  priority: Priority
  customerRef: string
  dimensions: string
  options: string
  instructions: string
  /** Production unit per product PROCESS id — planning's allocation responsibility. */
  processUnits: Record<string, UnitId>
  /** Legacy stage-level allocation kept for plans created before process allocation. */
  stageUnits?: Record<string, UnitId>
  status: PlanStatus
  submittedAt: string | null
  submittedBy: string | null
  costingId: string | null
  orderId: string | null
}

/* ----------------------------- Order costing ----------------------------- */

export interface OrderChargeInput {
  id: string
  templateId: string | null
  name: string
  basis: ChargeBasis
  amount: number | null
}

export interface CostingInputs {
  profitMethod: ProfitMethod
  profitPct: number
  taxPct: number
  charges: OrderChargeInput[]
  discountType: 'amount' | 'percent'
  discountValue: number
}

export interface SheetLayout {
  sheetLengthMm: number
  sheetWidthMm: number
  cutLengthMm: number
  cutWidthMm: number
  edgeMarginMm: number
  cutGapMm: number
  rotationAllowed: boolean
  calculatedUps: number
  ups: number
  upsSource: 'calculated' | 'override'
  orientation: 'as-drawn' | 'rotated'
  across: number
  along: number
  overrideReason: string
  yieldPct: number
}

export interface MaterialCostLine {
  bomLineId: string
  materialId: string
  code: string
  name: string
  kind: MaterialKind
  uom: string
  stageName: string
  processName: string
  price: number | null
  pricingBasis: PricingBasis
  pricedUnitLabel: string
  sheet: SheetLayout | null
  /** Sheet materials: cut pieces needed. Quantity materials: equals netQty. */
  piecesNeeded: number
  netQty: number
  wastagePct: number
  wastageQty: number
  totalQty: number
  purchaseQty: number
  purchaseUnit: string
  /** Consumption units bought beyond the requirement because of purchase rounding. */
  surplusQty: number
  amount: number
}

export interface ProcessCostLine {
  stageId: string
  stageName: string
  processId: string
  processName: string
  chargeName: string | null
  basis: CostBasis
  rate: number | null
  setupCharge: number | null
  hours: number
  runCost: number
  setupCost: number
  amount: number
}

export interface ChargeCostLine {
  id: string
  name: string
  basis: ChargeBasis
  input: number | null
  amount: number
}

export interface CostingIssue {
  level: 'error' | 'warning'
  message: string
  fix?: { label: string; to: string }
}

export interface CostingResult {
  quantity: number
  materialLines: MaterialCostLine[]
  processLines: ProcessCostLine[]
  chargeLines: ChargeCostLine[]
  materialCost: number
  processRunCost: number
  setupCost: number
  chargesCost: number
  totalCost: number
  costPerPiece: number
  profitMethod: ProfitMethod
  profitPct: number
  sellingPerPiece: number
  totalSelling: number
  profitAmount: number
  effectiveMarkupPct: number
  effectiveMarginPct: number
  discountAmount: number
  taxableValue: number
  taxLabel: string
  taxPct: number
  taxAmount: number
  grandTotal: number
  issues: CostingIssue[]
  valid: boolean
}

export interface ProductSnapshot {
  id: string
  code: string
  name: string
  category: string
  hsn: string
  uom: string
  version: number
  stages: ProductStage[]
  materials: Array<ProductMaterial & { material: Material }>
}

export interface CostingSnapshot {
  takenAt: string
  takenBy: string
  customer: CustomerSnapshot
  product: ProductSnapshot
  processCharges: ProcessCharge[]
  plan: Pick<
    Plan,
    | 'code'
    | 'quantity'
    | 'orderDate'
    | 'deliveryDate'
    | 'priority'
    | 'customerRef'
    | 'dimensions'
    | 'options'
    | 'instructions'
    | 'processUnits'
    | 'stageUnits'
  >
  inputs: CostingInputs
  result: CostingResult
}

export type CostingStatus = 'Draft' | 'Finalized'

export interface OrderCosting extends Stamp {
  id: string
  code: string
  planId: string
  inputs: CostingInputs
  status: CostingStatus
  finalizedAt: string | null
  finalizedBy: string | null
  snapshot: CostingSnapshot | null
  orderId: string | null
}

/* ------------------------------- Production ------------------------------ */

/** A stage status is DERIVED from its processes; it is never set directly. */
export type StageStatus =
  | 'Scheduled'
  | 'In Progress'
  | 'Completed'
  | 'Completed by Progression'
  | 'Delayed'
  | 'Blocked'

export type ProcessStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Delayed' | 'Blocked'

/**
 * The unit of shop-floor work. Each process is allocated to a unit in Planning
 * and carries its own schedule, status and execution resources. Processes run
 * in their configured order; completing one never closes another.
 */
export interface JobProcess {
  id: string
  processDefId: string
  /** Parent job stage (this order) and the Master stage it came from. */
  stageId: string
  stageDefId: string
  stageName: string
  name: string
  /** Sequence inside the parent stage. */
  index: number
  unitId: UnitId
  status: ProcessStatus
  durationHours: number
  plannedStart: string
  plannedEnd: string
  actualStart?: string
  actualEnd?: string
  /** Execution resources, allocated by the assigned unit after planning. */
  responsiblePersonId: string | null
  machineId: string | null
  /** Configured in Master: this process cannot run without a machine. */
  requiresMachine: boolean
  /** The unit declared this process manual — no machine is needed. */
  noMachineRequired: boolean
  assignedBy?: string
  assignedAt?: string
  updatedBy?: string
  updatedAt?: string
  note?: string
  problem?: string
  done: boolean
  doneAt: string | null
  doneBy: string | null
  /**
   * Migrated from a stage-level record: per-process progress, operator, machine
   * and timings were never captured and are shown as not recorded.
   */
  historical?: boolean
}

export interface JobStage {
  id: string
  stageDefId: string
  index: number
  name: string
  description: string
  /** Legacy single-unit allocation. A stage can now span units — read its
   *  processes (see `stageUnitIds`) instead of this field. */
  unitId?: UnitId
  status: StageStatus
  plannedStart: string
  plannedEnd: string
  durationHours: number
  actualStart?: string
  actualEnd?: string
  updatedBy?: string
  updatedAt?: string
  note?: string
  problem?: string
  processes: JobProcess[]
}

export type JobHealth = 'On Time' | 'At Risk' | 'Delayed' | 'Completed'

export interface ProductionOrder {
  id: string
  code: string
  planId: string
  costingId: string
  customerId: string
  productId: string
  customer: CustomerSnapshot
  productCode: string
  productName: string
  hsn: string
  uom: string
  quantity: number
  orderDate: string
  deliveryDate: string
  priority: Priority
  customerRef: string
  dimensions: string
  options: string
  instructions: string
  stages: JobStage[]
  status: 'Active' | 'Completed'
  completedAt: string | null
  completedQty: number
  createdAt: string
  createdBy: string
}

/* --------------------------- Dispatch & billing -------------------------- */

export interface Dispatch {
  id: string
  code: string
  orderId: string
  seq: number
  date: string
  quantity: number
  deliveryAddress: string
  transporter: string
  vehicleNo: string
  notes: string
  invoiceId: string
  /** Idempotency key — a repeated confirmation with the same key returns this record. */
  requestId: string
  createdAt: string
  createdBy: string
  /** Set only when Administrator 1 or 2 confirms the customer received this shipment. Never inferred. */
  receivedAt?: string | null
  receivedBy?: string | null
}

export type CompanySnapshot = Omit<CompanyProfile, 'updatedAt' | 'updatedBy'>

export interface InvoiceLine {
  description: string
  hsn: string
  quantity: number
  uom: string
  rate: number
  amount: number
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  orderId: string
  dispatchId: string
  requestId: string
  company: CompanySnapshot
  customer: CustomerSnapshot
  deliveryAddress: string
  refs: {
    orderCode: string
    planCode: string
    costingCode: string
    dispatchCode: string
    customerRef: string
  }
  productName: string
  lines: InvoiceLine[]
  subtotal: number
  discount: number
  taxableValue: number
  taxLabel: string
  taxPct: number
  taxAmount: number
  cgst: number | null
  sgst: number | null
  igst: number | null
  total: number
  partial: {
    seq: number
    orderedQty: number
    previouslyDispatched: number
    thisQty: number
    remainingAfter: number
    isFinal: boolean
    isSingleFull: boolean
  }
  paymentTerms: string
  transporter: string
  vehicleNo: string
  notes: string
  allocationNote: string
  createdAt: string
  createdBy: string
  /** How the tax is split. Missing on older invoices, which behave as `auto`. */
  supplyType?: SupplyType
  /** Set when billing corrected the GST details after issue. */
  editedAt?: string | null
  editedBy?: string | null
}

/* ------------------------------- Purchases ------------------------------- */

/**
 * auto  — decided from the two GSTIN state codes (same state → CGST + SGST)
 * intra — within the state: CGST + SGST, half each
 * inter — another state: IGST
 */
export type SupplyType = 'auto' | 'intra' | 'inter'

export interface PurchaseLine {
  id: string
  description: string
  hsn: string
  quantity: number
  uom: string
  rate: number
  /** GST rate for this line, e.g. 18. Goods differ, so each line carries its own. */
  gstPct: number
}

/** A supplier's bill for something we bought. Always editable and downloadable. */
export interface PurchaseBill extends Stamp {
  id: string
  code: string
  supplierName: string
  supplierGstin: string
  supplierAddress: string
  /** The supplier's own invoice number, as printed on their bill. */
  supplierInvoiceNo: string
  date: string
  lines: PurchaseLine[]
  supplyType: SupplyType
  /** Round the net amount to the nearest rupee, as most bills do. */
  roundOff: boolean
  notes: string
}

/* ----------------------------- Notifications ----------------------------- */

export type NotifyLevel = 'info' | 'success' | 'warn' | 'danger'
export type NotifyAudience = 'admin' | 'unit' | 'all'
/** Which module an alert belongs to, so accounts only see their own modules. */
export type NotifyTopic = 'production' | 'dispatch' | 'billing'

export interface Notification {
  id: string
  key: string
  title: string
  message: string
  level: NotifyLevel
  audience: NotifyAudience
  /** Defaults to production for records written before topics existed. */
  topic?: NotifyTopic
  unitId?: UnitId
  orderId?: string
  createdAt: string
  read: boolean
}

/* -------------------------------- Audit log ------------------------------ */

export type AuditEntity =
  | 'Product'
  | 'Material'
  | 'Costing Config'
  | 'Customer'
  | 'Plan'
  | 'Costing'
  | 'Production Order'
  | 'Stage'
  | 'Process'
  | 'Resource'
  | 'Dispatch'
  | 'Invoice'
  | 'Purchase'
  | 'Account'
  | 'System'

export interface AuditEntry {
  id: string
  at: string
  userId: string
  user: string
  role: Role | 'system'
  action: string
  entity: AuditEntity
  entityId: string
  entityLabel: string
  field?: string
  oldValue?: string
  newValue?: string
  reason?: string
}

/* --------------------------------- Database ------------------------------ */

export type CounterKey =
  | 'material'
  | 'product'
  | 'customer'
  | 'plan'
  | 'costing'
  | 'order'
  | 'dispatch'
  | 'invoice'
  | 'purchase'
  | 'person'
  | 'machine'

export interface VertexDB {
  version: 2
  /** Incremented on every persisted write; used to detect newer data from other tabs. */
  revision: number
  createdAt: string
  migrations: string[]
  company: CompanyProfile
  settings: CostingSettings
  units: ProductionUnit[]
  people: UnitPerson[]
  machines: UnitMachine[]
  users: User[]
  materials: Material[]
  products: Product[]
  customers: Customer[]
  plans: Plan[]
  costings: OrderCosting[]
  orders: ProductionOrder[]
  dispatches: Dispatch[]
  invoices: Invoice[]
  purchases: PurchaseBill[]
  notifications: Notification[]
  audit: AuditEntry[]
  counters: Record<CounterKey, number>
}
