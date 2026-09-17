import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/login');
  
  const exported = await page.evaluate(() => {
    const raw = localStorage.getItem('vertex-erp-db-v2');
    if (!raw) return null;
    const db = JSON.parse(raw);
    
    // Add PDF Materials
    const pdfMats = [
      { id: 'MAT-GB-1.5', code: 'GB-1.5', name: 'Greyboard 1.5mm', type: 'sheet', category: 'Board', uom: 'sheets', ratePerUom: 50, pricingBasis: 'per_sheet', sheetLengthMm: 790, sheetWidthMm: 1040, wastagePct: 15, purchaseMultiple: 100, supplier: 'Board Supplier', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-GB-2.0', code: 'GB-2.0', name: 'Greyboard 2.0mm', type: 'sheet', category: 'Board', uom: 'sheets', ratePerUom: 64, pricingBasis: 'per_sheet', sheetLengthMm: 790, sheetWidthMm: 1040, wastagePct: 15, purchaseMultiple: 100, supplier: 'Board Supplier', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-WRAP-157', code: 'WRAP-157', name: 'Coated Wrapping Paper 157 gsm', type: 'sheet', category: 'Paper', uom: 'sheets', ratePerUom: 18, pricingBasis: 'per_sheet', sheetLengthMm: 330, sheetWidthMm: 482, wastagePct: 10, purchaseMultiple: 100, supplier: 'Paper Mill', notes: '13x19 inch', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-MAG-ND', code: 'MAG-ND', name: 'Neodymium Magnet', type: 'qty', category: 'Hardware', uom: 'pcs', ratePerUom: 3.20, pricingBasis: 'per_uom', wastagePct: 0, purchaseMultiple: 100, supplier: 'Hardware Vendor', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-EPE-6', code: 'EPE-6', name: 'EPE Foam 6mm', type: 'qty', category: 'Insert', uom: 'sqm', ratePerUom: 50, pricingBasis: 'per_uom', wastagePct: 10, purchaseMultiple: 10, supplier: 'Foam Vendor', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' },
      { id: 'MAT-CARTON', code: 'CARTON-5', name: 'Master Carton 5-ply', type: 'qty', category: 'Packing', uom: 'pcs', ratePerUom: 77, pricingBasis: 'per_uom', wastagePct: 0, purchaseMultiple: 100, supplier: 'Packer', notes: '', active: true, priceUpdatedAt: new Date().toISOString(), priceUpdatedBy: 'USR-ADM1' }
    ];
    
    for (const mat of pdfMats) {
      if (!db.materials.some(m => m.id === mat.id)) db.materials.push(mat);
    }
    
    const newStages = [
      {
        id: "STG-PDF-1", name: "Pre-press & Printing", description: "Artwork and wrapper prep",
        processes: [
          { id: "PRC-P1", name: "Artwork, dieline and job setup", description: "", setupHours: 0.33, runHoursPer1000: 3.3, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" },
          { id: "PRC-P2", name: "Outer-wrapper digital printing", description: "", setupHours: 0, runHoursPer1000: 4.6, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" },
          { id: "PRC-P3", name: "Thermal lamination", description: "", setupHours: 0, runHoursPer1000: 2.5, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" }
        ]
      },
      {
        id: "STG-PDF-2", name: "Board Cutting & Forming", description: "Structure creation",
        processes: [
          { id: "PRC-P4", name: "Case-board cutting and scoring", description: "", setupHours: 0.1, runHoursPer1000: 10.8, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" },
          { id: "PRC-P5", name: "Tray-board cutting and scoring", description: "", setupHours: 0.1, runHoursPer1000: 13.3, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" },
          { id: "PRC-P6", name: "Four-corner sealing / tray forming", description: "", setupHours: 0, runHoursPer1000: 16.6, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" }
        ]
      },
      {
        id: "STG-PDF-3", name: "Case Making & Pasting", description: "Assembly",
        processes: [
          { id: "PRC-P7", name: "Case making and wrapper pasting", description: "", setupHours: 0, runHoursPer1000: 25, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" },
          { id: "PRC-P8", name: "Case/tray inner-sheet pasting", description: "", setupHours: 0, runHoursPer1000: 10, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" },
          { id: "PRC-P9", name: "Magnet recess, polarity check & pasting", description: "", setupHours: 0, runHoursPer1000: 6.6, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: false, method: "In-house" }
        ]
      },
      {
        id: "STG-PDF-4", name: "Insert & Final Assembly", description: "Finishing",
        processes: [
          { id: "PRC-P10", name: "Insert / foam cutting", description: "", setupHours: 0.1, runHoursPer1000: 10.8, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: true, method: "In-house" },
          { id: "PRC-P11", name: "Insert lining and jewellery-holder", description: "", setupHours: 0, runHoursPer1000: 15, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: false, method: "In-house" },
          { id: "PRC-P12", name: "Box + case inning / final assembly", description: "", setupHours: 0, runHoursPer1000: 10.8, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: false, method: "In-house" },
          { id: "PRC-P13", name: "Final QC, cleaning and packing", description: "", setupHours: 0, runHoursPer1000: 7.5, chargeId: null, costBasis: "per_hour", rate: 90, setupCharge: 0, requiresMachine: false, method: "In-house" }
        ]
      }
    ];

    db.products.forEach(p => {
      p.stages = JSON.parse(JSON.stringify(newStages));
      
      const isLarge = (p.name.includes('Chain Box') || p.name.includes('Haram'));
      const boardId = isLarge ? 'MAT-GB-2.0' : 'MAT-GB-1.5';
      const magnets = isLarge ? 4 : 2;
      
      p.materials = [
        { id: 'PMAT-PDF-1', materialId: boardId, stageId: 'STG-PDF-2', processId: 'PRC-P4', qtyPerPiece: null, piecesPerProduct: 5, cutLengthMm: 200, cutWidthMm: 150, rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: 'Board pieces (85% yield factor applied in costing)' },
        { id: 'PMAT-PDF-2', materialId: 'MAT-WRAP-157', stageId: 'STG-PDF-1', processId: 'PRC-P2', qtyPerPiece: null, piecesPerProduct: 1, cutLengthMm: 330, cutWidthMm: 482, rotationAllowed: true, upsOverride: null, upsOverrideReason: '', note: 'Wrapper' },
        { id: 'PMAT-PDF-3', materialId: 'MAT-MAG-ND', stageId: 'STG-PDF-3', processId: 'PRC-P9', qtyPerPiece: magnets, piecesPerProduct: null, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: 'Closure magnets' },
        { id: 'PMAT-PDF-4', materialId: 'MAT-EPE-6', stageId: 'STG-PDF-4', processId: 'PRC-P10', qtyPerPiece: 0.05, piecesPerProduct: null, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: 'Jewellery insert foam' },
        { id: 'PMAT-PDF-5', materialId: 'MAT-CARTON', stageId: 'STG-PDF-4', processId: 'PRC-P13', qtyPerPiece: 0.02, piecesPerProduct: null, cutLengthMm: null, cutWidthMm: null, rotationAllowed: false, upsOverride: null, upsOverrideReason: '', note: 'Master carton (1 per 50)' }
      ];
      
      p.description = 'Book-style rigid magnetic jewellery box. Loaded from ERP Production Log. ' + boardId + ' board, ' + magnets + ' magnets.';
      
      if (p.spec) {
        p.spec.status = 'confirmed';
        p.spec.sizeUnit = 'inch'; 
      }
      p.version = (p.version || 0) + 1;
    });

    localStorage.setItem('vertex-erp-db-v2', JSON.stringify(db));
    
    // Extract drafts
    const drafts = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('vertex-erp-draft-v1:')) {
        drafts.push({ key: k, value: localStorage.getItem(k) });
      }
    }
    
    return { db, drafts };
  });
  
  if (exported) {
    const exportFile = {
      format: 'vertex-erp-export-v1',
      exportedAt: new Date().toISOString(),
      source: 'browser',
      revision: null,
      summary: { users: exported.db.users.length, products: exported.db.products.length },
      db: exported.db,
      drafts: exported.drafts
    };
    fs.writeFileSync('final-export.json', JSON.stringify(exportFile, null, 2));
    console.log('Saved final-export.json with ' + exportFile.db.products.length + ' products.');
  } else {
    console.log('No DB found in localStorage');
  }
  
  await browser.close();
})();
