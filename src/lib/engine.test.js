import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseReps, compileSession, estimateSteps, startWorkout, advance, catchUp, pace,
  overrunSec, pause, resume, dropLastSet, shortenRests, buildWorkoutRecord, findPRs,
  extendStep, goBack, endEarly, adjustStep, restartStep, skipStep, stepElapsedSec, currentStepDuration,
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

test('timer controls: ±seconds, restart and skip', () => {
  let w = startWorkout({ session, now: 0, environment: 'gym' })
  w = advance(w, 30_000, { reps: 5, load: 100 }) // now resting
  assert.equal(w.steps[w.index].kind, 'rest')
  const base = currentStepDuration(w)
  w = adjustStep(w, 40_000, 10)
  w = adjustStep(w, 40_000, -5)
  assert.equal(currentStepDuration(w), base + 5)
  // Taking off more than is left ends the rest, never goes negative.
  w = adjustStep(w, 40_000, -9999)
  assert.equal(currentStepDuration(w) - stepElapsedSec(w, 40_000), 0)
  assert.equal(catchUp(w, 40_000).steps[catchUp(w, 40_000).index].kind, 'set', 'rest ends and the next set starts')
  // Restart wipes the adjustment and starts the clock again.
  w = restartStep(w, 50_000)
  assert.equal(stepElapsedSec(w, 50_000), 0)
  assert.equal(currentStepDuration(w), base)
  // Skipping a set records it for the coach and logs no reps.
  w = skipStep(w, 50_000) // skip the rest: not logged as a skip
  assert.equal(w.adjustments.filter(a => a.type === 'skip').length, 0)
  const set = w.steps[w.index]
  w = skipStep(w, 60_000)
  assert.deepEqual(w.adjustments.at(-1), { type: 'skip', at: 'during', exerciseId: set.exerciseId, kind: 'set', setNo: set.setNo })
  assert.equal(w.results[set.id].skipped, true)
})

test('controls while paused keep the clock frozen and resume cleanly', () => {
  let w = startWorkout({ session, now: 0, environment: 'gym' })
  w = advance(w, 30_000, { reps: 5, load: 100 })
  w = pause(w, 40_000)
  w = restartStep(w, 100_000)
  assert.equal(stepElapsedSec(w, 100_000), 0)
  w = resume(w, 200_000)
  assert.equal(stepElapsedSec(w, 205_000), 5, 'counts from the resume, not from the tap')
  w = pause(w, 210_000)
  w = goBack(w, 300_000)
  w = resume(w, 400_000)
  assert.equal(w.index, 0)
  assert.equal(stepElapsedSec(w, 401_000), 1)
})

test('skips read well in the summary', async () => {
  const { describeAdjustment } = await import('./adjust.js')
  assert.equal(describeAdjustment({ type: 'skip', kind: 'set', exerciseId: 'back-squat', setNo: 3 }), 'Skipped set 3 of Back squat')
  assert.equal(describeAdjustment({ type: 'skip', kind: 'timed', exerciseId: 'side-plank', setNo: 2, side: 'Left' }), 'Skipped Side plank (left side), round 2')
})

test('perSide: each set is left, switch, right — in single, superset and circuit blocks', async () => {
  const { compileSession, startWorkout, advance, buildWorkoutRecord, summarizeSets, dropLastSet, estimateSessionSec } = await import('./engine.js')
  const single = { id: 's', name: 'x', transitionSec: 0, blocks: [
    { id: 'b1', type: 'single', exercises: [{ exerciseId: 'kb-suitcase-march', sets: 2, reps: 10, load: 16, restSec: 60, perSide: true }] },
  ] }
  const steps = compileSession(single)
  assert.deepEqual(steps.map(s => s.kind + (s.side ? ':' + s.side : '') + ':' + (s.setNo ?? '')),
    ['set:Left:1', 'rest:', 'set:Right:1', 'rest:', 'set:Left:2', 'rest:', 'set:Right:2'])
  assert.equal(steps[1].durationSec, 10, 'default switch is 10 s')
  assert.equal(steps[1].label, 'Switch sides')
  const plain = { ...single, blocks: [{ ...single.blocks[0], exercises: [{ ...single.blocks[0].exercises[0], perSide: false }] }] }
  assert.ok(estimateSessionSec(single) > estimateSessionSec(plain) * 1.5, 'both sides are timed')

  const sup = compileSession({ id: 't', name: 'y', transitionSec: 0, blocks: [{ id: 'b2', type: 'superset', rounds: 2, restBetweenSec: 15, restSec: 60,
    exercises: [{ exerciseId: 'kb-suitcase-march', reps: 8, perSide: true, switchSec: 5 }, { exerciseId: 'push-up', reps: 10 }] }] })
  assert.deepEqual(sup.filter(s => s.kind === 'set' && s.setNo === 1).map(s => s.exerciseId + (s.side ? ':' + s.side : '')),
    ['kb-suitcase-march:Left', 'kb-suitcase-march:Right', 'push-up'])
  assert.equal(sup[1].durationSec, 5, 'switchSec')
  const circ = compileSession({ id: 'c', name: 'z', transitionSec: 0, blocks: [{ id: 'b3', type: 'circuit', rounds: 1,
    exercises: [{ exerciseId: 'kb-suitcase-march', reps: 8, perSide: true }] }] })
  assert.deepEqual(circ.filter(s => s.kind === 'set').map(s => s.side), ['Left', 'Right'])

  // Logs both sides.
  let w = startWorkout({ session: single, environment: 'home', now: 0 })
  for (let t = 1; w.index < w.steps.length; t++) {
    const st = w.steps[w.index]
    w = advance(w, t * 1000, st.kind === 'set' ? { reps: st.side === 'Left' ? 10 : 9, load: 16, actualSec: 30 } : { actualSec: 10 })
  }
  const sets = buildWorkoutRecord(w).blocks[0].exercises[0].sets
  assert.deepEqual(sets.map(s => [s.side, s.reps]), [['Left', 10], ['Right', 9], ['Left', 10], ['Right', 9]])
  assert.equal(summarizeSets(sets), 'L 2×10 @ 16 kg · R 2×9 @ 16 kg')
  assert.equal(summarizeSets(sets.map(s => ({ ...s, reps: 10 }))), '2×10 @ 16 kg each side')

  // Dropping the last set drops both sides.
  const fresh = startWorkout({ session: single, environment: 'home', now: 0 })
  const dropped = dropLastSet(fresh)
  assert.deepEqual(dropped.steps.map(s => s.kind + (s.side ? ':' + s.side : '')), ['set:Left', 'rest', 'set:Right'])
})

test('sided exercises run per side unless the plan says perSide: false', async () => {
  const { compileSession } = await import('./engine.js')
  const sess = perSide => ({ id: 's', name: 'x', transitionSec: 0, blocks: [{ id: 'b', type: 'single',
    exercises: [{ exerciseId: 'kb-squat-rotation-uppercut', sets: 1, reps: 10, ...(perSide === undefined ? {} : { perSide }) }] }] })
  assert.deepEqual(compileSession(sess()).filter(s => s.kind === 'set').map(s => s.side), ['Left', 'Right'])
  assert.deepEqual(compileSession(sess(false)).filter(s => s.kind === 'set').map(s => s.side), [undefined])
})
