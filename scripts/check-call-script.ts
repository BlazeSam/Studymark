// Sanity check for buildCallScript/buildCallTask. Run: node --experimental-strip-types scripts/check-call-script.ts
import assert from 'node:assert/strict'
import { buildCallScript, buildCallTask } from '../src/lib/callScript.ts'

const withAward = buildCallScript({
  specializationName: 'Social Computing',
  coursesRemaining: 1,
  awardName: 'RCAF Foundation Student Scholarships',
  awardDeadlineText: 'Closes in 6 days',
})
assert.ok(withAward.includes('1 course away from the Social Computing specialization'), 'singular course wording')
assert.ok(withAward.includes('RCAF Foundation Student Scholarships'), 'includes award name')
assert.ok(withAward.includes('closes in 6 days'), 'award deadline lowercased mid-sentence')
assert.ok(withAward.includes('on your StudyMax screen'), 'points the student at the on-screen link')
assert.ok(withAward.toLowerCase().includes('no need to answer'), 'tells the student up front it is one-way')
assert.ok(
  withAward.startsWith('Hello. I am StudyMax, your personal academic advisor.'),
  'opens by introducing itself, in the calm register the delivery notes ask for',
)

const plural = buildCallScript({ specializationName: 'Algorithmics', coursesRemaining: 3 })
assert.ok(plural.includes('3 courses away from the Algorithmics specialization'), 'plural course wording')
assert.ok(!plural.includes('on your StudyMax screen'), 'no link line when there is no award to link to')

const done = buildCallScript({ specializationName: 'Social Computing', coursesRemaining: 0 })
assert.ok(done.includes("You've completed the Social Computing specialization"), 'done state gets its own line, not "0 courses away"')

const task = buildCallTask('Hi, this is a test.')
assert.ok(task.includes('Hi, this is a test.'), 'task embeds the exact script')
assert.ok(task.toLowerCase().includes('do not have a conversation'), 'task forbids conversation')
assert.ok(task.toLowerCase().includes('do not ask'), 'task forbids questions')
assert.ok(task.toLowerCase().includes('end the call'), 'task instructs hanging up')
assert.ok(task.toLowerCase().includes('softly'), 'task carries the soft delivery note')
assert.ok(task.toLowerCase().includes('never sound urgent'), 'task rules out an urgent register')

console.log('check-call-script.ts: all assertions passed')
