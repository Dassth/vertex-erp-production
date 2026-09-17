/* ---------------------------------------------------------------------------
 * Jewellery-box onboarding templates (batch "jewellery-boxes-2026-09").
 *
 * PROPOSED, NOT CONFIRMED. The customer supplied ten product names, a size
 * string for each (unit, height and inside/outside basis unknown) and a batch
 * quantity of 25. Everything else here — the magnetic rigid-box route, the
 * material families and the insert approaches — is a manufacturing proposal
 * drawn from two legacy BOMs (workflow reference only) and supplier research.
 *
 * Unknown numbers are null: no sheet sizes, cut sizes, consumption, times,
 * rates or prices are invented, and legacy prices are not imported.
 * ------------------------------------------------------------------------- */

import type { CostBasis, MaterialKind, ProductSpec } from '../types'

export const JEWELLERY_BATCH_ID = 'jewellery-boxes-2026-09'

/* ------------------------------ Materials --------------------------------- */

export interface MaterialTemplate {
  key: string
  name: string
  kind: MaterialKind
  /** Consumption unit for quantity materials (the unit is a proposal; the amount stays unknown). */
  uom: string
  supplier: string
  notes: string
}

const ref = (text: string) => `Reference only — not an approved specification or current price. ${text}`

export const JEWELLERY_MATERIALS: MaterialTemplate[] = [
  {
    key: 'board',
    name: 'Kappa / grey board — structural (grade to confirm)',
    kind: 'sheet',
    uom: 'sheet',
    supplier: 'Lead: Sowji Papers, Sivakasi (sowjipapers.com) — advertises kappa/grey board 1–4 mm, 650–2600 GSM.',
    notes: ref(
      'Confirm grade, thickness, GSM, measured sheet size, grain direction and price basis. Legacy Rakhi box (BOM 014, 20-04-2023) used "1.5MM-950GSM SANTHANAM BOARD 79X104CM" at Rs 50/sheet; the nominal 79×104 cm size is unverified. Thickness and GSM are kept separately — no conversion is assumed.',
    ),
  },
  {
    key: 'wrapper',
    name: 'Outer wrapper paper — printable art / specialty (grade to confirm)',
    kind: 'sheet',
    uom: 'sheet',
    supplier: 'Lead: Sona Papers, Chennai branch (sonapapers.com) — confirm wrapping/printing suitability for the chosen grade.',
    notes: ref(
      'Confirm grade, GSM, colour, print method, sheet size and finish. Legacy BOM 014 used digital printing on 454×316 mm sheets and thermal lamination; legacy MDF BOM 068 used 13×19 in 128 gsm art paper. Lamination is optional and not selected.',
    ),
  },
  {
    key: 'liner',
    name: 'Inner liner — paper / specialty paper / approved fabric (to select)',
    kind: 'sheet',
    uom: 'sheet',
    supplier: 'To be sourced once the substrate is chosen.',
    notes: ref('Confirm substrate, cut size, coverage and adhesive compatibility.'),
  },
  {
    key: 'insert-board',
    name: 'Insert support board — board-backed pad (thickness to confirm)',
    kind: 'sheet',
    uom: 'sheet',
    supplier: 'Lead: Sowji Papers, Sivakasi (board range) — thickness from the approved insert design.',
    notes: ref('Legacy BOM 014 used "1mm 633gsm Santhanam Board 79x104cm" for its coin insert (historical zero-rated line). The coin insert is not copied to these products.'),
  },
  {
    key: 'cushion',
    name: 'Cushioning foam — EVA / PU / EPE (grade to select)',
    kind: 'sheet',
    uom: 'sheet',
    supplier: 'Lead: Axiom Designs & Packaging, Chennai (axiomdesigns.in) — custom die-cut EVA/PU/PE foam. Jewellery-contact suitability must be sampled.',
    notes: ref(
      'One family, grade to select — alternatives are not charged together. Confirm grade, density/hardness, colour, thickness, dimensions and contact suitability. Legacy BOM 014 listed "EPE FOAM 6MMX1400X65METER @ 50/METER" as a zero-valued line; that is not a verified free material.',
    ),
  },
  {
    key: 'covering',
    name: 'Presentation covering — velvet / velour / satin (to select)',
    kind: 'quantity',
    uom: 'mtr',
    supplier: 'Lead: Rigid Boxes India, Sivakasi (rigidboxesindia.in) — offers velvet presentation options locally.',
    notes: ref('Confirm colour, backing, shedding, colour transfer and adhesion. Consumption per piece must be measured from the approved insert.'),
  },
  {
    key: 'magnet',
    name: 'Closure magnet — size and grade to confirm',
    kind: 'quantity',
    uom: 'nos',
    supplier: 'Lead: Star Trace, Chennai (startrace.in) — neodymium and other magnets; small packaging sizes need quotation.',
    notes: ref('Count follows the closure drawing — two per box is NOT assumed. Legacy BOM 014 used "MAGNET - 6MM X 1.5MM" at Rs 1.25 (20-04-2023).'),
  },
  {
    key: 'steel-counterpart',
    name: 'Steel counterpart for magnet closure (optional)',
    kind: 'quantity',
    uom: 'nos',
    supplier: 'To quote with the chosen magnet.',
    notes: ref('Alternative closure arrangement. Not linked to any product until the closure drawing selects it.'),
  },
  {
    key: 'corner-tape',
    name: 'Rigid-box corner stay tape — kraft / PET (to select)',
    kind: 'quantity',
    uom: 'mtr',
    supplier: 'Lead: Bandx Industries, Chennai (bandx.in) — kraft-paper and PET corner stay tapes.',
    notes: ref('Confirm tape type, width, length per box and machine compatibility. Legacy BOM 014 listed "Corner Tape -12mm" as a zero-valued line.'),
  },
  {
    key: 'adhesive',
    name: 'Adhesive — paper/board and lining bonding (grade to select)',
    kind: 'quantity',
    uom: 'kg',
    supplier: 'Lead: S P Associates, Chennai (gumpowders.com) — paper/board pasting and rigid-box adhesives.',
    notes: ref('Select a grade per bond (wrapping, lining, insert). Consumption must be measured or supplier-supported. Setting time is recorded separately from labour.'),
  },
  {
    key: 'accessories',
    name: 'Insert accessories — ribbon / elastic / tabs / retainers (per design)',
    kind: 'quantity',
    uom: 'nos',
    supplier: 'To be sourced once the insert design is approved.',
    notes: ref('Approved design and measured consumption required. Legacy BOM 014 used satin ribbon for its coin insert (zero-valued line) — not copied.'),
  },
  {
    key: 'interleaf',
    name: 'Protective interleaf / bag (to specify)',
    kind: 'quantity',
    uom: 'nos',
    supplier: 'To be specified.',
    notes: ref('Surface protection before packing.'),
  },
  {
    key: 'carton',
    name: 'Corrugated outer carton (size and packed quantity to confirm)',
    kind: 'quantity',
    uom: 'nos',
    supplier: 'To be quoted.',
    notes: ref('Legacy BOMs used "Corrugated Box 25x15x8 5Ply" at Rs 70 (one carton per 100 Rakhi boxes; four per 100 MDF boxes). Packed quantity for these products is unknown.'),
  },
]

