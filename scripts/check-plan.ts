// Sanity check for the term planner. Run: node --experimental-strip-types scripts/check-plan.ts
import assert from 'node:assert/strict'
import { computeMatches } from '../src/lib/match.ts'
import { buildPlan, selectCourses, courseLevel, upcomingTerm } from '../src/lib/plan.ts'
import { completedCourses } from '../src/data/transcript.ts'
import { specializations } from '../src/data/specializations.ts'

const completed = new Set(completedCourses)
const matches = computeMatches(specializations, completed)

assert.equal(courseLevel('CMPT141'), 1)
assert.equal(courseLevel('CMPT423'), 4)

// --- selection covers exactly the outstanding requirement, never a completed course ---
for (const match of matches) {
  const picked = selectCourses(match, specializations, completed)
  assert.equal(picked.length, match.remaining, `${match.spec.id}: one pick per outstanding course`)
  assert.ok(
    picked.every((p) => !completed.has(p.code)),
    `${match.spec.id}: never plans a course already taken`,
  )
  assert.equal(new Set(picked.map((p) => p.code)).size, picked.length, `${match.spec.id}: no duplicate picks`)
  assert.ok(
    picked.every((p) => !p.alsoAdvances.includes(match.spec.name)),
    `${match.spec.id}: alsoAdvances excludes the target specialization itself`,
  )
}

// --- choice slots prefer the option that double-dips ---
const infoVis = matches.find((m) => m.spec.id === 'information-visualization')
assert.ok(infoVis, 'information-visualization should exist in the catalogue data')
const infoVisPicks = selectCourses(infoVis, specializations, completed)
assert.ok(
  infoVisPicks.some((p) => p.alsoAdvances.length > 0),
  'at least one planned course should also advance another specialization',
)

// --- terms chunk correctly and advance Fall -> Winter -> Fall ---
const target = matches.find((m) => m.remaining >= 3)
assert.ok(target, 'sample transcript should leave at least one specialization 3+ courses out')
const plan = buildPlan(target, specializations, completed, 2, { season: 'Fall', year: 2026 })
assert.equal(plan.length, Math.ceil(target.remaining / 2), 'term count = courses / per-term, rounded up')
assert.deepEqual(
  buildPlan(target, specializations, completed, 1, { season: 'Fall', year: 2026 })
    .slice(0, 3)
    .map((t) => t.label),
  ['Fall 2026', 'Winter 2027', 'Fall 2027'],
  'terms alternate Fall then the following Winter',
)
assert.ok(
  plan.every((t) => t.courses.length <= 2),
  'no term exceeds the per-term cap',
)
assert.equal(
  plan.flatMap((t) => t.courses).length,
  target.remaining,
  'every outstanding course lands in some term',
)

// --- lower-level courses are scheduled first ---
const levels = plan.flatMap((t) => t.courses).map((c) => courseLevel(c.code))
assert.deepEqual(levels, [...levels].sort((a, b) => a - b), 'plan is ordered by course level ascending')

// --- degrades, never throws ---
const done = matches.find((m) => m.remaining === 0)
if (done) assert.deepEqual(buildPlan(done, specializations, completed, 3, { season: 'Fall', year: 2026 }), [])
assert.ok(buildPlan(matches[0], specializations, completed, 0, { season: 'Fall', year: 2026 }).length >= 0)

assert.deepEqual(upcomingTerm(new Date('2026-03-01')), { season: 'Fall', year: 2026 })
assert.deepEqual(upcomingTerm(new Date('2026-10-01')), { season: 'Winter', year: 2027 })

console.log('check-plan.ts: all assertions passed')
