// Sanity check for transcriptParse. Run: node --experimental-strip-types scripts/check-transcript-parse.ts
import assert from 'node:assert/strict'
import { buildTranscriptParsePrompt, parseTranscriptResponse } from '../src/lib/transcriptParse.ts'

const known = ['CMPT145', 'CMPT214', 'MATH110']

const prompt = buildTranscriptParsePrompt(known)
assert.ok(prompt.includes('CMPT145'), 'prompt lists known course codes')
assert.ok(prompt.toLowerCase().includes('completed and passed'), 'prompt asks for completed+passed only')

assert.deepEqual(
  parseTranscriptResponse('["CMPT145","MATH110"]', known).sort(),
  ['CMPT145', 'MATH110'],
  'parses a clean JSON array',
)
assert.deepEqual(
  parseTranscriptResponse('Sure! Here you go:\n["cmpt 145"]\nHope that helps.', known),
  ['CMPT145'],
  'normalizes case and spaces, extracts array embedded in prose',
)
assert.deepEqual(
  parseTranscriptResponse('["CMPT145","PHIL999"]', known),
  ['CMPT145'],
  'drops codes not in the known list — never invents a match',
)
assert.deepEqual(parseTranscriptResponse('["CMPT145","CMPT145"]', known), ['CMPT145'], 'deduplicates')
assert.deepEqual(parseTranscriptResponse('not json at all', known), [], 'malformed input never throws')
assert.deepEqual(parseTranscriptResponse('[]', known), [], 'empty array is valid, returns empty')
assert.deepEqual(parseTranscriptResponse('', known), [], 'empty input never throws')

console.log('check-transcript-parse.ts: all assertions passed')
