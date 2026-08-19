import type { Program } from '../programs/types.ts'

export interface Resource {
  id: string
  name: string
  whatItIs: string
  whyRelevant: string
  /** e.g. "$2,500" or "Varies" — omit when the source doesn't list one. */
  value?: string
  /** Human-readable deadline shown to the student, e.g. "March 1, 2027" or "Rolling / ongoing". */
  deadline: string
  /** ISO yyyy-mm-dd for sorting. Omit for rolling/ongoing resources — they sort last. */
  deadlineDate?: string
}

export interface School {
  id: string
  name: string
  /** Lowercase strings a free-text school name/query can match against. */
  aliases: string[]
  /** Real, verified resources for this school only — never invented or placeholder entries. */
  resources: Resource[]
  /** Programs offered at this school with intake-driven course/specialization data. */
  programs?: Program[]
}
