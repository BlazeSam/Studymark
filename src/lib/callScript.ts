export interface CallContext {
  specializationName: string
  coursesRemaining: number
  awardName?: string
  awardDeadlineText?: string
}

/** The exact words the call will say — short, one-way, grounded only in real given facts. */
export function buildCallScript(ctx: CallContext): string {
  const specLine =
    ctx.coursesRemaining === 0
      ? `You've completed the ${ctx.specializationName} specialization.`
      : `You're ${ctx.coursesRemaining} course${ctx.coursesRemaining === 1 ? '' : 's'} away from the ${ctx.specializationName} specialization.`

  // The call can't carry a URL, so it points at the link StudyMax already put on the screen.
  const awardLine = ctx.awardName
    ? ` One more thing: the ${ctx.awardName}${ctx.awardDeadlineText ? `, ${ctx.awardDeadlineText.toLowerCase()}` : ''}.` +
      ' The link is on your StudyMax screen — open it before the deadline.'
    : ''

  return `Hi, this is your StudyMax reminder. No need to answer — I'm hanging up in a moment. ${specLine}${awardLine} That's it — good luck.`
}

/** Wraps the script in explicit one-way, no-conversation instructions for the call provider. */
export function buildCallTask(script: string): string {
  return [
    'You are placing a one-way informational phone call. Do not have a conversation and do not ask the person any questions.',
    `As soon as the call connects, say exactly this, once: "${script}"`,
    'Immediately after saying it, say a brief goodbye and end the call. Do not wait for or react to anything the person says.',
  ].join(' ')
}
