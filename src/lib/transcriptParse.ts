/** Builds the prompt for extracting completed courses from an uploaded transcript/degree-audit PDF. */
export function buildTranscriptParsePrompt(knownCourseCodes: string[]): string {
  return [
    'This document is a student transcript or degree-audit (e.g. DegreeWorks) PDF.',
    'Identify every course the student has COMPLETED AND PASSED — not in-progress, not planned, not failed or withdrawn.',
    '',
    'Only include a course if its code matches one of these exactly (case-insensitive, ignore spaces): ' +
      knownCourseCodes.join(', '),
    '',
    'Respond with ONLY a JSON array of the matching codes, uppercase subject + number with no space, nothing else.',
    'Example: ["CMPT145","MATH110"]',
    'If nothing matches, respond with an empty array: []',
  ].join('\n')
}

/**
 * Extracts completed-course codes from a model response, normalizing and keeping only codes
 * that are actually in the known list — a hard guard against inventing a code the model made up.
 */
export function parseTranscriptResponse(text: string, knownCourseCodes: string[]): string[] {
  const knownSet = new Set(knownCourseCodes)
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return []
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    const out = new Set<string>()
    for (const item of parsed) {
      if (typeof item !== 'string') continue
      const normalized = item.toUpperCase().replace(/\s+/g, '')
      if (knownSet.has(normalized)) out.add(normalized)
    }
    return [...out]
  } catch {
    return []
  }
}
