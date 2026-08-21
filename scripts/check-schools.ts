// Sanity check for findSchool. Run: node --experimental-strip-types scripts/check-schools.ts
import assert from 'node:assert/strict'
import { findSchool } from '../src/data/schools/index.ts'
import { schools } from '../src/data/schools/index.ts'

assert.equal(findSchool('University of Saskatchewan')?.id, 'usask', 'exact name matches')
assert.equal(findSchool('usask')?.id, 'usask', 'alias matches')
assert.equal(findSchool('U of S')?.id, 'usask', 'alias matches case-insensitively')
assert.equal(findSchool('the university of saskatchewan main campus')?.id, 'usask', 'substring alias match')
assert.equal(findSchool('University of Toronto'), null, 'unmapped school returns null')
assert.equal(findSchool(''), null, 'empty query returns null')
assert.equal(findSchool('   '), null, 'whitespace-only query returns null')

// --- every award links somewhere a student can actually act ---
for (const school of schools) {
  for (const resource of school.resources) {
    assert.ok(
      resource.url.startsWith('https://'),
      `${school.id}/${resource.id}: needs a real https award page, got ${JSON.stringify(resource.url)}`,
    )
  }
}

console.log('check-schools.ts: all assertions passed')
