import type { Program } from './types.ts'
import { computerScience } from './computerScience.ts'
import { appliedMathematics } from './appliedMathematics.ts'
import { physics } from './physics.ts'
import { appliedComputing } from './appliedComputing.ts'
import { computingCertificate } from './computingCertificate.ts'
import { mathematicalModellingCertificate } from './mathematicalModellingCertificate.ts'
import { formalReasoningCertificate } from './formalReasoningCertificate.ts'
import { astronomyCertificate } from './astronomyCertificate.ts'
import { statisticsMinor } from './statisticsMinor.ts'
import { math } from './math.ts'
import { statistics } from './statistics.ts'
import { biology } from './biology.ts'

// Adding a program = adding a data file + one line here.
//
// math / statistics / biology stay as empty stubs on purpose: their USask Four-year majors (and,
// for math, its minor) all rely on an open-ended "any 300/400-level course in the subject" bucket
// that doesn't map to an enumerated course list — see the commit message / chat summary for the
// full skip list and reasons.
export const programs: Program[] = [
  computerScience,
  appliedMathematics,
  physics,
  appliedComputing,
  computingCertificate,
  mathematicalModellingCertificate,
  formalReasoningCertificate,
  astronomyCertificate,
  statisticsMinor,
  math,
  statistics,
  biology,
]
