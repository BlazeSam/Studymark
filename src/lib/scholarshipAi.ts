export interface WhyYouContext {
  school: string
  program: string
  closestSpecialization: string
  coursesRemaining: number
  topOverlapCourse?: string
  /** Other specializations within reach (≤2 courses away), for a fuller picture than just the closest one. */
  otherCloseSpecializations?: { name: string; remaining: number }[]
}

export interface WhyYouResourceInput {
  id: string
  name: string
  whatItIs: string
}

/** Builds the prompt for a single batched call: one specific "why you" line per resource. */
export function buildWhyYouPrompt(context: WhyYouContext, resources: WhyYouResourceInput[]): string {
  const list = resources.map((r) => `- id: ${r.id}\n  name: ${r.name}\n  what it is: ${r.whatItIs}`).join('\n')
  const otherClose = context.otherCloseSpecializations?.length
    ? ` They're also within striking distance of: ${context.otherCloseSpecializations
        .map((s) => `${s.name} (${s.remaining} course${s.remaining === 1 ? '' : 's'} away)`)
        .join(', ')}.`
    : ''

  return [
    `A ${context.program} student at ${context.school} is ${context.coursesRemaining} course${context.coursesRemaining === 1 ? '' : 's'} away from completing the ${context.closestSpecialization} specialization.${otherClose}`,
    context.topOverlapCourse
      ? `The single course that would advance the most specializations for them right now is ${context.topOverlapCourse}.`
      : '',
    '',
    'For each resource below, write ONE sentence (under 22 words) explaining why THIS student — with these specific facts — might want to look into it.',
    '',
    'Hard rules, all of them, every line:',
    '- Every line must name at least one SPECIFIC fact about the resource (its actual name or what it does) AND at least one SPECIFIC fact about the student (a named specialization, the overlap course, or the exact remaining-course count).',
    '- Do not open two lines with the same words — vary sentence structure across resources.',
    '- Generic filler ("as a CS student", "this could help you", "worth checking out", "if eligible") is banned as a substitute for a real reason — cut it or replace it with a concrete detail.',
    '- Ground every claim in the facts given; do not invent details about the student or the award beyond what is provided.',
    '',
    list,
    '',
    'Respond with ONLY a JSON object mapping each resource id to its one-sentence line, nothing else. Example: {"id1":"...","id2":"..."}',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Extracts {id: line} from a model response, keeping only known ids with string values. */
export function parseWhyYouResponse(text: string, validIds: string[]): Record<string, string> {
  const idSet = new Set(validIds)
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return {}
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Record<string, string> = {}
    for (const [id, line] of Object.entries(parsed)) {
      if (idSet.has(id) && typeof line === 'string' && line.trim()) out[id] = line.trim()
    }
    return out
  } catch {
    return {}
  }
}

export interface GuidanceResult {
  categories: string[]
  whereToLook: string[]
}

/** Builds the prompt for general scholarship-category guidance — never specific award names. */
export function buildGuidancePrompt(school: string, program: string): string {
  return [
    `A student at "${school}" studying "${program}" wants to know what kinds of financial aid or scholarships they might be missing.`,
    '',
    'Do NOT name any specific scholarship, award, bursary, or program by name — you do not have verified data on this school\'s actual offerings, and inventing one would mislead the student.',
    'Instead, respond with general CATEGORIES of aid that typically exist at universities (e.g. entrance scholarships, departmental/faculty awards, need-based bursaries, external/provincial awards, research assistantships) and general PLACES to look (e.g. the registrar or financial aid office, the specific faculty/department website, the student union, provincial student aid programs).',
    '',
    'Respond with ONLY a JSON object of this shape, nothing else:',
    '{"categories":["...","..."],"whereToLook":["...","..."]}',
    '4-6 categories, 3-5 whereToLook items, each under 12 words.',
  ].join('\n')
}

/** Extracts {categories, whereToLook} from a model response, defaulting to empty arrays on any failure. */
export function parseGuidanceResponse(text: string): GuidanceResult {
  const empty: GuidanceResult = { categories: [], whereToLook: [] }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return empty
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (typeof parsed !== 'object' || parsed === null) return empty
    const categories = Array.isArray(parsed.categories) ? parsed.categories.filter((c: unknown) => typeof c === 'string') : []
    const whereToLook = Array.isArray(parsed.whereToLook) ? parsed.whereToLook.filter((c: unknown) => typeof c === 'string') : []
    return { categories, whereToLook }
  } catch {
    return empty
  }
}