/* ------------------------------- Route ------------------------------------ */

export interface ProcessTemplate {
  key: string
  name: string
  description: string
}

export interface StageTemplate {
  key: string
  name: string
  description: string
  processes: ProcessTemplate[]
}

const P = (key: string, name: string, description = ''): ProcessTemplate => ({ key, name, description })

/** Proposed reusable route. Optional operations that were not selected are listed in the stage description, not in the route. */
export function jewelleryRoute(insertNote: string, fitNote: string): StageTemplate[] {
  return [
    {
      key: 's1',
      name: 'Wrapper printing and finishing',
      description: 'Optional, not selected yet: inner-liner printing, lamination/coating, foil/embossing/branding. For 25-piece batches compare digital print, specialty paper with branding and outsourced print.',
      processes: [
        P('p1', 'Artwork, prepress and print layout'),
        P('p2', 'Case and tray wrapper printing', 'Split into separate operations if production or charging differs.'),
        P('p3', 'Wrapper trimming / die-cutting and inspection'),
      ],
    },
    {
      key: 's2',
      name: 'Structural board preparation',
      description: 'Cut list comes from the approved structural drawing — finished-box size alone does not define it.',
      processes: [
        P('p1', 'Board inspection and identification', 'Confirm the selected grade before cutting.'),
        P('p2', 'Cut case panels and tray components', 'From the approved cut list.'),
        P('p3', 'Score or V-groove', 'Only where the approved construction needs it.'),
        P('p4', 'Corner / slot cutting and magnet recess', 'Where applicable to the approved construction.'),
        P('p5', 'Dimension check and variant matching'),
      ],
    },
    {
      key: 's3',
      name: 'Case and magnetic closure assembly',
      description: 'Order of magnet fitting and wrapping follows the actual construction. Magnets are never concealed before polarity and alignment are checked.',
      processes: [
        P('p1', 'Position case panels with hinge / spine spacing'),
        P('p2', 'Locate and fix magnets / counterparts', 'Count and positions from the closure drawing.'),
        P('p3', 'Polarity and alignment check', 'Before the magnets are covered.'),
        P('p4', 'Apply outer wrapper and turn in edges'),
        P('p5', 'Attach inner liner'),
        P('p6', 'Press and set', 'Adhesive setting time is recorded separately from active labour.'),
      ],
    },
    {
      key: 's4',
      name: 'Inner tray formation',
      description: '',
      processes: [
        P('p1', 'Form tray walls'),
        P('p2', 'Reinforce corners', 'Method to be chosen (e.g. corner stay tape).'),
        P('p3', 'Apply tray wrapper and turn-ins'),
        P('p4', 'Fit tray lining'),
        P('p5', 'Tray squareness, dimension and case-fit check'),
      ],
    },
    {
      key: 's5',
      name: 'Jewellery-specific insert making',
      description: `Proposed insert: ${insertNote}. The legacy coin insert is not copied.`,
      processes: [
        P('p1', 'Cut insert support board and/or foam'),
        P('p2', 'Make cavities, holes, slots or retainers', insertNote),
        P('p3', 'Apply presentation covering'),
        P('p4', 'Add ribbon, elastic, tabs or roller components', 'Only those specified by the approved insert design.'),
        P('p5', 'Jewellery fit check', fitNote),
      ],
    },
    {
      key: 's6',
      name: 'Final assembly and setting',
      description: '',
      processes: [
        P('p1', 'Fix tray into case'),
        P('p2', 'Install the approved insert'),
        P('p3', 'Lid and closure alignment check'),
        P('p4', 'Press / set', 'As required by the materials and adhesive; waiting time is not operator labour.'),
        P('p5', 'Clean residue and surface inspection'),
      ],
    },
    {
      key: 's7',
      name: 'Quality inspection and packing',
      description: 'Tolerances, test counts and curing times are taken from the approved sample, supplier instructions or measurement — none are assumed.',
      processes: [
        P(
          'p1',
          'Final quality inspection',
          'Dimensions and insert fit; jewellery supported without force; closure alignment and retention; clean corners, sound bonds, hinge movement; no wrinkles, exposed board, glue marks or damage; artwork/colour/logo match; lining does not shed or transfer colour; quantity and variant identification.',
        ),
        P('p2', 'Apply surface protection'),
        P('p3', 'Pack into approved outer carton'),
        P('p4', 'Record accepted, rejected and reworked quantities; identify the batch'),
      ],
    },
  ]
}

