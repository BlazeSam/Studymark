// Sanity check for course search. Run: node --experimental-strip-types scripts/check-course-search.ts
import assert from 'node:assert/strict'
import { searchCourses, scoreCourse } from '../src/lib/courseSearch.ts'
import { catalogueCourses } from '../src/data/courses.ts'

// --- the scraped index itself ---
assert.ok(catalogueCourses.length > 2000, `expected a few thousand courses, got ${catalogueCourses.length}`)
assert.ok(
  catalogueCourses.every((c) => /^[A-Z]{2,5}\d{2,3}$/.test(c.code)),
  // Two-digit numbers are real: BIOL 90 and EAP 30 are preparatory courses in the catalogue.
  'every code is subject letters followed by two or three digits',
)
assert.ok(
  catalogueCourses.every((c) => c.title.length > 0),
  'every course carries a title',
)
assert.ok(
  catalogueCourses.every((c) => Number(c.code.replace(/^[A-Z]+/, '')) < 500),
  'graduate courses are excluded',
)
assert.equal(new Set(catalogueCourses.map((c) => c.code)).size, catalogueCourses.length, 'codes are unique')

const first = (query: string) => searchCourses(query)[0]?.code

// --- codes, however they are typed ---
assert.equal(first('CMPT 280'), 'CMPT280', 'spaced code')
assert.equal(first('cmpt280'), 'CMPT280', 'lowercase, unspaced')
assert.equal(first('cmpt-280'), 'CMPT280', 'punctuated')
assert.ok(searchCourses('280').some((c) => c.code === 'CMPT280'), 'a bare number finds courses ending in it')

// --- an exact code always outranks a prefix match ---
const cmpt141 = searchCourses('CMPT141')
assert.equal(cmpt141[0].code, 'CMPT141')
assert.ok(cmpt141[0].score > (cmpt141[1]?.score ?? 0), 'the exact code scores strictly highest')

// --- a partial code lists that subject, lowest number first ---
const cmpt2 = searchCourses('cmpt 2', 5)
assert.ok(cmpt2.length > 0 && cmpt2.every((c) => c.code.startsWith('CMPT2')), 'prefix search stays in the subject')
assert.deepEqual(
  cmpt2.map((c) => c.code),
  [...cmpt2.map((c) => c.code)].sort(),
  'within a tier, lower course numbers come first',
)

// --- titles, in the words a student would actually use ---
assert.ok(
  searchCourses('data structures').some((c) => c.code === 'CMPT280'),
  'CMPT280 is findable by its title',
)
assert.ok(
  searchCourses('machine learning').some((c) => c.code === 'CMPT423'),
  'CMPT423 is findable by its title',
)
assert.ok(
  searchCourses('linear algebra').some((c) => c.code === 'MATH266'),
  'title search crosses subjects',
)
// Word order and partial words shouldn't matter.
assert.ok(
  searchCourses('algebra linear').some((c) => c.code.startsWith('MATH')),
  'query words may arrive in any order',
)
assert.ok(
  searchCourses('intro comp').some((c) => c.title.toLowerCase().includes('introduction')),
  'query words match on prefix, so abbreviations still land',
)

// --- scoring order is the documented one ---
const exact = catalogueCourses.find((c) => c.code === 'CMPT280')!
assert.ok(scoreCourse('CMPT280', exact) > scoreCourse('CMPT28', exact), 'exact beats prefix')
assert.ok(scoreCourse('CMPT28', exact) > scoreCourse('data structures', exact), 'code beats title')
assert.equal(scoreCourse('quantum chromodynamics', exact), 0, 'an unrelated query scores zero')

// --- limits and empty input ---
assert.deepEqual(searchCourses(''), [], 'an empty query returns nothing')
assert.deepEqual(searchCourses('   '), [], 'whitespace is not a query')
assert.ok(searchCourses('c', 8).length <= 8, 'the limit is respected')
assert.deepEqual(searchCourses('zzzzqqq'), [], 'a nonsense query returns nothing rather than noise')

console.log(`check-course-search.ts: all assertions passed (${catalogueCourses.length} courses indexed)`)
