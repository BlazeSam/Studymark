import type { School } from './types.ts'
import { usask } from './usask.ts'

// Adding a school = adding a data file + one line here.
export const schools: School[] = [usask]

/** Matches a free-text school name against the mapped schools (exact or alias/substring match). */
export function findSchool(query: string): School | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  return (
    schools.find((s) => s.name.toLowerCase() === q || s.aliases.some((a) => a === q || q.includes(a))) ?? null
  )
}