export const DEFAULT_COST_BASIS: CostBasis = 'per_1000'

/* ------------------------------ BOM usage --------------------------------- */

export interface UsageTemplate {
  key: string
  material: string
  stage: string
  process: string | null
  note: string
}

const U = (key: string, material: string, stage: string, process: string | null, note: string): UsageTemplate => ({ key, material, stage, process, note })

/** Shell, closure, tray and packing usage common to the magnetic rigid-box template. */
const SHELL_USAGE: UsageTemplate[] = [
  U('u-wrapper', 'wrapper', 's1', 'p2', 'Case and tray wrappers — sheet size, cut size and pieces from the approved layout.'),
  U('u-board', 'board', 's2', 'p2', 'Case panels and tray components. Shared-sheet nesting to be used when the cut list is approved.'),
  U('u-magnet', 'magnet', 's3', 'p2', 'Count from the closure drawing (not assumed).'),
  U('u-adhesive', 'adhesive', 's3', 'p4', 'Wrapping, lining and component bonding — consumption to be measured.'),
  U('u-liner-case', 'liner', 's3', 'p5', 'Case inner liner.'),
  U('u-tape', 'corner-tape', 's4', 'p2', 'Tray corner reinforcement — length per box to be measured.'),
  U('u-liner-tray', 'liner', 's4', 'p4', 'Tray lining.'),
  U('u-interleaf', 'interleaf', 's7', 'p2', 'Surface protection.'),
  U('u-carton', 'carton', 's7', 'p3', 'Outer carton — packed quantity to be confirmed.'),
]

