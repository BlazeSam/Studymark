// Sanity check for computeMatches. Run: node --experimental-strip-types scripts/check-match.ts
import assert from 'node:assert/strict'
import { computeMatches, computeCourseOverlap } from '../src/lib/match.ts'
import { completedCourses, inProgressCourses } from '../src/data/transcript.ts'
import { catalogueCourses } from '../src/data/courses.ts'
import { specializations } from '../src/data/specializations.ts'

const completed = new Set(completedCourses)
const matches = computeMatches(specializations, completed)

assert.equal(matches[0].spec.id, 'social-computing', 'closest specialization should be Social Computing')
assert.equal(matches[0].remaining, 1, 'Social Computing should need exactly 1 more course')
assert.deepEqual(
  matches[0].unsatisfied.flatMap((g) => g.options),
  ['CMPT412'],
  'the missing course should be CMPT412',
)
assert.ok(
  matches.every((m, i) => i === 0 || m.remaining >= matches[i - 1].remaining),
  'results must be sorted ascending by remaining count',
)

const overlap = computeCourseOverlap(specializations, completed)
assert.equal(overlap[0].course, 'CMPT384', 'CMPT384 should be the highest-overlap uncompleted course')
assert.equal(overlap[0].specs.length, 3, 'CMPT384 should advance exactly 3 specializations')
assert.deepEqual(
  overlap[0].specs.map((s) => s.id).sort(),
  ['computational-modelling', 'computer-graphics', 'information-visualization'].sort(),
  'CMPT384 should advance Computational Modelling, Computer Graphics, and Information Visualization',
)
assert.ok(
  overlap.every((o, i) => i === 0 || o.specs.length <= overlap[i - 1].specs.length),
  'overlap results must be sorted descending by specs count',
)
assert.ok(
  overlap.every((o) => !completed.has(o.course)),
  'overlap must never include an already-completed course',
)

// programs with no data yet (Math/Stats/Biology stubs) must degrade to empty, never throw
assert.deepEqual(computeMatches([], completed), [], 'empty specializations list yields empty matches')
assert.deepEqual(computeCourseOverlap([], completed), [], 'empty specializations list yields empty overlap')

// --- the sample student mirrors the audit it came from ---
assert.equal(completedCourses.length, 28, 'the audit lists 28 completed courses')
assert.equal(inProgressCourses.length, 7, 'the audit lists 7 preregistered classes')
assert.ok(
  inProgressCourses.every((code) => !completedCourses.includes(code)),
  'a preregistered class is not also completed',
)
assert.ok(
  [...completedCourses, ...inProgressCourses].every((code) => catalogueCourses.some((c) => c.code === code)),
  'every sample course is a real catalogue course',
)

console.log('match.check.ts: all assertions passed')
