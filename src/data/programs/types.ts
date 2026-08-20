import type { Specialization } from '../specializations.ts'

export interface Program {
  id: string
  name: string
  /**
   * A credential a student can earn alongside a major. Defaults to 'major' when absent — only the
   * certificates and minors set it, and only those are offered as add-on credentials in the UI.
   */
  kind?: 'major' | 'certificate' | 'minor'
  /** Empty when no verified specialization data exists yet for this program — never invented. */
  specializations: Specialization[]
  courseTitles: Record<string, string>
  /** Only populated where a real sample transcript exists. */
  sampleTranscript?: string[]
}