const PAD_USAGE: UsageTemplate[] = [
  U('u-insert-board', 'insert-board', 's5', 'p1', 'Board-backed pad base.'),
  U('u-cushion', 'cushion', 's5', 'p1', 'Cushioning layer — thickness from actual clearance and support needs.'),
  U('u-covering', 'covering', 's5', 'p3', 'Pad covering — consumption to be measured.'),
]

/* ------------------------------- Products --------------------------------- */

export interface ProductTemplate {
  key: string
  sourceRow: number
  sourceName: string
  rawSize: string
  requestedQty: number
  insertApproach: string
  fitNote: string
  aliases: string[]
  usage: UsageTemplate[]
}

const COMMON_OPEN_ITEMS = [
  'Size unit of the original size string',
  'Internal or external dimension basis',
  'Confirmed length, width and height',
  'Actual jewellery size, weight and clearance',
  'Box opening style and closure (magnetic construction is a proposal)',
  'Board, wrapper, lining and insert selections',
  'Artwork, logo, colour and finishing',
  'Structural drawing and component cut list',
  'Prototype / white sample and jewellery fit check',
  'Approved sample version and acceptance criteria',
  'Supplier quotations and actual production method per process',
  'Process times, rates and setup charges',
  'Tax rate / HSN',
]

const T = (
  n: number,
  sourceName: string,
  rawSize: string,
  insertApproach: string,
  opts: { fitNote?: string; aliases?: string[]; usage?: UsageTemplate[]; accessories?: string } = {},
): ProductTemplate => ({
  key: `row-${String(n).padStart(2, '0')}`,
  sourceRow: n,
  sourceName,
  rawSize,
  requestedQty: 25,
  insertApproach,
  fitNote: opts.fitNote ?? 'Fit the actual jewellery or an approved representative sample.',
  aliases: opts.aliases ?? [],
  usage: [
    ...SHELL_USAGE,
    ...(opts.usage ?? PAD_USAGE),
    U('u-accessories', 'accessories', 's5', 'p4', opts.accessories ?? 'Only the accessories named in the approved insert design.'),
  ],
})

