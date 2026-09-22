/* ---------------------------------------------------------------------------
 * Operational configuration the application needs to run — and nothing else.
 *
 * There is deliberately NO business data here: no products, materials,
 * customers, plans, costings, orders, dispatches or invoices. A fresh database
 * starts empty and everything is entered through Master and the workflow.
 *
 * Accounts carry placeholder identities only (no real employee details) and no
 * password — each account chooses its password on first sign-in.
 * ------------------------------------------------------------------------- */

import type { AdminTier, CompanyProfile, CostingSettings, ProductionUnit, User, VertexDB } from './types'

export const DB_VERSION = 2 as const

export const DEFAULT_UNITS: ProductionUnit[] = [
  { id: 'U1', name: 'Unit 1', shortName: 'Unit 1', speciality: 'Production unit 1', dailyCapacityJobs: 5 },
  { id: 'U2', name: 'Unit 2', shortName: 'Unit 2', speciality: 'Production unit 2', dailyCapacityJobs: 5 },
  { id: 'U3', name: 'Unit 3', shortName: 'Unit 3', speciality: 'Production unit 3', dailyCapacityJobs: 5 },
  { id: 'U4', name: 'Unit 4', shortName: 'Unit 4', speciality: 'Production unit 4', dailyCapacityJobs: 5 },
]

function account(
  id: string,
  name: string,
  email: string,
  role: User['role'],
  unitId: string | null,
  designation: string,
  initials: string,
  adminTier: AdminTier | null = null,
): User {
  return {
    id,
    name,
    email,
    role,
    unitId,
    adminTier,
    designation,
    initials,
    passwordHash: null,
    passwordSalt: null,
    passwordSetAt: null,
    active: true,
  }
}

/** Three administrators with separate identities AND different access. */
export const DEFAULT_USERS: User[] = [
  account('USR-ADM1', 'Administrator 1', 'admin1@vertex.local', 'admin', null, 'Workflow administrator', 'A1', 'full'),
  account('USR-ADM2', 'Administrator 2', 'admin2@vertex.local', 'admin', null, 'Production & dispatch', 'A2', 'operations'),
  account('USR-ADM3', 'Administrator 3', 'admin3@vertex.local', 'admin', null, 'Billing', 'A3', 'billing'),
  account('USR-U1', 'Unit 1 Supervisor', 'unit1@vertex.local', 'unit', 'U1', 'Unit 1 shop floor', 'U1'),
  account('USR-U2', 'Unit 2 Supervisor', 'unit2@vertex.local', 'unit', 'U2', 'Unit 2 shop floor', 'U2'),
  account('USR-U3', 'Unit 3 Supervisor', 'unit3@vertex.local', 'unit', 'U3', 'Unit 3 shop floor', 'U3'),
  account('USR-U4', 'Unit 4 Supervisor', 'unit4@vertex.local', 'unit', 'U4', 'Unit 4 shop floor', 'U4'),
]

export function defaultCompany(): CompanyProfile {
  return {
    name: 'Vertex Print Pack',
    address: '',
    phone: '',
    email: '',
    gstin: '',
    invoicePrefix: 'INV',
    bankDetails: '',
    invoiceTerms: 'Goods once dispatched will not be taken back. Subject to local jurisdiction.',
    documentWatermark: true,
    updatedAt: null,
    updatedBy: null,
  }
}

export function defaultSettings(): CostingSettings {
  return {
    taxLabel: 'GST',
    taxPct: 18,
    profitMethod: 'markup',
    profitPct: 20,
    bufferHours: 6,
    processCharges: [],
    orderCharges: [],
    updatedAt: null,
    updatedBy: null,
  }
}

export function emptyCounters(): VertexDB['counters'] {
  return { material: 0, product: 0, customer: 0, plan: 0, costing: 0, order: 0, dispatch: 0, invoice: 0, purchase: 0, person: 0, machine: 0 }
}

export function buildEmptyDB(now: Date = new Date()): VertexDB {
  return {
    version: DB_VERSION,
    revision: 0,
    createdAt: now.toISOString(),
    migrations: [],
    company: defaultCompany(),
    settings: defaultSettings(),
    units: DEFAULT_UNITS.map((u) => ({ ...u })),
    people: [],
    machines: [],
    users: DEFAULT_USERS.map((u) => ({ ...u })),
    materials: [],
    products: [],
    customers: [],
    plans: [],
    costings: [],
    orders: [],
    dispatches: [],
    invoices: [],
    purchases: [],
    notifications: [],
    audit: [],
    counters: emptyCounters(),
  }
}
