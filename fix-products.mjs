import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/login');
  
  await page.evaluate(() => {
    const raw = localStorage.getItem('vertex-erp-db-v2');
    if (!raw) return;
    const db = JSON.parse(raw);
    
    // Add Standard Materials if they don't exist
    const standardMats = [
      { id: 'MAT-KAPPA', code: 'KAPPA-1.5', name: 'Kappa Board 1.5mm', type: 'sheet', category: 'Board', uom: 'sheets', ratePerUom: 50, pricingBasis: 'per_sheet', sheetLengthMm: 700, sheetWidthMm: 1000, wastagePct: 5, purchaseMultiple: 100, supplier: 'Board Supplier', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-ARTPAPER', code: 'ART-130', name: 'Art Paper 130 GSM', type: 'sheet', category: 'Paper', uom: 'sheets', ratePerUom: 10, pricingBasis: 'per_sheet', sheetLengthMm: 600, sheetWidthMm: 900, wastagePct: 10, purchaseMultiple: 500, supplier: 'Paper Mill', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-MAGNET', code: 'MAG-ND', name: 'Neodymium Magnet', type: 'qty', category: 'Hardware', uom: 'pcs', ratePerUom: 2, pricingBasis: 'per_uom', wastagePct: 2, purchaseMultiple: 1000, supplier: 'Hardware Vendor', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-GLUE', code: 'GLUE-HM', name: 'Hot Melt Glue', type: 'qty', category: 'Consumable', uom: 'kg', ratePerUom: 150, pricingBasis: 'per_uom', wastagePct: 5, purchaseMultiple: 5, supplier: 'Chemicals Co', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-FOAM', code: 'FOAM-VEL', name: 'Velvet Foam Insert', type: 'qty', category: 'Insert', uom: 'sqft', ratePerUom: 30, pricingBasis: 'per_uom', wastagePct: 10, purchaseMultiple: 10, supplier: 'Foam Vendor', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' }
    ];
    
    for (const mat of standardMats) {
      if (!db.materials.some(m => m.id === mat.id)) {
        db.materials.push(mat);
      }
    }
    
    // Standard Stages
    const newStages = [
      {
        id: 'STG-1',
        name: 'Board Cutting & Grooving',
        description: 'Cutting Kappa board and making V-grooves',
        processes: [
          { id: 'PRC-1-1', name: 'Board Cutting', description: 'Straight cutting', setupHours: 0.5, runHoursPer1000: 2, chargeId: null, costBasis: 'per_piece', rate: 2, setupCharge: 0, requiresMachine: true, method: 'In-house' },
          { id: 'PRC-1-2', name: 'V-Grooving', description: 'Making fold grooves', setupHours: 0.5, runHoursPer1000: 2, chargeId: null, costBasis: 'per_piece', rate: 3, setupCharge: 0, requiresMachine: true, method: 'In-house' }
        ]
      },
      {
        id: 'STG-2',
        name: 'Paper Printing & Lamination',
        description: 'Outer wrapper preparation',
        processes: [
          { id: 'PRC-2-1', name: 'Printing', description: 'Offset print', setupHours: 1, runHoursPer1000: 1, chargeId: null, costBasis: 'per_piece', rate: 5, setupCharge: 500, requiresMachine: true, method: 'Outsourced' },
          { id: 'PRC-2-2', name: 'Lamination', description: 'Thermal matte lamination', setupHours: 0.2, runHoursPer1000: 1, chargeId: null, costBasis: 'per_piece', rate: 2, setupCharge: 0, requiresMachine: true, method: 'Outsourced' }
        ]
      },
      {
        id: 'STG-3',
        name: 'Box Forming',
        description: 'Magnet fixing and pasting',
        processes: [
          { id: 'PRC-3-1', name: 'Magnet Fixing', description: 'Drilling and fixing magnets', setupHours: 0.2, runHoursPer1000: 5, chargeId: null, costBasis: 'per_piece', rate: 4, setupCharge: 0, requiresMachine: false, method: 'In-house' },
          { id: 'PRC-3-2', name: 'Box Pasting', description: 'Wrapping and pasting', setupHours: 0.5, runHoursPer1000: 10, chargeId: null, costBasis: 'per_piece', rate: 10, setupCharge: 0, requiresMachine: true, method: 'In-house' }
        ]
      },
      {
        id: 'STG-4',
        name: 'Insert & Assembly',
        description: 'Foam cutting and packing',
        processes: [
          { id: 'PRC-4-1', name: 'Insert Making', description: 'Velvet foam padding', setupHours: 0, runHoursPer1000: 10, chargeId: null, costBasis: 'per_piece', rate: 6, setupCharge: 0, requiresMachine: false, method: 'In-house' },
          { id: 'PRC-4-2', name: 'Assembly & Packing', description: 'Final QA and packing', setupHours: 0, runHoursPer1000: 5, chargeId: null, costBasis: 'per_piece', rate: 2, setupCharge: 0, requiresMachine: false, method: 'In-house' }
        ]
      }
    ];

    // Standard Product Materials mapping
    const newMaterials = [
      { id: 'PMAT-1', materialId: 'MAT-KAPPA', stageId: 'STG-1', processId: 'PRC-1-1', qtyPerPiece: null, piecesPerProduct: 2, cutLengthMm: 150, cutWidthMm: 100, rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: 'Base and flap board' },
      { id: 'PMAT-2', materialId: 'MAT-ARTPAPER', stageId: 'STG-2', processId: 'PRC-2-1', qtyPerPiece: null, piecesPerProduct: 1, cutLengthMm: 300, cutWidthMm: 200, rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: 'Outer wrapper' },
      { id: 'PMAT-3', materialId: 'MAT-MAGNET', stageId: 'STG-3', processId: 'PRC-3-1', qtyPerPiece: 2, piecesPerProduct: null, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: 'Flap magnets' },
      { id: 'PMAT-4', materialId: 'MAT-GLUE', stageId: 'STG-3', processId: 'PRC-3-2', qtyPerPiece: 0.05, piecesPerProduct: null, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: 'Pasting adhesive' },
      { id: 'PMAT-5', materialId: 'MAT-FOAM', stageId: 'STG-4', processId: 'PRC-4-1', qtyPerPiece: 0.1, piecesPerProduct: null, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: 'Inner cushioning' }
    ];

    db.products.forEach(p => {
      p.stages = JSON.parse(JSON.stringify(newStages));
      p.materials = JSON.parse(JSON.stringify(newMaterials));
      p.description = 'Magnetic rigid box for ' + p.name.split(' — ')[0] + '. Setup complete with standard BOM and stages.';
      
      if (p.spec) {
        p.spec.status = 'confirmed';
        p.spec.sizeUnit = 'inch'; 
        p.spec.dimensionBasis = 'internal';
        const parts = (p.spec.rawSize || '').split('*');
        if (parts.length >= 2) {
           p.spec.lengthMm = parseFloat(parts[0]) * 25.4;
           p.spec.widthMm = parseFloat(parts[1]) * 25.4;
           p.spec.heightMm = 50.8;
        }
      }
      p.version = (p.version || 0) + 1;
    });

    localStorage.setItem('vertex-erp-db-v2', JSON.stringify(db));
  });
  
  await browser.close();
  console.log('Done modifying localStorage via Playwright');
})();
