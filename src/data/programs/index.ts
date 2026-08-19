import type { Program } from './types.ts'
import { computerScience } from './computerScience.ts'
import { math } from './math.ts'
import { statistics } from './statistics.ts'
import { biology } from './biology.ts'

// Adding a program = adding a data file + one line here.
export const programs: Program[] = [computerScience, math, statistics, biology]
