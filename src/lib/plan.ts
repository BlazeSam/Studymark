import type { Specialization } from '../data/specializations.ts'
import { computeCourseOverlap, type SpecializationMatch } from './match.ts'

export interface PlannedCourse {
  code: string
  /** Names of OTHER specializations this same course also advances — the double-dip payoff. */
  alsoAdvances: string[]
}

export interface PlannedTerm {
  /** e.g. "Fall 2026" */
  label: string
  courses: PlannedCourse[]
}

export type Season = 'Fall' | 'Winter'

export interface TermStart {
  season: Season
  year: number
}

/** 3 in "CMPT317". Used as the sequencing proxy — see selectCourses. */
export function courseLevel(code: string): number {
  const digits = code.match(/(\d)/)
  return digits ? Number(digits[1]) : 9
}

/**
 * Picks the concrete courses that close out `match`'s unsatisfied requirement slots.
 *
 * Where a slot offers a choice ("CMPT260 or CMPT263"), the option that advances the most OTHER
 * specializations wins — that is the whole point: one course, two credentials. Ties break to the
 * lower course level, then alphabetically, so the pick is deterministic.
 *
 * Most-constrained slots are filled first so a shared course is never stolen by a slot that had
 * other options left.
 */
export function selectCourses(
  match: SpecializationMatch,
  allSpecializations: Specialization[],
  completed: Set<string>,
): PlannedCourse[] {
  const overlap = computeCourseOverlap(allSpecializations, completed)
  const overlapByCourse = new Map(overlap.map((o) => [o.course, o.specs]))

  const picked: PlannedCourse[] = []
  const takenCodes = new Set<string>()

  const slots = [...match.unsatisfied].sort((a, b) => a.options.length - b.options.length)

  for (const slot of slots) {
    const ranked = slot.options
      .filter((code) => !takenCodes.has(code))
      .sort((a, b) => {
        const aOther = (overlapByCourse.get(a) ?? []).filter((s) => s.id !== match.spec.id).length
        const bOther = (overlapByCourse.get(b) ?? []).filter((s) => s.id !== match.spec.id).length
        return bOther - aOther || courseLevel(a) - courseLevel(b) || a.localeCompare(b)
      })

    for (const code of ranked.slice(0, slot.need)) {
      takenCodes.add(code)
      picked.push({
        code,
        alsoAdvances: (overlapByCourse.get(code) ?? [])
          .filter((s) => s.id !== match.spec.id)
          .map((s) => s.name),
      })
    }
  }

  return picked
}

function nextTerm({ season, year }: TermStart): TermStart {
  // USask runs Fall (Sept, year Y) then Winter (Jan, year Y+1).
  return season === 'Fall' ? { season: 'Winter', year: year + 1 } : { season: 'Fall', year }
}

/**
 * Spreads the selected courses across terms, `coursesPerTerm` at a time.
 *
 * ponytail: ordered by course level (100s before 300s), NOT by real prerequisite chains — USask
 * publishes prerequisites only on pages that aren't machine-readable, and inventing them would be
 * worse than admitting it. The UI says so. Swap this sort for a real prereq topological sort the
 * day verified prerequisite data lands.
 */
export function buildPlan(
  match: SpecializationMatch,
  allSpecializations: Specialization[],
  completed: Set<string>,
  coursesPerTerm: number,
  start: TermStart,
): PlannedTerm[] {
  const perTerm = Math.max(1, Math.floor(coursesPerTerm))
  const ordered = selectCourses(match, allSpecializations, completed).sort(
    (a, b) => courseLevel(a.code) - courseLevel(b.code) || a.code.localeCompare(b.code),
  )

  const terms: PlannedTerm[] = []
  let term = start
  for (let i = 0; i < ordered.length; i += perTerm) {
    terms.push({ label: `${term.season} ${term.year}`, courses: ordered.slice(i, i + perTerm) })
    term = nextTerm(term)
  }
  return terms
}

/** The term a student starting now would register for: Fall if it's still before September. */
export function upcomingTerm(today: Date): TermStart {
  const month = today.getMonth() // 0 = January
  return month < 8 ? { season: 'Fall', year: today.getFullYear() } : { season: 'Winter', year: today.getFullYear() + 1 }
}
