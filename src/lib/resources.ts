import type { Resource } from '../data/schools/types.ts'

/** Ranks resources by nearest deadline first. Rolling/ongoing (no deadlineDate) sort last. */
export function rankByUrgency(resources: Resource[]): Resource[] {
  return [...resources].sort((a, b) => {
    if (!a.deadlineDate && !b.deadlineDate) return a.name.localeCompare(b.name)
    if (!a.deadlineDate) return 1
    if (!b.deadlineDate) return -1
    return a.deadlineDate.localeCompare(b.deadlineDate)
  })
}

/** Days from `today` until the resource's deadline. null for rolling/ongoing or past deadlines. */
export function daysUntil(resource: Resource, today: Date = new Date()): number | null {
  if (!resource.deadlineDate) return null
  const deadline = new Date(resource.deadlineDate + 'T23:59:59')
  const diffMs = deadline.getTime() - today.getTime()
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return days >= 0 ? days : null
}

export type UrgencyTier = 'urgent' | 'soon' | 'distant' | 'none'

/** Urgent ≤14 days, soon ≤60 days, distant beyond that, none when there's no countable deadline. */
export function urgencyTier(days: number | null): UrgencyTier {
  if (days === null) return 'none'
  if (days <= 14) return 'urgent'
  if (days <= 60) return 'soon'
  return 'distant'
}

/** "Closes today" / "Closes tomorrow" / "Closes in N days" — null input yields ''. */
export function formatCountdown(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return 'Closes today'
  if (days === 1) return 'Closes tomorrow'
  return `Closes in ${days} days`
}
