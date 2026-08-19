// Sanity check for scholarshipAi parsers. Run: node --experimental-strip-types scripts/check-scholarship-ai.ts
import assert from 'node:assert/strict'
import { parseWhyYouResponse, parseGuidanceResponse, buildWhyYouPrompt, buildGuidancePrompt } from '../src/lib/scholarshipAi.ts'

// --- parseWhyYouResponse ---
assert.deepEqual(
  parseWhyYouResponse('{"a":"line a","b":"line b"}', ['a', 'b']),
  { a: 'line a', b: 'line b' },
  'parses clean JSON',
)
assert.deepEqual(
  parseWhyYouResponse('Sure, here you go:\n{"a":"line a"}\nHope that helps!', ['a']),
  { a: 'line a' },
  'extracts JSON embedded in prose',
)
assert.deepEqual(parseWhyYouResponse('{"a":"line a","x":"unknown id"}', ['a']), { a: 'line a' }, 'drops unknown ids')
assert.deepEqual(parseWhyYouResponse('not json at all', ['a']), {}, 'malformed input never throws')
assert.deepEqual(parseWhyYouResponse('{"a":123}', ['a']), {}, 'non-string values dropped')
assert.deepEqual(parseWhyYouResponse('', ['a']), {}, 'empty input never throws')

// --- parseGuidanceResponse ---
assert.deepEqual(
  parseGuidanceResponse('{"categories":["Merit awards"],"whereToLook":["Registrar office"]}'),
  { categories: ['Merit awards'], whereToLook: ['Registrar office'] },
  'parses clean JSON',
)
assert.deepEqual(parseGuidanceResponse('garbage'), { categories: [], whereToLook: [] }, 'malformed input degrades to empty')
assert.deepEqual(
  parseGuidanceResponse('{"categories":"not an array"}'),
  { categories: [], whereToLook: [] },
  'wrong-shaped fields degrade to empty rather than throwing',
)

// --- prompts never invent specific award names / stay well-formed ---
const whyYouPrompt = buildWhyYouPrompt(
  {
    school: 'Test U',
    program: 'Computer Science',
    closestSpecialization: 'AI',
    coursesRemaining: 1,
    otherCloseSpecializations: [{ name: 'Algorithmics', remaining: 2 }],
  },
  [{ id: 'r1', name: 'Test Award', whatItIs: 'a thing' }],
)
assert.ok(whyYouPrompt.includes('r1'), 'why-you prompt includes resource id')
assert.ok(whyYouPrompt.includes('do not invent'), 'why-you prompt instructs against inventing details')
assert.ok(whyYouPrompt.includes('Algorithmics'), 'why-you prompt includes other close specializations for richer context')
assert.ok(whyYouPrompt.toLowerCase().includes('specific fact'), 'why-you prompt demands specific facts, not generic filler')
assert.ok(whyYouPrompt.toLowerCase().includes('generic filler'), 'why-you prompt explicitly bans generic filler phrases')
assert.ok(whyYouPrompt.includes('same words'), 'why-you prompt bans repeating sentence openings across lines')

const guidancePrompt = buildGuidancePrompt('Test U', 'Computer Science')
assert.ok(guidancePrompt.toLowerCase().includes('do not name any specific'), 'guidance prompt bans specific award names')

console.log('check-scholarship-ai.ts: all assertions passed')
