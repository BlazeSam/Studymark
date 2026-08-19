import type { Specialization } from '../specializations.ts'

export interface Program {
  id: string
  name: string
  /** Empty when no verified specialization data exists yet for this program — never invented. */
  specializations: Specialization[]
  courseTitles: Record<string, string>
  /** Only populated where a real sample transcript exists. */
  sampleTranscript?: string[]
}
