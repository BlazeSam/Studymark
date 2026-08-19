import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { computeMatches, computeCourseOverlap } from './lib/match.ts'
import { rankByUrgency, daysUntil, urgencyTier, formatCountdown } from './lib/resources.ts'
import type { GuidanceResult } from './lib/scholarshipAi.ts'
import { completedCourses } from './data/transcript.ts'
import { courseTitles } from './data/courseTitles.ts'
import { findSchool } from './data/schools/index.ts'
import type { School } from './data/schools/types.ts'
import './App.css'

type Lookup =
  | { kind: 'verified'; school: School; whyYou: Record<string, string>; loadingWhy: boolean }
  | { kind: 'guidance'; schoolName: string; program: string; loading: boolean; result: GuidanceResult | null; error: string | null }

const WHY_IT_MATTERS =
  'Specializations appear on your official transcript and signal focused expertise to employers — beyond the base CS degree.'

const ACCENTS = ['pear', 'cyan', 'mint'] as const
const PROGRAM = 'Computer Science'

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function courseCode(code: string) {
  return code.replace(/([A-Z]+)(\d+)/, '$1 $2')
}

function courseLabel(code: string) {
  const title = courseTitles[code]
  const display = courseCode(code)
  return title ? `${display} — ${title}` : display
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

function CourseCheck({ code, checked, onToggle }: { code: string; checked: boolean; onToggle: () => void }) {
  return (
    <li>
      <label className="check">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="check__box" aria-hidden />
        <span className="check__label">{courseLabel(code)}</span>
      </label>
    </li>
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
  const [completed, setCompleted] = useState(() => new Set(completedCourses))
  const completedRef = useRef(completed)
  completedRef.current = completed
  const matches = useMemo(() => computeMatches(completed), [completed])

  const [heroId, setHeroId] = useState<string | null>(null)
  useEffect(() => {
    if (heroId === null && matches.length > 0) setHeroId(matches[0].spec.id)
  }, [heroId, matches])

  const hero = matches.find((m) => m.spec.id === heroId) ?? matches[0]
  const rest = matches.filter((m) => m.spec.id !== hero.spec.id)
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
        const freshMatches = computeMatches(completedRef.current)
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
  }, [hero.spec.id, hero.remaining])

  const topOverlap = useMemo(() => {
    const overlap = computeCourseOverlap(completed)
    return overlap[0] && overlap[0].specs.length >= 2 ? overlap[0] : null
  }, [completed])

  const closenessRange = useMemo(() => {
    const remainings = rest.map((m) => m.remaining)
    return { min: Math.min(...remainings), max: Math.max(...remainings) }
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

  function resetToTranscript() {
    setCompleted(new Set(completedCourses))
    setHeroId(null)
  }

  const today = useMemo(() => new Date(), [])

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
                program: PROGRAM,
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

  return (
    <div className="page">
      <header className="nav">
        <span className="nav__mark">
          <span className="nav__dot" aria-hidden />
          StudyMax
        </span>
      </header>

      <main>
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
                  : `course${hero.remaining === 1 ? '' : 's'} from the ${hero.spec.name} specialization.`}
              </h1>
              <p className="hero__why">{WHY_IT_MATTERS}</p>
            </div>
          </div>
          <div className="hero__bar">
            <ProgressBar done={hero.doneCount} total={hero.totalRequired} />
          </div>
          {hero.remaining > 0 && (
            <ul className="hero__remaining">
              {hero.unsatisfied.map((g, i) => (
                <li key={i}>{g.options.map(courseLabel).join(' or ')}</li>
              ))}
            </ul>
          )}
          <button type="button" className="btn" onClick={resetToTranscript}>
            Reset to transcript
          </button>
        </section>

        {topOverlap && (
          <section className="insight">
            <p className="insight__text">
              <strong>{courseCode(topOverlap.course)}</strong> counts toward{' '}
              <strong>{topOverlap.specs.length} specializations</strong> — more than any other course you haven&rsquo;t
              taken.
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

        <section className="section">
          <h2 className="section__title">Ranked by fewest courses remaining</h2>
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
                  <div className="feed__head">
                    <span className="feed__name">{m.spec.name}</span>
                    <span className="feed__progress">
                      {m.doneCount}/{m.totalRequired}
                    </span>
                  </div>
                  <ProgressBar done={m.doneCount} total={m.totalRequired} />
                  {m.remaining > 0 && (
                    <ul className="feed__missing">
                      {m.unsatisfied.map((g, i2) => (
                        <li key={i2}>{g.options.map(courseLabel).join(' or ')}</li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        </section>

        <section className="checklist-section section section--band" data-band="cyan">
          <h2 className="section__title">Courses taken</h2>
          <p className="hint">Toggle courses to explore how the ranking changes.</p>
          <ul className="checklist">
            {notTakenCourses.map((code) => (
              <CourseCheck key={code} code={code} checked={false} onToggle={() => toggleCourse(code)} />
            ))}
          </ul>
          {takenCourses.length > 0 && (
            <details className="checklist__taken">
              <summary>
                ✓ {takenCourses.length} course{takenCourses.length === 1 ? '' : 's'} taken
              </summary>
              <ul className="checklist">
                {takenCourses.map((code) => (
                  <CourseCheck key={code} code={code} checked onToggle={() => toggleCourse(code)} />
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className="section section--band resources" data-band="mint">
          <h2 className="section__title">Hidden resources &amp; scholarships</h2>
          <p className="hint">
            The stuff your school buries a few clicks too deep. Works for any school — verified awards where we&rsquo;ve
            mapped it, AI-guided categories everywhere else.
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
                      {lookup.loadingWhy && <p className="resource-card__why-you resource-card__why-you--loading">Personalizing…</p>}
                      {why && <p className="resource-card__why-you">{why}</p>}
                    </li>
                  )
                })}
              </ol>
            ))}

          {lookup?.kind === 'guidance' && (
            <div className="guidance-card">
              <p className="guidance-card__label">
                {lookup.schoolName} isn&rsquo;t in our verified list yet — here&rsquo;s AI-guided direction, not specific
                named awards.
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
      </main>

      <footer className="footer">
        <p className="footer__statement">Built for one student, one transcript, one plan.</p>
        <p className="footer__meta">StudyMax</p>
      </footer>
    </div>
  )
}

export default App
