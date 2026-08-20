import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import { computeMatches, computeCourseOverlap, type SpecializationMatch } from './lib/match.ts'
import { rankByUrgency, daysUntil, urgencyTier, formatCountdown } from './lib/resources.ts'
import type { GuidanceResult } from './lib/scholarshipAi.ts'
import type { Specialization } from './data/specializations.ts'
import { findSchool } from './data/schools/index.ts'
import { usask } from './data/schools/usask.ts'
import type { School } from './data/schools/types.ts'
import { computerScience } from './data/programs/computerScience.ts'
import type { Program } from './data/programs/types.ts'
import { buildCallScript, type CallContext } from './lib/callScript.ts'
import { buildPlan, upcomingTerm } from './lib/plan.ts'
import { computeCredentials } from './lib/credentials.ts'
import { courseInfo } from './data/prereqs.ts'
import './App.css'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type Lookup =
  | { kind: 'verified'; school: School; whyYou: Record<string, string>; loadingWhy: boolean }
  | { kind: 'guidance'; schoolName: string; program: string; loading: boolean; result: GuidanceResult | null; error: string | null }

type UniversityChoice = '' | 'usask' | 'other'

const WHY_IT_MATTERS: Record<TargetKind, string> = {
  specialization:
    'Specializations appear on your official transcript and signal focused expertise to employers — beyond the base CS degree.',
  certificate:
    'A certificate is a separate credential with its own line on your transcript — earned alongside your degree, not instead of part of it.',
  minor:
    'A minor is a separate credential with its own line on your transcript — earned alongside your degree, not instead of part of it.',
}

type TargetKind = 'specialization' | 'certificate' | 'minor'

const ACCENTS = ['pear', 'cyan', 'mint'] as const

// Selected when the student picks "Other university" — no course-matching data exists for it,
// so it routes straight to the AI-guidance fallback in the resources section.
const OTHER_PROGRAM: Program = { id: 'other', name: 'your program', specializations: [], courseTitles: {} }

// Safe fallback so hero/resources/call never crash when there's no program data yet — never rendered
// as the actual reveal (hero/insight/feed are gated off in that case), only keeps other sections safe.
const EMPTY_SPEC: Specialization = { id: 'none', name: 'your program', requirements: [] }
const EMPTY_MATCH: SpecializationMatch = { spec: EMPTY_SPEC, totalRequired: 0, doneCount: 0, remaining: 0, unsatisfied: [] }

const SAVE_KEY = 'studymax:v1'

interface SavedState {
  universityId: UniversityChoice
  programId: string
  completed: string[]
  revealed: boolean
}

// Intake selections survive a refresh so a half-finished session isn't lost. The phone number is
// deliberately excluded — it never touches storage.
function loadSaved(): Partial<SavedState> {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function courseCode(code: string) {
  return code.replace(/([A-Z]+)(\d+)/, '$1 $2')
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="bar" role="img" aria-label={`${done} of ${total} courses done`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`bar__seg ${i < done ? 'bar__seg--done' : 'bar__seg--gap'}`} />
      ))}
    </div>
  )
}

function CourseCheck({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <li>
      <label className="check">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="check__box" aria-hidden />
        <span className="check__label">{label}</span>
      </label>
    </li>
  )
}

function OptionList({ options, label }: { options: string[]; label: (code: string) => string }) {
  // Some slots offer a dozen interchangeable courses. Showing all of them buries the ones that
  // matter, so name a few and let the student open the rest.
  const SHOWN = 3
  if (options.length <= SHOWN) return <>{options.map(label).join(' or ')}</>
  return (
    <>
      {options.slice(0, SHOWN).map(label).join(' or ')}{' '}
      <details className="options-more">
        <summary>or {options.length - SHOWN} other options</summary>
        <ul>
          {options.slice(SHOWN).map((code) => (
            <li key={code}>{label(code)}</li>
          ))}
        </ul>
      </details>
    </>
  )
}

