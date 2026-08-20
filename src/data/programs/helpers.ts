import type { RequirementGroup } from '../specializations.ts'

export const single = (course: string): RequirementGroup => ({ courses: [course], need: 1 })
