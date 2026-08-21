export interface TranscriptParseResult {
  completed: string[]
  inProgress: string[]
}

/**
 * Builds the prompt for extracting a student's full course history from an uploaded
 * transcript/degree-audit PDF. Extraction is program-agnostic on purpose — it captures every
 * course on the document, in every subject. Matching those courses against a specific
 * specialization's requirements happens later, separately, and never filters what gets extracted.
 */
export function buildTranscriptParsePrompt(): string {
  return [
    'This document is a student transcript or degree-audit (e.g. DegreeWorks) PDF from a Canadian university.',
    '',
    'Extract EVERY course that appears anywhere on this document, in every subject — do not filter by ' +
      'department or program. If it lists MATH, ECON, PHYS, PSY, ENG, ASTR, LING, PHIL, CMPT, STAT courses, ' +
      'or any other subject, capture all of them.',
    '',
    'Classify each course into exactly one of two buckets:',
    '- "completed": the student finished the course with a passing grade. Excludes failed, withdrawn, or ' +
      'excluded/superseded attempts.',
    '- "inProgress": the course is currently in progress, registered, or planned but not yet graded — often ' +
      'listed under a separate heading like "Courses in Progress" or "In Progress".',
    '',
    'If a course code appears more than once, handle it by what actually happened:',
    '- Failed or withdrawn, then later passed (a retake after failing): list it once under "completed" only.',
    '- Already passed once, and now being taken again (e.g. to improve the grade): list it under "completed" ' +
      '(the earlier pass still counts) AND under "inProgress" if that newer attempt is still ungraded.',
    '- Every attempt failed or was withdrawn with no pass on record: omit it entirely.',
    'Never list the same code twice within the same bucket.',
    '',
    'Respond with ONLY a JSON object of this exact shape, nothing else:',
    '{"completed":["CODE123","CODE456"],"inProgress":["CODE789"]}',
    'Course codes: uppercase subject letters directly followed by the number, no space, no period, no credit-' +
      'unit suffix. Example: "MATH 110.3" becomes "MATH110".',
    'If a bucket is empty, use an empty array for it — never omit a bucket.',
  ].join('\n')
}

function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '').replace(/\.\d+$/, '')
}

/**
 * Extracts {completed, inProgress} from a model response. Every returned code is validated
 * against `catalogueCodes` — pass the FULL course catalogue, not one program's course list, so
 * extraction never gets narrowed to a single subject. A hard guard against inventing a code the
 * model made up, without limiting what can legitimately be found.
 *
 * A code can legitimately appear in BOTH buckets — already passed once, currently being retaken
 * for a better grade — so this never forces exclusivity between them; only the prompt's own
 * instructions decide that.
 */
export function parseTranscriptResponse(text: string, catalogueCodes: string[]): TranscriptParseResult {
  const empty: TranscriptParseResult = { completed: [], inProgress: [] }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return empty

  const catalogueSet = new Set(catalogueCodes)

  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    if (typeof parsed !== 'object' || parsed === null) return empty

    const normalizeList = (list: unknown): string[] => {
      if (!Array.isArray(list)) return []
      const out = new Set<string>()
      for (const item of list) {
        if (typeof item !== 'string') continue
        const code = normalizeCode(item)
        if (catalogueSet.has(code)) out.add(code)
      }
      return [...out]
    }

    return { completed: normalizeList(parsed.completed), inProgress: normalizeList(parsed.inProgress) }
  } catch {
    return empty
  }
}