function useTickUp(target: number) {
  const [value, setValue] = useState(target)
  const prev = useRef(target)

  useEffect(() => {
    const from = prev.current
    prev.current = target
    if (from === target) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setValue(target)
      return
    }

    const duration = 500
    const start = performance.now()
    let frame: number

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return value
}

function App() {
  // --- intake: university → program → courses → phone ---
  const saved = useRef(loadSaved()).current
  const [universityId, setUniversityId] = useState<UniversityChoice>(saved.universityId ?? '')
  const [programId, setProgramId] = useState(saved.programId ?? '')
  const [revealed, setRevealed] = useState(saved.revealed ?? false)

  const selectedSchool = universityId === 'usask' ? usask : null
  const availablePrograms = selectedSchool?.programs ?? []
  const selectedProgram: Program | null =
    universityId === 'usask'
      ? (availablePrograms.find((p) => p.id === programId) ?? null)
      : universityId === 'other'
        ? OTHER_PROGRAM
        : null

  function courseLabel(code: string) {
    // Prerequisites can pull in courses from outside the program's own title map — fall back to the
    // scraped catalogue so they don't render as a bare code.
    const title = selectedProgram?.courseTitles[code] ?? courseInfo[code]?.title
    const display = courseCode(code)
    return title ? `${display} — ${title}` : display
  }

  const [completed, setCompleted] = useState<Set<string>>(() => new Set(saved.completed ?? []))
  const completedRef = useRef(completed)
  completedRef.current = completed

  useEffect(() => {
    const state: SavedState = { universityId, programId, completed: [...completed], revealed }
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    } catch {
      // storage full or blocked (private mode) — the app works fine without persistence
    }
  }, [universityId, programId, completed, revealed])
  const matches = useMemo(
    () => computeMatches(selectedProgram?.specializations ?? [], completed),
    [selectedProgram, completed],
  )

  const [heroId, setHeroId] = useState<string | null>(null)
  useEffect(() => {
    if (heroId === null && matches.length > 0) setHeroId(matches[0].spec.id)
  }, [heroId, matches])

  // Certificates and minors the student is partway through without having declared them. Ranked
  // and planned by the same engine as the specializations — they are just requirement lists.
  const credentials = useMemo(
    () => computeCredentials(selectedSchool?.programs ?? [], completed, selectedProgram?.id),
    [selectedSchool, completed, selectedProgram],
  )

  // Everything a planned course could advance: the program's specializations plus the credentials.
  const planningSpecs = useMemo(
    () => [...(selectedProgram?.specializations ?? []), ...credentials.map((c) => c.spec)],
    [selectedProgram, credentials],
  )

  const hero =
    matches.find((m) => m.spec.id === heroId) ??
    credentials.find((c) => c.spec.id === heroId) ??
    matches[0] ??
    EMPTY_MATCH
  const rest = matches.filter((m) => m.spec.id !== hero.spec.id)
  // A credential target ('certificate' / 'minor') reads differently from a specialization, and the
  // hero copy has to follow. computeCredentials only ever returns those two kinds.
  const heroCredentialKind = credentials.find((c) => c.spec.id === hero.spec.id)?.program.kind
  const heroKind: TargetKind =
    heroCredentialKind === 'certificate' || heroCredentialKind === 'minor' ? heroCredentialKind : 'specialization'
  const tickValue = useTickUp(hero.remaining)

  const [burst, setBurst] = useState(false)
  const prevRemaining = useRef<number | null>(null)
  useEffect(() => {
    if (prevRemaining.current !== null && prevRemaining.current > 0 && hero.remaining === 0) {
      const doneHeroId = hero.spec.id
      setBurst(true)
      const burstId = setTimeout(() => setBurst(false), 420)
      // hold the celebratory "done" state, then promote the next-closest specialization —
      // recomputed fresh from live data in case the student kept toggling during the hold.
      const promoteId = setTimeout(() => {
        const freshMatches = computeMatches(selectedProgram?.specializations ?? [], completedRef.current)
        const next = freshMatches
          .filter((m) => m.spec.id !== doneHeroId && m.remaining > 0)
          .sort((a, b) => a.remaining - b.remaining || a.spec.name.localeCompare(b.spec.name))[0]
        if (next) setHeroId(next.spec.id)
      }, 1800)
      return () => {
        clearTimeout(burstId)
        clearTimeout(promoteId)
      }
    }
    prevRemaining.current = hero.remaining
  }, [hero.spec.id, hero.remaining, selectedProgram])

  const topOverlap = useMemo(() => {
    const overlap = computeCourseOverlap(selectedProgram?.specializations ?? [], completed)
    return overlap[0] && overlap[0].specs.length >= 2 ? overlap[0] : null
  }, [selectedProgram, completed])

  const closenessRange = useMemo(() => {
    const remainings = rest.map((m) => m.remaining)
    return remainings.length > 0 ? { min: Math.min(...remainings), max: Math.max(...remainings) } : { min: 0, max: 0 }
  }, [rest])

  const allRequirementCourses = useMemo(() => {
    const codes = new Set<string>()
    for (const m of matches) {
      for (const g of m.spec.requirements) for (const c of g.courses) codes.add(c)
    }
    return [...codes].sort()
  }, [matches])

  const [notTakenCourses, takenCourses] = useMemo(() => {
    const notTaken: string[] = []
    const taken: string[] = []
    for (const code of allRequirementCourses) (completed.has(code) ? taken : notTaken).push(code)
    return [notTaken, taken]
  }, [allRequirementCourses, completed])

  function toggleCourse(code: string) {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function handleUniversityChange(id: string) {
    setUniversityId(id as UniversityChoice)
    setProgramId('')
    setCompleted(new Set())
    setHeroId(null)
    setUploadStatus('idle')
  }

  function handleProgramChange(id: string) {
    setProgramId(id)
    setCompleted(new Set())
    setHeroId(null)
    setUploadStatus('idle')
  }

  function loadSampleStudent() {
    setUniversityId('usask')
    setProgramId(computerScience.id)
    setCompleted(new Set(computerScience.sampleTranscript ?? []))
    setHeroId(null)
    setUploadStatus('idle')
    setRevealed(true)
  }

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleTranscriptUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-uploading the same filename later
    if (!file || !selectedProgram) return

    setUploadStatus('uploading')
    setUploadError(null)
    try {
      const pdfBase64 = await fileToBase64(file)
      const knownCourseCodes = Object.keys(selectedProgram.courseTitles)
      const res = await fetch('/api/parse-transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pdfBase64, knownCourseCodes }),
      })
      if (!res.ok) throw new Error('parse failed')
      const data = await res.json()
      const codes: string[] = data.completedCourses ?? []
      if (codes.length === 0) throw new Error('nothing found')
      setCompleted(new Set(codes))
      setHeroId(null)
      setUploadStatus('success')
    } catch {
      setUploadStatus('error')
      setUploadError("Couldn't read that file automatically — enter your courses manually below instead.")
    }
  }

  const today = useMemo(() => new Date(), [])

  // --- term-by-term path to the closest specialization ---
  const [coursesPerTerm, setCoursesPerTerm] = useState(2)
  const plan = useMemo(
    () =>
      hero.remaining > 0
        ? buildPlan(hero, planningSpecs, completed, coursesPerTerm, upcomingTerm(today))
        : [],
    [hero, planningSpecs, completed, coursesPerTerm, today],
  )
  const [planCopied, setPlanCopied] = useState(false)

  const hiddenPrereqs = useMemo(
    () => plan.flatMap((t) => t.courses).filter((c) => c.reason === 'prerequisite'),
    [plan],
  )

  async function copyPlan() {
    const lines = [
      `StudyMax plan — ${hero.spec.name} (${selectedProgram?.name ?? ''})`,
      `${hero.remaining} required course${hero.remaining === 1 ? '' : 's'} outstanding` +
        (hiddenPrereqs.length > 0
          ? `, plus ${hiddenPrereqs.length} prerequisite${hiddenPrereqs.length === 1 ? '' : 's'} not listed on the specialization page`
          : '') +
        `. ${coursesPerTerm} per term.`,
      '',
      ...plan.flatMap((term) => [
        `${term.label}:`,
        ...term.courses.map((c) => {
          const notes = [
            c.reason === 'prerequisite' ? `prerequisite for ${courseCode(c.neededBy ?? '')}` : null,
            c.alsoAdvances.length > 0 ? `also counts toward: ${c.alsoAdvances.join(', ')}` : null,
          ].filter(Boolean)
          return `  - ${courseLabel(c.code)}${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`
        }),
      ]),
      '',
      'Prerequisites and sequencing from catalogue.usask.ca. Confirm course offerings by term with an advisor.',
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setPlanCopied(true)
    setTimeout(() => setPlanCopied(false), 2000)
  }

  const otherCloseSpecializations = useMemo(
    () =>
      rest
        .filter((m) => m.remaining > 0 && m.remaining <= 2)
        .slice(0, 3)
        .map((m) => ({ name: m.spec.name, remaining: m.remaining })),
    [rest],
  )

  const [schoolQuery, setSchoolQuery] = useState('University of Saskatchewan')
  const [programQuery, setProgramQuery] = useState('')
  const [lookup, setLookup] = useState<Lookup | null>(null)

  async function handleFindResources(e: FormEvent) {
    e.preventDefault()
    const matched = findSchool(schoolQuery)

    if (matched) {
      const hasResources = matched.resources.length > 0
      setLookup({ kind: 'verified', school: matched, whyYou: {}, loadingWhy: hasResources })
      if (hasResources) {
        try {
          const res = await fetch('/api/why-you', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              context: {
                school: matched.name,
                program: selectedProgram?.name ?? 'their program',
                closestSpecialization: hero.spec.name,
                coursesRemaining: hero.remaining,
                topOverlapCourse: topOverlap?.course,
                otherCloseSpecializations,
              },
              resources: matched.resources.map((r) => ({ id: r.id, name: r.name, whatItIs: r.whatItIs })),
            }),
          })
          const data = res.ok ? await res.json() : { whyYou: {} }
          setLookup((prev) => (prev?.kind === 'verified' ? { ...prev, whyYou: data.whyYou ?? {}, loadingWhy: false } : prev))
        } catch {
          setLookup((prev) => (prev?.kind === 'verified' ? { ...prev, loadingWhy: false } : prev))
        }
      }
      return
    }

    setLookup({ kind: 'guidance', schoolName: schoolQuery, program: programQuery, loading: true, result: null, error: null })
    try {
      const res = await fetch('/api/scholarship-guidance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ school: schoolQuery, program: programQuery }),
      })
      if (!res.ok) throw new Error('guidance request failed')
      const result: GuidanceResult = await res.json()
      setLookup({ kind: 'guidance', schoolName: schoolQuery, program: programQuery, loading: false, result, error: null })
    } catch {
      setLookup({
        kind: 'guidance',
        schoolName: schoolQuery,
        program: programQuery,
        loading: false,
        result: null,
        error: "Couldn't reach the guidance service — try again in a moment.",
      })
    }
  }

  // --- additive: one-way scripted phone reminder (does not read or affect lookup/resources state) ---
  const topAward = useMemo(() => rankByUrgency(usask.resources)[0], [])
  const topAwardDeadlineText = useMemo(() => {
    if (!topAward) return undefined
    const days = daysUntil(topAward, today)
    return days !== null ? formatCountdown(days) : topAward.deadline
  }, [topAward, today])
  const callContext: CallContext = useMemo(
    () => ({
      specializationName: hero.spec.name,
      coursesRemaining: hero.remaining,
      awardName: topAward?.name,
      awardDeadlineText: topAwardDeadlineText,
    }),
    [hero, topAward, topAwardDeadlineText],
  )
  const callFallbackScript = useMemo(() => buildCallScript(callContext), [callContext])

  const [phone, setPhone] = useState('')
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'success' | 'error'>('idle')

  async function handleCallMe(e: FormEvent) {
    e.preventDefault()
    setCallStatus('calling')
    try {
      const res = await fetch('/api/call-me', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, context: callContext }),
      })
      if (!res.ok) throw new Error('call failed')
      setCallStatus('success')
    } catch {
      setCallStatus('error')
    }
  }

  const hasProgramData = (selectedProgram?.specializations.length ?? 0) > 0

  return (
    <div className="page">
      <header className="nav">
        <span className="nav__mark">
          <span className="nav__dot" aria-hidden />
          StudyMax
        </span>
      </header>

      <main>
        <section className="section section--band intake" data-band="pear">
          <h2 className="section__title">Tell us about you</h2>
          <p className="hint">Blank by default — or skip straight to an instant demo.</p>
          <button type="button" className="btn intake__sample" onClick={loadSampleStudent}>
            ⚡ Load sample student (USask CS)
          </button>

          <div className="step">
            <span className="step__badge" aria-hidden>
              1
            </span>
            <div className="step__body">
              <label className="step__label" htmlFor="intake-university">
                University
              </label>
              <select
                id="intake-university"
                className="resources__input"
                value={universityId}
                onChange={(e) => handleUniversityChange(e.target.value)}
              >
                <option value="">Select your university</option>
                <option value="usask">University of Saskatchewan</option>
                <option value="other">Other university</option>
              </select>
            </div>
          </div>

          {universityId === 'usask' && (
            <div className="step">
              <span className="step__badge" aria-hidden>
                2
              </span>
              <div className="step__body">
                <label className="step__label" htmlFor="intake-program">
                  Program
                </label>
                <select
                  id="intake-program"
                  className="resources__input"
                  value={programId}
                  onChange={(e) => handleProgramChange(e.target.value)}
                >
                  <option value="">Select your program</option>
                  {availablePrograms.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.specializations.length === 0}>
                      {p.name}
                      {p.specializations.length === 0 ? ' (coming soon)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {universityId === 'other' && (
            <p className="hint">
              We don&rsquo;t have course-matching data for this school yet — you can still get AI-guided scholarship
              direction after revealing.
            </p>
          )}
        </section>

        <section className="checklist-section section section--band intake" data-band="lavender">
          <div className="step">
            <span className="step__badge" aria-hidden>
              3
            </span>
            <div className="step__body">
              <label className="step__label">Courses taken</label>
              {!selectedProgram ? (
                <p className="hint">Pick your university and program above to see its course list.</p>
              ) : !hasProgramData ? (
                <p className="hint">No course data yet for {selectedProgram.name} — check back soon.</p>
              ) : (
                <>
                  <label htmlFor="transcript-upload" className="upload-dropzone">
                    <input
                      id="transcript-upload"
                      type="file"
                      accept="application/pdf"
                      className="upload-dropzone__input"
                      onChange={handleTranscriptUpload}
                    />
                    <span className="upload-dropzone__icon" aria-hidden>
                      📄
                    </span>
                    <span className="upload-dropzone__title">Upload your transcript and we&rsquo;ll read it for you</span>
                    <span className="upload-dropzone__hint">PDF — DegreeWorks audit or unofficial transcript</span>
                  </label>
                  {uploadStatus === 'uploading' && <p className="hint">Reading your transcript…</p>}
                  {uploadStatus === 'success' && (
                    <p className="upload-status upload-status--success">
                      ✓ Found {completed.size} completed course{completed.size === 1 ? '' : 's'} — review below.
                    </p>
                  )}
                  {uploadStatus === 'error' && <p className="upload-status upload-status--error">{uploadError}</p>}

                  <details className="intake__manual" open={uploadStatus === 'success' || uploadStatus === 'error'}>
                    <summary>{takenCourses.length > 0 ? 'Review or edit detected courses' : 'Or enter manually'}</summary>
                    <p className="hint">Toggle courses to explore how the ranking changes.</p>
                    <ul className="checklist">
                      {notTakenCourses.map((code) => (
                        <CourseCheck
                          key={code}
                          label={courseLabel(code)}
                          checked={false}
                          onToggle={() => toggleCourse(code)}
                        />
                      ))}
                    </ul>
                    {takenCourses.length > 0 && (
                      <details className="checklist__taken">
                        <summary>
                          ✓ {takenCourses.length} course{takenCourses.length === 1 ? '' : 's'} taken
                        </summary>
                        <ul className="checklist">
                          {takenCourses.map((code) => (
                            <CourseCheck key={code} label={courseLabel(code)} checked onToggle={() => toggleCourse(code)} />
                          ))}
                        </ul>
                      </details>
                    )}
                  </details>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="section section--band intake" data-band="cyan">
          <div className="step">
            <span className="step__badge" aria-hidden>
              4
            </span>
            <div className="step__body">
              <label className="step__label" htmlFor="intake-phone">
                Phone number <span className="intake__optional">(optional, for call reminders)</span>
              </label>
              <input
                id="intake-phone"
                type="tel"
                className="resources__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 555 5555"
              />
            </div>
          </div>
          <button type="button" className="btn intake__reveal" disabled={!selectedProgram} onClick={() => setRevealed(true)}>
            Reveal what my school hides
          </button>
        </section>

        {revealed && selectedProgram && (
          <>
            {hasProgramData ? (
              <>
                <section className="hero section section--band" data-band="pear">
                  <div className="hero__statement">
                    <div className="hero__figure tnum" style={{ position: 'relative' }}>
                      {tickValue}
                      {burst && <span className="star-burst" aria-hidden />}
                    </div>
                    <div className="hero__statement-text">
                      <h1 className="hero__headline">
                        {hero.remaining === 0
                          ? `${hero.spec.name} — done. It'll show on your transcript.`
                          : `course${hero.remaining === 1 ? '' : 's'} from ${heroKind === 'specialization' ? `the ${hero.spec.name} specialization` : hero.spec.name}.`}
                      </h1>
                      <p className="hero__why">{WHY_IT_MATTERS[heroKind]}</p>
                    </div>
                  </div>
                  <div className="hero__bar">
                    <ProgressBar done={hero.doneCount} total={hero.totalRequired} />
                  </div>
                  {hero.remaining > 0 && (
                    <ul className="hero__remaining">
                      {hero.unsatisfied.map((g, i) => (
                        <li key={i}><OptionList options={g.options} label={courseLabel} /></li>
                      ))}
                    </ul>
                  )}
                </section>

                {topOverlap && (
                  <section className="insight">
                    <p className="insight__text">
                      <strong>{courseCode(topOverlap.course)}</strong> counts toward{' '}
                      <strong>{topOverlap.specs.length} specializations</strong> — more than any other course you
                      haven&rsquo;t taken.
                    </p>
                    <div className="chips">
                      {topOverlap.specs.map((s) => (
                        <span key={s.id} className="chip">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {plan.length > 0 && (
                  <section className="section section--band plan" data-band="lavender">
                    <div className="plan__head">
                      <h2 className="section__title">Your path to {hero.spec.name}</h2>
                      <label className="plan__control">
                        <span>Courses per term</span>
                        <select
                          className="resources__input"
                          value={coursesPerTerm}
                          onChange={(e) => setCoursesPerTerm(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="hint">
                      Finishes in {plan.length} term{plan.length === 1 ? '' : 's'} — by{' '}
                      <strong>{plan[plan.length - 1].label}</strong>. Where a requirement let you choose, we picked the
                      option that also counts toward the most other credentials.
                    </p>
                    {hiddenPrereqs.length > 0 && (
                      <p className="plan__hidden-cost">
                        <strong>
                          {hiddenPrereqs.length} course{hiddenPrereqs.length === 1 ? '' : 's'} below{' '}
                          {hiddenPrereqs.length === 1 ? 'is' : 'are'} not on the specialization page
                        </strong>{' '}
                        — {hiddenPrereqs.length === 1 ? "it's a prerequisite" : "they're prerequisites"} you need before
                        you&rsquo;re allowed to register for the ones that are. That&rsquo;s the real cost.
                      </p>
                    )}

                    <ol className="plan__terms">
                      {plan.map((term, i) => (
                        <li key={term.label} className={`plan__term plan__term--${ACCENTS[i % ACCENTS.length]}`}>
                          <p className="plan__term-label">{term.label}</p>
                          <ul className="plan__courses">
                            {term.courses.map((c) => (
                              <li key={c.code} className={`plan__course plan__course--${c.reason}`}>
                                <span className="plan__course-name">{courseLabel(c.code)}</span>
                                {c.reason === 'prerequisite' && (
                                  <span className="plan__prereq">
                                    Prerequisite for {courseCode(c.neededBy ?? '')}
                                    {c.prerequisiteText && (
                                      <em className="plan__prereq-rule">
                                        {courseCode(c.neededBy ?? '')} requires: {c.prerequisiteText}
                                      </em>
                                    )}
                                  </span>
                                )}
                                {c.alsoAdvances.length > 0 && (
                                  <span className="plan__double-dip">
                                    Also counts toward: {c.alsoAdvances.join(', ')}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>

                    <div className="plan__actions">
                      <button type="button" className="btn" onClick={copyPlan}>
                        {planCopied ? '✓ Copied' : 'Copy plan for my advisor'}
                      </button>
                    </div>
                    <p className="plan__caveat">
                      Prerequisites come from catalogue.usask.ca verbatim; nothing here is inferred. What we
                      can&rsquo;t know is which terms a course is actually offered in — confirm that with your advisor
                      before you register.
                    </p>
                  </section>
                )}

                {credentials.length > 0 && (
                  <section className="section section--band credentials" data-band="mint">
                    <h2 className="section__title">Certificates and minors you&rsquo;re already partway through</h2>
                    <p className="hint">
                      Separate credentials from your degree, each with their own line on your transcript. Your major
                      already covers part of them — this is how much is left.
                    </p>
                    <ol className="credentials__list">
                      {credentials.map((c) => (
                        <li key={c.spec.id} className="credential-card">
                          <div className="credential-card__head">
                            <div>
                              <span className="credential-card__kind">
                                {c.program.kind === 'minor' ? 'Minor' : 'Certificate'}
                              </span>
                              <h3 className="credential-card__name">{c.program.name}</h3>
                            </div>
                            <span className="credential-card__count tnum">
                              {c.remaining === 0 ? 'Done' : `${c.remaining} left`}
                            </span>
                          </div>
                          <ProgressBar done={c.doneCount} total={c.totalRequired} />
                          <p className="credential-card__progress">
                            {c.doneCount} of {c.totalRequired} required courses already taken
                          </p>
                          {c.remaining > 0 && (
                            <>
                              <ul className="credential-card__missing">
                                {c.unsatisfied.map((g, i) => (
                                  <li key={i}><OptionList options={g.options} label={courseLabel} /></li>
                                ))}
                              </ul>
                              <button type="button" className="btn btn--quiet" onClick={() => setHeroId(c.spec.id)}>
                                Plan this one →
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ol>
                    <p className="plan__caveat">
                      Requirements are the catalogue&rsquo;s, but eligibility isn&rsquo;t: USask notes that
                      &ldquo;registration in most senior CMPT courses will be restricted to students in the
                      Department&rsquo;s programs.&rdquo; Confirm you can declare a credential before planning around
                      it.
                    </p>
                  </section>
                )}

                <section className="section">
                  <h2 className="section__title">Ranked by fewest courses remaining</h2>
                  <p className="hint">Pick any one to make it your target — the plan above rebuilds for it.</p>
                  <ol className="feed">
                    {rest.map((m, i) => {
                      const { min, max } = closenessRange
                      const closeness = max === min ? 0.5 : 1 - (m.remaining - min) / (max - min)
                      return (
                        <li
                          key={m.spec.id}
                          className={`feed__row feed__row--${ACCENTS[i % ACCENTS.length]}`}
                          style={{ '--closeness': closeness } as CSSProperties}
                        >
                          <button type="button" className="feed__target" onClick={() => setHeroId(m.spec.id)}>
                            <span className="feed__head">
                              <span className="feed__name">{m.spec.name}</span>
                              <span className="feed__progress">
                                {m.doneCount}/{m.totalRequired}
                              </span>
                            </span>
                            <ProgressBar done={m.doneCount} total={m.totalRequired} />
                            <span className="feed__cta">Plan this one →</span>
                          </button>
                          {m.remaining > 0 && (
                            <ul className="feed__missing">
                              {m.unsatisfied.map((g, i2) => (
                                <li key={i2}><OptionList options={g.options} label={courseLabel} /></li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </section>
              </>
            ) : (
              <section className="section">
                <p className="hint">
                  No course-matching data yet for {selectedProgram.name} — but you can still look up scholarship
                  guidance below.
                </p>
              </section>
            )}

            <section className="section section--band resources" data-band="mint">
              <h2 className="section__title">Hidden resources &amp; scholarships</h2>
              <p className="hint">
                The stuff your school buries a few clicks too deep. Works for any school — verified awards where
                we&rsquo;ve mapped it, AI-guided categories everywhere else.
              </p>
              <p className="resources__today">Today: {formatDate(today)}</p>
              <form className="resources__lookup" onSubmit={handleFindResources}>
                <input
                  className="resources__input"
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                  placeholder="Your school"
                  aria-label="Your school"
                />
                <input
                  className="resources__input"
                  value={programQuery}
                  onChange={(e) => setProgramQuery(e.target.value)}
                  placeholder="Your program (optional)"
                  aria-label="Your program"
                />
                <button type="submit" className="btn">
                  Find resources
                </button>
              </form>

              {lookup?.kind === 'verified' &&
                (lookup.school.resources.length === 0 ? (
                  <p className="resources__empty">
                    Waiting on the verified source list for {lookup.school.name} — nothing invented here.
                  </p>
                ) : (
                  <ol className="resources__list">
                    {rankByUrgency(lookup.school.resources).map((r) => {
                      const days = daysUntil(r, today)
                      const tier = urgencyTier(days)
                      const countdown = formatCountdown(days)
                      const why = lookup.whyYou[r.id]
                      return (
                        <li key={r.id} className={`resource-card resource-card--${tier}`}>
                          <p className="resource-card__countdown">{days !== null ? countdown : r.deadline}</p>
                          <h3 className="resource-card__name">{r.name}</h3>
                          {r.value && <p className="resource-card__value">{r.value}</p>}
                          <p className="resource-card__what">{r.whatItIs}</p>
                          <p className="resource-card__why">{r.whyRelevant}</p>
                          {lookup.loadingWhy && (
                            <p className="resource-card__why-you resource-card__why-you--loading">Personalizing…</p>
                          )}
                          {why && <p className="resource-card__why-you">{why}</p>}
                        </li>
                      )
                    })}
                  </ol>
                ))}

              {lookup?.kind === 'guidance' && (
                <div className="guidance-card">
                  <p className="guidance-card__label">
                    {lookup.schoolName} isn&rsquo;t in our verified list yet — here&rsquo;s AI-guided direction, not
                    specific named awards.
                  </p>
                  {lookup.loading && <p className="hint">Asking…</p>}
                  {lookup.error && <p className="resources__empty">{lookup.error}</p>}
                  {lookup.result && (
                    <>
                      <div className="chips">
                        {lookup.result.categories.map((c) => (
                          <span key={c} className="chip">
                            {c}
                          </span>
                        ))}
                      </div>
                      <ul className="guidance-card__where">
                        {lookup.result.whereToLook.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>

            {hasProgramData && (
              <section className="section call">
                <h2 className="section__title">Get a call about this</h2>
                <p className="hint">
                  One scripted call about your #1 specialization{topAward ? ' and your most urgent award' : ''} — no
                  conversation, just the reminder, then it hangs up.
                </p>
                <form className="call__form" onSubmit={handleCallMe}>
                  <input
                    type="tel"
                    className="call__input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555 555 5555"
                    aria-label="Your phone number"
                    required
                  />
                  <button type="submit" className="btn" disabled={callStatus === 'calling'}>
                    📞 Call me about this
                  </button>
                </form>
                {callStatus === 'calling' && <p className="hint">Calling…</p>}
                {callStatus === 'success' && <p className="call__success">Call placed — it should ring shortly.</p>}
                {callStatus === 'error' && (
                  <p className="call__fallback">
                    Call couldn&rsquo;t connect — here&rsquo;s your reminder on screen instead: &ldquo;
                    {callFallbackScript}&rdquo;
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p className="footer__statement">Built for one student, one transcript, one plan.</p>
        <p className="footer__meta">StudyMax</p>
      </footer>
    </div>
  )
}

export default App
