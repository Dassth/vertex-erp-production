import { buildEmptyDB } from './src/lib/defaults'
import { writeFileSync } from 'node:fs'

const db = buildEmptyDB(new Date())
const draftData = {
  id: 'PRD-TEST',
  name: 'Test Product Updated (Draft)',
  nested: { someField: 123 },
  stages: []
}
const draftStr = JSON.stringify({
  key: 'vertex-erp-draft-v1:USR-ADM1:products:PRD-TEST',
  userId: 'USR-ADM1',
  rev: 1,
  tabId: 'test-tab',
  savedAt: new Date().toISOString(),
  baseUpdatedAt: null,
  data: draftData
})

const exportFile = {
  format: 'vertex-erp-export-v1',
  exportedAt: new Date().toISOString(),
  source: 'browser',
  revision: null,
  summary: { users: 7, products: 0 },
  db,
  drafts: [
    { key: 'vertex-erp-draft-v1:USR-ADM1:products:PRD-TEST', value: draftStr }
  ]
}

writeFileSync('test-export.json', JSON.stringify(exportFile, null, 2))
console.log('Created test-export.json')