export const JEWELLERY_PRODUCTS: ProductTemplate[] = [
  T(1, 'Bracelet', '2*8.5', 'Covered pad with bracelet retainers or a shaped recess — confirm against the jewellery sample', {
    accessories: 'Bracelet retainers (if the pad design is chosen; a shaped foam recess is the alternative).',
  }),
  T(2, 'Mini Chain', '3*10', 'Chain pad with retaining slits/tabs, and pendant accommodation if required', {
    accessories: 'Retaining tabs for the chain; pendant support only if required.',
  }),
  T(3, 'Chain Box', '12*4', 'Elongated chain pad with retention at suitable positions', { accessories: 'Chain retention tabs/slits at approved positions.' }),
  T(4, 'Big Chain', '15*4', 'Chain support with sufficient clearance for the actual chain and clasp', {
    fitNote: 'Verify clearance for the actual chain and clasp.',
    accessories: 'Chain support/retention as designed.',
  }),
  T(5, 'Necklace Box', '7*6', 'Necklace-shaped presentation pad; earring positions only if requested', {
    accessories: 'Necklace retention; earring positions only if requested.',
  }),
  T(6, 'Necklace Box', '8*7', 'Separate necklace-pad variant matched to this box and its jewellery', { accessories: 'Necklace retention for this variant.' }),
  T(7, 'Haram Box', '13*6', 'Long necklace / haram pad with support for pendant and chain', {
    fitNote: 'Verify support for the pendant and chain.',
    accessories: 'Haram pendant and chain supports.',
  }),
  T(8, 'Haram Box', '15*6', 'Separate long-haram pad variant; verify pendant clearance', {
    fitNote: 'Verify pendant clearance for this variant.',
    accessories: 'Haram supports for this variant.',
  }),
  T(9, 'Jimmikke Box', '3*4', 'Earring card or covered insert supporting the pair, with clearance below the earrings', {
    fitNote: 'Verify earring-post/back clearance and space below hanging jimmikke.',
    aliases: ['Jimikki box', 'Jimikki', 'Jhumka box'],
    usage: [
      U('u-insert-board', 'insert-board', 's5', 'p1', 'Earring card / covered insert base.'),
      U('u-covering', 'covering', 's5', 'p3', 'Card covering — consumption to be measured.'),
    ],
    accessories: 'Earring holding slits/holes as designed (no cushioning layer unless the approved design adds one).',
  }),
  T(10, 'Bangle Roller', '6*4', 'Covered removable roller / cushion sized to the actual bangles', {
    fitNote: 'Verify roller diameter, usable length, removal method and lid clearance.',
    usage: [
      U('u-cushion', 'cushion', 's5', 'p1', 'Roller / cushion core — diameter and length from the actual bangles.'),
      U('u-covering', 'covering', 's5', 'p3', 'Roller covering — consumption to be measured.'),
    ],
    accessories: 'Roller end pieces / removal aid as designed.',
  }),
]

/** Display name: the source name with its size beside it, so size variants stay distinct. */
export const templateProductName = (t: ProductTemplate) => `${t.sourceName} — ${t.rawSize}`

export function templateSpec(t: ProductTemplate, batchId: string): ProductSpec {
  return {
    importKey: `${batchId}:${t.key}`,
    status: 'proposed',
    sourceRow: t.sourceRow,
    sourceName: t.sourceName,
    rawSize: t.rawSize,
    sizeUnit: null,
    dimensionBasis: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    requestedQty: t.requestedQty,
    construction: 'Magnetic rigid box (case with magnetic closure and inner tray) — proposed from the “Magnet Box” heading; confirmation pending.',
    insertApproach: t.insertApproach,
    aliases: t.aliases,
    openItems: [...COMMON_OPEN_ITEMS],
    notes: [
      `Customer list row ${t.sourceRow}: "${t.sourceName}", size "${t.rawSize}", requested quantity ${t.requestedQty} (batch quantity, not consumption).`,
      'Route and materials are a proposed template synthesised from two legacy BOMs used only as workflow references — SILVERA Rakhi box 68×150 mm (BOM 014, effective 20-04-2023, costed for 100 nos with observation quantities of 100–110) and MDF box 200×200 mm (BOM 068, effective 15-08-2025). MDF, coin cavities, U-lock and the legacy coin insert are not applied. Legacy prices, zero-valued lines and totals were not imported.',
      'Supplier listings are sourcing leads, not approved vendors, stock or prices.',
      'Do not treat as a production-ready BOM until dimensions, construction, materials, inserts and rates are confirmed.',
    ].join('\n'),
  }
}
