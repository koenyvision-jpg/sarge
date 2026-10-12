import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseReps, compileSession, estimateSteps, startWorkout, advance, catchUp, pace,
  overrunSec, pause, resume, dropLastSet, shortenRests, buildWorkoutRecord, findPRs,
  extendStep, goBack, endEarly,
} from './engine.js'
import { buildSamplePlan } from './samplePlan.js'
import { addDays, startOfWeek } from './dates.js'

const session = {
  id: 's1', date: '2026-10-12', name: 'Test', transitionSec: 60,
  blocks: [
    { id: 'a', type: 'single', exercises: [{ exerciseId: 'back-squat', sets: 3, reps: 5, restSec: 120, load: 100 }] },
    { id: 'b', type: 'superset', rounds: 2, restBetweenSec: 15, restSec: 60, exercises: [
      { exerciseId: 'db-row', reps: 10 }, { exerciseId: 'push-up', reps: 12 },
    ] },
    { id: 'c', type: 'hold', items: [{ exerciseId: 'couch-stretch', holdSec: 30, sides: true }] },
  ],
}

test('parseReps takes the upper bound', () => {
  assert.equal(parseReps(5), 5)
  assert.equal(parseReps('8-10'), 10)
  assert.equal(parseReps('AMRAP'), 12)
})

test('compileSession produces sets, rests and transitions in order', () => {
  const kinds = compileSession(session).map(s => s.kind)
  assert.deepEqual(kinds, [
    'set', 'rest', 'set', 'rest', 'set',                 // squat 3 sets
    'transition', 'set', 'rest', 'set', 'rest', 'set', 'rest', 'set', // superset 2 rounds
    'transition', 'timed', 'rest', 'timed',              // hold L/R
  ])
})

test('estimate adds expected set time, rests and transitions', () => {
  const steps = compileSession(session)
  // squat sets: 3 × max(25, 5*4+15=35) = 105, rests 240
  // superset sets: 2×(55 + 63) = 236, switches 2×15, round rest 60, transitions 120
  // holds 60 + switch 10
  assert.equal(estimateSteps(steps), 105 + 240 + 236 + 30 + 60 + 120 + 70)
})

test('rest auto-advances via catchUp; sets wait for Done', () => {
  const t0 = 1_000_000
  let w = startWorkout({ session, now: t0, environment: 'gym' })
  w = advance(w, t0 + 30_000, { reps: 5, load: 100 })
  assert.equal(w.steps[w.index].kind, 'rest')
  w = catchUp(w, t0 + 30_000 + 119_000)
  assert.equal(w.steps[w.index].kind, 'rest', 'rest not over yet')
  w = catchUp(w, t0 + 30_000 + 121_000)
  assert.equal(w.steps[w.index].kind, 'set')
  assert.equal(w.stepStartedAt, t0 + 150_000, 'next set starts when rest ended, not when caught up')
  w = catchUp(w, t0 + 999_000)
  assert.equal(w.steps[w.index].kind, 'set', 'catchUp never skips a set')
})

test('overrun counts time past the expected set duration', () => {
  const t0 = 0
  const w = startWorkout({ session, now: t0, environment: 'gym' })
  assert.equal(overrunSec(w, 30_000), 0)
  assert.equal(overrunSec(w, 50_000), 15)
})

test('pace reports behind when over-resting and pause does not count', () => {
  const t0 = 0
  let w = startWorkout({ session, now: t0, environment: 'gym' })
  w = advance(w, 35_000, { reps: 5, load: 100 }) // on time
  assert.ok(Math.abs(pace(w, 35_000).behindSec) < 0.01)
  w = pause(w, 40_000)
  w = resume(w, 340_000) // 5 min paused
  assert.ok(Math.abs(pace(w, 340_000).behindSec) < 0.01, 'paused time is excluded')
  w = extendStep(w, 30)
  w = catchUp(w, 340_000 + 150_000 - 5_000 + 1_000) // rest 120 + 30 extra
  assert.equal(w.steps[w.index].kind, 'set')
  assert.ok(pace(w, w.stepStartedAt).behindSec >= 29, 'extended rest puts you behind')
})

test('shortenRests and dropLastSet reduce remaining time', () => {
  let w = startWorkout({ session, now: 0, environment: 'gym' })
  const before = pace(w, 0).remainingSec
  w = shortenRests(w)
  const shorter = pace(w, 0).remainingSec
  assert.ok(shorter < before)
  const n = w.steps.length
  w = dropLastSet(w)
  assert.equal(w.steps.length, n - 2, 'removes the set and the rest before it')
  assert.equal(w.adjustments.at(-1).type, 'drop-set')
})

test('goBack returns to the previous set and clears its result', () => {
  let w = startWorkout({ session, now: 0, environment: 'gym' })
  w = advance(w, 10_000, { reps: 5, load: 100 })
  w = goBack(w, 20_000)
  assert.equal(w.index, 0)
  assert.equal(w.results[w.steps[0].id], undefined)
})

test('workout record groups sets per block and detects PRs', () => {
  let w = startWorkout({ session, now: 0, environment: 'gym' })
  let t = 0
  while (!w.finishedAt) {
    const step = w.steps[w.index]
    t += 40_000
    w = step.kind === 'set' ? advance(w, t, { reps: 5, load: 110 }) : advance(w, t, {})
  }
  const rec = buildWorkoutRecord(w, { sessionRpe: 8 })
  const squat = rec.blocks.find(b => b.blockId === 'a').exercises[0]
  assert.equal(squat.sets.length, 3)
  assert.equal(rec.blocks.find(b => b.blockId === 'c').timed.length, 2)

  const old = { ...rec, id: 'old', blocks: [{ blockId: 'a', exercises: [{ exerciseId: 'back-squat', sets: [{ reps: 5, load: 100 }] }] }] }
  const prs = findPRs(rec, [old])
  assert.deepEqual(prs.map(p => p.exerciseId), ['back-squat'])
  assert.deepEqual(findPRs(rec, []), [], 'first-ever lift is not a PR')
})

test('endEarly finishes the workout', () => {
  let w = startWorkout({ session, now: 0, environment: 'gym' })
  w = endEarly(w, 5000)
  assert.ok(w.finishedAt)
  assert.equal(w.endedEarly, true)
})

test('sample plan covers 4 weeks starting Monday, and every block compiles', () => {
  const plan = buildSamplePlan('2026-10-15')
  assert.equal(plan.startDate, startOfWeek('2026-10-15'))
  assert.equal(plan.endDate, addDays(plan.startDate, 27))
  assert.equal(plan.sessions.length, 24)
  for (const s of plan.sessions) {
    const sec = estimateSteps(compileSession(s))
    assert.ok(sec > 15 * 60 && sec < 100 * 60, `${s.name} estimate ${sec}s`)
  }
})
